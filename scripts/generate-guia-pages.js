#!/usr/bin/env node
/**
 * Gera uma página HTML estática para cada verbete do Guia (tabela
 * guia_verbetes no Supabase), no padrão guia/<slug>/index.html.
 *
 * Rodado pela GitHub Action .github/workflows/generate-guia-pages.yml,
 * disparada automaticamente por um Database Webhook do Supabase toda
 * vez que um verbete é criado, editado ou apagado pelo admin.
 *
 * Uso local (opcional, pra testar antes de commitar):
 *   node scripts/generate-guia-pages.js
 */

const fs = require('fs');
const path = require('path');

// mesmas credenciais públicas usadas no resto do site (chave anon, só leitura aqui)
const SUPABASE_URL = 'https://rpgcsejfewltricfsdrd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7LF70sbQS_es_uco138rqw_YfbqnIsa';
const BUCKET_IMAGENS = 'guia-imagens';

const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'guia');
const SITEMAP_PATH = path.join(ROOT_DIR, 'sitemap.xml');
const GUIA_INDEX_PATH = path.join(ROOT_DIR, 'guia.html');
const BLOG_POSTS_PATH = path.join(ROOT_DIR, 'blog', 'posts-data.json');
const SITE_URL = 'https://micaeltatuagem.com.br';

const CATEGORIAS = {
  significado: 'Significado',
  estilo: 'Estilo',
  tecnica: 'Técnica',
  termo: 'Termo'
};

