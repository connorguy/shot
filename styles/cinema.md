---
name: Cinema
description: Film titles and trailer cards. Anamorphic letterbox, bone-white serif credits on lifted black, 24 fps grain, gate weave and halation; slow fades or hard cuts on the sound hit. For brand films, founder stories, trailers and event openers.
---
# Cinema

The film should feel projected. It's framed in 2.39:1, lit with grain and a slight weave, and credited like a feature, with small, tracked, unhurried type. The restraint of a real title sequence is the point. Use it for brand films, origin stories, documentaries, trailers and keynote openers. Avoid it for UI-heavy product demos.

## Look at
- **A24 trailer cards and Criterion covers.** Small, centered, widely tracked cards, one line each, cut on a sound hit. An art-directed ground per title.
- **Pablo Ferro, *Dr. Strangelove* (1964) and *The Thomas Crown Affair* (1968).** Tall, thin lettering filling the frame, and split screens multiplying on the beat.
- **Kyle Cooper, *Se7en* (1995).** Type made by hand and made unstable: jitter, 1–2-frame flashes and film leader. Use it sparingly.

## Tokens
```css
:root { --bars: #000; --black: #0b0b0b; --bone: #ede8dc; --dim: #9c978c; --halation: #ff4a2a; --tungsten: #e3b870; }
.fk-stage { font-family: "Cormorant Garamond", serif; color: var(--bone); background: var(--black); }
.card { font-family: "Cormorant SC", serif; font-weight: 500; font-size: 32px; letter-spacing: .32em; }
.title { font-weight: 400; font-size: 120px; letter-spacing: .02em; }
.glow { text-shadow: 0 0 6px rgba(255,74,42,.35), 0 0 18px rgba(255,74,42,.15); } /* halation: cheap as text-shadow */
.billing { font-family: "Antonio", sans-serif; font-weight: 200; font-size: 24px; line-height: 1.05; letter-spacing: .02em; }
```
```js
const SCOPE = { top: 138, h: 804 };                      // 2.39:1 inside 1920×1080: 138 px bars top and bottom
const f24 = t => Math.floor(t * 24);                      // film frames: grain, flicker and weave step at 24 fps
const weave = t => { const f = f24(t); return [0.5 * Math.sin(f * 1.7) + 0.3 * Math.sin(f * 0.37), 0.4 * Math.sin(f * 1.1 + 2)]; }; // ±0.8 px
const flicker = t => 1 + 0.015 * (rng(f24(t))() * 2 - 1);
const EASE = { fade: bez(0.45, 0, 0.55, 1) };
const DUR = { in: 1.0, out: 0.7, dip: 0.4, focus: 1.2 };
```
Fonts: `font -- . "Cormorant Garamond:ital,wght@0,300..700;1,300..700" "Cormorant SC:wght@400;500;600" "Antonio:wght@100..700"`.

## Layout
- The bars are always there: pure black, 138 px top and bottom. Nothing sits on them, and they never animate.
- Cards are centered, or all bottom left at one consistent position for a whole sequence.
- **Role and name pairs:** the role in `.card` at about 60% size above the name.
- **Order of credits:** "presents", then "a film by …", then the title.

## Type
- **Credits:** `.card`.
- **Main title:** Cormorant Garamond 400, 96–140 px, or one word up to 400 px for a smash title.
- **Billing block:** `.billing`, compressed, at the end.
- **Color:** bone, never pure white. Apply `.glow` to bright type on black.

## Motion
- **Credit cards:** fade in over `DUR.in`, hold 3–4 s, fade out over `DUR.out`. Credits never slide or scale.
- **Trailer cards:** a hard cut in on the sound hit, 1.5–2.5 s, a hard cut out.
- **Between cards:** a dip to black of `DUR.dip`.
- **Title:** a focus pull, blur 10 px → 0 and scale 1.015 → 1 over `DUR.focus`. It's the one blur in the film.
- **The image layer weaves** by `weave(t)` and flickers by `flicker(t)`, applied to a wrapper under the bars. Titles weave with the image or stay registered, one or the other, for the whole film.

## Signature moves
1. **Cold open.** Black with the bars already in place. The image fades up over 2 s with grain and weave running. A single "a film by …" card holds 3 s, then the title smash-cuts in on the music hit.
2. **Split matrix.** On the beat, the frame divides into 1, then 2, then 4, then 9 panels, each a different still or crop. Then it collapses back to one, as in Ferro's *Thomas Crown*.
3. **Scratched title.** Hand-drawn SVG letters redraw at 24 fps with ±1 px of seeded vertex jitter, with a 1-frame white flash on the accent hits. Keep it under 8 s or it becomes parody.

## Devices
- **Grain:** SVG `feTurbulence` at half resolution (a 960 × 540 SVG scaled 2×), seed `f24(t)`, overlay at 6–10%. Grain reseeded every frame at full size costs about 70% more render time. Static grain looks fake.
- Vignette as a radial gradient to about 18% at the corners. `--tungsten` at most once.

## Never
Trajan or Cinzel "epic" titles, Bebas Neue trailer caps, lens flares, chrome or metal type, burns and scratches on every shot, weave over 2 px, teal-and-orange grading, typewriter reveals, sliding or zooming credits, text on the bars, or bars that animate.
