# shot

**The video editor where the video is code.**

Every scene is a JavaScript file. Every frame is a function of time. Shot gives you a timeline to retime, reorder and split those scenes, adds Gemini voiceover and Lyria music, and exports an MP4. Nothing is baked until export, so you (or your agent) can change one line of one scene and the preview updates right away.

No frames were harmed in the making of this editor. None were baked, either.

Site: [connorguy.github.io/shot](https://connorguy.github.io/shot) (source in [`docs/`](docs/)).

## Roll camera

```sh
git clone https://github.com/connorguy/shot.git
cd shot && npm install
npm run dev        # → http://localhost:5178
```

Then press **New**. That's most of the manual.

You'll need Node 22.18+, Google Chrome and ffmpeg (`brew install ffmpeg`). `npm link` gives you a `shot` command if you like typing less.

### Voice and music (optional)

Timing work is free: drafts use the macOS `say` voice. For the real voices and music, give Shot one of these:

- **An API key.** Run `cp .env.example .env` and set `GEMINI_API_KEY`.
- **Google ADC**, for orgs that don't allow keys. Run `gcloud auth application-default login`. If the Gemini Developer API says no, Shot falls back to Agent Platform on its own. Settings are in [`.env.example`](.env.example).

Prefer ElevenLabs? Set `ELEVENLABS_API_KEY` in `.env` too, then pick it under **Voiceover → Engine**. You get Eleven v3 with audio tags like `[whispers]`, and your own cloned voices. Music still comes from Lyria.

Keys and tokens stay on your machine, in the local server.

## How a film happens

1. **Brief.** Write down the goal, the beats and a rough voiceover in `brief.md`.
2. **Design.** Have Claude build the scenes with the [film-design skill](skills/film-design/). You get one file per scene.
3. **Tinker.** Open it in Shot. Drag edges to retime, reorder scenes, generate voiceover paced to each clip, and score it.
4. **Ship.** Export an MP4, or bundle the film as a single HTML file.

More on the pipeline in [PIPELINE.md](PIPELINE.md). The scene contract is in [film-kit/README.md](film-kit/README.md).

## Things worth knowing

- **Agents are first-class.** Every project gets an `AGENTS.md` explaining how it works. Press **P** on any clip, line or frame to copy a prompt that already knows the file, the timing and the frame. The studio reloads when files change on disk.
- **Voiceover lands on the frame.** Drag a line to the length you want. Gemini or ElevenLabs paces the read toward that length, and a pitch-safe stretch fixes whatever's left. Every take is kept.
- **Music ducks by itself** under every line.
- **Templates** keep a film's look and cut but none of its audio. Use **Save as template** in the inspector, and pick one from **New**.
- **Preview is the export.** The same frames and the same audio mix, just smaller.
- **Undo is deep.** Use ⌘Z. The last 40 saves are kept in `.history/`.
- **Films are code.** A design runs in your browser, next to the studio, so only open designs you trust.

Keys: `T` trim · `S` split · `H` hold · `P` prompt · `⌥` no snapping · `⇧` swap retime/trim.

## CLI

Anything the studio does, the CLI does too. `<p>` is a project folder.

```sh
npm run new -- <name> [--dir <parent>] [--from design.zip] [--template <id>]
npm run open -- <folder>              # open a project that lives anywhere
npm run inspect -- <p>                # cut, scenes, audio, warnings
npm run frame -- <p> 12.5             # PNG of one moment (--sheet for all of them)
npm run vo -- <p> [--draft] [--all]   # voice the lines (--engine elevenlabs to switch)
npm run music -- <p> "mood"
npm run render -- <p> [--draft]       # → exports/*.mp4
npm run bundle -- <p>                 # → one self-contained HTML file
npm run template -- list | save <p> --name "…"
```

## What's where

| Path | What |
|---|---|
| `src/` | the studio (React) |
| `server/` | local API: projects, Gemini, headless Chrome, export |
| `shared/` | timeline model, shared by the UI, the server and the CLI |
| `film-kit/` | the runtime every film loads |
| `templates/` | what new projects start from |
| `skills/film-design/` | the skill for Claude design sessions |
| `scripts/` | CLI |

## License

[Business Source License 1.1](LICENSE). Use Shot for anything, including commercial videos, except running it as a hosted video-editing service. Each version becomes Apache 2.0 on 2030-09-23.
