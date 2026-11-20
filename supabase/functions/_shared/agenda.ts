import { createClient } from "npm:@supabase/supabase-js@2";
import { type Cfg, type Ocupado, epoch, proximosDias, slotsDoDia } from "./slots.ts";
import { freeBusy, criarEvento, avisarDono } from "./google.ts";

export const sb = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

// ── HTTP ───────────────────────────────────────────────
const ORIGENS = [
  "https://micaeltatuagem.com.br",
  "https://www.micaeltatuagem.com.br",
  "https://micaeltatuagem.github.io",
];
export function cors(req: Request) {
  const o = req.headers.get("origin") ?? "";
  const ok = ORIGENS.includes(o) || /^http:\/\/localhost(:\d+)?$/.test(o);
  return {
    "Access-Control-Allow-Origin": ok ? o : ORIGENS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
export const resp = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

// ── Config / dados ─────────────────────────────────────
export async function carregarConfig(c: ReturnType<typeof sb>): Promise<Cfg> {
  const { data, error } = await c.from("agenda_config").select("*").eq("id", 1).single();
  if (error || !data) throw new Error("agenda_config ausente");
  return { ...data, sinal_valor: Number(data.sinal_valor) } as Cfg;
}
export async function carregarFeriados(c: ReturnType<typeof sb>): Promise<Set<string>> {
  const { data } = await c.from("feriados").select("data");
  return new Set((data ?? []).map((r: { data: string }) => r.data));
}
export async function expirarPendentes(c: ReturnType<typeof sb>) {
  await c.from("agendamentos").update({ status: "expirado" })
    .eq("status", "pendente").lt("expira_em", new Date().toISOString());
}
async function ocupadosDoBanco(c: ReturnType<typeof sb>, from: number, to: number): Promise<Ocupado[]> {
  const { data } = await c.from("agendamentos").select("inicio,fim")
    .in("status", ["pendente", "confirmado"])
    .lt("inicio", new Date(to).toISOString()).gt("fim", new Date(from).toISOString());
  return (data ?? []).map((r: { inicio: string; fim: string }) => ({ start: Date.parse(r.inicio), end: Date.parse(r.fim) }));
}

/** Datas → horários de início livres, para uma duração. */
export async function disponibilidade(c: ReturnType<typeof sb>, duracaoH: number, agora = Date.now()) {
  const cfg = await carregarConfig(c);
  const feriados = await carregarFeriados(c);
  await expirarPendentes(c);
  const dias = proximosDias(agora, cfg.dias_a_frente);
  const from = epoch(dias[0], 0) - 24 * 3600000; // margem para eventos que cruzam a meia-noite
  const to = epoch(dias[dias.length - 1], 24 * 60);
  const calIds = (Deno.env.get("GOOGLE_CALENDAR_IDS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!calIds.length) throw new Error("GOOGLE_CALENDAR_IDS vazio");
  const [g, db] = await Promise.all([freeBusy(calIds, from, to), ocupadosDoBanco(c, from, to)]);
  const ocupados = [...g, ...db];
  const out: Record<string, string[]> = {};
  for (const d of dias) {
    const s = slotsDoDia({ dateStr: d, duracaoH, cfg, feriados, ocupados, agora });
    if (s.length) out[d] = s;
  }
  return { cfg, dias: out };
}

// ── Evento no Google Agenda (idempotente) ──────────────
export async function garantirEvento(c: ReturnType<typeof sb>, ag: Record<string, any>) {
  if (ag.gcal_event_id || ag.status !== "confirmado") return;
  const calId = Deno.env.get("GOOGLE_TATTOO_CALENDAR_ID");
  if (!calId) return;
  try {
    const id = await criarEvento(calId, {
      id: ag.id,
      titulo: `Tatuagem — ${ag.nome} (${ag.duracao_horas}h) · sinal pago`,
      descricao: `WhatsApp: ${ag.whatsapp}\nE-mail: ${ag.email}\nSinal: R$ ${Number(ag.sinal_valor).toFixed(2)} (abate do valor final)\nAgendamento: ${ag.id}`,
      inicioISO: new Date(ag.inicio).toISOString(),
      fimISO: new Date(ag.fim).toISOString(),
    });
    await c.from("agendamentos").update({ gcal_event_id: id }).eq("id", ag.id);
  } catch (e) {
    console.error("garantirEvento falhou (o horário continua bloqueado pelo banco):", e);
  }
}

// ── Avisos para o dono (e-mail) ────────────────────────
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
const horaFim = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const linkZap = (tel: string) => { const d = String(tel).replace(/\D/g, ""); return `https://wa.me/${d.length <= 11 ? "55" + d : d}`; };
const detalhes = (ag: Record<string, any>) => [
  `Cliente: ${ag.nome}`,
  `WhatsApp: ${ag.whatsapp} → ${linkZap(ag.whatsapp)}`,
  `E-mail: ${ag.email}`,
  `Quando: ${quando(ag.inicio)} até ${horaFim(ag.fim)} (${ag.duracao_horas}h)`,
  `Sinal: R$ ${Number(ag.sinal_valor).toFixed(2).replace(".", ",")} (abate do valor final)`,
  `Agendamento: ${ag.id}`,
].join("\n");

/** Reserva confirmada (sinal pago). Nunca derruba o fluxo se o e-mail falhar. */
export async function avisarReserva(ag: Record<string, any>) {
  try {
    await avisarDono(
      `Nova reserva: ${ag.nome} — ${quando(ag.inicio)}`,
      `Nova reserva confirmada, sinal pago.\nO evento já está na agenda Tatuagem.\n\n${detalhes(ag)}\n`,
    );
  } catch (e) { console.error("avisarReserva falhou:", e); }
}

/** Raro: pagou, mas o horário já tinha sido ocupado → precisa reembolsar. */
export async function avisarPagoSemVaga(ag: Record<string, any>) {
  try {
    await avisarDono(
      `⚠ PAGO SEM VAGA — reembolsar: ${ag.nome}`,
      `O cliente pagou o sinal, mas o horário já estava ocupado. REEMBOLSE no Mercado Pago e avise o cliente.\n\n${detalhes(ag)}\nPagamento MP: ${ag.mp_payment_id ?? "?"}\n`,
    );
  } catch (e) { console.error("avisarPagoSemVaga falhou:", e); }
}
