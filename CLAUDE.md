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
  estilo é salva no painel (aba "Estilos / Tags"). **Gerada a partir do template
  `buildEstiloPageHtml()` dentro de `adminflash.html`** — o `<nav>` que esse template
  produz é HTML puro escrito à mão ali dentro, **não** lê de nenhum arquivo existente.
  Se o menu do site mudar de novo, esse template também precisa ser editado manualmente
  (`adminflash.html`, dentro de `buildEstiloPageHtml`), senão a próxima página gerada
  pelo painel volta pro menu antigo. Já atualizado em 22/07/2026 junto com as páginas.
- `sitemap.xml` — regenerado a cada save no painel (`commitSitemap()`), filtra drafts.

### `/page-gen.js` — módulo compartilhado de páginas de categoria/peça (22/07/2026)
Extraído do sistema de `/estilo/` do `adminflash.html` pra ser reaproveitável por
qualquer painel admin. Carregado via `<script src="/page-gen.js"></script>` antes do
script inline de cada admin. Expõe `window.PageGen` com:
- `buildCategoryPageHtml(cfg)` / `buildItemPageHtml(cfg)` — montam o HTML completo da
  página (head/nav/footer iguais em todo o site, `<nav>` idêntico ao do index — se o
  menu do site mudar, esse módulo também precisa ser editado manualmente, do jeito que
  `buildEstiloPageHtml` precisa).
- `buildContentBlockHtml`/`buildFaqBlockHtml`/`buildFaqSchema`/`buildBreadcrumbSchema` —
  helpers puros de HTML/schema.org, sem estado.
- `renderContentEditor`/`addContentSectionRow`/`addContentFaqRow`/`collectContentSections`/
  `collectContentFaq` — o form de seções+FAQ do painel (mesmo padrão do `adminflash.html`,
  só que genérico: os IDs dos containers são passados por parâmetro).
- `commitTextFile`/`deleteFile`/`ghGetSha` — commit genérico via worker proxy.
- `upsertSitemapEntry`/`removeSitemapEntry` — genéricos, por `loc` (URL completa).

Cada painel que usa o módulo mantém seu próprio `content.json` (`{categorias:{}, pecas:{}}`)
e suas próprias funções de "montar o cfg e chamar o PageGen" (não dá pra generalizar isso
sem perder as particularidades de cada galeria — nome dos campos, textos, etc.).

**Aerografia** (`adminaerografia.html`) foi o primeiro a usar, com dois tipos de página:
- `/aerografia/categoria-{slug}.html` — uma por categoria (`Quadros`, `Paredes/Murais`),
  editável na aba "Conteúdo & FAQ das categorias". Grid de amostras + contagem carregam
  ao vivo de `aerografia/aerografia-data.json` + `aerografia/tags.json`.
- `/aerografia/peca-{id}-{slug}.html` — uma por peça individual (opcional — só é gerada
  se algo for salvo pra ela), editável na aba "Conteúdo & FAQ de peças individuais".
  Página 100% estática (sem fetch em runtime), foto grande + texto + FAQ.
- Conteúdo fica em `aerografia/content.json`. Ao deletar uma categoria (`deleteTag`), a
  página e a entrada de sitemap correspondentes são limpas automaticamente
  (`deleteCategoryPage`); ao deletar uma peça isso **não** acontece ainda (página velha
  fica órfã, inofensiva mas não removida — pendente).
- Card social (og:image) usa a imagem crua da peça direto, sem o card decorado
  (moldura/flash-decor) que `/estilo/` tem — simplificação deliberada pra essa primeira
  versão.

**Corpos** (`admincorpos.html`) foi **propositalmente deixado de fora**: as fotos ali são
referência de corpo pro simulador (`preview-tatuagem.html`), não um portfólio público —
não tem página pra gerar.

**Galeria** (`admingaleria.html`) usa o mesmo padrão de `/aerografia/` (categoria + peça),
com uma ressalva: `galeria.html` (a página pública) **não** lê `?tag=` da URL — só tem
filtro por clique em botão. Então o CTA de "ver mais" e o link das amostras no grid
apontam pra `/galeria.html` sem pré-filtrar (funciona, só não abre já filtrado).

