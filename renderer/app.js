'use strict';

const timeEl = document.getElementById('time');
const dateEl = document.getElementById('date');
const fillEl = document.getElementById('minuteFill');
const hintEl = document.getElementById('hint');

let cfg = {
  locale: 'fr-FR',
  hour12: false,
  showSeconds: true,
  accent: '#7dd3fc',
  variant: 'hero'
};

// Emplacements fixes : on ne remplace que les caracteres qui changent, ce qui
// permet d'animer chiffre par chiffre au lieu de re-rendre tout le bloc.
const slots = [];
let secEl = null;
let ampmEl = null;

function buildTime() {
  timeEl.textContent = '';
  slots.length = 0;
  secEl = null;
  ampmEl = null;

  const hm = document.createElement('span');
  hm.className = 'hm';
  timeEl.appendChild(hm);

  for (const kind of ['d', 'd', 'sep', 'd', 'd']) {
    const span = document.createElement('span');
    span.className = kind;
    if (kind === 'sep') span.textContent = ':';
    hm.appendChild(span);
    slots.push(kind === 'sep' ? null : span);
  }

  if (cfg.showSeconds) {
    secEl = document.createElement('span');
    secEl.className = 'sec';
    hm.appendChild(secEl);
  }

  if (cfg.hour12) {
    ampmEl = document.createElement('span');
    ampmEl.className = 'ampm';
    hm.appendChild(ampmEl);
  }
}

function setDigit(span, char) {
  if (!span || span.textContent === char) return;
  span.textContent = char;
  span.classList.remove('turn');
  void span.offsetWidth; // force le redemarrage de l'animation
  span.classList.add('turn');
}

let lastDateKey = '';
let lastSecond = -1;

function render() {
  const now = new Date();
  const seconds = now.getSeconds();

  let hours = now.getHours();
  if (cfg.hour12) {
    if (ampmEl) ampmEl.textContent = hours < 12 ? 'am' : 'pm';
    hours = hours % 12 || 12;
  }

  const hh = String(hours).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const chars = [hh[0], hh[1], null, mm[0], mm[1]];

  for (let i = 0; i < slots.length; i++) {
    if (chars[i] !== null) setDigit(slots[i], chars[i]);
  }

  if (secEl) secEl.textContent = String(seconds).padStart(2, '0');

  if (seconds !== lastSecond) {
    // Au passage a zero on coupe la transition, sinon le filet revient
    // en glissant vers la gauche.
    const wrapped = seconds < lastSecond;
    fillEl.classList.toggle('reset', wrapped);
    fillEl.style.width = ((seconds / 60) * 100).toFixed(3) + '%';
    if (wrapped) requestAnimationFrame(() => fillEl.classList.remove('reset'));
    lastSecond = seconds;
  }

  const dateKey = now.toDateString();
  if (dateKey !== lastDateKey) {
    lastDateKey = dateKey;
    dateEl.textContent = now.toLocaleDateString(cfg.locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }
}

// Cale les mises a jour sur la seconde systeme plutot que sur un setInterval
// qui derive au bout de quelques heures.
function loop() {
  render();
  const delay = 1000 - (Date.now() % 1000);
  setTimeout(loop, delay + 12);
}

// ---------------------------------------------------------- activite ---

// L'affichage se fait sous le curseur : on ignore les premieres frames pour
// eviter qu'un mousemove parasite ne ferme l'horloge aussitot.
const ARMED_AT = Date.now() + 900;
let origin = null;

function wake() {
  if (Date.now() < ARMED_AT) return;
  if (window.clock) window.clock.wake();
}

window.addEventListener('mousemove', (e) => {
  if (!origin) { origin = { x: e.screenX, y: e.screenY }; return; }
  if (Math.hypot(e.screenX - origin.x, e.screenY - origin.y) > 8) wake();
});
for (const evt of ['mousedown', 'wheel', 'keydown', 'touchstart']) {
  window.addEventListener(evt, wake, { passive: true });
}

// ------------------------------------------------------------ config ---

function applyConfig(next) {
  cfg = { ...cfg, ...next };
  document.documentElement.style.setProperty('--accent', cfg.accent);
  document.body.classList.toggle('minimal', cfg.variant === 'minimal');
  if (cfg.variant === 'minimal') hintEl.remove();
  buildTime();
  lastSecond = -1;
  lastDateKey = '';
  render();
}

if (window.clock) {
  window.clock.onConfig(applyConfig);
}

applyConfig(cfg);
loop();
