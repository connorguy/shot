---
name: Brutalist
description: Brutalist and New Wave editorial after Bloomberg Businessweek, Weingart and Ray Gun. One blunt line at maximum size, default-web colors, UI artefacts as jokes that carry content, hard cuts on twos. For bold launches, media brands, indie software and anything with a point of view.
---
# Brutalist

It looks raw and is precise underneath. One hidden grid, two families, and every "error" (a cursor, a selection, a dialog box) is a specific artefact that says something. It's direct and fast, and funny when the content earns it. Use it for opinionated launches, media, dev tools with attitude and cultural brands. Avoid it for luxury, healthcare or anything that needs calm.

## Look at
- **Bloomberg Businessweek under Richard Turley (2010–14).** One blunt line at maximum size (the "It's Global Warming, Stupid" cover). Default-UI artefacts (cursors, dialogs, spreadsheet grids) used as jokes that carry the story.
- **Wolfgang Weingart's Basel posters (1970s).** Measured chaos: extreme letterspacing, stepped lines and layering, all exact.
- **David Carson, *Ray Gun* (1990s).** Break legibility only where it means something. Everything else stays readable.

## Tokens
```css
:root { --paper: #fff; --ink: #000; --link: #0000ee; --visited: #551a8b; --face: #c0c0c0; --shadow: #808080; --title: #000080; --accent: #ff4f00; }
.fk-stage { font-family: "Inter Tight", sans-serif; color: var(--ink); background: var(--paper); }
.blunt { font-weight: 800; letter-spacing: -0.045em; line-height: .82; }
.times { font-family: "Tinos", serif; }                           /* metric clone of Times New Roman */
.mono { font-family: "Cousine", monospace; font-size: 22px; }     /* metric clone of Courier New */
.win { background: var(--face); box-shadow: inset -2px -2px var(--shadow), inset 2px 2px #fff; }
```
```js
const twos = t => Math.floor(t * 12) / 12;           // animate on twos
const hold = (t, a, b) => t >= a && t < b;             // things are on or off
const marquee = (t, speed, w) => -((t * speed) % w);   // 150–300 px/s to read, 400–600 as texture
```
Fonts: `font -- . "Inter Tight:wght@100..900" "Tinos:ital,wght@0,400;0,700;1,400" "Cousine:wght@400;700"`.

## Layout
- One hidden 12-column grid. Every collision shares a baseline or an edge with what it hits.
- The headline runs 240–480 px and crops at the frame. Body is 28–36 px, captions 22 px mono. The headline is at least 6 times the body size.
- Two families, plus Cousine for UI chrome. At most three sizes per frame.

## Type
- **Blunt line:** `.blunt` Inter Tight 800, caps or sentence case. It says the point in five words or fewer.
- **Documents:** `.times` for text that should feel like a page.
- **UI:** `.mono` for UI, captions and timestamps.
- Underlined `--link` blue is a real device: use it for the one word that matters.

## Motion
- **Timing:** hard cuts. Motion runs on `twos(t)`, with holds of 8–24 frames between beats.
- **Scale:** size changes by cutting between sizes, never by zooming.
- **Steps:** things appear and disappear whole (`hold()`), or in a `steps()` progression: typing, window pops, table rows.
- **Marquee bands:** move at a constant speed (`marquee()`). This is the only linear move.
- **Flashes and inversions:** no more than 3 in any second, and never a full-frame saturated red flash (WCAG 2.3.1).

## Signature moves
1. **Live edit.** A system selection highlight sweeps a word of the headline. The word is deleted, and the new word types in, so the headline gets rewritten on screen.
2. **Scale-jump cut.** A word cropped at 480 px hard-cuts to the same word at 24 px, alone in white space, on the beat.
3. **Dialog stack.** Gray `.win` dialogs pop in one per beat, each 24 px down and right of the last, each carrying one line of the argument. Then they all close at once.

## Devices
- Default link blue and visited purple, `.win` dialogs, a text cursor and a spreadsheet grid.
- Full-width marquee bands between sections.
- Weingart staircases: lines stepping down diagonally while tracking changes in 4 discrete steps.

## Never
Random fonts or random tilts, RGB-split glitch on everything, ironic Comic Sans, grunge textures, gradients, soft shadows, low-contrast unreadable body copy, missing hierarchy, or Carson imitation without a content reason.
