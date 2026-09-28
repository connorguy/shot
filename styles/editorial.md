---
name: Editorial
description: Magazine editorial. A large light serif on warm paper, italic for emphasis, one oxblood accent, slow line reveals and long holds. For stories, brand essays and founder notes.
---
# Editorial

It reads like a well-set magazine spread that happens to move: type is large, light and close to the edge, and the pace lets every line be read twice. Use it for narrative films, manifestos and brand essays, and for anything with a strong script. Avoid it for fast feature tours.

## Look at
- **The New York Times Magazine covers (Gail Bichler's era).** Type used as the image, cropped by the frame, with one word turned by italic or scale.
- **Kinfolk and Cereal.** Generous paper, small quiet labels, photographs given room.
- **Jop van Bennekom's *Fantastic Man* and *The Gentlewoman*.** Plain, confident typography, where long captions and the words themselves are the design.

## Tokens
```css
:root { --bg: #f4efe6; --ink: #1a1714; --muted: #6f675e; --rule: rgba(26,23,20,.18); --accent: #8c1c13; }
.fk-stage { font-family: "Newsreader", serif; color: var(--ink); background: var(--bg); }
.display { font-weight: 300; font-variation-settings: "opsz" 72; letter-spacing: -0.02em; line-height: .95; }
.label { font-family: "Instrument Sans", sans-serif; font-weight: 500; font-size: 22px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
```
```js
const EASE = { in: bez(0.77, 0, 0.175, 1), out: bez(0.55, 0, 1, 0.45), soft: bez(0.65, 0, 0.35, 1) };
const DUR = { line: 1.0, out: 0.6, xfade: 0.7 };
const STAGGER = { line: 0.12 };
const GRID = { cols: 6, margin: 120 };
```
Fonts: `font -- . "Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800" "Instrument Sans:wght@400..700"`. Alternative display face: `"Instrument Serif:ital@0;1"`.

## Layout
- 6 columns with 120 px margins. The display line may run into the edge of the frame and crop there.
- Put the headline in the upper or lower third, never dead center. Keep a folio in one corner (`.label`, e.g. "No. 03 · The problem") on every scene, in the same place.
- Body copy runs to at most 45 characters per line.

## Type
- **Display:** `.display` at 200–300 px. Emphasis is the same size in italic, sometimes in `--accent`, and never bold.
- **Body:** Newsreader 400 at 34 px, line-height 1.3.
- **Labels:** `.label` only.
- Use real quotes and dashes (“ ” ’ —), never straight ones.

## Motion
- **Lines:** reveal each line through `mask()` with `EASE.in` over `DUR.line`, staggered by `STAGGER.line`. The italic word follows 0.2 s after its line lands.
- **Images:** a slow Ken Burns move from scale 1.00 to 1.06 across the whole shot, with `EASE.soft`.
- **Transitions:** dissolves of `DUR.xfade`, or a clip-path wipe like a turned page. Cuts come at the ends of sentences.
- **Holds:** hold each finished line for at least 2 s, and set no scene shorter than 3 s.
- **What never happens:** no scale-ins on type, no blur on type, no springs.

## Signature moves
1. **Cropped headline.** A 300 px display line starts with its first letters cut off by the left frame edge and rises through its mask. The next line follows 0.12 s later. The italic word lands in `--accent` 0.2 s after its line.
2. **Pull quote.** A 400 px quote mark fades in slowly in `--accent` (0.8 s, `EASE.soft`). The quote reveals line by line, 0.12 s apart. After a 0.6 s hold, the attribution arrives as a `.label`.
3. **Page turn.** In the last 0.45 s of a scene, its content wipes away from right to left behind a 1 px `--rule` line (`clip-path`, `EASE.in`). The next scene's first 0.45 s wipes its content in the same direction behind the same line. The cut falls where the line reaches the left edge. Scenes are independent, so each one does its own half.

## Devices
- 1 px column rules in `--rule`.
- A pull-quote mark at 400 px in `--accent`.
- Duotone photographs (`grayscale(1)`, then multiply over `--accent` at low opacity).
- Folio and issue numbers.

## Never
Display weights above 500, a sans-serif display face, bouncing, fast cuts (shorter than 1.5 s), a second accent, centered body copy, or icons.
