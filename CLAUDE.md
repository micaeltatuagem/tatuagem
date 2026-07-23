# Micael Tatuagem — notas para quem for mexer no site

Este arquivo existe pra evitar redescobrir do zero coisas que já custaram tempo real
pra entender. Leia isto **antes** de editar qualquer página. Repo: `micaeltatuagem/tatuagem`,
branch `main`, GitHub Pages, domínio `micaeltatuagem.com.br`.

## Visão geral do stack

- **Hospedagem**: GitHub Pages, repositório **público** (Pages grátis exige isso — se
  virar privado, precisa de plano pago do GitHub ou o site sai do ar).
- **Painel admin**: `adminflash.html`, protegido por senha via Cloudflare Worker
  (`tatuagem-gh-proxy`) que faz proxy autenticado pra API do GitHub. Não expõe token no navegador.
- **Banco de dados**: Supabase, usado só pelo sistema de cadastro/indicação/promoções
  (`reserva.html`). O catálogo de flash **não** usa banco — é tudo arquivo JSON estático.
- **Deploy**: qualquer commit em `main` já é o site (sem build step, sem CI).

## Como eu (Claude) commito

Não tenho acesso de escrita persistente — a cada sessão, o usuário passa um **token
fine-grained do GitHub** (curta duração, tratar como single-use). Uso a API REST
(`api.github.com/repos/.../contents/...`) via `bash_tool` + `urllib`, não `git clone`.

**Sequência que sempre uso, sem exceção:**
1. Buscar o arquivo fresco (`GET .../contents/arquivo`) e guardar o `sha` **imediatamente
   antes de commitar**, não no início da tarefa — o usuário edita o site ao vivo o tempo
   todo pelo painel, então o sha pode mudar no meio do trabalho.
2. Fazer o diff do meu arquivo local contra essa versão fresca, conferindo que só as
   mudanças pretendidas aparecem (protege contra perder trabalho concorrente do usuário).
3. Commitar (`PUT .../contents/arquivo` com o sha).
4. Re-buscar e comparar byte a byte (`remote == local`) pra confirmar que subiu exatamente
   o que eu esperava.

Arquivos grandes (>~1MB base64) podem estourar limite de linha de comando — escrever em
arquivo temporário com `base64 -w0` em vez de inline.

Upload em lote (várias páginas de uma vez, tipo as 21 de `/estilo/` ou as páginas `/f/`):
usar a Git Data API (tree) em vez de várias chamadas PUT — buscar sha da tree base,
criar blobs, criar tree nova, criar commit, atualizar o ref. Muito mais rápido que PUT
individual pra dezenas de arquivos.

## Testar antes de commitar (sempre, sem exceção pra mudanças de HTML/CSS/JS)

Ambiente sem acesso à internet real pro site (`micaeltatuagem.com.br` não é alcançável
daqui). Fluxo de teste:
1. Copiar os arquivos relevantes pra um diretório local, junto de qualquer JSON/imagem
   que o JS da página busca via `fetch()` (ex.: `flash/flash-data.json`, `flash/tags.json`).
2. Subir servidor local: `python3 -m http.server PORTA --directory pasta &`
   — **importante**: `nohup ... &` e o `curl`/teste seguinte precisam estar na
   **mesma chamada de bash_tool**, porque processos em background não sobrevivem
   entre chamadas de ferramenta separadas nesse ambiente.
3. Playwright (já instalado) pra testar de verdade: cliques, scroll, geometria de
   elementos (`bounding_box()`), amostra de pixel quando precisar confirmar contraste/
   camadas, screenshot pra revisão visual.
4. Para páginas que dependem do Supabase (`reserva.html`): a CDN do supabase-js não
   carrega nesse sandbox (domínio bloqueado), e o cliente é inicializado no topo do
   `<script>` sem try/catch — se `supabase` não existir, o script inteiro trava e
   nenhum event listener é registrado. Usar `page.add_init_script()` do Playwright pra
   injetar um `window.supabase` falso (stub) **antes** da página carregar, simulando
   `createClient`, `.from().insert()`, `.rpc()`. Testei essa lógica assim várias vezes
   com sucesso — ver histórico de commits do `reserva.html` pra um exemplo completo de stub.
5. `node --check arquivo.js` pra sintaxe, extraindo o conteúdo de `<script>` com regex
   (atenção: há múltiplos blocos `<script>` por página — JSON-LD, gtag, o principal.
   Pegar o mais longo geralmente é o certo, mas checar todos se tiver dúvida).

## Armadilhas de CSS que já morderam mais de uma vez

