---
name: film-design
description: Design a motion-graphics video (launch film, product explainer, social cut) as code, in the film-kit format Shot edits. Use when asked to design, storyboard or prototype a video from a brief. Output is a project folder (film.html + one JS file per scene) that plays in a browser and imports into Shot for retiming, voiceover, music and MP4 export.
---

# Film design (film-kit format)

You design the **picture** as HTML/CSS/JS, with each scene a pure function of time. Timing polish, voiceover, music and export happen later in Shot. The format below is what lets that editing work, so follow it exactly.

## Inputs

- A brief: goal, audience, length, beats, facts, brand. If there isn't one, write `brief.md` from `references/project-template/brief.md` with the user first.
- Brand assets: fonts, logos, product images. Put them in `film/assets/` and reference them by relative path (`film/assets/logo.svg`).
- A look: a style preset from `references/styles/`, the user's references, or the brand. See "Look and craft".

## Output: a project folder, zipped

```
<name>/
  brief.md
  style.md               the preset you followed (copied from references/styles/), with any brand overrides
  film.html              shell: film-kit, lib, one <script> per scene, edit.js last
  film/
    film-kit.js          copy of references/film-kit.js, unmodified
    lib.js               FilmKit.create(...), shared helpers, film.before(preloads)
    styles.css           brand tokens + scene classes
    scenes/<id>.js       one film.scene(...) per file
    edit.js              film.edit([...default cut...]); film.start();
    assets/…
  storyboard/            optional: one PNG per scene (mid-scene frame)
```

Start from `references/project-template/` (the same files the studio's `npm run new` uses) and replace the `{{TITLE}}` and `{{NAME}}` placeholders. Its `AGENTS.md` explains the contract and the `timeline.json` the studio adds later, so keep it in the folder.

If the environment can only produce one file (for example a chat artifact), inline `film-kit.js`, `lib.js`, the scenes and `edit.js` into a single `film.html`, in the same order. The studio accepts that too (`npm run new -- <name> --from film.html`), and agents can split it into scene files later.

## Scene rules (non-negotiable)

1. `film.scene({ id, label, section, start, end, beats?, vo?, notes? }, el => t => {...})`. The builder runs once and the returned `draw(t)` runs per frame.
2. **`draw(t)` depends only on `t`.** No `Date.now`, `performance.now`, `Math.random` (use `rng(seed)` from lib), CSS animations or transitions, `setTimeout`, or state carried between frames. Frames are rendered out of order and in parallel.
3. **Set every animated property on every draw**, including before an entrance and after an exit.
4. **Each scene has its own clock** (`start`–`end`, any numbers). The studio will retime, split, hold and reorder scenes, so a scene must look right at any `t` in its range, whatever came before.
5. Scenes don't share DOM or state. Shared helpers and constants go in `lib.js`.
6. Stage is 1920×1080 by default; use absolute pixel layout inside it. `film.W`, `film.H` are available.
7. Measure text in the builder (fonts are loaded by `film.before`), not in `draw`.

## Metadata that makes the studio useful

- `section`: the brief's beat names ("Hook", "Problem", "Turn", "Proof", "Close"). The studio groups scenes by section and times Lyria music to sections.
- `beats`: the internal moments of a scene (`[{ t: 12.0, label: 'Card lands' }]`). They show on timeline clips and become one-click split points.
- `vo`: the draft voiceover line for the scene. The studio turns it into a VO line ready for Gemini TTS.
- `notes`: intent or open questions for whoever edits next.
- `edit.js`: a default cut that plays the scenes at the intended pace (`{ scene, in?, out?, duration? | speed?, xfade? }`). It seeds the studio timeline and nothing more.

## Look and craft

1. **Pick the look before any scene.** If the brief or the user names a style, use it. Otherwise pick the preset in `references/styles/` that fits the brief (`README.md` there lists them and the render costs), tell the user which one and why, and save it as `style.md`. `references/styles/gallery/film/scenes/<id>.js` is a worked example of each: read it for technique, but don't copy its layout. The brand's colors, type and logo override a preset's; its layout and motion rules still hold.
2. **Set it up once.**
   - Put color and type tokens on `:root` in `styles.css`.
   - Put `EASE`, `DUR` and the grid in `lib.js`.
   - Bundle fonts as woff2 in `film/assets/fonts/`, with `@font-face` rules in `styles.css`. If you can't download them, keep the family names with a system fallback, and put the preset's `font` command in the first scene's `notes`, so an agent can run it after import.

   Scenes use these tokens and never invent their own.
3. **Follow "Design quality"** in `references/project-template/AGENTS.md`:
   - one focal point at a time
   - asymmetric easing, and `spring()` in place of `E.outBack`
   - intentional stagger
   - varied entrances: `mask()`, wipes and drawn strokes, not a fade-up on everything
   - readable holds of max(1 s, characters ÷ 15)
   - varied scene lengths
   - match cuts over crossfades
   - restraint, and its Avoid list
4. **Keep each scene to one idea**, in 1.5–5 s of scene time. Leave room for VO at roughly 2.5 words per second.
5. **Mark illustrative numbers** in `brief.md`, and say "Illustrative" on screen where the style has a source line.
6. **Review your own frames.**
   - Render stills of every scene at its start, mid-entrance and end (headless browser, `?render` on `film.html`, `window.__film.renderFrame([{scene, t, opacity: 1}])`).
   - Make a contact sheet of mid-scene frames.
   - Look at them against `style.md` and fix what breaks it.
   - Then remove one element that isn't earning its place.

## Handoff

Zip the folder. In Shot, pick **File → New project…** → **A design from Claude** and pick the zip (or a single `film.html`). The studio writes its own `AGENTS.md` into the project, so you don't need to keep the template's copy current.
