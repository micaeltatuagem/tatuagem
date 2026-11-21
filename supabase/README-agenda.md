# Agendamento com sinal (PIX / Mercado Pago + Google Agenda)

Página: `/agendar` (`agendar.html`). Backend: 4 Edge Functions + 3 tabelas no Supabase + 1 Google Apps Script.
Projeto Supabase: `rpgcsejfewltricfsdrd`.

## Como funciona
1. `agenda-slots` — devolve os horários livres. Regras: seg–sex 18–22h; sáb, dom e feriados 10–20h;
   reserva de **1 hora** (o tamanho da sessão é visto depois, pelo WhatsApp); horários cheios, sem intervalo entre reservas; **pausa de almoço 12h–13h em sáb/dom/feriados**; mínimo de **9 dias** de antecedência (`antecedencia_horas = 216`). Bloqueia o que estiver
   **ocupado** nas agendas do Google (só lê livre/ocupado, nunca títulos) e o que já está reservado.
2. `agenda-reservar` — revalida o horário, segura por 30 min (status `pendente`) e cria o PIX de R$ 50 no Mercado Pago.
   O banco impede duas reservas no mesmo horário mesmo com cliques simultâneos.
3. `agenda-webhook` — o Mercado Pago avisa o pagamento; a função **consulta o pagamento na API do MP**
   (nunca confia no navegador), confirma a reserva e cria o evento na agenda "Tatuagem".
4. `agenda-status` — a página consulta a cada 4 s até confirmar.

Tudo configurável na tabela `agenda_config` (sinal, duração, intervalo, horários, almoço, antecedência) sem mexer em código.
Migrations: `20261119120000_agenda.sql` (base) e `20261121120000_agenda_1h_almoco.sql` (1 hora + almoço).
Feriados: tabela `feriados` (já tem os nacionais; **adicione os municipais de Muriaé**).

## Colocando no ar (uma vez)

### 1. Google (Apps Script — sem chave de conta de serviço)
Muitas organizações do Google bloqueiam a criação de chaves de conta de serviço. Em vez disso, um pequeno
script roda **como você** e o site conversa com ele.
- No Google Agenda, crie uma agenda chamada **Tatuagem** (fuso América/São Paulo).
- Em script.google.com → **Novo projeto** ("agenda-site"). Apague o código e cole `apps-script/agenda-google.gs`.
- Barra lateral → **Serviços (+) → Google Calendar API → Adicionar**.
- **Configurações do projeto (engrenagem) → Propriedades do script → Adicionar**: nome `SEGREDO`, valor = uma senha longa e aleatória (guarde-a).
- **Implantar → Nova implantação → App da Web**: *Executar como:* **Eu** · *Quem tem acesso:* **Qualquer pessoa** → Implantar.
  Autorize (aviso "app não verificado" → Avançado → continuar) e copie a **URL do app da Web** (termina em `/exec`).
- IDs das agendas (Configurações da agenda → Integrar agenda): sua agenda principal (seu e-mail), as que bloqueiam
  seu tempo e a "Tatuagem" (`...@group.calendar.google.com`).

### 2. Mercado Pago
- Suas integrações → criar aplicação → copiar o **Access Token** (produção; para o 1º teste use sinal de R$ 1, veja abaixo).
- Webhooks → URL: `https://rpgcsejfewltricfsdrd.supabase.co/functions/v1/agenda-webhook`, evento **Pagamentos**
  → copiar a **chave secreta** do webhook.

### 3. Supabase (CLI)
```bash
supabase login && supabase link --project-ref rpgcsejfewltricfsdrd
supabase db push        # aplica supabase/migrations/20261119120000_agenda.sql
supabase secrets set \
  MP_ACCESS_TOKEN="APP_USR-..." \
  MP_WEBHOOK_SECRET="..." \
  GOOGLE_SCRIPT_URL="https://script.google.com/macros/s/.../exec" \
  GOOGLE_SCRIPT_SECRET="a mesma senha da propriedade SEGREDO" \
  GOOGLE_CALENDAR_IDS="seu@gmail.com,ID_DA_AGENDA_TATUAGEM@group.calendar.google.com" \
  GOOGLE_TATTOO_CALENDAR_ID="ID_DA_AGENDA_TATUAGEM@group.calendar.google.com"
# as chaves publishable novas do Supabase não são JWT → deploy SEM verificação de JWT (as funções validam tudo sozinhas)
for f in agenda-slots agenda-reservar agenda-status agenda-webhook; do supabase functions deploy $f --no-verify-jwt; done
```
(`GOOGLE_CALENDAR_IDS` = todas as agendas que bloqueiam horário, **incluindo** a "Tatuagem".)

### 4. Teste real antes de abrir
```sql
update agenda_config set sinal_valor = 1 where id = 1;   -- teste com R$ 1
```
Reserve um horário em `/agendar`, pague com seu próprio PIX e confira: tela confirma, evento aparece na agenda "Tatuagem".
Depois volte: `update agenda_config set sinal_valor = 50 where id = 1;`

## Operação
- Cliente que já pagou todas as sessões (layaway): crie o evento direto no Google Agenda, na agenda "Tatuagem",
  marcado como **Ocupado** — o site para de oferecer aquele horário.
- Reservas ficam em `agendamentos` (status `pendente`, `confirmado`, `expirado`, `cancelado`, `remarcado`, `pago_sem_vaga`).
  `pago_sem_vaga` (raro) = pagou mas o horário já tinha sido ocupado → reembolsar no Mercado Pago.
- Remarcação com 24h de aviso: mova o evento no Google Agenda (o sinal vale para a nova data); sem aviso, o sinal é perdido.
- Tabelas com RLS ligada e sem políticas: só as Edge Functions (service role) acessam.
