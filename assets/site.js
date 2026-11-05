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

// Dot field: the page's dot grid is drawn on a canvas. Dots near the cursor are pushed outward, away from it, and brighten,
// and the whole effect trails the pointer with a little inertia so it moves like a fluid.
// Mouse and pen only; skipped for touch and reduced motion, which keep the static CSS grid. Only the area around the
// cursor is redrawn, and the loop stops as soon as everything has settled.
if (!reducedMotion.matches && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const canvas = document.createElement('canvas');
  canvas.className = 'dot-field';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    document.body.prepend(canvas);
    const GRID = 24; // keep in step with --grid in styles.css
    const REACH = 150; // dots farther than this from the cursor are untouched
    const SIGMA = 52; // how tightly the push is focused around the cursor
    const PUSH = 0.6; // fraction of its distance from the cursor a dot is pushed outward at full strength
    const BASE = [158, 114, 211];
    const LIT = [232, 208, 252];
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    const target = { x: 0, y: 0 };
    const smooth = { x: 0, y: 0 };
    let strength = 0;
    let wanted = 0; // 1 while the pointer is over the page, otherwise 0
    let frame = 0;
    let painted = null; // box redrawn last frame, so it can be cleaned up

    const dot = (x, y, t) => {
      const r = 1.3 + 1.6 * t;
      const mix = (a, b) => Math.round(a + (b - a) * t);
      ctx.fillStyle = `rgba(${mix(BASE[0], LIT[0])},${mix(BASE[1], LIT[1])},${mix(BASE[2], LIT[2])},${(0.2 + 0.75 * t).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    const drawCell = (col, row, pulled) => {
      const bx = col * GRID + GRID / 2;
      const by = row * GRID + GRID / 2;
      if (pulled) {
        const dx = smooth.x - bx;
        const dy = smooth.y - by;
        const d2 = dx * dx + dy * dy;
        if (d2 < REACH * REACH) {
          const t = Math.exp(-d2 / (2 * SIGMA * SIGMA)) * strength;
          dot(bx - dx * PUSH * t, by - dy * PUSH * t, t);
          return;
        }
      }
      dot(bx, by, 0);
    };
    const boxAround = (x, y) => ({
      c0: Math.max(0, Math.floor((x - REACH - GRID) / GRID)),
      c1: Math.min(cols - 1, Math.ceil((x + REACH + GRID) / GRID)),
      r0: Math.max(0, Math.floor((y - REACH - GRID) / GRID)),
      r1: Math.min(rows - 1, Math.ceil((y + REACH + GRID) / GRID)),
    });
    const inside = (box, c, r) => box && c >= box.c0 && c <= box.c1 && r >= box.r0 && r <= box.r1;

    const paintAll = () => {
      ctx.clearRect(0, 0, width, height);
      for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) drawCell(c, r, false);
    };
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      cols = Math.ceil(width / GRID);
      rows = Math.ceil(height / GRID);
      painted = null;
      paintAll();
    };

    const clearBox = (box) => {
      if (box) ctx.clearRect(box.c0 * GRID - 4, box.r0 * GRID - 4, (box.c1 - box.c0 + 1) * GRID + 8, (box.r1 - box.r0 + 1) * GRID + 8);
    };
    const step = () => {
      frame = 0;
      smooth.x += (target.x - smooth.x) * 0.16;
      smooth.y += (target.y - smooth.y) * 0.16;
      strength += (wanted - strength) * 0.12;
      const settled = wanted === 0 && strength < 0.01;
      const now = settled ? null : boxAround(smooth.x, smooth.y);
      if (!painted && !now) return;
      // Clear and repaint only the area where the effect was and where it is now.
      clearBox(painted);
      clearBox(now);
      const c0 = Math.min(painted ? painted.c0 : Infinity, now ? now.c0 : Infinity);
      const c1 = Math.max(painted ? painted.c1 : -1, now ? now.c1 : -1);
      const r0 = Math.min(painted ? painted.r0 : Infinity, now ? now.r0 : Infinity);
      const r1 = Math.max(painted ? painted.r1 : -1, now ? now.r1 : -1);
      for (let r = r0; r <= r1; r += 1) {
        for (let c = c0; c <= c1; c += 1) {
          if (inside(painted, c, r) || inside(now, c, r)) drawCell(c, r, !settled);
        }
      }
      painted = now;
      // Keep going only while the cursor is still catching up or the strength is still easing in or out.
      const moving = Math.abs(target.x - smooth.x) > 0.3 || Math.abs(target.y - smooth.y) > 0.3;
      if (!settled && (moving || Math.abs(wanted - strength) > 0.005)) frame = window.requestAnimationFrame(step);
    };
    const wake = () => { if (!frame) frame = window.requestAnimationFrame(step); };

    window.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      if (wanted === 0 && strength < 0.01) { smooth.x = event.clientX; smooth.y = event.clientY; }
      target.x = event.clientX;
      target.y = event.clientY;
      wanted = 1;
      wake();
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { wanted = 0; wake(); });
    window.addEventListener('resize', () => { window.cancelAnimationFrame(frame); frame = 0; resize(); });
    resize();
    document.documentElement.classList.add('dot-canvas');
  }
}

// Custom cursor: a dot that tracks the pointer exactly and a ring that eases behind it. The ring grows over links and
// buttons, becomes a slim caret over text so it still reads as selectable, and shrinks while pressed.
// Mouse and pen only; skipped for touch and reduced motion, and form fields keep the native cursor.
if (!reducedMotion.matches && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const root = document.documentElement;
  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  ring.append(document.createElement('i'));
  [dot, ring].forEach((item) => item.setAttribute('aria-hidden', 'true'));
  document.body.append(dot, ring);
  const INTERACTIVE = 'a, button, summary, label, [role="button"]';
  const TEXT = 'p, li, h1, h2, h3, figcaption, dt, dd, td, th, blockquote, code';
  const NATIVE = 'input, textarea, select, [contenteditable="true"]';
  const goal = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  let started = false;
  let frame = 0;
  const place = (element, x, y) => { element.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
  const follow = () => {
    frame = 0;
    eased.x += (goal.x - eased.x) * 0.2;
    eased.y += (goal.y - eased.y) * 0.2;
    place(ring, eased.x, eased.y);
    if (Math.abs(goal.x - eased.x) > 0.1 || Math.abs(goal.y - eased.y) > 0.1) frame = window.requestAnimationFrame(follow);
  };
  const setState = (target) => {
    const element = target instanceof Element ? target : null;
    const native = !!element?.closest(NATIVE);
    const link = !native && !!element?.closest(INTERACTIVE);
    const text = !native && !link && !!element?.closest(TEXT);
    root.classList.toggle('cursor-native', native);
    [dot, ring].forEach((item) => { item.classList.toggle('is-link', link); item.classList.toggle('is-text', text); });
  };
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    goal.x = event.clientX;
    goal.y = event.clientY;
    if (!started) {
      // The real cursor is only hidden once the pointer's position is known, so it never vanishes unseen.
      started = true;
      eased.x = goal.x;
      eased.y = goal.y;
      root.classList.add('custom-cursor');
    }
    root.classList.add('cursor-on');
    place(dot, goal.x, goal.y);
    setState(event.target);
    if (!frame) frame = window.requestAnimationFrame(follow);
  }, { passive: true });
  window.addEventListener('pointerdown', (event) => { if (event.pointerType !== 'touch') [dot, ring].forEach((item) => item.classList.add('is-down')); });
  window.addEventListener('pointerup', () => [dot, ring].forEach((item) => item.classList.remove('is-down')));
  root.addEventListener('mouseleave', () => root.classList.remove('cursor-on'));
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
