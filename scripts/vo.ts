// npm run vo -- <project> [--draft] [--all] [--line <clip id>] [--voice Kore] [--style "calm"]
// Generate voiceover takes and select them. Default: every line that has no audio yet.
// Gemini 3.8 TTS by default (GEMINI_API_KEY in shot/.env, or ADC from `gcloud auth application-default login`);
// --draft uses macOS `say` (free, instant).
import { applyTake, voiceOf, type AudioClip, type Provider } from "../shared/timeline.ts";
import { authStatus } from "../server/gemini.ts";
import { makeTake } from "../server/media.ts";
import { readTimeline, writeTimeline } from "../server/projects.ts";
import { ctx, die, done, parseArgs, requireProject, timelineOf } from "./_lib.ts";

const args = parseArgs();
const project = requireProject(args._[0], "npm run vo -- <project> [--draft] [--all] [--line <id>]");
const tl = await timelineOf(project);
const provider: Provider = args.flags.draft ? "say" : "gemini";
if (provider === "gemini") {
  const auth = await authStatus();
  if (auth.mode === "none") die(`No Gemini credentials: add GEMINI_API_KEY to shot/.env or run \`gcloud auth application-default login\`. Or use --draft for a free placeholder voice.${auth.error ? `\nADC: ${auth.error}` : ""}`);
  console.log(auth.mode === "key" ? "Gemini via API key" : `Gemini via ADC (project ${auth.project ?? "?"}, backend ${auth.backend})`);
}

const lines = tl.tracks.filter((t) => t.kind === "vo").flatMap((t) => t.clips).filter((c) => c.vo && c.vo.text.trim());
const pick = (c: AudioClip) =>
  args.flags.line ? c.id === args.flags.line : args.flags.all ? true : !c.asset;
const todo = lines.filter(pick);
if (!todo.length) { console.log(args.flags.line ? `No VO line "${args.flags.line}".` : "Every line already has a take (use --all to regenerate)."); await done(); }

console.log(`${todo.length} line(s) · ${provider === "say" ? "macOS say (draft)" : tl.voice.model}`);
const results = new Map<string, Awaited<ReturnType<typeof makeTake>>>();
let failed = 0;
for (let i = 0; i < todo.length; i += 3) {
  await Promise.all(todo.slice(i, i + 3).map(async (c) => {
    const v = voiceOf(tl, c);
    try {
      const take = await makeTake(ctx, project, {
        clipId: c.id, text: c.vo!.text, provider, model: tl.voice.model, target: c.vo!.target ?? null,
        voice: String(args.flags.voice || v.voice), style: String(args.flags.style ?? v.style ?? ""),
      });
      results.set(c.id, take);
      console.log(`  ✓ ${c.id}  ${take.duration.toFixed(2)}s${take.target ? ` (target ${take.target.toFixed(2)}s)` : ""}  “${c.vo!.text}”`);
    } catch (e: any) {
      failed++;
      console.log(`  ✗ ${c.id}  ${e.message}`);
    }
  }));
}

// re-read before writing, so edits made meanwhile (studio autosave) are kept
const fresh = (await readTimeline(ctx, project)) || tl;
for (const t of fresh.tracks) for (const c of t.clips) {
  const take = results.get(c.id);
  if (!take || !c.vo) continue;
  c.vo.takes.push(take);
  applyTake(c, c.vo.takes.length - 1, fresh);
}
await writeTimeline(ctx, project, fresh);
console.log(`Saved timeline.json (${results.size} new take${results.size === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}). Check timing: npm run inspect -- ${project}`);
await done(failed ? 1 : 0);
