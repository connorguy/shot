# film-kit: the film contract

`film-kit.js` is the only thing a film needs to work in Shot. It is plain JavaScript with no dependencies, and it lives in two places:

- `film/film-kit.js` in each project, loaded with `<script src>`. Copy the file over again when this one changes.
- Inlined in a single-file film, for example a design-chat artifact.

## What a film provides

```js
const film = FilmKit.create({ title: 'Launch', width: 1920, height: 1080, fps: 30, background: '#f7f7f5' });

film.before(async () => { await document.fonts.ready; });   // optional: preloads before scenes build

film.scene({ id: 'title', label: 'Title card', section: 'Open', start: 0, end: 3,
             beats: [{ t: 1.2, label: 'Dot lands' }], vo: 'Draft voiceover.', notes: '' },
  el => {                       // build once, under `el`
    const h = document.createElement('div'); el.appendChild(h);
    return t => {               // draw at scene time t (start..end); pure function of t
      h.style.opacity = Math.min(1, t / 0.5);
    };
  });

film.edit([{ scene: 'title', duration: 3.5 }]);   // optional default cut (in/out/duration/speed/xfade)
film.start();                                     // last
```

## What film-kit provides

- **Stage and player.** A native-size stage scaled to fit the window, with play, restart and scrub that play the default cut.
- **`?render`.** A bare, unscaled frame with no controls, used for thumbnails, frame stills and MP4 export.
- **`window.__film`.** Used by the studio and the CLI:
  - `manifest()` returns `{ width, height, fps, scenes: [{ id, label, section, start, end, beats, vo, notes, error }], edit }`.
  - `renderFrame([{ scene, t, opacity }])` draws those scene layers. Crossfades pass two layers.
  - `renderAt(videoTime)` plays back the default cut.
- **Error isolation.** If a scene's build or draw throws, film-kit shows the error on that scene and reports it in `manifest().scenes[i].error`.

## Rules

1. **Every frame is a pure function of time.** Export renders frames in parallel and out of order. Don't use `Date.now`, `performance.now`, unseeded `Math.random`, CSS animations or transitions, timers, or state carried between draws.
2. **Set every animated property on every draw**, including before an element's entrance and after its exit.
3. **Each scene has its own clock** (`start`–`end`). The studio retimes, splits, holds and reorders scenes by choosing which scene time to draw, so a scene must not assume it starts at 0 or plays at 1× speed.
4. **Scenes are independent.** No scene may depend on another having drawn. Anything shared goes in `lib.js` or the builder.
5. **Load order.** Script tags go in `<body>`: film-kit, then lib, then scene files, then `edit.js` (which calls `film.start()`). Builders run inside `start()`, after `film.before(...)` promises resolve.
