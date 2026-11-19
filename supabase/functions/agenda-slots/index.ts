import { sb, resp, cors, disponibilidade } from "../_shared/agenda.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  try {
    const { duracao } = await req.json().catch(() => ({}));
    const d = Number(duracao);
    if (![2, 4].includes(d)) return resp(req, { erro: "duracao_invalida" }, 400);
    const { cfg, dias } = await disponibilidade(sb(), d);
    return resp(req, { sinal: cfg.sinal_valor, intervalo_min: cfg.intervalo_min, dias });
  } catch (e) {
    console.error(e);
    return resp(req, { erro: "indisponivel" }, 503); // falha fechada: sem horários em vez de horários errados
  }
});
