---
name: film-design
description: Design a motion-graphics video (launch film, product explainer, social cut) as code, in the film-kit format Shot edits. Use when asked to design, storyboard or prototype a video from a brief. Output is a project folder (film.html + one JS file per scene) that plays in a browser and imports into Shot for retiming, voiceover, music and MP4 export.
---

# Film design (film-kit format)

You design the **picture** as HTML/CSS/JS, with each scene a pure function of time. Timing polish, voiceover, music and export happen later in Shot. The format below is what lets that editing work, so follow it exactly.

## Inputs

- A brief: goal, audience, length, beats, facts, brand. If there isn't one, write `brief.md` from `references/project-template/brief.md` with the user first.
- Brand assets: fonts, logos, product images. Put them in `film/assets/` and reference them by relative path (`film/assets/logo.svg`).

## Output: a project folder, zipped

```
<name>/
  brief.md
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

## Craft

- One idea per scene, in 1.5–5 s of scene time. Leave room for VO: roughly 2.5 words per second.
- Use one easing family throughout (`EB`, `E.out3`, `E.outBack` in lib), and enter and exit with the same motion vocabulary.
- Mark which numbers on screen are illustrative in `brief.md`.
- Check your work by rendering stills at several `t` values per scene (headless browser, `?render` on `film.html`, `window.__film.renderFrame([{scene, t, opacity: 1}])`), and look at them.

## Handoff

Zip the folder. In Shot, pick **File → New project…** → **A design from Claude** and pick the zip (or a single `film.html`). The studio writes its own `AGENTS.md` into the project, so you don't need to keep the template's copy current.
