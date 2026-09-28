---
name: Couture
description: High fashion. Black, white and a hairline Didone at extreme scale; black-and-white photography, sound-led cuts, a house name set small in a plain tight sans. For fashion, beauty, luxury and design-object launches.
---
# Couture

Scale contrast is the whole grammar. A frame-filling Didone word cuts to an 18 px caption alone on white, and the music decides when. It's austere, confident and never decorative. Use it for fashion, beauty, luxury, furniture and design objects. Avoid it for software feature tours.

Without photography it becomes a type-only film. That can work, but the brief should know.

## Look at
- **Alexey Brodovitch, *Harper's Bazaar* (1934–58).** The spread as the unit, with type and photograph as one image. Take the image cropped hard and bled against white space.
- **Fabien Baron, *Harper's Bazaar* relaunch (1992).** Didone letters spaced edge to edge across the page, interlocking with the figure. Take letters as architecture.
- **Hedi Slimane's Saint Laurent (2012) and Celine (2018), and Peter Saville's Burberry (2018).** The house name in a plain, tight sans, small and centered over black-and-white photography. Take restraint as the luxury signal.

## Tokens
```css
:root { --black: #000; --white: #fff; --paper: #f3f0ea; --grey: #8a8a8a; --accent: #5a0f14; /* oxblood, optional, once */ }
.fk-stage { font-family: "Bodoni Moda", serif; color: var(--black); background: var(--white); }
.didone { font-variation-settings: "opsz" 96; font-weight: 400; letter-spacing: -0.03em; line-height: .85; }
.house { font-family: "Inter Tight", sans-serif; font-weight: 600; font-size: 44px; letter-spacing: .02em; text-transform: uppercase; }
.cap { font-family: "Inter Tight", sans-serif; font-weight: 500; font-size: 20px; letter-spacing: .26em; text-transform: uppercase; }
.photo { filter: grayscale(1) contrast(1.3); }
```
```js
const BPM = 120, BEAT = 60 / BPM;                  // set from the music: cuts are musical
const beat = n => n * BEAT;
const EASE = { push: bez(0.33, 0, 0.67, 1) };
const push = (t, a, b) => 1 + 0.04 * EASE.push(P(t, a, b));   // slow push over a held image
```
Fonts: `font -- . "Bodoni Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900" "Inter Tight:wght@100..900"`. Always set opsz 96 at display sizes, or the hairlines thicken.

## Layout
- Asymmetric: full-bleed photograph or full-bleed white, nothing in between.
- Captions pin to a corner at a 72 px margin. The house name sits centered, small, 96 px from the bottom.
- Split spreads: two images side by side, with a 0 or 2 px gutter.
- The largest type in a frame is at least 20 times the smallest.

## Type
- **Hero word:** `.didone` at 360–640 px. It may crop off one edge. Italic is the only emphasis.
- **Deck:** Bodoni Moda italic at 44–56 px.
- **Captions and house name:** `.cap` and `.house`.

## Motion
- **Cuts:** the music makes them. Montage phrases run 0.25–0.5 beat per cut, then one image or word holds for 3–6 s while `push()` moves it from 1.00 to 1.04.
- **Type:** hard cuts on and off. The only type animation is tracking breathing from 0 to 0.06em across a whole shot.
- **Between phrases:** 2 frames of black. No crossfades, or 4–6-frame ones at most.
- **Photographs:** preload them in `film.before`. Shot has stills only, no video clips, so motion comes from cutting and pushing.

## Signature moves
1. **Masthead behind the head.** A 600 px Didone word spans the frame. A cut-out photo (a PNG with alpha) sits over it, hiding letters as on a magazine cover. It needs a matte asset from the brief.
2. **Scale jump.** A hard cut on the beat, from a frame-filling Didone word to an 18 px caption alone on white. The contrast is the transition.
3. **Letter spread.** The five to seven letters of a word are placed at fixed x positions edge to edge. They arrive one per beat, and a photograph interlocks between them.

## Devices
- Black-and-white photographs, crushed blacks, fine static grain.
- Split spreads, a single line of italic, and the house name as a sign-off.
- Oxblood once in the film, if at all.

## Never
Gold, foil or gradients, script fonts, Playfair everywhere, Didone at small optical sizes, faux bold, typewriter reveals, Ken Burns on every still, slow crossfades, bokeh, rose gold, symmetric centering of everything except the house name, or stock "elegant" piano.
