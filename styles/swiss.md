---
name: Swiss
description: International Typographic Style. Paper, black and one red; a strict grid, flush-left grotesk, and moves measured in grid modules. For confident, factual launches.
---
# Swiss

The grid is the idea and the type is the image. Nothing moves that doesn't have to, and everything that moves travels along the grid. Use it for dev tools, infrastructure, B2B launches and anything built on facts. Avoid it for warm, lifestyle or playful briefs.

## Look at
- **Josef Müller-Brockmann, Zürich Tonhalle posters.** Take one large geometric gesture (arcs, or bars at fixed angles) set against small, exact, flush-left type.
- **Otl Aicher, Munich 1972.** Take the idea that every position and color comes from a system and none are chosen ad hoc.
- **Experimental Jetset, Whitney "responsive W".** Take a single line that re-proportions itself to the content.

## Tokens
```css
:root { --bg: #f2f0eb; --ink: #111111; --muted: #6b6b66; --accent: #e4002b; }
.fk-stage { font-family: "Inter Tight", sans-serif; color: var(--ink); background: var(--bg); }
.num { font-variant-numeric: tabular-nums; }
```
```js
const GRID = { cols: 12, margin: 96, gutter: 24, base: 12 };
const col = n => GRID.margin + n * (W - 2 * GRID.margin + GRID.gutter) / GRID.cols; // x of column n (0..12)
const MOD = (W - 2 * GRID.margin + GRID.gutter) / GRID.cols;                        // one column step
const EASE = { in: bez(0.16, 1, 0.3, 1), out: bez(0.5, 0, 0.75, 0), move: bez(0.87, 0, 0.13, 1) };
const DUR = { in: 0.7, out: 0.4, move: 0.8, rule: 0.6 };
const STAGGER = { line: 0.09, word: 0.05 };
```
Fonts: `font -- . "Inter Tight:wght@100..900"`.

## Layout
- 12 columns, 96 px margins and 24 px gutters. Take x from `col(n)` and snap y to the 12 px baseline. For portrait, use 6 columns and 72 px margins.
- Set type flush left, ragged right. Keep layouts asymmetric: the headline across columns 0–8, the metadata in columns 9–11. Leave at least 40% of the frame empty.
- Center only a single word, and only on the closing card.

## Type
- **Display:** Inter Tight 700, 180–240 px, tracking −0.035em, line-height 0.9, sentence case. Break lines by sense, never by width.
- **Secondary:** 500 at 40 px, tracking −0.01em.
- **Labels:** 500 at 24 px, sentence case, led by an index ("01 Setup").
- Use no more than three sizes in a frame. Big index numerals are the signature.

## Motion
- **Lines:** each line enters through a mask (`mask()`) with `EASE.in` over `DUR.in`, staggered by `STAGGER.line`. The other entrance is a slide of exactly one `MOD` along the grid.
- **Rules:** 2 px hairlines draw left to right (scaleX from 0, transform-origin left) over `DUR.rule`, and the type lands on them after.
- **Placement:** position changes use `EASE.move` and always travel horizontally or vertically, by whole modules.
- **What never happens:** no overshoot, no springs with bounce, no blur, no scale-ins, no rotation except the one geometric gesture.
- **Cuts:** hard cuts on the beat. The one wipe allowed is the red block: it covers columns 8–12 at the end of one scene, and the next scene starts from that same block.
- **Stillness:** once type is set, it stays put.

## Devices
- 2 px ink rules, index numerals and a visible order of reading.
- One geometric gesture per film (a circle, an arc, or a bar at 15°/30°/45°), in `--accent`.
- Numbers use `.num` and count with `EASE.in`.

## Never
Gradients, shadows, rounded corners, blur, glows, icons, centered paragraphs, a second accent color, diagonal motion, or type smaller than 24 px.
