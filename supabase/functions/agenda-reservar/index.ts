import { sb, resp, cors, disponibilidade, expirarPendentes } from "../_shared/agenda.ts";
import { epoch, toMin } from "../_shared/slots.ts";

const soDigitos = (s: string) => s.replace(/\D/g, "");
const isoComOffset = (ms: number) => new Date(ms - 3 * 3600000).toISOString().replace("Z", "-03:00");
const bloqueioRange = (a: number, b: number) => `[${new Date(a).toISOString()},${new Date(b).toISOString()})`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const b = await req.json().catch(() => null);
  if (!b) return resp(req, { erro: "corpo_invalido" }, 400);

  // Anti-bot: campo-armadilha preenchido ou formulário enviado rápido demais → finge sucesso vazio
  if (b.hp || Number(b.tempo_ms) < 4000) return resp(req, { erro: "bloqueado" }, 429);

  const duracao = Number(b.duracao);
  const nome = String(b.nome ?? "").trim();
  const whatsapp = soDigitos(String(b.whatsapp ?? ""));
  const email = String(b.email ?? "").trim().toLowerCase();
  const data = String(b.data ?? "");
  const hora = String(b.hora ?? "");

  if (![2, 4].includes(duracao)) return resp(req, { erro: "duracao_invalida" }, 400);
  if (nome.length < 2 || nome.length > 80) return resp(req, { erro: "nome_invalido" }, 400);
  if (whatsapp.length < 10 || whatsapp.length > 13) return resp(req, { erro: "whatsapp_invalido" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return resp(req, { erro: "email_invalido" }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) return resp(req, { erro: "horario_invalido" }, 400);
  if (b.maior18 !== true || b.politica !== true) return resp(req, { erro: "aceite_obrigatorio" }, 400);

  const c = sb();
  try {
    await expirarPendentes(c);

    // Limite de reservas pendentes por WhatsApp (evita travar a agenda de propósito)
    const { count } = await c.from("agendamentos").select("id", { count: "exact", head: true })
      .eq("whatsapp", whatsapp).eq("status", "pendente");
    if ((count ?? 0) >= 2) return resp(req, { erro: "muitas_pendentes" }, 429);

    // Revalida no servidor: o horário precisa estar livre AGORA
    const { cfg, dias } = await disponibilidade(c, duracao);
    if (!dias[data]?.includes(hora)) return resp(req, { erro: "horario_indisponivel" }, 409);

    const ini = epoch(data, toMin(hora));
    const fim = ini + duracao * 3600000;
    const bloqueioFim = fim + cfg.intervalo_min * 60000;
    const expira = Date.now() + cfg.hold_min * 60000;

    const { data: ag, error } = await c.from("agendamentos").insert({
      nome, whatsapp, email, duracao_horas: duracao,
      inicio: new Date(ini).toISOString(), fim: new Date(fim).toISOString(),
      bloqueio: bloqueioRange(ini, bloqueioFim),
      sinal_valor: cfg.sinal_valor, expira_em: new Date(expira).toISOString(),
      maior_18_aceito: true, politica_aceita_em: new Date().toISOString(),
    }).select().single();
    if (error) {
      if (error.code === "23P01") return resp(req, { erro: "horario_indisponivel" }, 409); // alguém levou na frente
      throw error;
    }

    // Cobrança PIX no Mercado Pago
    const mp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": ag.id,
      },
      body: JSON.stringify({
        transaction_amount: cfg.sinal_valor,
        description: `Sinal de agendamento — Micael Tatuagem (${duracao}h)`,
        payment_method_id: "pix",
        payer: { email, first_name: nome.split(" ")[0] },
        external_reference: ag.id,
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/agenda-webhook`,
        date_of_expiration: isoComOffset(expira),
      }),
    });
    const pj = await mp.json();
    const td = pj?.point_of_interaction?.transaction_data;
    if (!mp.ok || !td?.qr_code) {
      console.error("Mercado Pago:", JSON.stringify(pj));
      await c.from("agendamentos").update({ status: "cancelado" }).eq("id", ag.id); // libera o horário
      return resp(req, { erro: "pagamento_indisponivel" }, 502);
    }
    await c.from("agendamentos").update({ mp_payment_id: String(pj.id) }).eq("id", ag.id);

    return resp(req, {
      id: ag.id, sinal: cfg.sinal_valor, expira_em: new Date(expira).toISOString(),
      inicio: ag.inicio, duracao_horas: duracao,
      pix: { copia_cola: td.qr_code, qr_base64: td.qr_code_base64 },
    });
  } catch (e) {
    console.error(e);
    return resp(req, { erro: "falha_interna" }, 500);
  }
});