### 1. Ordem de regras conflitantes com media query
Se uma regra base (fora de media query) aparece **depois**, no arquivo, de uma regra
de mesma especificidade dentro de `@media`, a regra base vence — mesmo em telas onde
o media query deveria valer. Isso já causou bugs reais: scroll travado no `.flash-grid`
do Criar, chips de filtro sumindo no desktop. Dois jeitos de resolver:
- Mover a regra base pra ANTES do media query no arquivo (nem sempre prático).
- Aumentar a especificidade do seletor dentro do media query (ex.: `.app-shell .flash-grid`
  em vez de só `.flash-grid`). É o que uso na prática — mais seguro, não depende de
  reordenar nada.

**Sempre que adicionar um novo elemento com comportamento diferente em desktop/mobile,
verificar com Playwright + `getComputedStyle()` que o valor realmente aplicado bate
com o esperado em cada largura — não confiar só na leitura do CSS.**

### 2. Variáveis CSS não são as mesmas entre páginas
Cada página do site foi construída em momento diferente e tem seu próprio `:root`.
Exemplo real que já causou confusão: `--ink` significa "texto claro" em `cadastro.html`
mas "fundo escuro" em `reserva.html`. **Nunca copiar um bloco de CSS de uma página pra
outra sem checar se as variáveis usadas existem (e significam a mesma coisa) no destino.**
Ao portar estilos entre páginas, eu tenho traduzido manualmente variável por variável
(ver commit da fusão reserva+cadastro pro exemplo mais completo disso).

### 3. `flash-decor.js` precisa de duas coisas pra decorar direito
Esse script espalha desenhos de flash (baixa opacidade) como decoração de fundo. Ele
escolhe os elementos a decorar via `getSelectors()` (lista de seletores diferente por
página, olhando `location.pathname`) e mede a `getBoundingClientRect()` de cada um pra
saber a área onde pode espalhar imagens.
- Se a seção/main que ele decora tiver `max-width` aplicado **nela mesma**, a decoração
  nunca alcança as margens reais da tela — fica presa dentro da coluna de conteúdo.
  Solução padrão: separar em dois elementos — um "canvas" full-bleed (sem max-width,
  onde o decor é injetado) e um `.pagina-inner` por dentro dele (com o max-width e o
  conteúdo de verdade). Ver `.flash-section` + `.flash-section-inner` em `flash.html`
  como referência de padrão.
- As imagens de decor são `position:absolute` com `z-index:0`. Qualquer conteúdo real
  que precise ficar visualmente por cima (texto, painéis, grades de imagem) precisa de
  `position:relative; z-index:1` explícito — senão corre risco de ficar atrás,
  dependendo da ordem do DOM.

### 4. `.content-panel` — componente padrão pro texto não brigar com o fundo
Criado nessa sessão, já usado em `index.html`, `flash.html`, `galeria.html`:
```css
.content-panel {
  position: relative; z-index: 1;
  background: rgba(10,10,10,0.62);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(212,201,176,0.08); /* neutro, nunca dourado */
  border-radius: 4px;
  padding: 1.75rem 2rem;
}
```
Usar em qualquer bloco de texto corrido ou lista densa que fique diretamente sobre uma
seção decorada. Títulos grandes (H1) normalmente não precisam — só ganham o painel
blocos de texto menor/mais denso (parágrafos, listas de FAQ, filtros).

## Painel admin (`adminflash.html`) — o que é seguro editar

`commitCatalogPage()` faz *splice* cirúrgico no `flash.html`: só substitui o conteúdo
entre `<!-- FLASH_GRID_START/END -->` e `<!-- FLASH_FILTERS_START/END -->`. Tudo fora
dessas marcações (head, nav, footer, qualquer JS/CSS que eu adicionar) sobrevive pra
sempre a saves futuros do painel. **Nunca colocar código novo dentro dessas marcações**
— vai ser apagado no próximo save. Fora delas, é seguro.

O painel guarda `GH_TOKEN` (a sessão de login), `REPO_OWNER`, `REPO_NAME`, `BRANCH`,
`WORKER_URL` como constantes no topo do script — todas as chamadas de commit passam
por `${WORKER_URL}/gh/repos/...`, nunca direto pra API do GitHub (o worker é quem
carrega o token real).

### Sistema de rascunho (`draft:true`)
Item novo (upload em lote ou individual) nasce com `draft:true` em `flash-data.json`.
Draft:
- **não aparece** em `flash.html`, no filtro do Criar (`preview-tatuagem.html`), no
  `sitemap.xml` nem no `manifest.json` (decoração aleatória do site).
- Some automaticamente quando o item é editado/salvo no painel (`saveEdit()` limpa a flag).

**Se o painel ficar aberto numa aba por muito tempo enquanto eu atualizo o código**, o
JS antigo continua rodando até a pessoa dar F5 — isso já causou uma leva de 86 itens
publicados sem gerar a página `/f/` correspondente, porque o fix só valia pro JS novo.
Se desconfiar disso, comparar contagem de páginas `/f/*.html` no repo contra a
contagem de itens `draft:false` em `flash-data.json` — a diferença mostra o que falta.

