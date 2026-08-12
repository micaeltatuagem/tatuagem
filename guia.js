(function(){
  // ==================== SUBSTITUA AQUI ====================
  const SUPABASE_URL  = 'https://rpgcsejfewltricfsdrd.supabase.co';
  const SUPABASE_KEY  = 'sb_publishable_7LF70sbQS_es_uco138rqw_YfbqnIsa';
  // ========================================================

  // nome do bucket do Storage onde as imagens dos verbetes ficam
  const BUCKET_IMAGENS = 'guia-imagens';

  const CATEGORIAS = {
    significado: 'Significado',
    estilo: 'Estilo',
    tecnica: 'Técnica',
    termo: 'Termo'
  };
  const TEMAS = {
    significado: 'Significados',
    estilo: 'Estilos',
    tecnica: 'Técnicas',
    termo: 'Termos'
  };

  let allEntries = [];
  let view = 'az';
  let cat = 'todos';

  const conteudoEl = document.getElementById('conteudo');
  const azIndexEl  = document.getElementById('azIndex');
  const vazioEl    = document.getElementById('vazio');
  const buscaEl    = document.getElementById('busca');

  function normalize(str){
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function urlImagem(caminho){
    if (!caminho) return '';
    if (/^https?:\/\//i.test(caminho)) return caminho;
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_IMAGENS}/${caminho}`;
  }

  function mapRow(row){
    return {
      titulo: row.termo || '',
      slug: row.slug || '',
      categoria: row.categoria || '',
      resumo: row.descricao || '',
      letra: (row.letra || normalize(row.termo || '')[0] || '#').toUpperCase(),
      ordem: row.ordem || 0,
      imagem_url: row.imagem_url || '',
      link_estilo: row.link_estilo || '',
      tema: [row.categoria]
    };
  }

  function filterEntries(){
    const q = normalize(buscaEl.value.trim());
    return allEntries.filter(e => {
      if (cat !== 'todos' && e.categoria !== cat) return false;
      if (q && !normalize(e.titulo + ' ' + (e.resumo||'')).includes(q)) return false;
      return true;
    });
  }

  function renderAZ(entries){
    const groups = {};
    entries.forEach(e => {
      const letter = e.letra;
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(e);
    });
    Object.keys(groups).forEach(k => {
      groups[k].sort((a,b) => (a.ordem - b.ordem) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
    });
    const letters = Object.keys(groups).sort();

    azIndexEl.innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => {
      const has = letters.includes(l);
      return `<a class="az-letter ${has ? 'has-entries' : ''}" href="${has ? '#letra-' + l : '#'}" ${!has ? 'tabindex="-1" aria-disabled="true"' : ''}>${l}</a>`;
    }).join('');

    conteudoEl.innerHTML = letters.map(l => `
      <section class="grupo" id="letra-${l}">
        <h2 class="grupo-titulo">${l}</h2>
        <div class="verbetes-grid">
          ${groups[l].map(cardHtml).join('')}
        </div>
      </section>
    `).join('');
  }

  function renderTema(entries){
    azIndexEl.innerHTML = '';
    const groups = {};
    entries.forEach(e => {
      const key = e.categoria || 'outros';
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    Object.keys(groups).forEach(k => {
      groups[k].sort((a,b) => (a.ordem - b.ordem) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
    });
    const cats = Object.keys(groups).sort((a,b) => {
      const order = {significado:1, estilo:2, tecnica:3, termo:4};
      return (order[a]||99) - (order[b]||99);
    });

    conteudoEl.innerHTML = cats.map(t => `
      <section class="grupo">
        <h2 class="grupo-titulo">${TEMAS[t] || t}</h2>
        <div class="verbetes-grid">
          ${groups[t].map(cardHtml).join('')}
        </div>
      </section>
    `).join('');
  }

  function cardHtml(e){
    // Sempre abre o modal de detalhe; o link do estilo fica dentro do modal, não no card.
    return `
      <a class="verbete-card" href="#verbete-${e.slug}" data-slug="${e.slug}">
        <div class="verbete-cat">${CATEGORIAS[e.categoria] || e.categoria}</div>
        <div class="verbete-titulo">${e.titulo}</div>
        <p class="verbete-resumo">${e.resumo || ''}</p>
      </a>
    `;
  }

  function updateSchema(entries){
    const schema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Guia de Tatuagem — Micael Tatuagem",
      "itemListElement": entries.slice(0, 50).map((e, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "name": e.titulo,
        "url": "https://micaeltatuagem.com.br/guia#verbete-" + e.slug
      }))
    };
    document.getElementById('schemaData').textContent = JSON.stringify(schema);
  }

  function render(){
    const entries = filterEntries();
    vazioEl.style.display = entries.length ? 'none' : 'block';
    if (view === 'az') renderAZ(entries); else renderTema(entries);
    updateSchema(entries);
  }

  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      view = btn.dataset.view;
      render();
    });
  });

  document.getElementById('catGroup').addEventListener('click', e => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    cat = btn.dataset.cat;
    render();
  });

  let searchTimer;
  buscaEl.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 150);
  });

  // ====== MODAL DE DETALHE DO VERBETE ======
  const modalEl        = document.getElementById('verbeteModal');
  const modalCatEl      = document.getElementById('vModalCategoria');
  const modalTituloEl   = document.getElementById('vModalTitulo');
  const modalImagemEl   = document.getElementById('vModalImagem');
  const modalResumoEl   = document.getElementById('vModalResumo');
  const modalEstiloEl   = document.getElementById('vModalEstilo');
  const modalFecharEls  = document.querySelectorAll('[data-fechar-modal]');

  function abrirVerbete(slug){
    const entry = allEntries.find(e => e.slug === slug);
    if (!entry || !modalEl) return;

    modalCatEl.textContent = CATEGORIAS[entry.categoria] || entry.categoria;
    modalTituloEl.textContent = entry.titulo;
    modalResumoEl.textContent = entry.resumo || '';

    const img = urlImagem(entry.imagem_url);
    if (img) {
      modalImagemEl.src = img;
      modalImagemEl.alt = entry.titulo;
      modalImagemEl.style.display = 'block';
    } else {
      modalImagemEl.style.display = 'none';
      modalImagemEl.removeAttribute('src');
    }

    if (entry.link_estilo) {
      modalEstiloEl.href = entry.link_estilo;
      modalEstiloEl.style.display = 'inline-block';
    } else {
      modalEstiloEl.style.display = 'none';
    }

    modalEl.classList.add('aberto');
    document.body.style.overflow = 'hidden';
  }

  function fecharVerbete(){
    if (!modalEl) return;
    modalEl.classList.remove('aberto');
    document.body.style.overflow = '';
    if (location.hash.startsWith('#verbete-')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function checarHash(){
    const hash = location.hash;
    if (hash.startsWith('#verbete-')) {
      const slug = hash.replace('#verbete-', '');
      abrirVerbete(slug);
    } else {
      fecharVerbete();
    }
  }

  window.addEventListener('hashchange', checarHash);
  modalFecharEls.forEach(el => el.addEventListener('click', () => {
    location.hash = '';
    fecharVerbete();
  }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalEl && modalEl.classList.contains('aberto')) {
      location.hash = '';
      fecharVerbete();
    }
  });

  // ====== BUSCA NO SUPABASE (REST API) ======
  fetch(`${SUPABASE_URL}/rest/v1/guia_verbetes?select=*&order=termo.asc`, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  })
  .then(r => {
    if (!r.ok) throw new Error('Erro ' + r.status);
    return r.json();
  })
  .then(data => {
    allEntries = Array.isArray(data) ? data.map(mapRow) : [];
    render();
    checarHash(); // se a página já abriu com #verbete-slug na URL, abre o modal direto
  })
  .catch(err => {
    console.error(err);
    conteudoEl.innerHTML = '';
    vazioEl.textContent = 'Não foi possível carregar o guia agora. Verifique as credenciais do Supabase.';
    vazioEl.style.display = 'block';
  });
})();
