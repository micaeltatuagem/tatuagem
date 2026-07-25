/* ===========================================================
   nav-mobile.js — injeta o botão hambúrguer em qualquer <nav>
   com .nav-links, e controla abrir/fechar o dropdown mobile.
   =========================================================== */
(function () {
  function initNav(nav) {
    if (nav.dataset.navMobileInit) return;
    var links = nav.querySelector('.nav-links, .site-nav-links');
    if (!links) return;
    nav.dataset.navMobileInit = '1';

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
