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
const MOD = (W - 2 * GRID.margin + GRID.gutter) / GRID.cols;  // one column step
const col = n => GRID.margin + n * MOD;                          // left edge of column n (0..11)
const colEnd = n => col(n) + MOD - GRID.gutter;                 // right edge of column n; colEnd(11) = W - margin
const ROW = 4 * GRID.base;                                      // one vertical step (48 px)
const EASE = { in: bez(0.16, 1, 0.3, 1), out: bez(0.5, 0, 0.75, 0), move: bez(0.87, 0, 0.13, 1) };
const DUR = { in: 0.7, out: 0.45, move: 0.8, rule: 0.6 };
const STAGGER = { line: 0.09, word: 0.05 };
```
Fonts: `font -- . "Inter Tight:wght@100..900"`.

## Layout
- 12 columns, 96 px margins and 24 px gutters. Take x from `col(n)` and `colEnd(n)`, and put the tops of text boxes on multiples of the 12 px baseline. For portrait, use 6 columns and 72 px margins.
- Set type flush left, ragged right. Keep layouts asymmetric: the headline across columns 0–8, the metadata in columns 9–11. Leave at least 40% of the frame empty.
- Center only a single word, and only on the closing card.

## Type
- **Display:** Inter Tight 700, 180–240 px, tracking −0.035em, line-height 0.9, sentence case. Break lines by sense, never by width.
- **Secondary:** 500 at 40 px, tracking −0.01em.
- **Labels:** 500 at 24 px, sentence case, led by an index ("01 Setup").
- Use no more than three sizes in a frame. Index numerals are the signature: at label size on every scene, and once per film as a hero numeral at 240–360 px.

## Motion
- **Lines:** each line enters through a mask (`mask()`) with `EASE.in` over `DUR.in`, staggered by `STAGGER.line`. The other entrance is a slide of exactly one `MOD` along the grid.
- **Rules:** 2 px hairlines draw left to right (scaleX from 0, transform-origin left) over `DUR.rule`, starting with the type they carry. The type is the primary move.
- **Placement:** position changes use `EASE.move` and travel horizontally by whole `MOD`s or vertically by whole `ROW`s.
- **What never happens:** no overshoot, no springs with bounce, no blur, no scale-ins, no rotation except the one geometric gesture.
- **Cuts:** hard cuts on the beat. The one wipe allowed is the red block: full height, from `col(8)` to the right frame edge. It wipes in from the right (`clip-path: inset(0 0 0 100%)` to `inset(0)`) with `EASE.move` over `DUR.move` at the end of one scene, and the next scene starts under that same block and wipes it off to the right.
- **Stillness:** once type is set, it stays put.

## Signature moves
1. **Index cut.** A hero numeral ("01", 320 px) rises through its mask in columns 0–2 (0–0.7 s). Its label slides one `MOD` in from the right (0.25–0.95 s) while a 2 px rule draws under both (0.1–0.7 s). Hold for 1.5 s, then hard cut.
2. **Re-set the poster.** A settled headline block moves from columns 0–7 to 4–11 in whole `MOD`s (`EASE.move`, 0.8 s) while a second block rises through its mask in the space it left, 0.3 s behind. The layout reorganizes the way a compositor re-sets a page.
3. **Red block hand-off.** The cut described under Motion: the block wipes in over the end of one scene, and the next scene starts under it and wipes it away.

## Devices
- 2 px ink rules, index numerals and a visible order of reading.
- At most one geometric gesture per film (a circle, an arc, or a bar at 15°/30°/45°), in `--accent`. It's optional.
- Counting numbers use `.num` (tabular figures, so digits don't jitter) and count with `EASE.in`. Static numbers keep the default figures, which space better at display sizes.

## Never
Gradients, shadows, rounded corners, blur, glows, icons, centered paragraphs, a second accent color, diagonal motion, or type smaller than 24 px.
