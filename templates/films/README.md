# Film templates

Each folder here is a film template: a look and a structure that new projects can start from. The **New** dialog in the studio lists them, and so does `npm run template -- list`.

```
<id>/
  template.json   { "name", "description", "tags", "scenes", "duration", "from", "createdAt" }
  preview.jpg     cover shown in the New dialog (960×540)
  film.html       shell that loads film/film-kit.js, film/lib.js, film/scenes/*.js, film/edit.js
  film/           lib.js, styles.css, scenes/*.js, edit.js, assets/  (film-kit.js is added to each new project)
  timeline.json   optional: the cut (clip order and timing) and voice settings, with no audio clips
```

What a template never contains: music, voiceover takes or any audio, designed voice ids, exports, `.history`. A project made from a template gets `AGENTS.md`, `CLAUDE.md`, `brief.md` and `.gitignore` from `../project`. If the template has `timeline.json`, the scenes' draft `vo` lines come back as empty voiceover slots on first open (`"seedVo": true`).

`{{TITLE}}` and `{{NAME}}` in `film.html`, `film/lib.js`, `film/edit.js` and scene files are replaced with the new project's title and folder name.

Make one:
- In the studio: open a project, then **Save as template…** in the inspector (nothing selected). The frame under the playhead becomes the cover.
- From a terminal: `npm run template -- save <project folder> --name "Bold launch" --description "…" [--at 12.5] [--no-cut]`.
- By hand: copy a project's `film.html` and `film/` into a new folder here and add `template.json`, then run `npm run template -- preview <id>` to render the cover.

Remove one by deleting its folder.
