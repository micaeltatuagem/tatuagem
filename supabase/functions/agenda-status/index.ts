import { sb, resp, cors, garantirEvento, expirarPendentes } from "../_shared/agenda.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return resp(req, { erro: "id_invalido" }, 400);
  const c = sb();
  await expirarPendentes(c);
  const { data: ag } = await c.from("agendamentos").select("*").eq("id", id).maybeSingle();
  if (!ag) return resp(req, { erro: "nao_encontrado" }, 404);
  if (ag.status === "confirmado") await garantirEvento(c, ag); // autocura se o Google falhou no webhook
  return resp(req, { status: ag.status, inicio: ag.inicio, duracao_horas: ag.duracao_horas, expira_em: ag.expira_em });
});
