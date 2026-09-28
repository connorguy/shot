---
name: Terminal
description: The command line, set like a well-made CLI demo. One rounded window on near-black, a strict character grid, human typing rhythm, output that assembles into panels, a single pink-violet accent pair. For developer tools, CLIs and APIs.
---
# Terminal

The terminal as a designed object, not a screen recording. Every element snaps to the character grid, typing has a human rhythm, and output builds into clean bordered panels. One accent pair carries the brand. Use it for CLIs, SDKs, APIs and dev infrastructure. Avoid it for audiences who have never opened a terminal.

## Look at
- **Charm (VHS demos, Bubble Tea, Lip Gloss).** Take the rounded window with generous padding, the rounded-border panels, and a pink and violet accent pair on near-black.
- **Vercel CLI and Geist.** Pure black, one grey ramp, and exactly one bright moment per shot.
- **Rich (Python) progress bars and tables, and the Ghostty ASCII ghost.** Pictures made of characters, animated cell by cell. Bars built from heavy horizontals with a travelling pulse.

## Tokens
```css
:root { --bg: #111014; --win: #1a1920; --fg: #e6e4ec; --dim: #858392; --line: #3a3943; --a: #ff60ff; --b: #6b50ff; --ok: #12c78f; --err: #ff577d; }
.fk-stage { font-family: "Inter Tight", sans-serif; background: var(--bg); color: var(--fg); }
.term { font-family: "JetBrains Mono", monospace; font-size: 36px; line-height: 1.4; white-space: pre; font-variant-ligatures: none; }
.window { background: var(--win); border: 2px solid var(--line); border-radius: 16px; }
```
```js
const CELL = { w: 21.6, h: 50.4 };   // 36 px JetBrains Mono: advance 0.6em, line-height 1.4 (measure with mw('0') and trust that)
const EASE = { in: bez(0.22, 1, 0.36, 1), move: bez(0.65, 0, 0.35, 1) };
/** Seconds at which each character of `cmd` appears, starting at t0: 45–70 ms a key, longer after spaces and before flags. */
const typing = (cmd, t0, seed = 1) => { const r = rng(seed); let t = t0; return [...cmd].map((c, i) => (t += (0.045 + r() * 0.025) + (cmd[i - 1] === ' ' ? 0.12 + r() * 0.1 : 0) + (c === '-' ? 0.08 : 0))); };
const blink = (t, idle) => (t - idle < 0.5 || Math.floor((t - idle) / 0.53) % 2 === 0) ? 1 : 0; // solid while typing, then 530 ms blink
```
Fonts: `font -- . "JetBrains Mono:wght@400;700" "Inter Tight:wght@500;600" --text auto`. The `--text` flag bundles `❯`, box drawing (`╭─╮`) and blocks (`█▒`) from JetBrains Mono. No Google mono has braille, so draw spinners in SVG.

## Layout
- One window, about 1560 × 880, centered or offset left, on a flat backdrop one step off the window color. No wallpaper and no gradient.
- Position everything on the cell grid (`CELL`). Camera moves snap to whole cells.
- Captions outside the window use Inter Tight 500–600 at 32–40 px. Use one caption per shot.
- Keep window chrome minimal: a title in `--dim`, and no traffic lights unless the brief is Mac-specific.

## Type
- **Body:** `.term` at 32–40 px, 70–90 columns. A hero command may go to 64–96 px.
- **Prompt:** `❯` in `--b`, commands in `--fg`, flags in `--a`, output in `--dim` except results.
- Use one theme for the whole film.

## Motion
- **Typing:** follow `typing()`. Hold 0.35–0.6 s before Enter, and never fake typos.
- **Output:** streams at 20–40 ms per line. Long logs scroll at a constant rate (the linear move). A result line lands last and stays.
- **Cursor:** solid while typing, then `blink()`.
- **Emphasis:** dim every other line to 35% and put a 4 px `--a` bar at the left of the key line. Zoom as a cell-snapped crop over 0.6 s with `EASE.in`, with no blur.
- **Spinners:** an SVG arc turning at a constant rate, or characters changing at 12 fps (`Math.floor(t * 12)`).

## Signature moves
1. **Command becomes UI.** A typed command's output assembles as a panel. Its rounded border draws clockwise (0.3 s), then content fills row by row, 40 ms per row.
2. **ASCII resolve.** A logo made of characters starts as seeded random glyphs (`rng(cellIndex + Math.floor(t * 12))`). Cells lock to their final glyph in a diagonal wave over about 1 s.
3. **Spinner to check.** The spinner resolves into a `--ok` ✓, and the ✓ scales up into the next scene's hero mark as a match cut.

## Devices
- Rounded-border panels, tables with box-drawing rules, and progress bars of `━` with a travelling highlight.
- Key hints in `--dim` (`enter to confirm`).
- One `--a`/`--b` gradient bar at most, as a brand moment.

## Never
Matrix green, CRT scanlines or glow, fake typos, typing sounds, text under 28 px, traffic lights and drop shadows on every shot, output too fast to read, mixed themes, emoji spinners, or blurred zooms.