function urlImagem(caminho) {
  if (!caminho) return '';
  if (/^https?:\/\//i.test(caminho)) return caminho;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_IMAGENS}/${caminho}`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Trunca um texto em até `max` caracteres sem cortar no meio de uma palavra.
// Se cortou de fato, some "…" no fim (respeitando o limite).
function truncarPalavra(str, max) {
  const texto = String(str || '').trim();
  if (texto.length <= max) return texto;
  const cortado = texto.slice(0, max - 1);
  const ultimoEspaco = cortado.lastIndexOf(' ');
  const base = ultimoEspaco > 40 ? cortado.slice(0, ultimoEspaco) : cortado;
  return base.replace(/[.,;:—-]+$/, '') + '…';
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizarBusca(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Carrega os posts do blog (se o arquivo existir) pra cruzar tags/tema
// com os verbetes do guia e gerar links relacionados nos dois sentidos.
function carregarPostsBlog() {
  try {
    const raw = fs.readFileSync(BLOG_POSTS_PATH, 'utf8');
    const posts = JSON.parse(raw);
    return Array.isArray(posts) ? posts.filter(p => !p.draft) : [];
  } catch {
    return [];
  }
}

// Retorna até `max` posts do blog cujas tags batem com o tema/termo do verbete.
function postsRelacionados(v, posts, max = 3) {
  const termos = [
    normalizarBusca(v.termo),
    ...(Array.isArray(v.tema) ? v.tema.map(normalizarBusca) : [])
  ].filter(Boolean);
  if (!termos.length) return [];

  const pontuados = posts.map(p => {
    const tagsPost = (p.tags || []).map(normalizarBusca);
    const pontos = termos.reduce((acc, t) => acc + (tagsPost.some(tag => tag.includes(t) || t.includes(tag)) ? 1 : 0), 0);
    return { post: p, pontos };
  }).filter(x => x.pontos > 0);

  pontuados.sort((a, b) => b.pontos - a.pontos);
  return pontuados.slice(0, max).map(x => x.post);
}

function paragrafos(texto) {
  return String(texto || '')
    .split(/\n{2,}/)
    .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n        ');
}

function renderPagina(v, posts) {
  const categoriaLabel = CATEGORIAS[v.categoria] || v.categoria;
  const titulo = escapeHtml(v.termo);
  const tituloSeo = escapeHtml(v.seo_title || `${v.termo} — ${categoriaLabel} de Tatuagem`);
  const metaDesc = escapeHtml(truncarPalavra(v.meta_description || v.descricao || '', 157));
  const relacionados = postsRelacionados(v, posts);
  const img = urlImagem(v.imagem_url);
  const imgAlt = escapeHtml(v.imagem_alt || v.termo);
  const url = `https://micaeltatuagem.com.br/guia/${v.slug}`;
  const linkBusca = `/flash?q=${encodeURIComponent(v.termo)}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-JB6GZM1DFM"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-JB6GZM1DFM');
</script>

<title>${tituloSeo} | Micael Tatuagem</title>
<meta name="description" content="${metaDesc}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${titulo} | Guia · Micael Tatuagem">
<meta property="og:description" content="${metaDesc}">
<meta property="og:image" content="${img || 'https://micaeltatuagem.com.br/skull.webp'}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="article">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Micael Tatuagem">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titulo} | Guia · Micael Tatuagem">
<meta name="twitter:description" content="${metaDesc}">
<meta name="twitter:image" content="${img || 'https://micaeltatuagem.com.br/skull.webp'}">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Micael Tatuagem",
  "description": "Tatuador em Muriaé-MG especializado em blackwork, dark art, colorido e ornamental, atendendo clientes de toda a Zona da Mata mineira.",
  "url": "https://micaeltatuagem.com.br/",
  "image": "https://micaeltatuagem.com.br/hero-bg.webp",
  "telephone": "+55-32-99966-6946",
  "email": "micaeltattoo@gmail.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Rua Astrogildo Figueiredo de Barros, 469",
    "addressLocality": "Muriaé",
    "addressRegion": "MG",
    "postalCode": "36880-000",
    "addressCountry": "BR"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": -21.1265, "longitude": -42.3682 },
  "sameAs": ["https://instagram.com/micaeltatuagem"],
  "priceRange": "R$ 150+"
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://micaeltatuagem.com.br/" },
    { "@type": "ListItem", "position": 2, "name": "Guia", "item": "https://micaeltatuagem.com.br/guia" },
    { "@type": "ListItem", "position": 3, "name": "${titulo}", "item": "${url}" }
  ]
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "DefinedTerm",
  "name": "${titulo}",
  "description": "${metaDesc}",
  "inDefinedTermSet": "https://micaeltatuagem.com.br/guia"
}
</script>

<style>
  :root {
    --bg:        #0a0a0a;
    --surface:   #111111;
    --border:    #1e1e1e;
    --border-hi: #2e2e2e;
    --ink:       #e8e8e8;
    --ink-muted: #777777;
    --ink-faint: #333333;
    --accent:    #c8a96e;
    --accent-dim:#7a6340;
    --radius:    3px;
    --font-body: 'Georgia', 'Times New Roman', serif;
    --font-ui:   system-ui, -apple-system, 'Helvetica Neue', sans-serif;
    --max:       780px;
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:var(--font-body); line-height:1.65; }
  .inner { max-width: var(--max); margin:0 auto; padding: 0 1.5rem; }
  a { color: inherit; }

  nav {
    display:flex; align-items:center; justify-content:space-between;
    padding:1.1rem 1.5rem; border-bottom:1px solid var(--border);
    font-family: var(--font-ui); position:sticky; top:0; background:rgba(10,10,10,.92);
    backdrop-filter: blur(6px); z-index:40;
  }
  .nav-logo { font-family: var(--font-body); font-size:1.05rem; text-decoration:none; color:var(--ink); }
  .nav-links { list-style:none; display:flex; gap:1.4rem; margin:0; padding:0; font-size:.85rem; overflow-x:auto; white-space:nowrap; }
  .nav-links a { text-decoration:none; color:var(--ink-muted); }
  .nav-links a:hover, .nav-links a.atual { color: var(--accent); }
  @media (max-width:700px){ .nav-logo{ display:none; } }

  .breadcrumb { font-family: var(--font-ui); font-size:.78rem; color:var(--ink-faint); padding: 1.5rem 0 0; }
  .breadcrumb a { color:var(--ink-faint); text-decoration:none; }
  .breadcrumb a:hover { color:var(--accent); }

  header.hero { padding: 1rem 0 2rem; border-bottom:1px solid var(--border); }
  .eyebrow { font-family: var(--font-ui); text-transform:uppercase; letter-spacing:.12em; font-size:.72rem; color:var(--accent); margin:0 0 .6rem; }
  h1 { font-weight:400; font-size:2.4rem; margin:0; }

  .verbete-imagem { width:100%; max-height:420px; object-fit:contain; background:#e8e0c9; border-radius:var(--radius); margin: 2rem 0; padding:1.5rem; display:block; }

  .conteudo { font-size:1.08rem; padding: 1rem 0 2rem; }
  .conteudo p { margin: 0 0 1.2rem; }

  .cta-box {
    display:flex; flex-wrap:wrap; gap:.8rem; padding: 1.5rem 0 2.5rem; border-bottom: 1px solid var(--border);
  }
  .cta-btn {
    font-family: var(--font-ui); font-size:.82rem; text-decoration:none; padding:.75rem 1.3rem;
    border-radius: 999px; letter-spacing:.03em;
  }
  .cta-btn.primario { background: #7a8c3a; color:#fff; }
  .cta-btn.secundario { border:1px solid var(--accent-dim); color:var(--ink); }

  .faq { padding: 2.5rem 0; }
  .faq-title { font-family: var(--font-ui); font-size:1.1rem; color:var(--accent); margin: 0 0 1.2rem; }
  .faq-item { margin-bottom: 1.1rem; }
  .faq-q { font-family: var(--font-ui); font-size:.95rem; color:var(--ink); margin: 0 0 .3rem; }
  .faq-a { font-family: var(--font-ui); font-size:.85rem; color:var(--ink-muted); margin:0; }

  .relacionados { padding: 1.5rem 0 0; }
  .relacionados-lista { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.6rem; }
  .relacionados-lista a { font-family: var(--font-ui); font-size:.9rem; color: var(--ink); text-decoration:none; border-bottom:1px dotted var(--border-hi); padding-bottom:.4rem; display:inline-block; }
  .relacionados-lista a:hover { color: var(--accent); }

  .voltar { display:inline-block; margin: 1rem 0 2rem; font-family: var(--font-ui); font-size:.82rem; color:var(--ink-muted); text-decoration:none; }
  .voltar:hover { color: var(--accent); }

  footer {
    font-family: var(--font-ui); font-size:.78rem; color: var(--ink-faint);
    text-align:center; padding: 3rem 1.5rem 2rem; border-top:1px solid var(--border); margin-top:2rem;
  }
  footer a { color: var(--ink-faint); text-decoration:none; }
</style>
<link rel="stylesheet" href="/nav-mobile.css">
</head>
<body>

<nav>
  <a href="/" class="nav-logo"><img src="/nav-icon.webp" alt="" width="28" height="28">Micael Tatuagem</a>
  <ul class="nav-links">
    <li class="nav-extra"><a href="/#sobre">Sobre</a></li>
    <li><a href="/galeria">Galeria</a></li>
    <li><a href="/flash">Flash</a></li>
    <li class="nav-extra"><a href="/aerografia">Aerografia</a></li>
    <li><a href="/preview-tatuagem">Criar</a></li>
    <li><a href="/guia" class="atual">Guia</a></li>
    <li class="nav-extra"><a href="/fisiologia-da-tatuagem">Cuidados</a></li>
    <li class="nav-extra"><a href="/valor">Valor</a></li>
    <li class="nav-extra"><a href="/#promocoes">Promoções</a></li>
    <li class="nav-extra"><a href="/#localizacao">Localização</a></li>
    <li><a href="/blog">Blog</a></li>
    <li><a href="/reserva">Reserva</a></li>
    <li><a href="/#contato">Contato</a></li>
    <li class="nav-more">
      <button type="button" class="nav-more-btn" aria-haspopup="true" aria-expanded="false">Mais &#9662;</button>
    </li>
  </ul>
  <button type="button" class="nav-toggle" aria-label="Abrir menu" aria-expanded="false">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path class="ico-bars" d="M4 7h16M4 12h16M4 17h16"/>
      <path class="ico-x" d="M6 6l12 12M18 6L6 18"/>
    </svg>
  </button>
</nav>
<ul class="nav-more-panel">
  <li><a href="/#sobre">Sobre</a></li>
  <li><a href="/aerografia">Aerografia</a></li>
  <li><a href="/fisiologia-da-tatuagem">Cuidados</a></li>
  <li><a href="/valor">Valor</a></li>
  <li><a href="/#promocoes">Promoções</a></li>
  <li><a href="/#localizacao">Localização</a></li>
</ul>

<div class="inner">
  <p class="breadcrumb"><a href="/">Home</a> / <a href="/guia">Guia</a> / ${titulo}</p>

  <header class="hero">
    <p class="eyebrow">${categoriaLabel}</p>
    <h1>${titulo}</h1>
  </header>

  ${img ? `<img class="verbete-imagem" src="${img}" alt="${imgAlt}">` : ''}

  <div class="conteudo">
        ${paragrafos(v.corpo || v.descricao)}
  </div>

  <div class="cta-box">
    <a class="cta-btn primario" href="https://wa.me/5532999666946?text=${encodeURIComponent(`Oi Micael! Vi o verbete "${v.termo}" no Guia e quero saber mais.`)}" target="_blank" rel="noopener">Chamar no WhatsApp</a>
    <a class="cta-btn secundario" href="${linkBusca}">Ver mais tatuagens de ${escapeHtml(v.termo.toLowerCase())} →</a>
    ${v.link_estilo ? `<a class="cta-btn secundario" href="${v.link_estilo}">Ver estilo na galeria →</a>` : ''}
  </div>

  <div class="faq">
    <h2 class="faq-title">Dúvidas sobre esse verbete</h2>
    <div class="faq-item">
      <p class="faq-q">Posso tatuar "${titulo}" do jeito que está descrito aqui?</p>
      <p class="faq-a">Sim. Se quiser esse desenho ou tema específico, chame no WhatsApp com o nome do verbete pra combinar tamanho, local do corpo e agenda.</p>
    </div>
    <div class="faq-item">
      <p class="faq-q">Dá pra adaptar o significado ou o traço pra algo mais pessoal?</p>
      <p class="faq-a">Sim, o conteúdo aqui é ponto de partida. Composições, tamanho e nível de detalhe são combinados em consulta antes da sessão.</p>
    </div>
  </div>

  ${relacionados.length ? `
  <div class="relacionados">
    <h2 class="faq-title">Pra saber mais</h2>
    <ul class="relacionados-lista">
      ${relacionados.map(p => `<li><a href="/blog/${p.slug}">${escapeHtml(p.title)}</a></li>`).join('\n      ')}
    </ul>
  </div>` : ''}

  <a class="voltar" href="/guia">← Voltar ao Guia completo</a>
</div>

<footer>
  <span>© Micael Faccio · Tatuador em Muriaé, MG</span>
</footer>

<script src="/nav-mobile.js" defer></script>
</body>
</html>
`;
}

// ── sitemap.xml: substitui o bloco entre os marcadores GUIA pelas entradas atuais ──
function atualizarSitemap(verbetes) {
  if (!fs.existsSync(SITEMAP_PATH)) {
    console.warn('  aviso: sitemap.xml não encontrado, pulando.');
    return;
  }
  const hoje = new Date().toISOString().slice(0, 10);
  const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');

  const entradas = verbetes.map(v => {
    const url = `${SITE_URL}/guia/${v.slug}`;
    const img = urlImagem(v.imagem_url);
    const imgBlock = img ? `
      <image:image>
        <image:loc>${img}</image:loc>
        <image:title>${escapeHtml(v.termo)}</image:title>
      </image:image>` : '';
    return `  <url>
    <loc>${url}</loc>
    <lastmod>${hoje}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>${imgBlock}
  </url>`;
  }).join('\n');

  const inicio = '<!-- GUIA:START (gerado automaticamente por scripts/generate-guia-pages.js, não editar à mão) -->';
  const fim = '<!-- GUIA:END -->';
  const blocoNovo = `${inicio}\n${entradas}\n  ${fim}`;

  let novoXml;
  if (xml.includes(inicio) && xml.includes(fim)) {
    const re = new RegExp(`${escapeRegex(inicio)}[\\s\\S]*?${escapeRegex(fim)}`);
    novoXml = xml.replace(re, blocoNovo);
  } else {
    // primeira vez: insere o bloco logo antes do fechamento de </urlset>
    novoXml = xml.replace('</urlset>', `  ${blocoNovo}\n</urlset>`);
  }
  fs.writeFileSync(SITEMAP_PATH, novoXml);
  console.log(`  sitemap.xml atualizado com ${verbetes.length} entradas do Guia.`);
}

// ── guia.html: gera uma lista estática de <a href="/guia/slug"> pros crawlers
// que não executam JS (a maioria dos bots de IA). O JS (guia.js) continua
// substituindo esse conteúdo pela versão interativa pra quem tem JS ligado. ──
function atualizarListaEstatica(verbetes) {
  if (!fs.existsSync(GUIA_INDEX_PATH)) {
    console.warn('  aviso: guia.html não encontrado, pulando.');
    return;
  }
  const html = fs.readFileSync(GUIA_INDEX_PATH, 'utf8');

  const porLetra = {};
  verbetes.forEach(v => {
    const letra = normalizarBusca(v.termo).charAt(0).toUpperCase() || '#';
    if (!porLetra[letra]) porLetra[letra] = [];
    porLetra[letra].push(v);
  });
  const letras = Object.keys(porLetra).sort();

  const listaHtml = letras.map(l => `
    <section class="grupo">
      <h2 class="grupo-titulo">${l}</h2>
      <ul>
        ${porLetra[l]
          .sort((a, b) => a.termo.localeCompare(b.termo, 'pt-BR'))
          .map(v => `<li><a href="/guia/${v.slug}">${escapeHtml(v.termo)}</a></li>`)
          .join('\n        ')}
      </ul>
    </section>`).join('\n');

  const inicio = '<!-- GUIA-ESTATICO:START (gerado automaticamente por scripts/generate-guia-pages.js — fallback pra bots sem JS; o script inline logo abaixo substitui isso em runtime) -->';
  const fim = '<!-- GUIA-ESTATICO:END -->';
  const blocoNovo = `${inicio}${listaHtml}\n  ${fim}`;

  let novoHtml;
  if (html.includes(inicio) && html.includes(fim)) {
    const re = new RegExp(`${escapeRegex(inicio)}[\\s\\S]*?${escapeRegex(fim)}`);
    novoHtml = html.replace(re, blocoNovo);
  } else {
    novoHtml = html.replace('<main id="conteudo"></main>', `<main id="conteudo">${blocoNovo}</main>`);
  }
  fs.writeFileSync(GUIA_INDEX_PATH, novoHtml);
  console.log(`  guia.html atualizado com lista estática de ${verbetes.length} verbetes.`);
}

async function main() {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/guia_verbetes?select=*&draft=eq.false&order=slug.asc`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  if (!resp.ok) {
    throw new Error(`Falha ao buscar verbetes no Supabase: ${resp.status} ${await resp.text()}`);
  }

  const verbetes = await resp.json();
  console.log(`Encontrados ${verbetes.length} verbetes publicados.`);

  const posts = carregarPostsBlog();
  console.log(`Encontrados ${posts.length} posts do blog pra cruzar links relacionados.`);

  // limpa o diretório de saída antes de regenerar, pra remover páginas de
  // verbetes que foram apagados ou virados rascunho
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const v of verbetes) {
    if (!v.slug) continue;
    const dir = path.join(OUTPUT_DIR, v.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderPagina(v, posts));
    console.log(`  gerado: guia/${v.slug}/index.html`);
  }

  atualizarSitemap(verbetes);
  atualizarListaEstatica(verbetes);

  console.log('Concluído.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
