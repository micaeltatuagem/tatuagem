// Webhook do Mercado Pago. Deploy com:  supabase functions deploy agenda-webhook --no-verify-jwt
// A confirmação NUNCA vem do navegador: aqui consultamos o pagamento direto na API do Mercado Pago.
import { sb, garantirEvento } from "../_shared/agenda.ts";

async function hmacHex(secret: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(s)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const dataId = String(url.searchParams.get("data.id") ?? body?.data?.id ?? "");
  const tipo = String(url.searchParams.get("type") ?? body?.type ?? "");
  if (tipo !== "payment" || !dataId) return new Response("ignorado");

  // Assinatura (x-signature: ts=...,v1=...) — manifesto: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
  const segredo = Deno.env.get("MP_WEBHOOK_SECRET");
  if (segredo) {
    const sig = req.headers.get("x-signature") ?? "";
    const ts = /ts=([^,]+)/.exec(sig)?.[1] ?? "";
    const v1 = /v1=([^,]+)/.exec(sig)?.[1] ?? "";
    const reqId = req.headers.get("x-request-id") ?? "";
    const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
    const esperado = await hmacHex(segredo, `id:${id};request-id:${reqId};ts:${ts};`);
    if (!ts || !v1 || esperado !== v1) return new Response("assinatura inválida", { status: 401 });
  }

  // Fonte da verdade: a API do Mercado Pago
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
    headers: { Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}` },
  });
  if (!r.ok) { console.error("MP consulta falhou", r.status); return new Response("erro MP", { status: 502 }); } // MP tenta de novo
  const pg = await r.json();
  const agId = String(pg.external_reference ?? "");
  if (!/^[0-9a-f-]{36}$/.test(agId)) return new Response("sem referência");

  const c = sb();
  const { data: ag } = await c.from("agendamentos").select("*").eq("id", agId).maybeSingle();
  if (!ag) return new Response("agendamento desconhecido");

  if (pg.status !== "approved") {
    if (["cancelled", "expired", "rejected"].includes(pg.status) && ag.status === "pendente") {
      await c.from("agendamentos").update({ status: "expirado" }).eq("id", agId); // libera o horário
    }
    return new Response("ok");
  }
  if (ag.status === "confirmado") { await garantirEvento(c, ag); return new Response("ok"); }
  if (Number(pg.transaction_amount) < Number(ag.sinal_valor)) {
    console.error("valor menor que o sinal", agId, pg.transaction_amount);
    return new Response("valor incorreto");
  }

  const { data: conf, error } = await c.from("agendamentos")
    .update({ status: "confirmado", confirmado_em: new Date().toISOString(), mp_payment_id: String(pg.id) })
    .eq("id", agId).in("status", ["pendente", "expirado"]).select().maybeSingle();

  if (error) {
    // 23P01: o horário foi ocupado por outra pessoa antes do pagamento cair → exige reembolso manual
    if (error.code === "23P01") {
      await c.from("agendamentos").update({ status: "pago_sem_vaga", mp_payment_id: String(pg.id) }).eq("id", agId);
      console.error("PAGO SEM VAGA — reembolsar no Mercado Pago:", agId, pg.id);
      return new Response("ok");
    }
    console.error(error);
    return new Response("erro", { status: 500 });
  }
  if (conf) await garantirEvento(c, conf);
  return new Response("ok");
});