### Páginas geradas automaticamente pelo painel
- `/f/{id}-{slug}.html` — uma por item do catálogo, só serve pra robôs de preview
  (WhatsApp/Facebook) lerem a imagem certa. Redireciona sozinha pro catálogo via JS.
  Gerada por `commitShareCard()`, chamada em upload em lote, upload individual **e**
  em `saveEdit()`.
- `/estilo/{slug}.html` — uma por tag de estilo. Modelo híbrido: só o essencial de SEO
  fica estático no HTML (título, meta description, texto real do estilo); contagem de
  itens, imagens de exemplo e lista de "outros estilos" carregam via `fetch()` no
  carregamento da página, direto de `flash/flash-data.json` e `flash/tags.json` — nunca
  ficam desatualizadas sozinhas. Regenerada automaticamente quando a descrição daquele
  estilo é salva no painel (aba "Estilos / Tags").
- `sitemap.xml` — regenerado a cada save no painel (`commitSitemap()`), filtra drafts.

## Onde cada coisa mora

| Arquivo | O que é |
|---|---|
| `index.html` | Home. Seções: hero, sobre, processo (agora "por onde começar", 4 cards de ferramentas — sem link direto no menu, ver nota do menu abaixo), galeria (carrossel), localização, faq, promoções, contato |
| `flash.html` | Catálogo de flash (500+ itens), filtro por estilo, busca, lightbox |
| `galeria.html` | Portfólio de sessões finalizadas |
| `preview-tatuagem.html` | "Criar" — simulador de tatuagem na foto do corpo, app de tela única (sem header/main/section padrão — `flash-decor.js` não decora essa página) |
| `reserva.html` | Formulário único: ideia de tatuagem + cadastro no programa de promoção/indicação. Salva no Supabase, gera código de indicação, monta mensagem de WhatsApp |
| `cadastro.html` | Vitrine das promoções (–20% primeira tattoo, indicação 5→1), CTA pro `reserva.html`. Redireciona sozinho se receber `?ref=` de link antigo |
| `anamnese.html` | Ficha de cadastro/anamnese, formulário longo |
| `fisiologia-da-tatuagem.html` | "Cuidados" — conteúdo educativo sobre fisiologia da pele e cuidados pós-tatuagem |
| `adminflash.html` | Painel admin (senha), gerencia catálogo, tags/estilos, backup |
| `flash-decor.js` | Script de decoração de fundo (flash artwork de baixa opacidade), compartilhado por várias páginas |
| `flash/flash-data.json` | Fonte da verdade do catálogo (508+ itens) |
| `flash/tags.json` | Lista de estilos/tags |
| `flash/style-descriptions.json` | Descrição de cada estilo (editável no painel, aba Estilos/Tags) |
| `flash/manifest.json` | Lista de arquivos usados na decoração aleatória do site |

## Coisas que eu sei que ainda podem estar pendentes

- Nem toda página tem o tratamento `.content-panel` — só `index.html`, `flash.html`,
  `galeria.html` receberam até agora. `reserva.html`/`anamnese.html`/`cadastro.html`
  não, porque a maior parte do conteúdo delas já é campo de formulário (protegido por
  fundo próprio) — mas vale reavaliar se crescerem trechos de texto corrido.
- O menu já não tem mais o item `Processo`: foi substituído por `Cuidados` (linkando pra
  `fisiologia-da-tatuagem.html`) e ganhou um item `Localização` novo. A seção `#processo`
  (agora com o texto "por onde começar") continua existindo em `index.html`, só não tem
  mais link direto no menu. Esse menu atualizado está sincronizado em `index.html` e nas
  7 páginas internas "padrão" (`galeria.html`, `flash.html`, `aerografia.html`,
  `preview-tatuagem.html`, `reserva.html`, `cadastro.html`, `anamnese.html`) — atualizado
  em 22/07/2026.
- **Pendente**: as 24 páginas de `/estilo/` e as ~25 páginas "órfãs" na raiz (`animais.html`,
  `blackwork.html` etc. — duplicatas antigas cujo `canonical` já aponta pra versão em
  `/estilo/`, sem nenhum link ativo apontando pra elas) ainda usam um menu mais antigo e
  mais curto (sem `hide-sm`, sem `Cuidados`/`Localização`, paths absolutos tipo
  `/index.html`). Não foram tocadas nessa atualização — avaliar se vale sincronizar
  também, e nesse caso lembrar que usam paths absolutos (`/index.html`, `/flash.html`
  etc.) em vez de relativos.
- O sistema de indicação/promoção do `reserva.html` supõe que a tabela `clientes_promo`
  no Supabase só tem as colunas nome/whatsapp/email/codigo_indicacao/indicado_por/canal.
  **Não adicionar campos novos no payload de insert sem confirmar o schema** — inserir
  uma coluna que não existe quebra o insert inteiro (erro do PostgREST).
