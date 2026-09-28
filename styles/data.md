---
name: Data
description: Data journalism in the manner of the FT, NYT Upshot and The Pudding. Takeaway headlines, one highlighted series against grey, direct labels, and charts that draw themselves. For results, benchmarks and reports.
---
# Data

Every scene makes one claim and shows the evidence for it. The chart is the hero, the headline states what it means, and color is spent only on the thing that matters. Use it for performance numbers, customer results, market context and annual reviews. Avoid it when there are no real numbers.

## Look at
- **FT visual journalism (John Burn-Murdoch).** Grey out everything, then highlight one series. Label lines directly at their ends and annotate the takeaway on the chart.
- **The Pudding.** The same marks move between states (sort, filter, zoom) instead of cutting to a new chart.
- **Bartosz Ciechanowski.** One color per concept, used the same way in every scene.

## Tokens
```css
:root { --bg: #faf7f2; --ink: #1d1d1b; --muted: #76716a; --grid: rgba(29,29,27,.12); --dim: #c9c4bc; --hi: #0f5499; --hi2: #c2410c; }
.fk-stage { font-family: "Libre Franklin", sans-serif; color: var(--ink); background: var(--bg); font-variant-numeric: tabular-nums; }
.deck { font-family: "Source Serif 4", serif; font-size: 34px; line-height: 1.3; color: var(--muted); }
.axis { font-size: 20px; color: var(--muted); }
.source { font-size: 20px; color: var(--muted); }
```
```js
const EASE = { grow: bez(0.22, 1, 0.36, 1), draw: bez(0.65, 0, 0.35, 1), in: bez(0.16, 1, 0.3, 1) };
const DUR = { axes: 0.4, grow: 0.6, draw: 1.8, count: 1.2, dim: 0.5 };
const STAGGER = { bar: 0.04 };
const fmt = new Intl.NumberFormat('en-US');                 // round every frame: fmt.format(Math.round(v))
```
Fonts: `font -- . "Libre Franklin:wght@100..900" "Source Serif 4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900"`.

## Layout
- The headline states the takeaway as a sentence ("Builds got 3× faster in six weeks"), top left, 64–84 px, weight 700, at most 2 lines.
- The chart takes about 60% of the frame. The deck or annotation column takes 30%.
- A source line sits bottom left in `.source`. Say "Illustrative data" there when the brief marks numbers as illustrative.
- Label series directly at the end of their lines or bars. Never use a legend.

## Type
- **Headline:** Libre Franklin 700.
- **Labels and axes:** 500.
- **Deck:** Source Serif 4 (`.deck`).
- Every number uses tabular figures (the stage sets them), so digits don't jitter while counting.

## Motion
- **Axes first:** gridlines and axes draw over `DUR.axes`, then the data comes in.
- **Bars:** grow from the baseline (scaleY with transform-origin bottom) over `DUR.grow` with `EASE.grow`, staggered by `STAGGER.bar`.
- **Lines:** SVG paths with `pathLength="1"` and `stroke-dasharray: 1`, drawn by `stroke-dashoffset` from 1 to 0 over `DUR.draw` with `EASE.draw`. A dot rides the tip, and the end label lands when the line does.
- **Counts:** numbers count on `EASE.in` over `DUR.count`, and the count ends on the exact figure.
- **Highlight:** everything else fades to `--dim` over `DUR.dim`, then the one series takes `--hi`. `--hi2` is only for a direct comparison.
- **Annotations:** the leader line draws, then its text arrives through a mask.
- **State changes** (sort, zoom, filter) are one scene with timed phases in which the same marks move. They are not cuts.
- Nothing moves while the viewer reads a number. Hold it for at least 2 s.

## Devices
- 1 px gridlines in `--grid` and a 2 px baseline.
- Direct labels, leader-line annotations, and a range band for context.
- Big single numbers (160–240 px) for one-stat scenes.

## Never
3D charts, pie charts with more than 3 slices, legends, gradient fills, rainbow palettes, bar axes that don't start at zero, dual y-axes, camera moves across a chart, or decimals the brief didn't give.
