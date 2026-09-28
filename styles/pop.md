---
name: Pop
description: Bold brand pop in the manner of Collins (Dropbox, Mailchimp) and Spotify Wrapped. Two-color pairs that swap on every cut, giant flat shapes with their own personalities, flush-left grotesk, squash and stretch on shapes only. For consumer apps, launches and year-in-review films.
---
# Pop

Loud, but systematic. Each shot is exactly one color pair, shapes are characters with their own behaviors, and planes push each other around on one axis. It's energetic without chaos, because the rules are strict. Use it for consumer apps, marketplaces, recaps, "wrapped"-style stats and playful launches. Avoid it for security, finance or somber subjects.

## Look at
- **Collins, Dropbox identity (2017).** Pair a light cool color with a dark warm one, diagonally across the wheel. Planes push and reveal on a single axis. Type is flush left and never centered.
- **Spotify Wrapped (2022, animated by Hornet).** A kit of shapes, each with its own behavior, around one giant stat.
- **Collins, Mailchimp (2018).** One owned color carries the whole system, with a warm, soft serif and a single surreal object as the surprise.

## Tokens
```css
:root { --graphite: #1e1919; }
.fk-stage { font-family: "Bricolage Grotesque", sans-serif; }
.head { font-weight: 700; letter-spacing: -0.03em; line-height: .95; font-variation-settings: "opsz" 96; }
.soft { font-family: "Fraunces", serif; font-variation-settings: "SOFT" 100, "WONK" 0, "opsz" 144; font-weight: 400; }
```
```js
const PAIRS = [                                   // [background, foreground]: light-cool with dark-warm, or the reverse
  ['#2f5bff', '#f7f5f2'], ['#fad2e1', '#6a1b2f'], ['#c8f55a', '#1a2a6c'], ['#ffd21e', '#3d1e5c'], ['#b7e4f4', '#6b2a10'],
];
const EASE = { push: bez(0.7, 0, 0.2, 1) };
const DUR = { push: 0.45 };
/** Squash and stretch that keeps volume: s > 1 stretches along the motion, < 1 squashes; returns [along, across]. */
const squash = s => [s, 1 / s];
const land = (t, t0) => 1 - 0.18 * Math.exp(-7 * Math.max(0, t - t0)) * Math.cos(18 * Math.max(0, t - t0)) * (t >= t0 ? 1 : 0); // impact squash, settles in ~0.5 s
```
Fonts: `font -- . "Bricolage Grotesque:opsz,wdth,wght@12..96,75..100,200..800" "Fraunces:opsz,wght,SOFT,WONK@9..144,100..900,0..100,0..1"`.

## Layout
- One pair per shot: background and foreground, plus `--graphite` for small text only. Never three colors.
- Flush left with a 120 px margin. Never centered.
- Giant shapes (circles, pills, quarter-rounds, stars with soft points) at 40–120% of the frame height, cropped by the frame edge.
- Photos become duotones in the current pair (SVG `feColorMatrix`): shadows take the dark color, highlights the light one.

## Type
- **Headline:** `.head` at 160–280 px. The subline is half the headline size. Body is 40 px.
- **The soft serif:** `.soft` is for one word of warmth per film, not a second system.
- No hyphenation. Sentence case.

## Motion
- **Planes:** push the previous content off on one axis only, x or y, over `DUR.push` with `EASE.push`. The incoming plane squashes 8–12% against its leading edge on contact.
- **Squash and stretch, on shapes only:**
  - Stretch 1.15–1.25 along the travel at peak speed. Squash 0.8 for 60–80 ms at contact, with the transform origin at the contact edge (`land()`). Volume is preserved (`squash()`).
  - Anticipation is an 8% counter-move over 0.12 s.
  - Never squash text: it distorts the letters.
- **Overshoot:** 8–12% for planes and type (`spring(s, 0.5, 0.2)`), and 20–30% for character shapes.
- **Personalities:** each shape has one behavior (bounce, spin, breathe or wobble), each with a different period, and keeps it all film.
- Cuts land on the beat.

## Signature moves
1. **Pair swap.** Every cut swaps which color of the pair is the background, or moves to the next pair. The frame never keeps both colors across a cut.
2. **Plane push.** A flat plane in the next pair's color enters on one axis and shoves the current content off. It squashes on contact, springs back, and the headline rises through a mask on it.
3. **The stat.** A giant number (400–600 px) counts up, flush left, while 3–4 shapes around it each keep their own behavior at different periods.

## Devices
- A shape kit of 4–6 shapes, used across the whole film.
- Duotone photography and one surreal object in the owned color.
- Stickers or labels set in `--graphite` at 28–32 px.

## Never
Three or more colors in a frame, gradients, drop shadows, "Corporate Memphis" flat people, centered text, the same bounce on everything, squashed type, a black background behind brand colors, or rainbow palettes.
