// Lógica PURA de horários (sem dependências) — testável em Node e Deno.
// Brasil não tem horário de verão desde 2019, então usamos offset fixo -03:00.

export const TZ_OFFSET = "-03:00";

export interface Cfg {
  sinal_valor: number;
  intervalo_min: number;
  hold_min: number;
  antecedencia_horas: number;
  dias_a_frente: number;
  passo_min: number;
  semana_abre: string;
  semana_fecha: string;
  fds_abre: string;
  fds_fecha: string;
  duracao_horas: number;               // duração da reserva (1 = só o horário; o tamanho da sessão é visto depois)
  fds_almoco_abre?: string | null;      // pausa de almoço em sáb/dom/feriado (vazio = sem pausa)
  fds_almoco_fecha?: string | null;
}
export interface Ocupado { start: number; end: number } // epoch ms

const pad = (n: number) => String(n).padStart(2, "0");
export const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
export const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** epoch ms de "YYYY-MM-DD" + minutos desde 00:00 no fuso -03:00 */
export function epoch(dateStr: string, min: number): number {
  const h = Math.floor(min / 60), m = min % 60;
  if (h >= 24) { // permite 24:00
    return epoch(dateStr, min - 24 * 60) + 24 * 3600000;
  }
  return Date.parse(`${dateStr}T${pad(h)}:${pad(m)}:00${TZ_OFFSET}`);
}

export function diaDaSemana(dateStr: string): number { // 0 = domingo
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Sábado, domingo ou feriado */
export function ehFolga(dateStr: string, feriados: Set<string>): boolean {
  const dow = diaDaSemana(dateStr);
  return dow === 0 || dow === 6 || feriados.has(dateStr);
}

/** Janela de atendimento do dia em minutos [abre, fecha] */
export function janela(dateStr: string, cfg: Cfg, feriados: Set<string>): [number, number] {
  const fds = ehFolga(dateStr, feriados);
  return fds ? [toMin(cfg.fds_abre), toMin(cfg.fds_fecha)] : [toMin(cfg.semana_abre), toMin(cfg.semana_fecha)];
}

/** Horários de início ("HH:MM") livres no dia para uma sessão de duracaoH horas */
export function slotsDoDia(p: {
  dateStr: string; duracaoH: number; cfg: Cfg; feriados: Set<string>; ocupados: Ocupado[]; agora: number;
}): string[] {
  const [abre, fecha] = janela(p.dateStr, p.cfg, p.feriados);
  const dur = p.duracaoH * 60;
  const buf = p.cfg.intervalo_min * 60000;
  const minStart = p.agora + p.cfg.antecedencia_horas * 3600000;
  const folga = ehFolga(p.dateStr, p.feriados);
  const almAbre = folga && p.cfg.fds_almoco_abre ? toMin(p.cfg.fds_almoco_abre) : null;
  const almFecha = folga && p.cfg.fds_almoco_fecha ? toMin(p.cfg.fds_almoco_fecha) : null;
  const out: string[] = [];
  for (let s = abre; s + dur <= fecha; s += p.cfg.passo_min) {
    // pausa de almoço: a reserva não pode encostar no intervalo [almAbre, almFecha)
    if (almAbre !== null && almFecha !== null && s < almFecha && s + dur > almAbre) continue;
    const a = epoch(p.dateStr, s), b = epoch(p.dateStr, s + dur);
    if (a < minStart) continue;
    if (p.ocupados.some((o) => a < o.end + buf && b + buf > o.start)) continue;
    out.push(hhmm(s));
  }
  return out;
}

/** Datas locais (YYYY-MM-DD), de hoje até n dias à frente */
export function proximosDias(agora: number, n: number): string[] {
  const base = new Date(agora - 3 * 3600000); // "agora" no fuso -03:00 lido como UTC
  const out: string[] = [];
  for (let i = 0; i <= n; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
