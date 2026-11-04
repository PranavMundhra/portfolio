document.querySelectorAll('[data-print]').forEach((button) => {
  button.hidden = false;
  button.addEventListener('click', () => window.print());
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Fade blocks in as they scroll into view. Blocks already on screen are left alone, so nothing flashes.
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const targets = document.querySelectorAll('.section-heading, .achievement, .project-card, .background-item, .personal-panel, .contact-panel, .detail-section');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  targets.forEach((target) => {
    if (target.getBoundingClientRect().top < window.innerHeight) return;
    // Stagger siblings in the same row of cards.
    const index = [...target.parentElement.children].indexOf(target);
    target.style.setProperty('--reveal-delay', `${Math.min(index % 3, 2) * 0.08}s`);
    target.classList.add('reveal');
    observer.observe(target);
    // Once revealed, drop the reveal styling so the element's own transitions (e.g. card hover) apply without delay.
    target.addEventListener('transitionend', function settle(event) {
      if (event.target !== target || !target.classList.contains('is-visible')) return;
      target.classList.remove('reveal', 'is-visible');
      target.style.removeProperty('--reveal-delay');
      target.removeEventListener('transitionend', settle);
    });
  });
}

// Dot-grid glow: a brighter patch of the background grid that follows the cursor, moving in grid steps.
// Mouse and pen only; skipped for touch and reduced motion. Only a compositor transform changes.
if (!reducedMotion.matches && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const glow = document.createElement('div');
  glow.className = 'dot-glow';
  glow.setAttribute('aria-hidden', 'true');
  document.body.append(glow);
  const grid = 24;
  const half = 144; // half the 288px patch, a whole number of grid cells so the dots line up with the page grid
  let cell = '';
  let frame = 0;
  let point;
  const place = () => {
    frame = 0;
    const x = Math.round(point.clientX / grid) * grid - half;
    const y = Math.round(point.clientY / grid) * grid - half;
    const key = `${x},${y}`;
    if (key !== cell) { cell = key; glow.style.transform = `translate(${x}px, ${y}px)`; }
    if (!glow.classList.contains('is-on')) {
      // First appearance (or re-entry): jump straight to the cursor instead of sliding in from the corner.
      glow.style.transition = 'none';
      glow.getBoundingClientRect();
      glow.style.transition = '';
      glow.classList.add('is-on');
    }
  };
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    point = event;
    if (!frame) frame = window.requestAnimationFrame(place);
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => glow.classList.remove('is-on'));
}

// Highlight the nav link for the section nearest the middle of the screen.
const navLinks = [...document.querySelectorAll('.section-nav a[href^="#"]')];
if (navLinks.length) {
  const sections = navLinks.map((link) => ({ link, section: document.getElementById(link.hash.slice(1)) })).filter((item) => item.section);
  const navBar = navLinks[0].parentElement;
  let active;
  let queued = false;
  const update = () => {
    queued = false;
    // The current section is the last one whose top has passed a line about a third of the way down the screen.
    // At the very bottom of the page the last section can never reach that line, so it is chosen directly.
    const probe = window.innerHeight * 0.35;
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
    let current = sections[0];
    sections.forEach((item) => { if (item.section.getBoundingClientRect().top <= probe) current = item; });
    if (atBottom) current = sections[sections.length - 1];
    if (current.link === active) return;
    active?.removeAttribute('aria-current');
    current.link.setAttribute('aria-current', 'true');
    active = current.link;
    // Keep the active link visible when the nav scrolls sideways on small screens.
    // This scrolls only the nav; scrollIntoView would interrupt the page's own smooth scroll.
    if (navBar.scrollWidth > navBar.clientWidth) navBar.scrollLeft = active.offsetLeft - (navBar.clientWidth - active.offsetWidth) / 2;
  };
  const schedule = () => { if (!queued) { queued = true; window.requestAnimationFrame(update); } };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
}

// The heading's full accessible name and layout remain stable during typing.
const surname = document.querySelector('[data-type-surname]');
if (surname) {
  const fullText = surname.textContent;
  const repeatDelay = 18000;
  let timer;
  const restore = () => {
    window.clearTimeout(timer);
    surname.textContent = fullText;
    surname.classList.remove('is-typing');
  };
  const canAnimate = () => !reducedMotion.matches && !document.hidden;
  const typeName = () => {
    restore();
    if (!canAnimate()) return;
    surname.textContent = '';
    surname.classList.add('is-typing');
    let position = 0;
    const typeNext = () => {
      if (!canAnimate()) return restore();
      surname.textContent = fullText.slice(0, ++position);
      if (position < fullText.length) timer = window.setTimeout(typeNext, 120);
      else {
        restore();
        timer = window.setTimeout(typeName, repeatDelay);
      }
    };
    timer = window.setTimeout(typeNext, 120);
  };
  const reset = () => {
    restore();
    if (canAnimate()) timer = window.setTimeout(typeName, repeatDelay);
  };
  reducedMotion.addEventListener('change', reset);
  document.addEventListener('visibilitychange', reset);
  if (canAnimate()) timer = window.setTimeout(typeName, 500);
}
