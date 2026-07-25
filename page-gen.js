/*
 * page-gen.js — módulo compartilhado de geração de páginas de conteúdo (SEO)
 * Usado pelos painéis admin (adminflash, adminaerografia, admingaleria, ...) pra criar
 * páginas estáticas de categoria e de peça individual, com texto/FAQ editável e schema.org.
 *
 * Não depende de nenhum outro arquivo do site. Cada admin.html que usar isso deve:
 *   <script src="/page-gen.js"></script>
 * antes do seu próprio <script> inline, e então chamar window.PageGen.*
 */
(function (global) {
  'use strict';

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeXml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function slugify(str) {
    return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function buildFaqSchema(faq) {
    if (!faq || !faq.length) return '';
    const entities = faq.map(f => `    {
      "@type": "Question",
      "name": ${JSON.stringify(f.q)},
      "acceptedAnswer": { "@type": "Answer", "text": ${JSON.stringify(f.a)} }
    }`).join(',\n');
    return `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
${entities}
  ]
}
<\/script>`;
  }

  function buildBreadcrumbSchema(siteUrl, crumbs) {
    if (!crumbs || !crumbs.length) return '';
    const items = crumbs.map((c, i) => `    { "@type": "ListItem", "position": ${i + 1}, "name": ${JSON.stringify(c.name)}, "item": ${JSON.stringify(c.url)} }`).join(',\n');
    return `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
${items}
  ]
}
<\/script>`;
  }

  function buildContentBlockHtml(sections) {
    if (!sections || !sections.length) return '';
    const body = sections.map(s => `    <h2>${escapeHtml(s.heading)}</h2>
    <p>${escapeHtml(s.text)}</p>`).join('\n');
    return `
  <div class="content-block">
${body}
  </div>`;
  }

  function buildFaqBlockHtml(faq) {
    if (!faq || !faq.length) return '';
    const body = faq.map(f => `    <details class="faq-item">
      <summary>${escapeHtml(f.q)}</summary>
      <p>${escapeHtml(f.a)}</p>
    </details>`).join('\n');
    return `
  <div class="faq-block">
    <h2>Perguntas frequentes</h2>
${body}
  </div>`;
  }

  // CSS compartilhado por todas as páginas geradas (categoria e peça). Fica inline em
  // cada página (sem depender de folha de estilo externa), do jeito que /estilo/ já fazia.
  const SHARED_STYLE = `
  :root {
    --ink: #0a0a0a; --deep: #111010; --surface: #181616;
    --bone: #d4c9b0; --blood: #8b1a1a; --rust: #c0392b;
    --muted: #6b6560; --border: rgba(212,201,176,0.12);
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--ink); color:var(--bone); font-family:'Inter',sans-serif; }
  nav { display:flex; align-items:center; justify-content:space-between; padding:1.2rem 1.5rem; border-bottom:1px solid var(--border); flex-wrap:wrap; gap:.6rem; }
  .nav-logo { font-family:'Inter',sans-serif; font-size:.95rem; letter-spacing:.08em; text-transform:uppercase; color:var(--bone); text-decoration:none; }
  .nav-links { display:flex; gap:1.5rem; list-style:none; margin:0; padding:0; flex-wrap:wrap; }
  .nav-links a { font-size:.85rem; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); text-decoration:none; }
  .nav-links a:hover { color:var(--bone); }
  .nav-links .destaque { color: var(--rust); }
  .hide-sm { }
  @media (max-width:560px) { .hide-sm { display:none; } }
  main { max-width:760px; margin:0 auto; padding:3rem 1.5rem 4rem; text-align:center; }
  .eyebrow { font-size:.78rem; letter-spacing:.15em; text-transform:uppercase; color:var(--rust); margin-bottom:.8rem; }
  h1 { font-family:'Cormorant Garamond', serif; font-size:2.4rem; font-weight:600; margin:0 0 1.2rem; }
  .item-count { font-size:.82rem; color:var(--muted); margin-bottom:1.6rem; letter-spacing:.03em; min-height:1.2em; }
  .intro-text { font-size:1rem; line-height:1.7; color:#c9beac; margin:0 auto 2.2rem; max-width:600px; }
  .cta { display:inline-block; background:var(--blood); color:var(--bone); text-decoration:none; padding:.85rem 1.8rem; border-radius:4px; font-size:.85rem; letter-spacing:.08em; text-transform:uppercase; margin-bottom:2.8rem; transition:background .2s ease; }
  .cta:hover { background:var(--rust); }
  .sample-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; margin-bottom:2.5rem; min-height:1px; }
  .sample-item { display:block; aspect-ratio:1; background:var(--surface); border:1px solid var(--border); border-radius:4px; overflow:hidden; }
  .sample-item img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .3s ease; }
  .sample-item:hover img { transform:scale(1.05); }
  .sample-empty { color:var(--muted); font-size:.9rem; margin-bottom:2.5rem; }
  .hero-image { width:100%; max-width:520px; border-radius:6px; overflow:hidden; margin:0 auto 2rem; border:1px solid var(--border); background:var(--surface); }
  .hero-image img { width:100%; display:block; }
  .content-block { text-align:left; border-top:1px solid var(--border); padding-top:2.2rem; margin-bottom:2.6rem; }
  .content-block h2 { font-family:'Cormorant Garamond', serif; font-size:1.5rem; font-weight:600; margin:0 0 .9rem; color:var(--bone); }
  .content-block h2:not(:first-child) { margin-top:1.8rem; }
  .content-block p { font-size:.95rem; line-height:1.75; color:#c9beac; margin:0 0 1rem; }
  .faq-block { border-top:1px solid var(--border); padding-top:2.2rem; margin-bottom:2.6rem; text-align:left; }
  .faq-block h2 { font-family:'Cormorant Garamond', serif; font-size:1.5rem; font-weight:600; margin:0 0 1.2rem; text-align:center; }
  .faq-item { border-bottom:1px solid var(--border); padding:1rem 0; }
  .faq-item summary { cursor:pointer; font-size:.95rem; color:var(--bone); list-style:none; display:flex; justify-content:space-between; gap:1rem; }
  .faq-item summary::-webkit-details-marker { display:none; }
  .faq-item summary::after { content:'+'; color:var(--rust); font-size:1.1rem; flex-shrink:0; }
  .faq-item[open] summary::after { content:'−'; }
  .faq-item p { font-size:.88rem; line-height:1.65; color:#a89e8e; margin:.8rem 0 0; }
  .related-list { border-top:1px solid var(--border); padding-top:1.8rem; text-align:left; }
  .related-list h2 { font-size:.78rem; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin-bottom:1rem; text-align:center; }
  .related-list ul { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:.5rem .9rem; justify-content:center; }
  .related-list a { font-size:.82rem; color:var(--muted); text-decoration:none; border-bottom:1px solid transparent; }
  .related-list a:hover { color:var(--bone); border-color:var(--muted); }
  footer { padding:2rem; text-align:center; border-top:1px solid var(--border); font-size:.85rem; letter-spacing:.1em; color:var(--muted); text-transform:uppercase; }
  footer a { color:var(--muted); text-decoration:none; }
  @media (max-width:560px) { .nav-links { gap:.9rem; } h1 { font-size:1.9rem; } }
`;

  // O <nav> do site, igual em index.html e nas outras páginas internas (ver CLAUDE.md).
  const SITE_NAV = `<nav>
  <a href="/index.html" class="nav-logo">Micael Tatuagem</a>
  <ul class="nav-links">
    <li class="hide-sm"><a href="/index.html#sobre">Sobre</a></li>
    <li><a href="/galeria.html">Galeria</a></li>
    <li><a href="/flash.html">Flash</a></li>
    <li><a href="/aerografia.html">Aerografia</a></li>
    <li><a href="/preview-tatuagem.html">Criar</a></li>
    <li><a href="/gerador-de-selos.html">Selos</a></li>
    <li><a href="/guia.html">Guia</a></li>
    <li><a href="/deriva.html">Deriva</a></li>
    <li class="hide-sm"><a href="/fisiologia-da-tatuagem.html">Cuidados</a></li>
    <li><a href="/index.html#promocoes" class="destaque">Promoções</a></li>
    <li class="hide-sm"><a href="/index.html#localizacao">Localização</a></li>
    <li><a href="/reserva.html">Reserva</a></li>
    <li><a href="/index.html#contato">Contato</a></li>
  </ul>
</nav>`;

  const SITE_FOOTER = `<footer>
  <p>
    <a href="/index.html">← Voltar à home</a>
  </p>
  <p style="margin-top:0.8rem;">© Micael Faccio · Tatuador em Muriaé, MG</p>
</footer>`;

  function buildHead(cfg) {
    const imgDimsTags = cfg.heroImgIsGenerated
      ? '\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:type" content="image/jpeg">'
      : '';
    const faqSchema = buildFaqSchema(cfg.faq);
    const breadcrumbSchema = buildBreadcrumbSchema(cfg.siteUrl, cfg.breadcrumbs);
    return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(cfg.title)}</title>
<meta name="description" content="${escapeHtml(cfg.metaDesc)}">
<link rel="canonical" href="${cfg.canonical}">
<link rel="icon" type="image/png" href="/favicon.png">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(cfg.title)}">
<meta property="og:description" content="${escapeHtml(cfg.shareDesc)}">
<meta property="og:image" content="${cfg.heroImg}">${imgDimsTags}
<meta property="og:url" content="${cfg.canonical}">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Micael Tatuagem">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(cfg.title)}">
<meta name="twitter:description" content="${escapeHtml(cfg.shareDesc)}">
<meta name="twitter:image" content="${cfg.heroImg}">${breadcrumbSchema}${faqSchema}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="/nav-mobile.css">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>${SHARED_STYLE}</style>`;
  }

  /**
   * Página de categoria (ex: /aerografia/categoria-quadros.html): grid de amostras,
   * contagem ao vivo, texto/FAQ editáveis, lista de outras categorias.
   *
   * cfg: {
   *   siteUrl, title, metaDesc, shareDesc, canonical, heroImg, heroImgIsGenerated,
   *   breadcrumbs: [{name,url}], eyebrow, h1, introText, ctaLabel, ctaLink,
   *   countTextInitial, sampleGridHtmlInitial, otherItemsHtmlInitial, otherItemsLabel,
   *   sections, faq,
   *   runtime: { dataUrl, tagsUrl|null, filterField, categoryValue, catalogLinkBase,
   *              catalogLinkParam, otherPageUrlTemplate }
   * }
   */
  function buildCategoryPageHtml(cfg) {
    const contentBlock = buildContentBlockHtml(cfg.sections);
    const faqBlock = buildFaqBlockHtml(cfg.faq);
    const runtimeJson = JSON.stringify(cfg.runtime);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
${buildHead(cfg)}
</head>
<body>
${SITE_NAV}
<main>
  <p class="eyebrow">${escapeHtml(cfg.eyebrow)}</p>
  <h1>${escapeHtml(cfg.h1)}</h1>
  <p class="item-count" id="itemCount">${escapeHtml(cfg.countTextInitial || '')}</p>
  <p class="intro-text">${escapeHtml(cfg.introText || '')}</p>
  <a href="${cfg.ctaLink}" class="cta">${escapeHtml(cfg.ctaLabel)}</a>
  <div class="sample-grid" id="sampleGrid">${cfg.sampleGridHtmlInitial || ''}</div>${contentBlock}${faqBlock}
  <div class="related-list">
    <h2>${escapeHtml(cfg.otherItemsLabel || 'Outras categorias')}</h2>
    <ul id="relatedList">${cfg.otherItemsHtmlInitial || ''}</ul>
  </div>
</main>
${SITE_FOOTER}
<script>
(function(){
  const CFG = ${runtimeJson};
  const CATALOG_LINK = CFG.catalogLinkBase + '?' + CFG.catalogLinkParam + '=' + encodeURIComponent(CFG.categoryValue);

  fetch(CFG.dataUrl + '?t=' + Date.now(), { cache: 'no-store' })
    .then(r => r.json())
    .then(data => {
      const published = data.filter(it => !it.draft);
      const items = published.filter(it => {
        const val = it[CFG.filterField];
        return Array.isArray(val) ? val.includes(CFG.categoryValue) : val === CFG.categoryValue;
      });
      const countEl = document.getElementById('itemCount');
      if (countEl) countEl.textContent = items.length + (items.length===1 ? ' peça disponível' : ' peças disponíveis');

      const n = 6;
      const step = items.length ? Math.max(1, Math.floor(items.length/n)) : 1;
      const samples = [];
      for (let i=0; i<items.length && samples.length<n; i+=step) samples.push(items[i]);

      const gridEl = document.getElementById('sampleGrid');
      if (gridEl) {
        if (samples.length) {
          gridEl.innerHTML = samples.map(it => {
            const alt = (it.altText || it.title || '').replace(/"/g,'&quot;');
            return '<a href="' + CATALOG_LINK + '" class="sample-item"><img src="/' + it.imageUrl + '" alt="' + alt + '" loading="lazy"></a>';
          }).join('');
        } else {
          gridEl.innerHTML = '<p class="sample-empty">Novas peças em breve. Fale com o tatuador pra encomendar algo personalizado.</p>';
        }
      }
    })
    .catch(() => {});

  if (CFG.tagsUrl) {
    fetch(CFG.tagsUrl + '?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.json())
      .then(tags => {
        const others = tags.filter(t => t !== CFG.categoryValue);
        const el = document.getElementById('relatedList');
        if (el) {
          el.innerHTML = others.map(t => {
            const slug = t.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
            const url = CFG.otherPageUrlTemplate.replace('{slug}', slug);
            return '<li><a href="' + url + '">' + t + '</a></li>';
          }).join('');
        }
      })
      .catch(() => {});
  }
})();
<\/script>
<script src="/nav-mobile.js" defer><\/script>
</body>
</html>
`;
  }

  /**
   * Página de peça individual (ex: /aerografia/peca-3-rosto-feminino.html): imagem grande,
   * texto/FAQ editáveis. Totalmente estática (sem fetch em runtime).
   *
   * cfg: {
   *   siteUrl, title, metaDesc, shareDesc, canonical, heroImg, heroImgIsGenerated,
   *   breadcrumbs, eyebrow, h1, introText, heroAlt,
   *   backLinkLabel, backLinkUrl, sections, faq
   * }
   */
  function buildItemPageHtml(cfg) {
    const contentBlock = buildContentBlockHtml(cfg.sections);
    const faqBlock = buildFaqBlockHtml(cfg.faq);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
${buildHead(cfg)}
</head>
<body>
${SITE_NAV}
<main>
  <p class="eyebrow">${escapeHtml(cfg.eyebrow)}</p>
  <h1>${escapeHtml(cfg.h1)}</h1>
  <div class="hero-image"><img src="${cfg.heroImg}" alt="${escapeHtml(cfg.heroAlt || cfg.h1)}" loading="lazy"></div>
  <p class="intro-text">${escapeHtml(cfg.introText || '')}</p>
  <a href="${cfg.backLinkUrl}" class="cta">${escapeHtml(cfg.backLinkLabel)}</a>${contentBlock}${faqBlock}
</main>
${SITE_FOOTER}
<script src="/nav-mobile.js" defer><\/script>
</body>
</html>
`;
  }

  // ── Editor de seções/FAQ reaproveitável no painel admin ──

  function renderContentEditor(sectionsContainerId, faqContainerId, data) {
    const sectionsEl = document.getElementById(sectionsContainerId);
    const faqEl = document.getElementById(faqContainerId);
    sectionsEl.innerHTML = '';
    faqEl.innerHTML = '';
    const sections = (data && data.sections && data.sections.length) ? data.sections : [{ heading: '', text: '' }];
    const faq = (data && data.faq && data.faq.length) ? data.faq : [{ q: '', a: '' }];
    sections.forEach(s => addContentSectionRow(sectionsContainerId, s.heading, s.text));
    faq.forEach(f => addContentFaqRow(faqContainerId, f.q, f.a));
  }

  function addContentSectionRow(containerId, heading, text) {
    heading = heading || ''; text = text || '';
    const wrap = document.getElementById(containerId);
    const row = document.createElement('div');
    row.className = 'pagegen-section-row';
    row.style.cssText = 'border:1px solid #333;border-radius:6px;padding:.7rem;margin-bottom:.6rem;';
    row.innerHTML = `
      <input type="text" class="pagegen-section-heading" placeholder="Título da seção" value="${escapeHtml(heading)}" style="width:100%;margin-bottom:.4rem;">
      <textarea class="pagegen-section-text" placeholder="Texto da seção" rows="3" style="width:100%;">${escapeHtml(text)}</textarea>
      <button type="button" class="btn-secondary" onclick="this.closest('.pagegen-section-row').remove()" style="margin-top:.4rem;">Remover seção</button>
    `;
    wrap.appendChild(row);
  }

  function addContentFaqRow(containerId, q, a) {
    q = q || ''; a = a || '';
    const wrap = document.getElementById(containerId);
    const row = document.createElement('div');
    row.className = 'pagegen-faq-row';
    row.style.cssText = 'border:1px solid #333;border-radius:6px;padding:.7rem;margin-bottom:.6rem;';
    row.innerHTML = `
      <input type="text" class="pagegen-faq-q" placeholder="Pergunta" value="${escapeHtml(q)}" style="width:100%;margin-bottom:.4rem;">
      <textarea class="pagegen-faq-a" placeholder="Resposta" rows="2" style="width:100%;">${escapeHtml(a)}</textarea>
      <button type="button" class="btn-secondary" onclick="this.closest('.pagegen-faq-row').remove()" style="margin-top:.4rem;">Remover pergunta</button>
    `;
    wrap.appendChild(row);
  }

  function collectContentSections(containerId) {
    return Array.from(document.querySelectorAll('#' + containerId + ' .pagegen-section-row')).map(row => ({
      heading: row.querySelector('.pagegen-section-heading').value.trim(),
      text: row.querySelector('.pagegen-section-text').value.trim()
    })).filter(s => s.heading || s.text);
  }

  function collectContentFaq(containerId) {
    return Array.from(document.querySelectorAll('#' + containerId + ' .pagegen-faq-row')).map(row => ({
      q: row.querySelector('.pagegen-faq-q').value.trim(),
      a: row.querySelector('.pagegen-faq-a').value.trim()
    })).filter(f => f.q || f.a);
  }

  // ── GitHub: commit genérico de arquivo (texto) via worker proxy ──

  async function ghGetSha(opts) {
    const url = `${opts.workerUrl}/gh/repos/${opts.owner}/${opts.repo}/contents/${opts.path}`;
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${opts.ghToken}` } });
      if (r.ok) return (await r.json()).sha;
    } catch (e) {}
    return null;
  }

  async function commitTextFile(opts) {
    const url = `${opts.workerUrl}/gh/repos/${opts.owner}/${opts.repo}/contents/${opts.path}`;
    const sha = await ghGetSha(opts);
    const content = btoa(unescape(encodeURIComponent(opts.text)));
    const body = { message: opts.message, content, branch: opts.branch };
    if (sha) body.sha = sha;
    const res = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${opts.ghToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Erro ao salvar ' + opts.path); }
    return res.json();
  }

  async function deleteFile(opts) {
    const sha = await ghGetSha(opts);
    if (!sha) return;
    const url = `${opts.workerUrl}/gh/repos/${opts.owner}/${opts.repo}/contents/${opts.path}`;
    const body = { message: opts.message, sha, branch: opts.branch };
    await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${opts.ghToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  // ── sitemap.xml: upsert/remove de uma entrada <url> ──

  async function upsertSitemapEntry(opts) {
    // opts: {workerUrl, owner, repo, branch, ghToken, loc, imageUrl, imageTitle, imageCaption}
    const url = `${opts.workerUrl}/gh/repos/${opts.owner}/${opts.repo}/contents/sitemap.xml`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${opts.ghToken}` } });
    if (!res.ok) throw new Error('Nao foi possivel ler sitemap.xml');
    const fileData = await res.json();
    let xml = decodeURIComponent(escape(atob(fileData.content)));

    let imageBlock = '';
    if (opts.imageUrl) {
      imageBlock = `
      <image:image>
        <image:loc>${opts.imageUrl}</image:loc>
        <image:title>${escapeXml(opts.imageTitle || '')}</image:title>
        <image:caption>${escapeXml((opts.imageCaption || '').slice(0, 150))}</image:caption>
      </image:image>`;
    }
    const today = new Date().toISOString().split('T')[0];
    const urlBlock = `  <url>
    <loc>${opts.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>${imageBlock}
  </url>`;

    const escLoc = opts.loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blockRegex = new RegExp(`\\s*<url>\\s*<loc>${escLoc}</loc>[\\s\\S]*?</url>`);
    if (blockRegex.test(xml)) {
      xml = xml.replace(blockRegex, '\n' + urlBlock);
    } else {
      xml = xml.replace('</urlset>', urlBlock + '\n</urlset>');
    }

    const newContent = btoa(unescape(encodeURIComponent(xml)));
    const body = { message: opts.message || `Atualiza sitemap.xml (${opts.loc})`, content: newContent, branch: opts.branch, sha: fileData.sha };
    const putRes = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${opts.ghToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!putRes.ok) { const e = await putRes.json(); throw new Error(e.message || 'Erro ao atualizar sitemap'); }
  }

  async function removeSitemapEntry(opts) {
    const url = `${opts.workerUrl}/gh/repos/${opts.owner}/${opts.repo}/contents/sitemap.xml`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${opts.ghToken}` } });
    if (!res.ok) return;
    const fileData = await res.json();
    let xml = decodeURIComponent(escape(atob(fileData.content)));
    const escLoc = opts.loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blockRegex = new RegExp(`\\s*<url>\\s*<loc>${escLoc}</loc>[\\s\\S]*?</url>`);
    if (!blockRegex.test(xml)) return;
    xml = xml.replace(blockRegex, '');
    const newContent = btoa(unescape(encodeURIComponent(xml)));
    const body = { message: opts.message || `Remove entrada de sitemap (${opts.loc})`, content: newContent, branch: opts.branch, sha: fileData.sha };
    await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${opts.ghToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  global.PageGen = {
    escapeHtml, escapeXml, slugify,
    buildContentBlockHtml, buildFaqBlockHtml, buildFaqSchema, buildBreadcrumbSchema,
    buildCategoryPageHtml, buildItemPageHtml,
    renderContentEditor, addContentSectionRow, addContentFaqRow, collectContentSections, collectContentFaq,
    ghGetSha, commitTextFile, deleteFile,
    upsertSitemapEntry, removeSitemapEntry
  };
})(window);
