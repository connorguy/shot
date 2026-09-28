---
name: Keynote
description: Product-launch dark in the Apple and Linear manner. Near-black, one line per shot, the product UI crisp at 1:1, slow camera drift, a single soft light. For software and hardware launches.
---
# Keynote

Restraint that reads as expensive. Each shot holds one sentence or one piece of product, lit like an object, with motion that is slow and certain. Use it for product launches, feature announcements and anything where the UI is the star. It is the wrong choice when there is no product to show: an empty dark frame with a glow is the cliché.

## Look at
- **Apple keynote and product films.** One idea per shot, a big tight headline of 1–5 words, reveals by mask or blur-to-sharp and never by bounce, and a frame that never quite freezes.
- **Linear launch pages and films.** A near-black ground, product panels at 1:1 with 1 px borders, one light source, and small, precise supporting type.
- **Vercel Ship.** Mono labels used sparingly as metadata, and a quiet grid in the background.

## Tokens
```css
:root { --bg: #0a0a0b; --fg: #ededed; --muted: #8a8f98; --line: rgba(255,255,255,.08); --panel: #111113; --accent: #4c7dff; }
.fk-stage { font-family: "Geist", sans-serif; color: var(--fg); background: var(--bg); }
.mono { font-family: "Geist Mono", monospace; font-size: 20px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 20px; }
```
```js
const EASE = { in: bez(0.23, 1, 0.32, 1), out: bez(0.55, 0, 1, 0.45), move: bez(0.77, 0, 0.175, 1) };
const DUR = { in: 0.8, out: 0.5, move: 0.9 };
const STAGGER = { char: 0.022, word: 0.06, item: 0.08 };
const drift = (t, a, b) => 1 + 0.03 * P(t, a, b);   // camera push over the whole shot: the only linear move
```
Fonts: `font -- . "Geist:wght@100..900" "Geist Mono:wght@400..500"`. If the brand has its own type, use that in place of Geist.

## Layout
- Center the hero line. Keep supporting copy within a 1280 px column. Show one line of type or one product panel per shot, never both at full weight.
- Build product UI in the DOM at 1:1 pixels. Panels take 60–70% of the frame width. Never scale a screenshot up.
- Keep the frame 90% neutral and use the accent on no more than 5% of it.

## Type
- **Display:** Geist 600, 120–160 px, tracking −0.04em, line-height 1.0, at most 6 words.
- **Body:** 28–32 px in `--muted`.
- **Labels:** `.mono`, at most one per shot.
- The hero line may carry a white-to-`#a1a1aa` text gradient. It is the only gradient in the film.

## Motion
- **Headlines:** blur in from 10 px to 0, move from y +16 to 0 and fade from 0 to 1, over `DUR.in` with `EASE.in`, staggered by word or character.
- **Panels:** land with `spring(s, 0.6, 0.1)` from scale 0.96 and opacity 0. Never grow from scale 0.
- **Camera drift:** each shot drifts with `drift()` across its whole length, applied to a wrapper, so no frame is dead still.
- **Cursor:** when a cursor demonstrates the product, it moves on eased curves (never straight lines), dips to 0.97 scale on a click, and the UI answers within 0.1 s.
- **Exits:** a fade of `DUR.out` with 4 px of blur, or a cut. Crossfades are fine in this style, with 2 px of blur through the dissolve.

## Devices
- One radial glow behind the hero in `--accent` at 15–20% opacity, blurred 160 px. Use it at most once per scene.
- A 64 px dot grid at 6% opacity, masked by a radial fade.
- Grain at 3–4% (`feTurbulence`, seed `Math.floor(t * 24)`).

## Never
Blue-to-purple gradient backgrounds, more than one glow, glassmorphism or `backdrop-filter`, drop shadows on panels (use the 1 px border), 3D tilts past 8°, particle fields, stock icons, or a headline sharing the frame with a busy UI.
