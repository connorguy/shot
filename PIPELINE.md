# Brief → design → tinker → ship

```
 brief.md  ──►  design session (Claude + film-design skill)  ──►  project folder  ──►  Shot / agents  ──►  MP4
 words          picture as code: one JS file per scene            film.html + film/     timing, VO, music         exports/
```

## 1. Brief

Write `brief.md` from `templates/project/brief.md`: goal, audience, length, beats with draft VO, exact figures, brand, voice and music mood. A few sentences per heading is enough; beats and draft VO matter most.

## 2. Design in Claude

In a Claude design session (claude.ai or Cowork), add the **film-design** skill (`npm run pack-skill`, then upload `dist/film-design-skill.zip`) and attach the brief and brand assets. Ask it to design the film. The skill has Claude:

- write one `film/scenes/<id>.js` per beat, following the film-kit contract (every frame a pure function of time)
- tag scenes with `section`, `beats`, and a draft `vo` line
- write a default cut in `film/edit.js`
- check its own frames and hand back a zipped project folder (or one `film.html` when it can only make one file)

Iterate on the look here. Design sessions are best at composition, motion vocabulary and copy.

## 3. New project

In the studio, pick **File → New project…**, name it, pick where it lives on disk, and choose **A design from Claude** (the zip, a `film.html`, or a folder). Or skip the design and start from a template, in landscape (1920×1080), portrait (1080×1920) or square (1080×1080). From a terminal:

```sh
npm run new -- launch-v2 --dir ~/Movies --from ~/Downloads/launch-v2.zip
```

Every project gets `AGENTS.md` and `CLAUDE.md`, so any agent opening the folder knows the layout, the contract, and how to run the tools from there (`npm --prefix <shot> run inspect -- .`).

To recreate an existing video instead, choose **Clone a video** (or `npm run new -- launch-v2 --dir ~/Movies --video ~/Movies/launch.mp4`). Shot detects the cuts, samples frames from every shot, puts the soundtrack on the Music track, and makes one placeholder scene per shot at the original timing. A shot scene's clock is the source video's time, so `npm run compare` can render any shot next to the original and score it while an agent rebuilds the shots as code. The project's `AGENTS.md` gets the full loop.

## 4. Tinker

In the studio (`npm run dev`):

- Retime, split, hold, reorder and crossfade scenes. Nothing is baked, so every change previews instantly from the scene code.
- Voiceover: edit the lines, draft with the free macOS voice, then generate Gemini 3.8 TTS takes. "Stretch picture to fit VO" slows each span just enough for its line.
- Music: generate a Lyria track timed to your sections, or drop in your own. It ducks under the voiceover.

With agents (Claude Code in this repo, or any agent pointed at the project folder), the same edits work from the CLI and plain files: scene files for the picture, `timeline.json` for the edit, `npm run inspect` / `frame` / `vo` / `music` / `render` for the rest. The studio picks up disk changes live.

To send the film back to a design session, run `npm run bundle -- <project>`: one HTML file that plays the current cut.

## 5. Ship

`npm run render -- <project>` (or Export in the studio) renders every frame in headless Chrome and encodes H.264 with the mixed audio into `projects/<name>/exports/`.
