---
name: HUD
description: Film user interfaces done with restraint, after Oblivion and The Martian. A dot grid on deep black, one near-white line color, three line weights, corner brackets, data that types on and locks in, and a warm accent earned once. For AI, security, space, mobility and data products.
---
# HUD

A screen from a well-made film: sparse, legible in under a second, every element on a grid, color spent only where the story needs it. The elegance comes from what's left out. Use it for AI, security, aerospace, automotive, robotics and monitoring products. Avoid it for consumer lifestyle brands.

## Look at
- **Oblivion, light-table and Bubbleship UI (GMUNK, 2013).** Everything hangs on a dot grid, in one bright line color with lots of empty black. Glow is rare.
- **The Martian (Territory Studio, 2015).** Clear data hierarchy, with red reserved for mission-critical states only.
- **Iron Man HUDs (Jayse Hansen).** Separate depth planes and rings turning at different rates. As Mark Coleran puts it, a screen must read "in 24 frames or less".

## Tokens
```css
:root { --bg: #05080a; --line: #e6f1f4; --dim: #6f9aa8; --grid: rgba(111,154,168,.10); --accent: #ff8a3d; --alert: #ff3b30; }
.fk-stage { font-family: "Oxanium", sans-serif; color: var(--line); background: var(--bg); }
.data { font-family: "JetBrains Mono", monospace; font-size: 20px; font-variant-numeric: tabular-nums; letter-spacing: .04em; }
.micro { font-family: "JetBrains Mono", monospace; font-size: 14px; letter-spacing: .12em; text-transform: uppercase; color: var(--dim); } /* texture, never content */
svg .l1 { stroke-width: 1; } svg .l2 { stroke-width: 2; } svg .l3 { stroke-width: 3; }  /* the only three weights */
```
```js
const PITCH = 24;                                   // dot grid; everything snaps to it
const snap = v => Math.round(v / PITCH) * PITCH;
const EASE = { out: bez(0.16, 1, 0.3, 1) };
const f = t => Math.floor(t * 30);                  // frame index, for seeded scrambles and flickers
/** Type-on with scramble: each char cycles 2–3 seeded glyphs every 2 frames, then resolves. 50 chars/s. */
const scramble = (s, t, t0, seed = 7) => [...s].map((c, i) => { const ti = t0 + i / 50; if (t < ti) return ' '; if (t > ti + 0.1 || c === ' ') return c; return '#%&*+<>0123456789ABCDEF'[Math.floor(rng(seed + i * 31 + Math.floor(f(t) / 2))() * 22)]; }).join('');
const flickerOn = (t, t0) => [0, 1, 0.3, 1][Math.min(3, Math.max(0, f(t) - f(t0)))] * (t >= t0 ? 1 : 0);
```
Fonts: `font -- . "Oxanium:wght@200..800" "JetBrains Mono:wght@300..700"`.

## Layout
- A visible dot grid on a 24 px pitch at 10% opacity. Every element's corners snap to it.
- Use corner brackets (L shapes, 24–40 px arms) instead of boxes.
- About 60% of the frame stays empty. Data sits in 2–3 clusters, never as wallpaper.
- **Line weights:** 1 px for grid and ticks, 2 px for primary strokes, 3 px for a selected state. Lines that move are 2 px or heavier (1 px shimmers).

## Type
- **Display:** Oxanium 300 for readouts at 48–72 px. One hero number at 160–220 px, weight 200–300.
- **Data:** `.data`. Text that must be read is 20 px or larger.
- **Micro-labels:** `.micro` at 14 px are texture only. Never put the message in them.

## Motion
- **Boot:** rules draw from the center outward (0.3–0.4 s, `EASE.out`). Brackets snap from 1.15× to 1× in 0.2 s. Labels type on after them with `scramble()`. Clusters stagger 0.1–0.13 s apart.
- **Appearances:** `flickerOn()` over 4 frames, deterministically, never randomly.
- **Data:** ticks update in steps at 4–8 Hz against smooth motion elsewhere.
- **Rings:** turn at constant speeds of 6–20° per second, each at a different, non-integer ratio.
- **Scan sweeps:** 0.6–0.9 s, linear.
- Every scramble, flicker and tick is seeded from the frame index, so each frame is a pure function of `t`.

## Signature moves
1. **Grid lock.** The dot grid fades up first (0.5 s). Then each element lands on it, clusters staggered, brackets snapping and labels scrambling in.
2. **Lock-on.** Four brackets travel in from the frame edges, decelerating onto the subject with `EASE.out` and no overshoot. A 2-frame fill flash, then the label types on.
3. **Earned color.** Everything is `--line` and `--dim` until the story's key beat, when one element turns `--accent`, or `--alert` if it is a warning. It happens once per film.

## Devices
- Range rings, tick scales, a crosshair made of four short lines, and coordinate readouts.
- Three parallax planes in CSS `perspective`, drifting 2–6 px apart.
- Glow only on the hero element, as `text-shadow: 0 0 8px`. Blur filters and bloom are costly and cheapen it.

## Never
Orbitron, cyan-and-magenta neon, hexagon wallpaper, Matrix rain, "ACCESS GRANTED", glow on everything, chromatic aberration, scanline overlays, everything rotating, data unrelated to the story, four or more line weights, or messages set at 14 px.
