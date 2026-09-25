# {{TITLE}}: film project

This folder is one video, as code. The picture is an HTML film: every frame is a pure function of time and is drawn live by the scene files. No video clips are baked. `timeline.json` says which scene ranges play, in what order, for how long, with which voiceover and music. Shot previews it live and renders the MP4 frame by frame on export.

Tooling lives in Shot at `{{STUDIO}}`. Run its commands from **this folder** like this (`.` means this project):

```sh
npm --prefix "{{STUDIO}}" run inspect -- .
```

If that path no longer exists, Shot has moved: ask where it is now (it's the folder with `film-kit/` and a `package.json` named `shot`).

## Layout

| Path | What it is | Who edits it |
|---|---|---|
| `brief.md` | What the film must say, to whom, how long, tone. Read it first. | human, agents |
| `film.html` | Shell: loads `film/film-kit.js`, `film/lib.js`, each scene file, then `film/edit.js`. Script order = scene bin order. | agents, when adding or removing scenes |
| `film/scenes/<id>.js` | One scene each: `film.scene({meta}, el => t => draw)`. | agents, freely |
| `film/lib.js` | Shared helpers (easing, `P`, `mk`, `setv`, `mw`, `env`, `rng`) and preloads. Globals for scenes. | agents, carefully (every scene uses it) |
| `film/styles.css` | Brand tokens and scene classes. | agents |
| `film/edit.js` | Default cut, used only to seed a brand-new timeline. Calls `film.start()`; keep it last. | rarely |
| `film/film-kit.js` | Vendored runtime (contract with the studio). | never; update by copying `{{STUDIO}}/film-kit/film-kit.js` |
| `film/assets/` | Images and fonts, referenced by relative path (`film/assets/x.png`). | agents |
| `timeline.json` | The edit: picture clips, audio tracks, VO lines and takes, voice settings. | studio, agents |
| `audio/vo`, `audio/music`, `audio/sfx` | Generated takes, Lyria tracks, uploads. | tools |
| `exports/` | Rendered MP4s (+ the mixed WAV). Git-ignored. | tools |
| `.history/` | Last 40 saves of `timeline.json`. Git-ignored. | tools |
| `.frames/` | Stills from `frame` and `compare`. Git-ignored. | tools |
| `reference/` | Only in projects cloned from a video: the video, its shots and their frames. See "Rebuilding the reference video" if this file has it. | tools |

## The scene contract

```js
film.scene({
  id: 'chart',                 // stable id; timeline.json clips point at it
  label: 'Growth chart',       // shown in the studio
  section: 'Problem',          // groups scenes; Lyria music prompts use sections
  start: 16.4, end: 18.1,      // the scene's own clock, in seconds
  beats: [{ t: 17.0, label: 'Line peaks' }], // optional split points shown on clips
  vo: 'Suggested voiceover.',  // optional; seeds a VO line on first open
  notes: 'Direction for humans and agents.',
}, el => {
  // build once: create DOM under `el`, measure text, precompute
  return t => { /* draw for scene time t, start <= t <= end */ };
});
```

Rules, all enforced by the fact that export renders frames out of order in parallel:

1. `draw(t)` must depend only on `t`. No `Date.now()`, `performance.now()`, `Math.random()` (use `rng(seed)`), CSS animations or transitions, timers, or state carried between calls.
2. Set every animated property on every call (opacity, transform, text), including before an element's entrance and after its exit.
3. Scene time is the scene's own clock. The studio maps timeline time into `[start, end]` (retiming, holds, splits), so never assume a scene starts at 0 or plays at 1× speed.
4. Build-time work (measuring text, layout) goes in the builder. Fonts and images listed in `film.before(...)` in `lib.js` are loaded by then.
5. If a builder or draw throws, the studio shows the error on that scene and the rest keep working. `inspect` lists broken scenes.

Adding a scene: create `film/scenes/<id>.js`, add its `<script>` tag to `film.html` before `edit.js`, then add a clip for it to `timeline.json` (or drag it in from the studio's Scenes panel).

## timeline.json

```jsonc
{
  "fps": 30, "width": 1920, "height": 1080,
  "clips": [                                  // picture track, plays back to back in order
    { "id": "c_x1", "scene": "chart", "in": 16.4, "out": 18.12, "duration": 3.1, "xfade": 0 }
    // speed = (out - in) / duration. in == out is a freeze frame (hold) of that duration.
  ],
  "tracks": [
    { "id": "vo", "kind": "vo", "gain": 0, "mute": false, "solo": false, "duck": null, "clips": [
      { "id": "vo_a1",
        "anchor": { "clip": "c_x1", "offset": 0.2 },   // pinned 0.2 s into picture clip c_x1; moves with it
        "start": 0,                                     // used only when anchor is null
        "asset": "audio/vo/vo-a1-k2.wav", "assetDuration": 2.41, "in": 0, "duration": null,
        "rate": 1.08,                                   // playback speed, pitch kept (omitted = 1)
        "gain": 0, "fadeIn": 0, "fadeOut": 0,
        "vo": { "text": "Every week, it adds up.", "voice": null, "style": null,
                "target": 2.23,                         // seconds the line should take (optional)
                "takes": [ ... ], "take": 1 } }
    ]},
    { "id": "music", "kind": "music", "gain": -6, "duck": { "enabled": true, "amount": -12, "attack": 0.25, "release": 0.6 }, "clips": [ ... ] },
    { "id": "sfx", "kind": "sfx", "clips": [ ... ] }
  ],
  "voice": { "provider": "gemini", "model": "gemini-3.8-flash-tts", "voice": "Kore", "style": "",
             "eleven": { "model": "eleven_v3", "voice": "JBFqnCBsd6RMkjVDRZzb", "name": "George" } }
}
```

- Retime a beat: change a clip's `duration`. Trim it: change `in`/`out` (keep `duration` in step to keep speed). Reorder: reorder `clips`. Keep `id`s stable, since audio anchors point at them.
- Rewrite a VO line: edit `vo.text`, then generate a take (below). A take whose text differs from the line is shown as stale.
- Voice engine: `voice.provider` is `gemini`, `elevenlabs` or `say` (free draft). `model`/`voice` are Gemini's; `voice.eleven` holds the ElevenLabs model (`eleven_v3`, `eleven_multilingual_v2`, `eleven_flash_v2_5`) and voice id (20 letters and digits). A line's own `vo.voice` only counts when it belongs to the engine in use. On Eleven v3 the style becomes a leading audio tag (`[calm]`), and tags like `[whispers]` work inline in `vo.text`.
- Make a line fit a slot: set `vo.target` (seconds). Generation paces the read toward it (Gemini through the delivery style with one retry, ElevenLabs through its 0.7–1.2× speed setting with one correction). Selecting a take then sets `rate` so it lands exactly, unless `voice.snapToTarget` is `false`. `rate` alone speeds a clip up or slows it down with pitch kept; `in`/`duration` are measured after that speed change.
- `null` voice/style on a line means the project default in `voice`.
- The studio reloads `timeline.json` when it changes on disk, as long as it has no unsaved edits of its own.

## Commands

Each is `npm --prefix "{{STUDIO}}" run <command> -- . [options]` from this folder.

| Command | What it does |
|---|---|
| `dev` | The studio UI at http://localhost:5178 (live preview, drag editing, VO, music, export). This project is in its project menu. No `-- .` needed. |
| `inspect -- .` | Scenes, clips with start/end/speed, VO lines and takes, plus warnings (missing or broken scenes, overlapping or overrunning VO). `--json` for machine output. |
| `frame -- . 12.5` | PNG of timeline time 12.5 s, saved in `.frames/`. `--scene chart --at 17.2` renders one scene at its own time. `--sheet` renders a contact sheet, one frame per clip. Prints the file path, so look at it. |
| `vo -- .` | Generate takes for VO lines without audio, with the project's engine (Gemini or ElevenLabs; `--engine` overrides, `--draft` uses free macOS `say`). `--all` regenerates every line; `--line vo_a1` one line. |
| `music -- . "prompt"` | Lyria track timed to the current cut's sections, placed on the Music track. `--dry` prints the prompt only. |
| `render -- .` | Full MP4 with the audio mix into `exports/`. `--draft` for 540p. |
| `bundle -- .` | One self-contained HTML of the current cut (scripts, styles, fonts, images inlined) for sharing or a design chat. |
| `compare -- . 12.5` | Projects cloned from a video only: the frame next to the reference video at the same moment, with a similarity score (SSIM). `--shot shot-03` across one shot, `--sheet` every shot. |

## Templates

To reuse this film's look in new projects, save it as a template: **Save as template…** in the studio inspector, or `npm --prefix "{{STUDIO}}" run template -- save . --name "…"`. Templates keep the scenes, styles, assets and cut, but no audio.

## Working loop for agents

1. `inspect -- .` to see the cut and any warnings.
2. Edit a scene file or `timeline.json`.
3. `frame -- . <t>` (or `--sheet`) and look at the PNG to check the change.
4. Repeat. Render a `--draft` MP4 when timing matters, since stills do not show motion.
