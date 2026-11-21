import { sb, resp, cors, disponibilidade } from "../_shared/agenda.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  try {
    const { cfg, dias } = await disponibilidade(sb()); // a duração é decidida pelo servidor, nunca pelo navegador
    return resp(req, { sinal: cfg.sinal_valor, duracao: cfg.duracao_horas, intervalo_min: cfg.intervalo_min, dias });
  } catch (e) {
    console.error(e);
    return resp(req, { erro: "indisponivel" }, 503); // falha fechada: sem horários em vez de horários errados
  }
});
