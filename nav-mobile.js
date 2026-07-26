/* ===========================================================
   nav-mobile.js — injeta o botão hambúrguer em qualquer <nav>
   com .nav-links, controla abrir/fechar o dropdown mobile, e
   agrupa itens secundários num dropdown "Mais ▾" no desktop
   (pra evitar que o menu estoure/sume em telas largas).
   =========================================================== */
(function () {
  // Calcula o caminho do ícone a partir do próprio <script>, pra funcionar
  // igual em qualquer profundidade de pasta (raiz, /estilo/, /f/ etc.) sem
  // precisar de configuração por página.
  var ICON_SRC = 'nav-icon.webp';
  (function () {
    var scriptEl = document.currentScript;
    if (scriptEl && scriptEl.src) {
      ICON_SRC = scriptEl.src.replace(/nav-mobile\.js(\?.*)?$/, '') + 'nav-icon.webp';
    }
  })();

  function injectLogoIcon(nav) {
    var logo = nav.querySelector('.nav-logo, .site-nav-logo');
    if (!logo || logo.querySelector('img')) return;
    var img = document.createElement('img');
    img.src = ICON_SRC;
    img.alt = '';
    img.width = 28;
    img.height = 28;
    logo.insertBefore(img, logo.firstChild);
  }

  // Itens que viram "Mais ▾" no desktop — casados por fragmento de href,
  // não por página, então funciona igual em qualquer lugar do site.
  var MORE_HREF_FRAGMENTS = [
    '#sobre',
    'gerador-de-selos.html',
    'aerografia.html',
    'deriva.html',
    'fisiologia-da-tatuagem.html',
    '#promocoes',
    '#localizacao'
  ];

  function isMoreLink(href) {
    if (!href) return false;
    for (var i = 0; i < MORE_HREF_FRAGMENTS.length; i++) {
      if (href.indexOf(MORE_HREF_FRAGMENTS[i]) !== -1) return true;
    }
    return false;
  }

  function buildDesktopMore(nav, links) {
    if (nav.dataset.navMoreInit) return;
    // só monta o agrupamento em telas largas — no mobile o hambúrguer já
    // mostra tudo achatado, não precisa de "Mais"
    if (window.innerWidth <= 760) return;

    var candidates = Array.prototype.slice.call(links.children).filter(function (li) {
      var a = li.querySelector('a');
      return a && isMoreLink(a.getAttribute('href'));
    });
    // só vale a pena agrupar se sobrar mais de um item — evita um "Mais ▾"
    // com um único link dentro em páginas com menu mais enxuto (ex: guia.html)
    if (candidates.length < 2) return;
    nav.dataset.navMoreInit = '1';

    var moreLi = document.createElement('li');
    moreLi.className = 'nav-more';

    var moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'nav-more-btn';
    moreBtn.textContent = 'Mais ▾';
    moreBtn.setAttribute('aria-expanded', 'false');
    moreBtn.setAttribute('aria-haspopup', 'true');
    moreLi.appendChild(moreBtn);
    links.appendChild(moreLi);

    // O painel é anexado direto no <body> e posicionado com position:fixed,
    // calculado via JS. Isso evita depender do contexto de empilhamento das
    // sections da página (algumas usam position:relative/overflow:hidden
    // pros elementos decorativos, o que podia esconder um dropdown absoluto
    // aninhado dentro do <nav>).
    var panel = document.createElement('ul');
    panel.className = 'nav-more-panel';
    candidates.forEach(function (li) { panel.appendChild(li); });
    document.body.appendChild(panel);

    function positionPanel() {
      var r = moreBtn.getBoundingClientRect();
      panel.style.top = (r.bottom + 10) + 'px';
      panel.style.right = (window.innerWidth - r.right) + 'px';
    }

    function closeMore() {
      panel.classList.remove('open');
      moreBtn.setAttribute('aria-expanded', 'false');
    }
    function toggleMore(e) {
      e.stopPropagation();
      var opening = !panel.classList.contains('open');
      if (opening) positionPanel();
      panel.classList.toggle('open', opening);
      moreBtn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    }

    moreBtn.addEventListener('click', toggleMore);
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMore();
    });
    document.addEventListener('click', function (e) {
      if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== moreBtn) closeMore();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMore();
    });
    window.addEventListener('resize', closeMore);
    window.addEventListener('scroll', function () {
      if (panel.classList.contains('open')) positionPanel();
    }, { passive: true });
  }

  function initNav(nav) {
    if (nav.dataset.navMobileInit) return;
    var links = nav.querySelector('.nav-links, .site-nav-links');
    if (!links) return;
    nav.dataset.navMobileInit = '1';

    injectLogoIcon(nav);
    buildDesktopMore(nav, links);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-toggle';
    btn.setAttribute('aria-label', 'Abrir menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
      '<path class="ico-bars" d="M4 7h16M4 12h16M4 17h16"/>' +
      '<path class="ico-x" d="M6 6l12 12M18 6L6 18"/>' +
      '</svg>';
    links.insertAdjacentElement('afterend', btn);

    function setHeight() {
      nav.style.setProperty('--nav-h', nav.offsetHeight + 'px');
    }
    setHeight();
    window.addEventListener('resize', setHeight);

    function close() {
      nav.classList.remove('nav-open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function toggle() {
      var open = nav.classList.toggle('nav-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) setHeight();
    }

    btn.addEventListener('click', toggle);
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('nav-open') && !nav.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  function init() {
    document.querySelectorAll('nav').forEach(initNav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
