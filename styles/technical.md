---
name: Technical
description: The engineering manual. Paper, ink and one safety orange; ISO line weights, dimension lines, numbered callouts, exploded views and a title block. For hardware, developer tools and any product whose precision is the point.
---
# Technical

The film is a technical drawing that assembles itself: parts drawn in exact line weights, dimensioned, called out and exploded along one axis, all on a sheet with a title block. Precision reads as trust. Use it for hardware, APIs, infrastructure, and "how it works" beats. Avoid it for emotional brand stories.

## Look at
- **NASA Graphics Standards Manual (Danne & Blackburn, 1975).** The manual page system: a top hairline, small section numbers, vast white space and one red. Borrow the system, never the NASA marks.
- **teenage engineering OP-1 guides.** Thin-line product drawings with numbered callouts, light type at small sizes, and orange as the one functional color.
- **Apple exploded-view films (Mac Pro, 2019).** Parts separate along one axis in a slow ease-in-out, hang, then reassemble in a neutral void.
- **The Hilfiker SBB station clock.** The second hand sweeps, then stops for 1.5 s at the top ("stop-to-go"), a motion motif to steal.

## Tokens
```css
:root { --paper: #f2f1ec; --ink: #141414; --grey: #8c8c88; --grid: #d9d8d2; --accent: #ff4f00; }
.fk-stage { font-family: "Inter Tight", sans-serif; color: var(--ink); background: var(--paper); }
.mono { font-family: "IBM Plex Mono", monospace; font-size: 22px; letter-spacing: .06em; text-transform: uppercase; font-variant-numeric: tabular-nums; }
svg .thin { stroke-width: 2; } svg .wide { stroke-width: 4; } svg .extra { stroke-width: 8; }   /* 1:2:4, ISO 128 */
svg path, svg line { vector-effect: non-scaling-stroke; fill: none; stroke: var(--ink); }
```
```js
const EASE = { draw: bez(0.37, 0, 0.63, 1), move: bez(0.65, 0, 0.35, 1), in: bez(0.16, 1, 0.3, 1) };
const DUR = { draw: 0.6, ext: 0.15, dim: 0.4, explode: 1.6, callout: 0.25 };
const STAGGER = { part: 0.08, char: 0.03 };
const ISO = (X, Y, Z) => [(X - Z) * 0.8660, (X + Z) * 0.5 - Y];   // isometric projection, 30° axes
```
Fonts: `font -- . "Inter Tight:wght@100..900" "IBM Plex Mono:wght@400;500"`. Light variant: `"Martian Mono:wdth,wght@75..112.5,100..800"` at weight 300 for everything.

## Layout
- **The sheet:** a 2 px border inset 48 px, a title block at bottom right (part name, `SCALE 1:2`, `REV C`, date in `.mono`), and zone letters and numbers in the margins. It stays fixed across scenes.
- **Grid:** 12 columns, with the drawing in columns 0–7 and the spec table in columns 8–11. Figures are labelled "FIG. 03".
- **Lines:** three weights per drawing, in the ratio 1:2:4 (2, 4 and 8 px). Never 1 px, which aliases in motion. Parallel lines sit at least 16 px apart.

## Type
- **Display:** Inter Tight 500, 120–200 px, tracking −0.02em. Labels and values use `.mono`.
- **Dimensions:** values sit centered above the dimension line, parallel to it, in tabular figures. Units and tolerances go at the smaller size.

## Motion
- **Lines draw** with `pathLength="1"` and `stroke-dashoffset` over `DUR.draw`, using `EASE.draw`. Outlines go first, then details.
- **Dimensions:**
  - Extension lines draw first (`DUR.ext`): each starts 6 px from the part and runs 12 px past the dimension line.
  - The dimension line then grows from its center both ways (`DUR.dim`).
  - Then the arrowheads snap on: filled, 18 × 6 px (3:1).
  - Last, the value counts up with `EASE.in`.
- **Callouts:** a 6 px dot appears, with no bounce. The leader draws (`DUR.callout`) as a horizontal, then one segment at 30°, 45° or 60°. Then the label types on at `STAGGER.char`.
- **Exploded views:** parts travel along one axis with `EASE.move` over `DUR.explode`, staggered by depth (`STAGGER.part`). They hold for at least 1.5 s, then reverse.
- No blur, no overshoot, no perspective. The camera only pans and zooms orthographically.

## Signature moves
1. **Explode, dimension, reassemble.** The part splits along its axis, dimensions draw onto the separated parts, hold, the dimensions retract, and the part closes.
2. **Stop-to-go.** A counter or a rotating element advances smoothly, then stops for 1.5 s exactly on a beat, like the SBB clock. Use it for rhythm across a whole scene.
3. **Detail view.** A 2 px circle draws around a region, labelled "DETAIL A · 4:1". The camera zooms orthographically into a scaled view of that region, with its own dimension.

## Devices
- Hidden lines dashed (12:3 × line width) and center lines as dash-dot.
- Hatching inside cut sections (an SVG `<pattern>` clipped to the shape).
- Numbered callout circles 40 px across, and a bill-of-materials table that fills row by row.

## Never
Blueprint blue with a white grid, glowing lines, sci-fi HUD rings, lit or perspective 3D, decorative numbers that mean nothing, line weights outside the system, callouts that cross, or arrowheads out of proportion.
