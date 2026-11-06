// Listen: reads a case study aloud with the browser's built-in speech voices (Web Speech API).
// Nothing is sent anywhere. The player is hidden when the browser has no speech support.
(() => {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
  const page = document.querySelector('main.reading');
  if (!page) return;
  const synth = window.speechSynthesis;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- What gets read ------------------------------------------------------------------------------------------
  const SKIP_SECTION = /evidence|links/i;
  const PRONOUNCE = [
    [/PM2\.5/g, 'P M two point five'], [/ConvLSTM/g, 'conv L S T M'], [/ONNX/g, 'O N N X'], [/\bLAN\b/g, 'L A N'],
    [/\bPCs\b/g, 'P Cs'], [/\bPC\b/g, 'P C'], [/\bCPU\b/g, 'C P U'], [/SMAPE/g, 'S MAPE'], [/SCADA/g, 'scada'],
    [/FastAPI/g, 'Fast A P I'], [/\bAPI\b/g, 'A P I'], [/\bML\b/g, 'M L'], [/\bAI\b/g, 'A I'], [/\bUI\b/g, 'U I'],
    [/PyPI/g, 'pie P I'], [/OTTools/g, 'O T tools'], [/VoiceRX/g, 'Voice R X'], [/\bT4\b/g, 'T four'], [/IIIT/g, 'I I I T'],
    [/NMIMS/g, 'N M I M S'], [/ANRF/g, 'A N R F'], [/SNOMED CT/g, 'snow med C T'], [/Neo4j/g, 'Neo four J'],
    [/GPT-4o/g, 'G P T four o'], [/HTTP/g, 'H T T P'], [/PostgreSQL/g, 'post gress Q L'], [/\bSQL\b/g, 'sequel'],
    [/Streamlit/g, 'stream lit'], [/AppTest/g, 'app test'], [/\bCSV\b/g, 'C S V'], [/LaTeX/g, 'lay tek'], [/MODI/g, 'modi'], [/\bVAM\b/g, 'V A M'], [/FADE/g, 'fade'], [/\bGB\b/g, 'gigabytes'],
    [/\bCARE\b/g, 'care'], [/→/g, ' to '], [/×/g, ' times '], [/≈/g, ' about '], [/\s[–—]\s/g, ', '], [/↗|↓|→/g, ''],
  ];
  const speakable = (raw) => PRONOUNCE.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), raw).replace(/\s+/g, ' ').trim();
  const clean = (element) => (element.textContent || '').replace(/\s+/g, ' ').trim();

  const units = []; // { el, text, section }
  const sections = [];
  const addUnit = (el, text, sectionIndex) => { if (text) units.push({ el, text, section: sectionIndex }); };
  [...page.querySelectorAll(':scope > .detail-section')].forEach((section) => {
    const heading = section.querySelector(':scope > h2');
    if (!heading || SKIP_SECTION.test(clean(heading))) return;
    const index = sections.length;
    sections.push({ el: section, title: clean(heading), first: units.length });
    addUnit(heading, clean(heading), index);
    [...section.children].forEach((child) => {
      if (child === heading || child.classList.contains('tts-here')) return;
      const tag = child.tagName;
      if (tag === 'P') addUnit(child, clean(child), index);
      else if (tag === 'UL' || tag === 'OL') [...child.children].forEach((item) => addUnit(item, clean(item), index));
      else if (tag === 'H3') addUnit(child, clean(child), index);
      else if (tag === 'FIGURE') {
        const caption = child.querySelector('figcaption');
        const table = child.querySelector('table');
        if (table) {
          const heads = [...table.querySelectorAll('thead th')].map(clean);
          [...table.querySelectorAll('tbody tr')].forEach((row) => {
            const cells = [...row.children].map(clean);
            addUnit(row, cells.map((cell, i) => (heads[i] ? `${heads[i]}: ${cell}` : cell)).join('. '), index);
          });
        }
        if (caption) addUnit(caption, clean(caption), index);
      }
    });
  });
  if (units.length < 3) return;
  const totalWords = units.reduce((sum, unit) => sum + unit.text.split(' ').length, 0);

  // ---- Settings (remembered between visits) ---------------------------------------------------------------------
  const store = {
    get: (key, fallback) => { try { return window.localStorage.getItem(`listen:${key}`) ?? fallback; } catch { return fallback; } },
    set: (key, value) => { try { window.localStorage.setItem(`listen:${key}`, value); } catch { /* storage unavailable */ } },
  };
  let rate = Number(store.get('rate', '1')) || 1;
  let voiceId = store.get('voice', '');

  // ---- Voices --------------------------------------------------------------------------------------------------
  let voices = [];
  const pickVoice = () => {
    const chosen = voices.find((voice) => voice.voiceURI === voiceId);
    if (chosen) return chosen;
    const score = (voice) => (/natural|online/i.test(voice.name) ? 4 : 0) + (/google/i.test(voice.name) ? 2 : 0) + (/^en-(IN|GB|US)/i.test(voice.lang) ? 1 : 0) + (voice.default ? 0.5 : 0);
    return [...voices].sort((a, b) => score(b) - score(a))[0] || null;
  };
  const loadVoices = () => {
    voices = synth.getVoices().filter((voice) => /^en/i.test(voice.lang));
    voiceSelect.replaceChildren(...voices.map((voice) => {
      const option = document.createElement('option');
      option.value = voice.voiceURI;
      option.textContent = `${voice.name.replace(/^(Microsoft|Google)\s+/i, '')} (${voice.lang})`;
      return option;
    }));
    const current = pickVoice();
    if (current) voiceSelect.value = current.voiceURI;
    voiceSelect.disabled = voices.length === 0;
  };

  // ---- Interface -----------------------------------------------------------------------------------------------
  const icon = (path) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="${path}" fill="currentColor"/></svg>`;
  const ICON = {
    play: icon('M8 5v14l11-7z'),
    pause: icon('M6 5h4v14H6zM14 5h4v14h-4z'),
    stop: icon('M6 6h12v12H6z'),
    prev: icon('M6 6h2v12H6zM9.5 12 18 6v12z'),
    next: icon('M16 6h2v12h-2zM6 18V6l8.5 6z'),
    gear: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 6h9.2a3 3 0 0 1 5.6 0H20v2h-1.2a3 3 0 0 1-5.6 0H4zm14 1a1 1 0 1 0-2 0 1 1 0 0 0 2 0zM4 16h1.2a3 3 0 0 1 5.6 0H20v2h-9.2a3 3 0 0 1-5.6 0H4zm5-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>',
  };
  const button = (className, label, html) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.setAttribute('aria-label', label);
    element.innerHTML = html;
    return element;
  };
  const select = (className, label) => {
    const wrap = document.createElement('label');
    wrap.className = 'listen-field';
    const span = document.createElement('span');
    span.textContent = label;
    const field = document.createElement('select');
    field.className = className;
    wrap.append(span, field);
    return { wrap, field };
  };

  const minutes = (r) => Math.max(1, Math.round(totalWords / (165 * r)));
  const startButton = button('listen-start', 'Listen to this page', `${ICON.play}<span>Listen to this page</span><small></small>`);
  startButton.title = 'Uses your device’s built-in voices. Nothing is uploaded.';
  const rateField = select('listen-rate', 'Speed');
  [[0.8, '0.8×'], [1, '1×'], [1.15, '1.15×'], [1.3, '1.3×'], [1.5, '1.5×']].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = label;
    rateField.field.append(option);
  });
  rateField.field.value = String(rate);
  if (rateField.field.value !== String(rate)) { rate = 1; rateField.field.value = '1'; }
  const voiceField = select('listen-voice', 'Voice');
  const voiceSelect = voiceField.field;
  const note = document.createElement('p');
  note.className = 'listen-note';
  note.textContent = 'Uses your device’s built-in voices. Nothing is uploaded.';

  const settings = document.createElement('details');
  settings.className = 'listen-settings';
  const settingsLabel = document.createElement('summary');
  settingsLabel.setAttribute('aria-label', 'Listening settings: speed and voice');
  settingsLabel.title = 'Speed and voice';
  settingsLabel.innerHTML = ICON.gear;
  const pop = document.createElement('div');
  pop.className = 'listen-pop';
  pop.append(rateField.wrap, voiceField.wrap, note);
  settings.append(settingsLabel, pop);
  document.addEventListener('click', (event) => { if (settings.open && !settings.contains(event.target)) settings.open = false; });

  const intro = document.createElement('div');
  intro.className = 'listen';
  intro.setAttribute('role', 'group');
  intro.setAttribute('aria-label', 'Listen to this page');
  intro.append(startButton, settings);
  const lead = page.querySelector('.detail-hero .lead') || page.querySelector('.detail-hero');
  lead.after(intro);
  const refreshTime = () => { startButton.querySelector('small').textContent = `about ${minutes(rate)} min`; };
  refreshTime();

  const bar = document.createElement('div');
  bar.className = 'listen-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Listening controls');
  bar.hidden = true;
  const prevButton = button('listen-ctl', 'Previous section', ICON.prev);
  const toggleButton = button('listen-ctl listen-toggle', 'Pause', ICON.pause);
  const nextButton = button('listen-ctl', 'Next section', ICON.next);
  const stopButton = button('listen-ctl', 'Stop listening', ICON.stop);
  const status = document.createElement('div');
  status.className = 'listen-status';
  status.setAttribute('aria-live', 'polite');
  const progress = document.createElement('div');
  progress.className = 'listen-progress';
  const progressFill = document.createElement('i');
  progress.append(progressFill);
  const label = document.createElement('span');
  status.append(label);
  bar.append(prevButton, toggleButton, nextButton, status, stopButton, progress);
  document.body.append(bar);


  // The slim top bar is built by site.js (back link, title, Index, progress); the play/pause button joins it here.
  const topBar = document.querySelector('.reading-bar');
  const topToggle = button('listen-ctl listen-toggle', 'Listen to this page', ICON.play);
  if (topBar) topBar.append(topToggle);

  // Per-section "listen from here" buttons.
  sections.forEach((section, index) => {
    const here = button('tts-here', `Listen from “${section.title}”`, `${ICON.play}<span>Listen</span>`);
    here.addEventListener('click', () => start(section.first));
    section.el.prepend(here);
    section.here = here;
    section.index = index;
  });

  // ---- Playback ------------------------------------------------------------------------------------------------
  let position = 0; // index into units
  let chunkIndex = 0; // index into the current unit's chunks
  let chunks = [];
  let state = 'stopped'; // stopped | playing | paused
  let token = 0; // invalidates callbacks from cancelled utterances
  let highlighted = null;

  const split = (text) => {
    const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [text];
    const out = [];
    let current = '';
    sentences.forEach((sentence) => {
      if ((current + sentence).length > 210 && current) { out.push(current); current = ''; }
      current += sentence;
    });
    if (current.trim()) out.push(current);
    return out.map((part) => part.trim()).filter(Boolean);
  };
  const setHighlight = (el) => {
    highlighted?.classList.remove('tts-current');
    highlighted = el;
    if (!el) return;
    el.classList.add('tts-current');
    const box = el.getBoundingClientRect();
    if (box.top < 150 || box.bottom > window.innerHeight - 70) el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  const render = () => {
    const unit = units[position];
    const section = sections[unit ? unit.section : 0];
    label.textContent = state === 'stopped' ? '' : `${state === 'paused' ? 'Paused' : 'Reading'}: ${section.title}`;
    progressFill.style.width = `${Math.round((position / units.length) * 100)}%`;
    toggleButton.innerHTML = state === 'playing' ? ICON.pause : ICON.play;
    toggleButton.setAttribute('aria-label', state === 'playing' ? 'Pause' : 'Resume');
    bar.hidden = state === 'stopped';
    startButton.classList.toggle('is-active', state !== 'stopped');
    sections.forEach((item) => item.here.classList.toggle('is-active', state !== 'stopped' && unit && unit.section === item.index));
    prevButton.disabled = nextButton.disabled = state === 'stopped';
    topToggle.innerHTML = state === 'playing' ? ICON.pause : ICON.play;
    topToggle.setAttribute('aria-label', state === 'playing' ? 'Pause' : state === 'paused' ? 'Resume' : 'Listen to this page');
    if (topBar) topBar.classList.toggle('is-playing', state !== 'stopped');
  };
  const finish = () => {
    state = 'stopped';
    setHighlight(null);
    render();
  };
  const speakChunk = () => {
    if (state !== 'playing') return;
    if (position >= units.length) { finish(); return; }
    const unit = units[position];
    if (chunkIndex === 0) { chunks = split(speakable(unit.text)); setHighlight(unit.el); render(); }
    if (chunkIndex >= chunks.length) { position += 1; chunkIndex = 0; speakChunk(); return; }
    const mine = token;
    const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
    const voice = pickVoice();
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
    utterance.rate = rate;
    utterance.onend = () => { if (mine !== token) return; chunkIndex += 1; speakChunk(); };
    utterance.onerror = (event) => { if (mine !== token || event.error === 'interrupted' || event.error === 'canceled') return; finish(); };
    synth.speak(utterance);
  };
  function start(unitIndex) {
    token += 1;
    synth.cancel();
    position = Math.max(0, Math.min(unitIndex, units.length - 1));
    chunkIndex = 0;
    state = 'playing';
    speakChunk();
  }
  const pause = () => { if (state !== 'playing') return; state = 'paused'; token += 1; synth.cancel(); render(); };
  const resume = () => { if (state !== 'paused') return; token += 1; state = 'playing'; speakChunk(); };
  const stop = () => { token += 1; synth.cancel(); position = 0; chunkIndex = 0; finish(); };
  const jump = (direction) => {
    const current = units[position] ? units[position].section : 0;
    const target = sections[Math.max(0, Math.min(sections.length - 1, current + direction))];
    const keepPaused = state === 'paused';
    start(target.first);
    if (keepPaused) pause();
  };

  startButton.addEventListener('click', () => { if (state === 'stopped') start(0); else if (state === 'playing') pause(); else resume(); });
  toggleButton.addEventListener('click', () => { if (state === 'playing') pause(); else resume(); });
  topToggle.addEventListener('click', () => { if (state === 'stopped') start(0); else if (state === 'playing') pause(); else resume(); });
  prevButton.addEventListener('click', () => jump(-1));
  nextButton.addEventListener('click', () => jump(1));
  stopButton.addEventListener('click', stop);
  rateField.field.addEventListener('change', () => {
    rate = Number(rateField.field.value) || 1;
    store.set('rate', String(rate));
    refreshTime();
    if (state === 'playing') { token += 1; synth.cancel(); speakChunk(); }
  });
  voiceSelect.addEventListener('change', () => {
    voiceId = voiceSelect.value;
    store.set('voice', voiceId);
    if (state === 'playing') { token += 1; synth.cancel(); speakChunk(); }
  });
  window.addEventListener('pagehide', () => synth.cancel());
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (settings.open) { settings.open = false; settingsLabel.focus(); return; }
    if (state !== 'stopped') stop();
  });

  loadVoices();
  if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', loadVoices);
  else synth.onvoiceschanged = loadVoices;
  render();
})();
