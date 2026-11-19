-- Agendamento com sinal via PIX (Mercado Pago) + Google Agenda
-- Acesso SOMENTE via Edge Functions (service_role). RLS ligada e sem policies = anon não lê nem escreve.

create table if not exists public.agenda_config (
  id                 int primary key default 1 check (id = 1),
  sinal_valor        numeric(8,2) not null default 50,   -- R$ (abatido do valor final)
  intervalo_min      int not null default 30,            -- limpeza/montagem entre sessões
  hold_min           int not null default 30,            -- tempo para pagar o PIX (mínimo do Mercado Pago = 30)
  antecedencia_horas int not null default 24,            -- antecedência mínima para agendar
  dias_a_frente      int not null default 60,
  passo_min          int not null default 30,            -- de quanto em quanto tempo oferecer início
  semana_abre        text not null default '18:00',      -- seg–sex
  semana_fecha       text not null default '22:00',
  fds_abre           text not null default '10:00',      -- sáb, dom e feriados
  fds_fecha          text not null default '20:00',
  atualizado_em      timestamptz not null default now()
);
insert into public.agenda_config (id) values (1) on conflict do nothing;

create table if not exists public.feriados (
  data date primary key,
  nome text not null
);
-- Feriados nacionais. ADICIONE os municipais de Muriaé: insert into feriados values ('AAAA-MM-DD','Nome');
insert into public.feriados (data, nome) values
  ('2026-11-20','Consciência Negra'),
  ('2026-12-25','Natal'),
  ('2027-01-01','Confraternização Universal'),
  ('2027-03-26','Sexta-feira Santa'),
  ('2027-04-21','Tiradentes'),
  ('2027-05-01','Dia do Trabalho'),
  ('2027-09-07','Independência'),
  ('2027-10-12','Nossa Senhora Aparecida'),
  ('2027-11-02','Finados'),
  ('2027-11-15','Proclamação da República'),
  ('2027-11-20','Consciência Negra'),
  ('2027-12-25','Natal')
on conflict do nothing;

create table if not exists public.agendamentos (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  whatsapp           text not null,
  email              text not null,
  duracao_horas      int  not null check (duracao_horas in (2,4)),
  inicio             timestamptz not null,
  fim                timestamptz not null,
  bloqueio           tstzrange   not null,               -- [inicio, fim + intervalo)
  status             text not null default 'pendente'
                     check (status in ('pendente','confirmado','expirado','cancelado','remarcado','pago_sem_vaga')),
  sinal_valor        numeric(8,2) not null,
  mp_payment_id      text,
  expira_em          timestamptz not null,
  gcal_event_id      text,
  maior_18_aceito    boolean not null default false,
  politica_aceita_em timestamptz,
  criado_em          timestamptz not null default now(),
  confirmado_em      timestamptz,
  -- impede dois agendamentos ativos no mesmo horário, mesmo com cliques simultâneos
  constraint agendamentos_sem_sobreposicao
    exclude using gist (bloqueio with &&) where (status in ('pendente','confirmado'))
);
create index if not exists agendamentos_status_inicio on public.agendamentos (status, inicio);
create index if not exists agendamentos_whatsapp_status on public.agendamentos (whatsapp, status);

alter table public.agenda_config enable row level security;
alter table public.feriados      enable row level security;
alter table public.agendamentos  enable row level security;
