# Proxy autenticado pro admin do Provador/Flash

## 1. Instalar a ferramenta da Cloudflare (uma vez só)

```bash
npm install -g wrangler
wrangler login   # abre o navegador, você loga na sua conta Cloudflare (grátis)
```

## 2. Fazer o deploy do Worker

Dentro desta pasta (`worker-proxy/`):

```bash
wrangler deploy
```

Isso te dá uma URL tipo:
`https://tatuagem-gh-proxy.SEU-USUARIO.workers.dev`

## 3. Configurar os dois segredos (nunca ficam em arquivo, só na nuvem)

```bash
wrangler secret put GITHUB_TOKEN
# cola aqui o fine-grained token do GitHub (Contents: read/write, só no repo tatuagem)

wrangler secret put ADMIN_PASSWORD
# cria uma senha só sua, pra usar no painel admin (troque quando quiser, sem redeploy)
```

## 4. Atualizar o adminflash.html

No arquivo `adminflash.html`, é uma troca mecânica:

**Antes**, todo lugar que tem:
```js
const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${IMAGE_FOLDER}/${filename}`;
...
headers: { Authorization: `token ${GH_TOKEN}` }
```

**Depois**, vira:
```js
const WORKER_URL = 'https://tatuagem-gh-proxy.SEU-USUARIO.workers.dev';
const url = `${WORKER_URL}/gh/repos/${REPO_OWNER}/${REPO_NAME}/contents/${IMAGE_FOLDER}/${filename}`;
...
headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` }
```

Ou seja: troca `https://api.github.com` por `${WORKER_URL}/gh`, e troca
`Authorization: token ${GH_TOKEN}` por `Authorization: Bearer ${ADMIN_PASSWORD}`
em TODAS as ~10 chamadas fetch do arquivo (upload, delete, commitTags,
commitFlashData, commitManifest, commitCatalogPage, commitSitemap).

A tela de login deixa de validar um token do GitHub e passa a só guardar a
senha que você digitou (pra mandar no header Bearer). Não precisa mais
colar um Personal Access Token inteiro no navegador — só a sua senha curta.

## 5. Rate limiting (proteção contra força bruta na senha)

O `wrangler.jsonc` já vem com um binding nativo de rate limiting da
Cloudflare (5 tentativas por IP a cada 60s). Só precisa de:

```bash
npm install -g wrangler@latest   # garanta Wrangler >= 4.36.0
wrangler deploy                  # redeploy pra aplicar o binding novo
```

Não precisa criar nada manualmente no dashboard — o binding é criado
automaticamente no primeiro deploy depois dessa mudança.

## O que isso muda na prática

- O token de verdade do GitHub nunca mais aparece no navegador, no DevTools,
  ou em qualquer lugar visível pro usuário do admin.
- Se alguém descobrir a senha do admin, o Worker só deixa mexer no
  repositório `micaeltatuagem/tatuagem` (trava no código do worker.js) —
  não dá pra usar essa senha pra acessar outra coisa na sua conta GitHub.
- Trocar a senha é `wrangler secret put ADMIN_PASSWORD` de novo, sem precisar
  gerar/revogar token do GitHub toda vez.
- Custo: o plano gratuito da Cloudflare Workers cobre isso tranquilamente
  (100 mil requisições/dia de graça — muito acima do que um painel de
  admin pessoal usaria).