**Corpos** (`admincorpos.html`) também foi conectado, mas é diferente dos outros três:
não tem uma lista de tags gerenciada — a "categoria" é o valor de `nome` (parte do corpo,
texto livre digitado no upload, ex: "braço", "perna", "costas") que já existe em cada foto,
então as opções do seletor vêm de `[...new Set(getGallery().map(i => i.nome))]`. Por causa
disso, o `page-gen.js` precisou de um ajuste: o filtro do runtime agora aceita tanto campo
array (`styles: [...]`, usado por flash/aerografia/galeria) quanto campo de valor único
(`nome`, usado por corpos) — `Array.isArray(val) ? val.includes(x) : val === x`.
Ideia por trás: texto sobre posicionamento (dor, cicatrização, tamanho recomendado) por
região do corpo. Ainda **não existe um hub público** linkando pra essas páginas — elas
existem e entram no sitemap normalmente, mas o CTA delas aponta pra `preview-tatuagem.html`
como destino provisório. Onde (ou se) elas vão ganhar um hub próprio ainda está em aberto.

## Onde cada coisa mora

| Arquivo | O que é |
|---|---|
| `index.html` | Home. Seções: hero, sobre, processo ("Caminhos", cards: Galeria, Flash, Criar, Guia, Reserva, Aerografia), galeria (carrossel), localização, faq, promoções, contato |
| `flash.html` | Catálogo de flash (500+ itens), filtro por estilo, busca, lightbox |
| `galeria.html` | Portfólio de sessões finalizadas |
| `preview-tatuagem.html` | "Criar" — simulador de tatuagem na foto do corpo, app de tela única (sem header/main/section padrão — `flash-decor.js` não decora essa página) |
| `reserva.html` | Formulário único: ideia de tatuagem + cadastro no programa de promoção/indicação. Salva no Supabase, gera código de indicação, monta mensagem de WhatsApp |
| `cadastro.html` | Vitrine das promoções (–20% primeira tattoo, indicação 5→1), CTA pro `reserva.html`. Redireciona sozinho se receber `?ref=` de link antigo |
| `anamnese.html` | Ficha de cadastro/anamnese, formulário longo |
| `fisiologia-da-tatuagem.html` | "Cuidados" — conteúdo educativo sobre fisiologia da pele e cuidados pós-tatuagem |
| `adminflash.html` | Painel admin (senha), gerencia catálogo, tags/estilos, backup. Também gera `/estilo/*.html` via `buildEstiloPageHtml()` — ver seção de navegação acima |
| `guia.html` | "Guia" — significados, estilos e termos. Toggle A-Z/por tema, lê de `guia-data.json` via `fetch()`, schema.org `ItemList` |
| `adminguia.html` | Painel do Guia (mesmo login/commit do `adminflash.html`). CRUD de verbetes |
| `guia-data.json` | Fonte de verdade do Guia — 25 estilos (linkam pra `/estilo/*.html`) + verbetes de significado/técnica/termo (crescendo aos poucos, `draft:true` até serem preenchidos) |
| `valor.html` | "Preço & Valor" — processo (preparo, por que não uso anestesia), pagamento por sessão, fechamento, cobertura, micro/flash, esboço em estúdio |
| `nav-mobile.css` / `nav-mobile.js` | Menu compartilhado por todo o site — ver seção de navegação acima |
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
- O sistema de indicação/promoção do `reserva.html` supõe que a tabela `clientes_promo`
  no Supabase só tem as colunas nome/whatsapp/email/codigo_indicacao/indicado_por/canal.
  **Não adicionar campos novos no payload de insert sem confirmar o schema** — inserir
  uma coluna que não existe quebra o insert inteiro (erro do PostgREST).
- **Guia** (`guia.html`/`adminguia.html`/`guia-data.json`) tem só os 25 verbetes de estilo
  preenchidos de verdade (migrados de `/estilo/*.html`) + 4 exemplos-semente com
  `draft:true` (2 significados, 1 técnica, 1 termo) — praticamente todo o conteúdo de
  significados/técnicas/termos ainda falta ser escrito, verbete por verbete, no
  `adminguia.html`. O índice A-Z fica esparso até isso crescer (natural, não é bug).
