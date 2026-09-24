# Set up Shot (instructions for an agent)

You're Claude Code, Codex or another coding agent, and the user asked you to install Shot. Do the steps below yourself. Stop to ask the user only where a step says to. Commands assume macOS with a POSIX shell.

`$SHOT` means the Shot checkout. Use `~/shot` unless the user named another folder.

## 1. Get the code

- If `$SHOT` exists and its `package.json` has `"name": "shot"`, update it with `git -C $SHOT pull --ff-only`.
- Otherwise, run `git clone https://github.com/connorguy/shot.git $SHOT`.

Run everything below from `$SHOT`.

## 2. Check what's needed

| Need | Check | Install on macOS |
|---|---|---|
| Node 22.18+ | `node -v` | `brew install node` |
| ffmpeg (export) | `ffmpeg -version` | `brew install ffmpeg` |
| Google Chrome (thumbnails, frames, export) | `/Applications/Google Chrome.app` exists | `brew install --cask google-chrome`, or `npx playwright install chromium` |

Ask the user before you install anything system-wide. If Homebrew isn't installed, say so and give them the command from [brew.sh](https://brew.sh) to run themselves. On Linux, Shot works, but the free draft voice and the native file pickers only exist on macOS.

## 3. Install

```sh
npm install
```

Ask whether they want a `shot` command on their PATH. If yes, run `npm link`. After that, `shot` starts the studio and `shot <command>` runs the CLI.

## 4. Voice and music (optional)

Drafts are free: they use the macOS `say` voice. Real voiceover and Lyria music need Gemini. Ask which of these the user wants:

- **Gemini API key.** Run `cp .env.example .env`. Then tell the user to paste their key after `GEMINI_API_KEY=` in `$SHOT/.env`. Don't ask for the key in chat, and don't read it back.
- **Google ADC**, for orgs that don't allow keys. If `gcloud` is installed, have the user run `gcloud auth application-default login` themselves (it opens a browser).
- **ElevenLabs**, as an extra voice engine. It uses the same `.env`: they add `ELEVENLABS_API_KEY=`.
- **Skip it for now.** Everything else works.

## 5. Agent integration

Every project Shot creates has its own `AGENTS.md` (Codex reads it) and `CLAUDE.md` (Claude Code reads it). You don't need to install anything to edit films.

To design new films from a brief, install the **film-design** skill for whichever agent you are. If the user runs both Claude Code and Codex, install it for both.

```sh
npm run pack-skill
# Claude Code
mkdir -p ~/.claude/skills && rm -rf ~/.claude/skills/film-design && cp -R dist/film-design ~/.claude/skills/
# Codex
mkdir -p ~/.codex/skills && rm -rf ~/.codex/skills/film-design && cp -R dist/film-design ~/.codex/skills/
```

## 6. Start the studio

Start `npm run dev` as a background process if your harness supports that. Otherwise, ask the user to run it in a terminal. Wait until `curl -s http://localhost:5178/api/status` answers, then run `open http://localhost:5178`. The status JSON shows which of Gemini, ElevenLabs and ffmpeg are ready.

## 7. First film (optional)

Ask whether they want to start a film now. If they do, pick a name and a parent folder with them (the default is `~/Movies`), then run:

```sh
npm run new -- <name> --dir <parent>
```

That creates `<parent>/<name>/` with `brief.md`, `AGENTS.md`, `CLAUDE.md` and a starter film, and adds it to the studio. Fill in `brief.md` with them. For all further work, follow that folder's `AGENTS.md`.

## 8. Wrap up

Tell the user, briefly:

- where Shot lives, and how to start it again (`shot`, or `npm --prefix $SHOT run dev`)
- which voice setup is active, and where the skill went
- that film work is best done in an agent session started in the project folder
- that pressing **P** on a clip, a VO line or a frame in the studio copies a short prompt with the exact file and timing, ready to paste into that session
