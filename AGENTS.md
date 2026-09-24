# Shot: agent notes

Two kinds of work happen here. Find out which one you're doing first.

1. **Working on a film** (scenes, timing, voiceover, music, export): go to `projects/<name>/AGENTS.md`. Each project has one. Edit files there and use the CLI below. Don't change studio code for film work.
2. **Working on the studio itself**: read on.

## Commands (run in this folder)

- `npm run dev`: studio at http://localhost:5178 (Vite and the API in one process).
- `npm run typecheck`: `tsc --noEmit` over `src/`, `server/`, `shared/` and `scripts/`. Run it before handing off.
- `npm run build`: typecheck plus a production bundle of the UI.
- CLI for films: `new`, `inspect`, `frame`, `vo`, `music`, `render`, `bundle`, `pack-skill` (see README).

## Code map

| Area | Files |
|---|---|
| Timeline model: types, clip math (`layersAt`, `resolveAudio`, `duckEnvelope`), seeding from a film manifest | `shared/timeline.ts` |
| Warnings shown by `inspect` and the studio | `shared/lint.ts` |
| Film API shim for older films (`__renderAt`/`__DUR`) | `shared/filmShim.ts` |
| Film runtime and contract | `film-kit/film-kit.js`, `film-kit/README.md` |
| HTTP API (Vite middleware), static `/files/<project>/…` | `server/api.ts` |
| Projects: registry (`~/.shot/projects.json`, projects anywhere on disk), scaffolding from `templates/project` (fills `{{TITLE}}`, `{{NAME}}`, `{{STUDIO}}`), timeline read/write with history, versions | `server/projects.ts` |
| Gemini: API key or ADC (Developer API, then Agent Platform fallback); TTS, voice design, Lyria | `server/gemini.ts`, `server/media.ts` |
| ElevenLabs (optional, `ELEVENLABS_API_KEY`): TTS with speed-based pacing, voice list | `server/elevenlabs.ts`, `server/media.ts` |
| Film templates: list, save (strips audio), cover render, apply to a new project | `server/templates.ts`, `templates/films/` |
| Headless Chrome (thumbnails, frames), MP4 export jobs | `server/chrome.ts`, `server/export.ts` |
| UI state (external store, snapshot undo, autosave) | `src/lib/store.ts` |
| Timeline edits (split, hold, anchors, takes, fit-to-VO) | `src/lib/actions.ts` |
| Audio: one `schedule()` for live preview and offline export mix | `src/audio/engine.ts` |
| Preview iframe, timeline, panels | `src/components/*` |
| Headless hooks for `npm run render` | `src/lib/headless.ts` |

## Invariants

- The preview and the export must draw the same pixels. Both go through `layersAt()` and `__film.renderFrame()`. Don't add a second path.
- The preview audio and the export audio must match. Both use `schedule()` in `src/audio/engine.ts`.
- Audio clips pinned to picture clips (`anchor`) must survive split, delete and reorder. See `splitAt`, `deleteSelection` and `detachOrphans` in `actions.ts`.
- `timeline.json` is shared with agents. Keep the schema backward compatible and extend `normalizeTimeline` when adding fields.
- Gemini and ElevenLabs keys and ADC tokens stay server-side. The UI only learns the auth mode (`/api/status`).
- CLI scripts accept a project id or a folder path, resolved against `INIT_CWD` so `npm --prefix <studio> run x -- .` works from inside a project.
- Node runs the CLI with type stripping only: no enums, namespaces or parameter properties (`erasableSyntaxOnly` enforces this).
- Templates never carry audio, takes or designed voice ids (`templateTimeline()` in `shared/timeline.ts`). Projects made from one get `seedVo` so draft VO slots come back from the scenes.
- `film-kit.js` is copied into every project. Keep changes backward compatible and update `templates/project` and `skills/film-design` along with it.
