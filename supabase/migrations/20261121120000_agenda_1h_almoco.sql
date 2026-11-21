-- Reserva de 1 hora (o tamanho da sessão é visto depois) + pausa de almoço em sáb/dom/feriado
alter table public.agenda_config
  add column if not exists duracao_horas    int  not null default 1,
  add column if not exists fds_almoco_abre  text default '12:00',   -- deixe vazio (null) para não ter pausa
  add column if not exists fds_almoco_fecha text default '13:00';

-- a duração da reserva deixa de ser só 2 ou 4
alter table public.agendamentos drop constraint if exists agendamentos_duracao_horas_check;
alter table public.agendamentos add constraint agendamentos_duracao_horas_check check (duracao_horas between 1 and 8);

-- horários cheios, sem intervalo entre reservas de 1 hora; antecedência mínima de 9 dias; agenda aberta por 60 dias
update public.agenda_config
   set duracao_horas = 1, passo_min = 60, intervalo_min = 0,
       antecedencia_horas = 216, dias_a_frente = 60, atualizado_em = now()
 where id = 1;
