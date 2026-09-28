---
name: Kinetic
description: Kinetic type in the manner of DIA and Studio Dumbar. One variable grotesk fills and crops the frame, repeats, steps through its width and weight axes, and changes only on the beat. For announcements and hype cuts set to music.
---
# Kinetic

Type is the whole picture, and time is the grid. The film is built from a few words that repeat, stretch and flip, all locked to the music's tempo. Use it for launches with a strong soundtrack, events and short social cuts. Avoid it for explainers with a lot to say: this style carries about 3 words per scene.

## Look at
- **DIA (Mitch Paone), kinetic identities.** Motion is a system of rules: one typeface, huge and cropped, stepping through its axes, with every change on a beat subdivision.
- **Studio Dumbar and DEPT, "Cities in Motion".** The grid itself moves, and type reflows into its cells.
- **ManvsMachine.** Mechanical cause and effect: one move pushes the next, on the beat.

## Tokens
```css
:root { --bg: #0e0e0e; --fg: #f4f4f0; --accent: #ff4d00; }
.fk-stage { font-family: "Archivo", sans-serif; color: var(--fg); background: var(--bg); }
.kt { font-weight: 800; font-stretch: 100%; line-height: .8; letter-spacing: -0.02em; text-transform: uppercase; white-space: nowrap; }
```
```js
const BPM = 120, BEAT = 60 / BPM;                       // set BPM to the music's tempo
const beat = n => n * BEAT;                              // time of beat n (fractions allowed: beat(2.5))
const EASE = { snap: bez(0.87, 0, 0.13, 1), in: bez(0.16, 1, 0.3, 1) };
const DUR = { snap: BEAT / 2, step: BEAT / 4 };
/** Axis value at time t, stepping from `a` to `b` in `n` hard steps between beats i and j. */
const axis = (t, i, j, a, b, n) => lerp(a, b, Math.floor(P(t, beat(i), beat(j)) * n) / n);
```
Fonts: `font -- . "Archivo:wdth,wght@62..125,100..900"` (the width axis runs 62–125). Alternative: `"Anton"`, which has one weight, for scenes without axis moves.

## Layout
- Type fills the frame edge to edge and crops: 300–600 px, line-height 0.8.
- Stack rows of the same word on a strict row grid. Offsets are whole rows or whole columns.
- Center or edge-align. Never place anything loosely in the middle distance.
- Allow one small label per film (48 px or larger), at a fixed corner.

## Type
- One family. Weight and width change through `font-variation-settings: "wght" …, "wdth" …`, not through other fonts.
- Keep changing words inside a fixed-width box and measure them at their widest (`mw`) so reflow doesn't jitter the layout.
- 1–3 words per scene. Use the brief's own words, not filler.

## Motion
- Every change starts on `beat(n)` or a half or quarter subdivision. Moves last `DUR.snap` with `EASE.snap`: a fast attack and a hard stop.
- Repetition: the same word ×3–7 in rows, each row delayed by `beat(1/8)`.
- Axis steps: `axis()` walks wdth or wght in 4–8 hard steps across one or two beats. Stepped reads as designed; smooth reads as a morph.
- Polarity flips (`--bg` and `--fg` swap) on downbeats, at most one per bar.
- Cuts land on beats. Scenes last whole bars (`beat(4)`, `beat(8)`).
- No fades anywhere: things are either there or not.

## Devices
- Repetition, cropping, axis stepping, polarity flips.
- A single `--accent` word, once or twice per film.
- A marquee row at constant speed (the one linear move).

## Never
Fades or blur, soft easings, a second typeface, text under 48 px, changes off the beat, gradients or glows, or more than 3 flashes (full-frame polarity changes) in any one second (WCAG 2.3.1, photosensitivity).