- **Cuidados** (`fisiologia-da-tatuagem.html`) foi decidido que **continua existindo como
  página própria** — não foi fundida no Guia. Quando for distrinchada em verbetes, isso
  entra no Guia como categoria própria (`termo` ou nova categoria), e a página antiga
  pode ou virar redirect ou continuar coexistindo — decisão em aberto.
- `estilo/organico.html` (e a versão espelho na raiz, `organico.html`) **não são conteúdo
  duplicado** — já são só stubs de redirect (`noindex`, `canonical`, `location.replace()`)
  pra `estilo/organica.html`. "organica" é o termo oficial. Não apagar esses stubs sem
  necessidade — eles preservam links antigos que ainda apontem pra grafia errada.
- `hyperspace_flow.html` e `rorschach_flow.html` existem no repo mas não estão linkados
  de lugar nenhum ativo (nem do Deriva, que já foi removido). Prováveis protótipos órfãos
  de antes da consolidação em `aura_flow.html`. Não apagados por falta de confirmação —
  ver nota de remoção do Deriva abaixo.
## Navegação do site (28/07/2026 — reescrita completa, 2ª vez)

O menu passou por uma reescrita de arquitetura grande nessa sessão. Isso invalida
qualquer nota anterior sobre "menu montado por JS" — a estrutura atual é 100% HTML
estático, descrita aqui.

### Por que mudou de novo
A versão anterior (JS injetando ícone do logo + agrupando itens no dropdown "Mais"
depois que a página carregava) causava um "pulo" visual visível — o menu aparecia
cheio por uma fração de segundo e depois se reorganizava. Też causava um bug real de
z-index (o painel do "Mais", quando `position:absolute` aninhado dentro do `<nav>`,
ficava atrás do conteúdo de algumas seções da página, dependendo do CSS de
`position:relative`/`overflow:hidden` usado pra decoração). A solução foi parar de
montar a estrutura via JS e deixar o HTML de cada página já nascer pronto.

### Arquitetura atual
- **HTML estático, idêntico em espírito em toda página**: cada página tem, escrito
  direto no arquivo, um `<nav>` com logo+ícone, os 6 itens sempre visíveis (Galeria,
  Flash, Criar, Guia, Reserva, Contato) e um `<li class="nav-more">` com o botão
  "Mais". Logo depois do `</nav>` (como **irmão**, não filho — importante pro
  z-index), existe um `<ul class="nav-more-panel">` com os itens secundários
  duplicados: Sobre, Aerografia, Cuidados, Valor, Promoções, Localização.
- **`nav-mobile.js`** (~80 linhas): só comportamental. Não cria nem move nenhum
  elemento — só abre/fecha o hambúrguer (mobile) e o painel "Mais" (desktop,
  `position:fixed`, posição calculada via `getBoundingClientRect()` no clique).
- **`nav-mobile.css`**: paleta e fonte **hardcoded com `!important`**, não usa
  nenhuma variável CSS de página (cada página define `--ink`/`--bg`/etc. com
  significados diferentes — já causou bugs de texto invisível e hover sumindo).
  Também define a estrutura base do `nav` (sticky, flex, etc.), então uma página
  sem CSS de nav próprio nenhum (ex.: `gerador-de-selos.html` antes de ser
  removido) ainda fica com o menu certo, só de incluir o HTML + os 2 arquivos.
  - Desktop: `.nav-links li.nav-extra { display:none }` (escondidos, já existem
    de novo dentro do `.nav-more-panel`). `.nav-more-panel` é `position:fixed`,
    `display:none` até ganhar a classe `.open`.
  - Mobile (`max-width:760px`): `.nav-more` e `.nav-more-panel` ficam
    `display:none` sempre (o "Mais" não existe no mobile), e
    `.nav-links li.nav-extra { display:list-item !important }` mostra de volta
    os itens escondidos — resultado: lista única achatada com os 12 itens no
    hambúrguer.
- **`nav-icon.webp`**: ícone (caveira chaos) que aparece antes do texto do logo,
  como `<img>` estático dentro do `.nav-logo` — carrega junto com o resto do HTML,
  sem JS. Tem transparência real (canal alfa variável); a versão anterior em PNG
  (`favicon.png`) tinha fundo preto sólido opaco e deixava uma borda quadrada visível.
