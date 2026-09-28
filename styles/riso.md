---
name: Riso
description: Risograph print. Two spot inks overprinting on warm paper, halftone tones, plates slightly out of register, animated on twos. For indie launches, community and culture brands, and anything that should feel made by hand.
---
# Riso

The frame is a print: each color is its own ink plate, inks are translucent so overlaps make a third color, tones are dots rather than gradients, and nothing lines up perfectly. It's warm and tactile without being cute. Use it for zines, indie tools, community events, food and culture brands. Avoid it for enterprise, finance, or anything whose UI has to be shown at pixel precision.

## Look at
- **Colorama (Berlin), *Colorsheet* series.** Overprint swatch grids: the third color, where two inks cross, is the design.
- **Knust / Extrapool (Nijmegen).** Coarse, visible screens used as structure and texture, not as a filter.
- **Risotto (Glasgow) and Hato Press (London).** Flat two-ink shapes and repeat patterns, with type as a printed object.

## Tokens
```css
:root { --paper: #efe8d8; --a: #ff48b0; /* fluorescent pink */ --b: #0078bf; /* blue */ --ink-alpha: .9; }
.fk-stage { font-family: "Bricolage Grotesque", sans-serif; background: var(--paper); isolation: isolate; }
.plate { position: absolute; inset: 0; mix-blend-mode: multiply; opacity: var(--ink-alpha); }
.label { font-family: "Space Mono", monospace; font-size: 24px; letter-spacing: .04em; text-transform: uppercase; }
```
```js
const INK = { a: '#ff48b0', b: '#0078bf' };                   // pairs that print well: pink+blue, yellow #ffe800+blue, pink+aqua #5ec8e5
const twos = t => Math.floor(t * 12) / 12;                     // the whole film runs on twos
const EASE = { in: bez(0.22, 1, 0.36, 1), move: bez(0.65, 0, 0.35, 1) };
const DUR = { in: 0.6, tone: 0.8, plate: 0.7 };
const MISREG = seed => { const r = rng(seed); return [(r() - .5) * 10, (r() - .5) * 10]; }; // 3–8 px per plate, fixed per scene
```
Fonts: `font -- . "Bricolage Grotesque:opsz,wdth,wght@12..96,75..100,200..800" "Space Mono:wght@400;700"`.

## Layout
- Poster logic. Big flat shapes bleed off the frame, type acts as an image, and a 5–8% paper margin stays unprinted on one or more edges, like the gripper edge.
- Build every element on one of two plates: a `.plate` for ink A and one for ink B. Black text is a third plate only if the brief needs it.
- Decide for each element whether it knocks out (the paper shows through) or overprints (makes the third color). Mix both on purpose.

## Type
- **Display:** Bricolage Grotesque 700–800, 160–260 px, tracking −0.03em. Use the width axis (wdth 75) for tall stacks.
- **Labels:** `.label` in Space Mono.
- Type sits on one plate, so it misregisters with its plate.

## Motion
- Draw from `twos(t)`, not `t`, everywhere.
- **Plates:** misregistration is a constant per plate per scene (`MISREG(sceneSeed)`). Re-roll it only on cuts. It never jitters per frame.
- **Tone, not opacity.** Riso has no alpha, so things never fade. Tones build as halftone dots growing from 0 to full coverage over `DUR.tone` (an SVG `<pattern>` whose dot radius follows `t`).
- **Moves:** slides with `EASE.in` over `DUR.in`, then quantized by `twos`. Whole plates move, not single letters.

## Signature moves
1. **Plates register.** The A and B plates slide in from 40–80 px apart (`EASE.move`, `DUR.plate`) and settle at their residual offset. The overprint color appears only once they overlap.
2. **Separation.** A finished frame splits into its plates. They fan out diagonally, each flat ink on paper, hold for 0.8 s, then recombine. It makes a good mid-film beat.
3. **Next sheet.** The scene change is a new sheet feeding through from the bottom with 0.4° of skew. The last print ghosts on it at 8% (set-off) for the first 0.5 s of the next scene.

## Devices
- Halftone screens as texture in big solids (dots at 45° for ink B and 15° for ink A, like a real screen).
- Overprint swatches, registration marks and crop marks in the paper margin.
- Paper grain: a static SVG `feTurbulence` at 6–10%, reseeded only on twos. Animated full-frame grain doubles render time.

## Never
Opacity fades, blur, gradients (riso can't print them), more than 2 inks (3 with black), a drop-shadow-style offset on every element instead of whole-plate misregistration, uniform grain over everything, cute blobs, or smooth 30 fps motion.
