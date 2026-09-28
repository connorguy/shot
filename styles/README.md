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
| `editorial` | Stories, brand essays, founder notes. Large light serif on paper, slow line reveals, long holds. |
| `kinetic` | Announcements and hype cuts set to music. Type fills and crops the frame, steps through its axes, and changes on the beat. |
| `data` | Results, benchmarks, reports. Takeaway headlines, one highlighted series, charts that draw on. |
| `cutout` | Playful or cinematic brand films in the manner of Saul Bass and the Bauhaus. Flat paper shapes that carry the cuts. |

## Writing a preset

Keep it to one screen of rules an agent can check against a frame. Use this shape (the studio reads `name` and `description` from the front matter):

```
---
name: Short name
description: One sentence: the look, and what it's for.
---
# Name
What it is, and when to use it or not (2–3 sentences).
## Look at        2–3 real references, each with the one thing to take from it
## Tokens         a CSS :root block, a lib.js block (easing, durations, grid), and the `font` command
## Layout · ## Type · ## Motion · ## Devices
## Never          the style's own don'ts
```

Numbers beat adjectives. Name fonts that are on Google Fonts, so `npm run font` can bundle them. Every value in the tokens should be used by at least one rule.
