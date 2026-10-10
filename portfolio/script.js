(() => {
  'use strict';

  const header = document.getElementById('siteHeader');
  const progress = document.getElementById('siteProgress');
  const menuToggle = document.getElementById('menuToggle');
  const mobileNav = document.getElementById('mobileNav');
  const year = document.getElementById('year');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  const projectCards = [...document.querySelectorAll('[data-group]')];
  const emptyFilter = document.getElementById('emptyFilter');

  if (year) year.textContent = new Date().getFullYear();

  const updateScroll = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = (maxScroll > 0 ? Math.min(100, Math.max(0, window.scrollY / maxScroll * 100)) : 0) + '%';
    if (header) header.classList.toggle('scrolled', window.scrollY > 16);
  };
  window.addEventListener('scroll', updateScroll, {passive:true});
  window.addEventListener('resize', updateScroll, {passive:true});
  updateScroll();

  const closeMenu = () => {
    if (!menuToggle || !mobileNav) return;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
    mobileNav.hidden = true;
    document.body.classList.remove('menu-open');
  };

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => {
      const opening = menuToggle.getAttribute('aria-expanded') !== 'true';
      menuToggle.setAttribute('aria-expanded', String(opening));
      menuToggle.setAttribute('aria-label', opening ? 'Close navigation' : 'Open navigation');
      mobileNav.hidden = !opening;
      document.body.classList.toggle('menu-open', opening);
    });
    mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    window.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
    window.matchMedia('(min-width: 821px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
  }

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      const selection = button.dataset.filter;
      let visible = 0;
      filterButtons.forEach(item => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      projectCards.forEach(card => {
        const matches = selection === 'all' || card.dataset.group === selection;
        card.hidden = !matches;
        if (matches) visible++;
      });
      if (emptyFilter) emptyFilter.hidden = visible > 0;
    });
  });

  const revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, {threshold: 0.07, rootMargin: '0px 0px -32px 0px'});
    revealElements.forEach((node, index) => {
      node.style.transitionDelay = Math.min(index % 3, 2) * 70 + 'ms';
      observer.observe(node);
    });
  } else {
    revealElements.forEach(node => node.classList.add('visible'));
  }
})();
