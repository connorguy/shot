---
name: Ma
description: Japanese minimalism after Kenya Hara and Ikko Tanaka. Warm white, sumi ink and one seal red; vast emptiness, vertical type, one slow movement at a time and long holds. For calm, considered brands and craft products.
---
# Ma

間 (ma) is the interval: emptiness as a material. One thing happens, then nothing happens for long enough to feel it. The brand is small and the frame is a vessel. Use it for craft and design-led products, wellness without the clichés, hardware with a quiet story, and a pause inside a louder film. Avoid it for feature-dense or urgent briefs.

Latin-only copy works. Japanese copy is optional, and must be real: written or checked by someone who reads it.

## Look at
- **Kenya Hara, MUJI "Horizon" (2003).** A horizon line and a logo at about 1% of the frame. Take the idea that emptiness invites and doesn't just simplify.
- **Ikko Tanaka, *Nihon Buyo* poster (1981).** A figure built from squares, semicircles and one large circle in flat color, with no outlines. Take geometry on a grid.
- **Kashiwa Sato, Uniqlo identity (2006).** The square as a container, with Latin and katakana given equal weight.

## Tokens
```css
:root { --bg: #fcfaf2; /* shironeri */ --ink: #1c1c1c; /* sumi */ --ink2: #434343; --line: #bdc0ba; --seal: #c73e3a; /* ginshu */ }
.fk-stage { font-family: "Shippori Mincho", serif; color: var(--ink); background: var(--bg); }
.v { writing-mode: vertical-rl; font-feature-settings: "vpal"; line-break: strict; line-height: 1.9; }
.latin { font-family: "Zen Kaku Gothic New", sans-serif; font-weight: 300; font-size: 22px; letter-spacing: .2em; text-transform: uppercase; color: var(--ink2); }
```
```js
const EASE = { soft: bez(0.37, 0, 0.63, 1) };                 // sine in-out: the only curve in this style
const DUR = { fade: 2.0, column: 0.8, line: 3.0, stamp: 0.12 };
const STAGGER = { column: 0.3 };
const HOLD = 4;                                                // seconds of stillness after every arrival
```
Fonts: `font -- . "Shippori Mincho:wght@400;500;800" "Zen Kaku Gothic New:wght@300;500" --text auto`. The `--text` flag keeps CJK fonts to the characters the film uses (a full one is 5–14 MB). Run it again after copy changes.

## Layout
- Content covers at most 25% of the frame. Place the subject off center, on a third or a 2:1 split.
- A horizon sits at 62–66% of the height.
- Vertical columns start about 240 px from the right edge and step leftward, 1.8–2.2 em apart.
- The seal (a 64 px square) sits bottom right, 96 px from the edges.
- No boxes, no cards, no rules except the horizon.

## Type
- **Latin display:** Shippori Mincho 400 at 64–96 px, deliberately small, tracking +0.02em.
- **Hero:** a single kanji may stand alone at 320–420 px.
- **Vertical body:** 36 px in `.v`. Letter-space kanji by 0.1 em at most.
- **Labels:** `.latin`.
- Two digits inside vertical text: `text-combine-upright: all`. Never set rotated Latin to be read vertically.

## Motion
- `EASE.soft` only. No springs, no overshoot, no drift, no camera moves.
- One thing moves at a time. Every arrival is followed by `HOLD` seconds of stillness, and scenes run at least 6 s. This preset deliberately overrides the usual rhythm rules.
- Things appear by fading over `DUR.fade`, or by revealing along their own direction:
  - Vertical columns reveal top to bottom through a mask, `DUR.column` each, the next `STAGGER.column` later, right to left.
  - A horizon draws left to right over `DUR.line`.

## Signature moves
1. **Horizon.** An empty frame. A 2 px sumi line draws across at 64% height over 3 s, then 4 s of nothing. A small wordmark (`.latin`) fades in below the right third over 2 s, then 3 s more of stillness.
2. **Ink bloom.** A sumi disc spreads from a point over 2.5 s. It's a circle whose `mask-image: radial-gradient(...)` soft edge narrows as it grows, so the edge feathers like wet ink. It settles as the frame's one circle, and a vertical line of text sets beside it.
3. **Seal.** The `--seal` square appears at 104% scale and settles to 100% in `DUR.stamp`, darkening for two frames as if pressed. It's the only fast event in the film, so it lands.

## Devices
- One horizon, one circle and one seal per film, at most.
- A Tanaka-style figure made of squares and semicircles. It is the one place more color is allowed: ruri `#005caf`, tokiwa `#1b813e` and yamabuki `#ffb11b`, as flat blocks.
- Static paper fiber at 2–3% (`feTurbulence`, never reseeded).
- For a displaced ink edge, apply `feDisplacementMap` to that one element only. It is costly full-frame.

## Never
Cherry blossoms, torii, ensō clip art, rising-sun rays, the red-black-gold "Japan" palette, brush fonts for text, pseudo-Asian Latin typefaces, katakana as decoration, pure `#000` on `#fff`, springs, anything moving during a hold, or machine-translated Japanese.