- **Sem `.hide-sm`, sem `.site-nav-links`**: a variante de classe usada só em
  `fisiologia-da-tatuagem.html` (`.site-nav`/`.site-nav-links`/`.site-nav-logo`)
  foi unificada pra `nav`/`.nav-links`/`.nav-logo` igual todo mundo. `.hide-sm`
  (escondia item em telas <560px, de um sistema anterior ao hambúrguer) foi
  removido — substituído por `.nav-extra`, que tem lógica clara (desktop:
  escondido/vai pro "Mais"; mobile: mostrado/lista achatada).
- **Sem destaque dourado no Promoções**: existia uma classe `.destaque` que
  deixava o link de Promoções dourado (parecia que "você já tá na página de
  promoção"). Removida — todos os itens do menu têm exatamente a mesma cor.

### Conteúdo do menu (itens)
Sempre visíveis: Galeria, Flash, Criar, Guia, Reserva, Contato.
Dentro do "Mais": Sobre, Aerografia, Cuidados, Valor, Promoções, Localização.
(Selos e Deriva existiam aqui antes — foram removidos do site em 28/07/2026, ver
nota "Remoção de Selos e Deriva" abaixo.)

### Gerador local (`generate_nav.py`, não faz parte do site em produção)
Existe um script Python (`generate_nav.py`, na raiz do repo) que gera o bloco
`<nav>...</nav><ul class="nav-more-panel">...</ul>` certo pra qualquer página,
dada uma lista central de itens (`VISIBLE`/`EXTRA` no topo do arquivo) e o nome
do arquivo atual (decide prefixo `/` pra `/estilo/*`, `#âncora` vs
`index.html#âncora`, e marca `class="atual"` sozinho). **Se o menu mudar de novo
(item novo, removido, renomeado), edite `VISIBLE`/`EXTRA` nesse script e rode
pra regerar todas as páginas** — não edite página por página à mão, e não confie
em regex solto (`grep -rl "nav-links" *.html` também acha ocorrências dentro de
template strings JS, ver nota abaixo).

Se o menu mudar, ainda tem **três lugares** que usam a MESMA estrutura mas não
rodam o script sozinhos (são gerados/mantidos separado, precisam de edição
manual espelhando o que o script produz):
1. As páginas HTML existentes (rodar `generate_nav.py` e reaplicar).
2. `buildEstiloPageHtml()` em `adminflash.html` (gera `/estilo/*.html` futuras).
3. `SITE_NAV` em `page-gen.js` (gera páginas de aerografia/galeria/corpos futuras).

**Armadilha real que já mordeu nessa sessão**: `grep -rl "nav-links" *.html`
encontra ocorrências de `<nav>` dentro de template strings JS (dentro de
`adminflash.html` e `page-gen.js`), não só o nav real de uma página renderizada.
Editar às cegas por regex de arquivo inteiro corre o risco de mexer no lugar
errado. **Sempre isolar o bloco `<nav>...</nav>...<ul class="nav-more-panel">...</ul>`
mais próximo antes de editar, e depois validar com Playwright: (1) com JS
desligado, confirmar que os 6 itens + botão "Mais" já aparecem certo (prova que
não depende de JS pra estrutura); (2) com JS ligado, clicar de verdade em cada
item do "Mais" (`elementFromPoint` no centro do link, não só checar se existe
no DOM) em pelo menos 3-4 páginas de exemplo antes de considerar pronto.**

### Remoção de Selos e Deriva (28/07/2026)
`gerador-de-selos.html` e `deriva.html` (+ `aura_flow.html`, sub-experiência
visual usada só pelos "portais" do Deriva) foram removidos do site — o dono vai
reaproveitar essas ferramentas em outro projeto separado. Apagados sem deixar
vestígio: arquivo em si, card em "Caminhos" (`index.html`), item de menu (todas
as páginas + os 2 templates geradores), entrada no `sitemap.xml`. Os arquivos
`hyperspace_flow.html` e `rorschach_flow.html` **não foram tocados** — não estão
linkados de lugar nenhum ativo (nem do Deriva, que só usa `aura_flow.html?layer=X`),
parecem protótipos órfãos de antes da consolidação em `aura_flow.html`; decisão
sobre eles fica em aberto.
