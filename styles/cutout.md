---
name: Cutout
description: Flat paper shapes in the manner of Saul Bass and the Bauhaus. Cream, black and red, hard edges, shapes that slide in from the frame's edges and carry the cut from scene to scene. For playful or cinematic brand films.
---
# Cutout

A few cut-paper shapes do all the work: they are the characters, the transitions and the metaphor. Use it for brand films, title sequences, and product stories that need an image rather than a screenshot. Avoid it when the product UI has to be shown in detail.

## Look at
- **Saul Bass, *Anatomy of a Murder*, *Vertigo* and *Psycho* titles.** The fewest possible elements doing the most work. Bars sliding in at different lengths and speeds *are* the transitions.
- **Ordinary Folk (Jorge R. Canedo Estrada).** Simple shapes and thoughtful color. One shape hands off to the next scene instead of cutting.
- **Herbert Bayer and Bauhaus posters.** Primaries, circles and bars, type on a diagonal.

## Tokens
```css
:root { --bg: #efe6d2; --ink: #141414; --red: #d7261e; --second: #1f4e9c; /* or #f4c21b: pick one second color per film */ }
.fk-stage { font-family: "Jost", sans-serif; color: var(--ink); background: var(--bg); }
.shape { position: absolute; left: 0; top: 0; }
```
```js
const EASE = { slide: bez(0.76, 0, 0.24, 1), in: bez(0.16, 1, 0.3, 1) };
const DUR = { short: 0.35, mid: 0.6, long: 0.9 };            // vary these between bars; never one length for all
const twos = t => Math.floor(t * 12) / 12;                  // "on twos": draw at 12 fps for a cut-paper feel
const jitter = (t, seed, px = 1) => (rng(seed + Math.floor(t * 12))() - 0.5) * 2 * px; // held-cel wobble
```
Fonts: `font -- . "Jost:ital,wght@0,100..900;1,100..900"`.

## Layout
- Build each scene around one large shape that bleeds off the frame edge. Compose off center.
- Set type against or across the shape, often rotated 90° or on a 45° diagonal.
- Use 3–5 elements per scene, including the type.

## Type
- Jost 500 for text and 700 for titles, 80–200 px, tracking −0.01em, all caps or sentence case per film (pick one).
- At most two lines on screen. Words can be split across shapes.

## Motion
- **Entrances:** shapes enter from the frame edges (never fade in) with `EASE.slide`. A group of bars uses mixed lengths and mixed durations from `DUR`, the way the *Psycho* bars do.
- **Landings:** shapes that land settle with `spring(s, 0.5, 0.15)`, like paper dropped flat. Use one per scene.
- **Hand-offs:** the last shape of a scene is the first shape of the next, at the same position, size and color (a match cut). At least half the cuts should hand off like this.
- **Texture of time:** pass `t` through `twos()` for scenes that should feel handmade, and add `jitter()` of 1 px to held shapes.
- **Type:** arrives through a mask or on the back of a shape that wipes past. It never fades.

## Devices
- Rectangles, circles, half circles and triangles with hard edges, cut by `clip-path`.
- Misregistration: offset the color layer 2–4 px from the black layer.
- Paper grain at 6–10% (`feTurbulence`, seed `Math.floor(t * 12)`).

## Never
Gradients, shadows, strokes or outlines on shapes, rounded rectangles (corners are 0 or the shape is a circle), stock icons, photographs, more than 3 elements moving at once, or a third color beyond red and the one second color.
