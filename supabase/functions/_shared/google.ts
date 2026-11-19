// Google Agenda via Google Apps Script (web app que roda COMO VOCÊ).
// Não usa chave de conta de serviço (muitas organizações bloqueiam a criação de chaves).
import type { Ocupado } from "./slots.ts";

async function chamarScript(payload: Record<string, unknown>) {
  const url = Deno.env.get("GOOGLE_SCRIPT_URL");
  const segredo = Deno.env.get("GOOGLE_SCRIPT_SECRET");
  if (!url || !segredo) throw new Error("GOOGLE_SCRIPT_URL / GOOGLE_SCRIPT_SECRET ausentes");
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, segredo }),
    redirect: "follow", // o Apps Script responde com um redirecionamento
  });
  const txt = await r.text();
  let j: any;
  try { j = JSON.parse(txt); } catch { throw new Error("Apps Script devolveu resposta inválida: " + txt.slice(0, 200)); }
  if (!r.ok || j.erro) throw new Error("Apps Script: " + (j.erro ?? r.status));
  return j;
}

let busyCache: { key: string; at: number; val: Ocupado[] } | null = null;

/** Intervalos OCUPADOS (sem títulos nem detalhes) de todas as agendas listadas. Falha fechada. */
export async function freeBusy(calIds: string[], from: number, to: number): Promise<Ocupado[]> {
  const key = `${calIds.join(",")}|${Math.floor(from / 60000)}|${Math.floor(to / 60000)}`;
  if (busyCache && busyCache.key === key && Date.now() - busyCache.at < 30_000) return busyCache.val;
  const j = await chamarScript({
    op: "freebusy", ids: calIds,
    timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(),
  });
  const out: Ocupado[] = [];
  for (const id of calIds) {
    const c = j.calendars?.[id];
    if (!c || c.errors?.length) throw new Error(`Agenda inacessível (${id}): ` + JSON.stringify(c?.errors ?? "sem resposta"));
    for (const b of c.busy ?? []) out.push({ start: Date.parse(b.start), end: Date.parse(b.end) });
  }
  busyCache = { key, at: Date.now(), val: out };
  return out;
}

/** Cria o evento na agenda "Tatuagem". O id do evento = id do agendamento (sem hífens) → idempotente. */
export async function criarEvento(calId: string, ev: {
  id: string; titulo: string; descricao: string; inicioISO: string; fimISO: string;
}): Promise<string> {
  const eventId = ev.id.replaceAll("-", "");
  const j = await chamarScript({
    op: "criar", calId, id: eventId, titulo: ev.titulo, descricao: ev.descricao,
    inicioISO: ev.inicioISO, fimISO: ev.fimISO,
  });
  return j.id ?? eventId;
}
