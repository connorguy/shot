# Style presets

Each `<id>.md` here is art direction for a film: what to look at, the tokens, and the rules for layout, type and motion, plus what to avoid. It isn't code. A project that takes a preset gets a copy as `style.md`, and its `AGENTS.md` tells agents to follow it when they design or change scenes. The universal craft rules (easing, holds, rhythm, the review pass) live in the project `AGENTS.md` and in `skills/film-design/SKILL.md`. A preset only adds to them or changes their numbers.

Use one:
- In the studio: **File → New project…**, then pick a **Style**.
- From a terminal: `npm run new -- <name> --style swiss`.
- In an existing project: copy `styles/<id>.md` to the project's `style.md`, then ask an agent to restyle the scenes.
- In a design session: the film-design skill carries these as `references/styles/`.

| id | For |
|---|---|
| `swiss` | Confident, factual launches. Paper, black, one red, a strict grid, moves measured in grid modules. |
| `keynote` | Software and hardware launches in the Apple and Linear manner. Near-black, one line per shot, UI at 1:1, slow drift. |
| `editorial` | Stories, brand essays, founder notes. A large light serif on paper, slow line reveals, long holds. |
| `kinetic` | Announcements and hype cuts set to music. Type fills and crops the frame, steps through its axes, and changes on the beat. |
| `data` | Results, benchmarks, reports. Takeaway headlines, one highlighted series, charts that draw on. |
| `cutout` | Playful or cinematic brand films in the manner of Saul Bass and the Bauhaus. Flat paper shapes that carry the cuts. |
| `riso` | Indie, community and culture brands. Two spot inks overprinting, halftone tones, plates out of register, on twos. |
| `technical` | Hardware, APIs, "how it works". ISO line weights, dimensions, callouts, exploded views, a title block. |
| `terminal` | CLIs and developer tools. One window, a strict character grid, human typing rhythm, output that builds panels. |
| `ma` | Calm, considered brands. Japanese minimalism: emptiness, vertical type, one slow move, then stillness. |
| `couture` | Fashion, beauty, luxury, design objects. Hairline Didone at extreme scale, black-and-white photography, cuts on the music. |
| `cinema` | Brand films, origin stories, trailers. Letterbox, bone-white serif credits, grain, weave, halation. |
| `hud` | AI, security, aerospace, data. A dot grid, one line color, three line weights, data that types on and locks. |
| `pop` | Consumer apps and recaps. Two-color pairs that swap on every cut, giant shapes with personalities, squash and stretch. |
| `brutalist` | Launches with a point of view. One blunt line at maximum size, default-web colors, UI artefacts that carry the joke. |

Each preset has a worked example in `gallery/film/scenes/<id>.js`, a single scene that uses its tokens and signature moves, and a cover in `previews/<id>.jpg`. Rebuild both with `npm run style-gallery` (it bundles the fonts and renders the covers), and open `gallery/film.html` to watch them.

References are there for their approach. Never reproduce another company's logo, marks or exact brand system in a film.

## What HTML renders well

Export draws every frame in headless Chrome and captures it. These are measured costs per 1080p frame, against about 50 ms for a plain frame:

| Cheap (about the same as plain) | Costly |
|---|---|
| transforms, opacity, `clip-path` wipes and masks | `filter: blur()` on a large shape: **3.5×**. Use a `radial-gradient` for glows instead. |
| SVG stroke drawing (`pathLength` + dashoffset) | full-frame SVG grain reseeded every frame: **+70%**. Reseed on twos, or render it at half size. |
| `mix-blend-mode: multiply`, CSS 3D `perspective` | big soft `box-shadow`s: **+70%** |
| variable-font axes (`font-variation-settings`) | thousands of animated DOM nodes (1,500 spans: +50%). Use a canvas. |
| canvas 2D drawing, WebGL (needs `preserveDrawingBuffer: true`) | full-frame `feDisplacementMap`. Keep it to one small element. |

The limits:
- **No video clips.** Motion comes from stills, code, canvas and WebGL.
- **No live data or network.** Fonts must be bundled with `npm run font`.
- **Latin fonts only by default.** Pass `--text` to bundle any other script.
- **No randomness.** Use `rng(seed)`, seeded from the frame (`Math.floor(t * 24)`) for anything that flickers.

## Writing a preset

Keep it to one screen of rules an agent can check against a frame, and add an example scene to `gallery/film/scenes/` (copy `swiss.js` for its conventions). Use this shape (the studio reads `name` and `description` from the front matter):

```
---
name: Short name
description: One sentence: the look, and what it's for.
---
# Name
What it is, and when to use it or not (2–3 sentences).
## Look at        2–3 real references, each with the one thing to take from it
## Tokens         a CSS :root block, a lib.js block (easing, durations, grid), and the `font` command
## Layout · ## Type · ## Motion
## Signature moves   2–3 shots a top studio would build, with exact timings
## Devices
## Never          the style's own don'ts
```

Numbers beat adjectives. Name fonts that are on Google Fonts, so `npm run font` can bundle them. Every value in the tokens should be used by at least one rule.
