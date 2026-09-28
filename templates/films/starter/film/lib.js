// Shared runtime for every scene file. Loaded after film-kit.js, before the scenes.
// Top-level names here are globals for scene files, so keep them few and obvious.
const film = FilmKit.create({ title: '{{TITLE}}', width: 1920, height: 1080, fps: 30, background: '#f7f7f5' });
const W = film.W, H = film.H;

// ── time helpers ──
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** Progress of t through [a, b], clamped to 0..1. The workhorse: P(t, 1.2, 1.6). */
const P = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const E = {
  out3: k => 1 - Math.pow(1 - k, 3),
  in3: k => k * k * k,
  io3: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outExpo: k => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  outBack: k => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
};
function bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t;
  return k => { if (k <= 0) return 0; if (k >= 1) return 1; let lo = 0, hi = 1, t = k; for (let i = 0; i < 30; i++) { t = (lo + hi) / 2; if (sx(t) < k) lo = t; else hi = t; } return sy(t); };
}
const EB = bez(0.77, 0, 0.175, 1); // expressive ease-in-out
/** Damped spring from 0 to 1, s seconds after it starts (s <= 0 gives 0). Pure, so it's safe in draw(t).
 *  dur ≈ time to settle; bounce 0 lands without overshoot, 0.2–0.3 settles with one small overshoot.
 *  A heavier, more physical landing than E.outBack: spring(t - 1.2, 0.6, 0.2). */
function spring(s, dur = 0.6, bounce = 0) {
  if (s <= 0) return 0;
  const w = 2 * Math.PI / dur, z = 1 - bounce;
  if (z >= 1) return 1 - Math.exp(-w * s) * (1 + w * s);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + (z * w / wd) * Math.sin(wd * s));
}
/** Seeded random: use rng(seed) instead of Math.random so every frame is reproducible. */
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/** Fade/blur envelope: in over [a, a+d], optional out from b. Returns [opacity, blurPx, inProgress]. */
function env(t, a, d, b, d2 = 0.3, bl = 12) { const k = E.out3(P(t, a, a + d)); const o = b == null ? 0 : P(t, b, b + d2); return [k * (1 - o), (1 - k) * bl + o * bl, k]; }

// ── DOM helpers ──
function mk(parent, cls, css, html, tag) { const e = document.createElement(tag || 'div'); if (cls) e.className = cls; if (css) Object.assign(e.style, css); if (html != null) e.innerHTML = html; parent.appendChild(e); return e; }
/** Position an element: translate, scale, opacity, blur, rotate. */
function setv(e, x, y, s = 1, op = 1, blur = 0, rot = 0) {
  e.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${s.toFixed(4)})${rot ? ` rotate(${rot.toFixed(2)}deg)` : ''}`;
  e.style.opacity = op.toFixed(3);
  e.style.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : 'none';
}
/** Masked line: text that rises into view from behind its own baseline instead of fading in. Returns
 *  [box, reveal]: place `box` with setv, then call reveal(k) every draw, k 0 (hidden below) to 1 (in place). */
function mask(parent, cls, css, html) {
  const box = mk(parent, 'abs', { overflow: 'hidden' });
  const line = mk(box, cls, Object.assign({ position: 'relative', paddingBottom: '0.15em' }, css), html); // room for descenders
  return [box, k => { line.style.transform = `translateY(${((1 - k) * 105).toFixed(2)}%)`; }];
}
const meas = mk(document.body, null, { position: 'absolute', left: '-99999px', top: '0', visibility: 'hidden' });
/** Measure text width in px for a style (fonts are loaded before scenes build). Uses the stage's font unless css sets one. */
function mw(text, css) { meas.removeAttribute('style'); Object.assign(meas.style, { position: 'absolute', left: '-99999px', top: '0', visibility: 'hidden', whiteSpace: 'pre', lineHeight: '1', fontFamily: getComputedStyle(film.stage).fontFamily }, css); meas.textContent = text; return meas.getBoundingClientRect().width; }

// Fonts and images must be ready before scenes build (they measure text). Loads every @font-face in
// styles.css (fonts only load on first use otherwise). Add image preloads here too.
film.before(async () => {
  await Promise.all([...document.fonts].map(f => f.load().catch(() => {})));
  await document.fonts.ready;
});
