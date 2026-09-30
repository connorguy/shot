// npm run sfx -- <project> "prompt" [--at 3.2 | --clip <picture clip id> [--offset 0.2]] [--duration 0.8] [--influence 0.5] [--loop] [--gain -6]
// npm run sfx -- <project> --cues [--all]
// Generate ElevenLabs sound effects (ELEVENLABS_API_KEY in shot/.env) and place them on the SFX track.
// With a prompt: one effect, at timeline time --at (default 0), or pinned --offset seconds into picture clip --clip.
// With --cues: every `sfx` cue the scenes declare (film.scene({ sfx: [{ t, prompt, duration, gain }] })), pinned to
// the picture clip that plays that scene moment. Cues that already have a clip are not regenerated (unless --all):
// they are re-pinned to where their cue lands now, so retiming a scene's clock keeps them in sync.
import { clipStarts, sfxCues, uid, type AudioClip, type Timeline } from "../shared/timeline.ts";
import { elevenAvailable } from "../server/elevenlabs.ts";
import { makeSfx } from "../server/media.ts";
import { readTimeline, writeTimeline } from "../server/projects.ts";
import { ctx, die, done, manifestOf, parseArgs, requireProject, timelineOf } from "./_lib.ts";

const usage = 'npm run sfx -- <project> "prompt" [--at 3.2 | --clip <id> --offset 0.2] [--duration 0.8] [--influence 0.5] [--gain -6] [--loop]  |  --cues [--all]';
const args = parseArgs();
const project = requireProject(args._[0], usage);
const num = (k: string) => (args.flags[k] === undefined || args.flags[k] === true ? undefined : Number(args.flags[k]));
if (!elevenAvailable()) die("No ElevenLabs key: add ELEVENLABS_API_KEY to shot/.env (or run through your secrets wrapper).");

const manifest = await manifestOf(project);
const tl = await timelineOf(project, manifest);

const repin = new Map<string, { clip: string; offset: number }>(); // cue key → where it lands now
interface Job { key: string; prompt: string; duration?: number; influence?: number; gain: number; loop: boolean; anchor: { clip: string; offset: number } | null; start: number; label: string }
const jobs: Job[] = [];

if (args.flags.cues) {
  const have = new Set(tl.tracks.filter((t) => t.kind === "sfx").flatMap((t) => t.clips).map((c) => c.sfx?.cue).filter(Boolean));
  for (const c of sfxCues(tl, manifest)) if (have.has(c.key) && !args.flags.all && c.anchor) repin.set(c.key, c.anchor);
  const cues = sfxCues(tl, manifest);
  if (!cues.length) die("No scene declares `sfx` cues. Add them to film.scene({ …, sfx: [{ t, prompt }] }) or pass a prompt.");
  for (const c of cues) {
    if (!c.anchor) { console.log(`  - ${c.key}  skipped: scene time ${c.cue.t} is not in the cut`); continue; }
    if (have.has(c.key) && !args.flags.all) { console.log(`  = ${c.key}  already on the SFX track (re-pinned)`); continue; }
    jobs.push({ key: c.key, prompt: c.cue.prompt, duration: c.cue.duration, influence: c.cue.influence, gain: c.cue.gain ?? 0, loop: false, anchor: c.anchor, start: 0, label: c.cue.prompt });
  }
} else {
  const prompt = String(args._[1] || "").trim() || die(`usage: ${usage}`);
  const clip = typeof args.flags.clip === "string" ? args.flags.clip : null;
  if (clip && !tl.clips.some((c) => c.id === clip)) die(`No picture clip "${clip}". Clip ids are listed by inspect.`);
  jobs.push({
    key: "", prompt, duration: num("duration"), influence: num("influence"), gain: num("gain") ?? 0, loop: !!args.flags.loop,
    anchor: clip ? { clip, offset: num("offset") ?? 0 } : null, start: num("at") ?? 0, label: prompt,
  });
}
if (!jobs.length && !repin.size) { console.log("Nothing to generate."); await done(); }

console.log(`${jobs.length} sound effect(s) · ElevenLabs`);
const made: { job: Job; asset: string; duration: number | null; sfx: NonNullable<AudioClip["sfx"]> }[] = [];
let failed = 0;
for (let i = 0; i < jobs.length; i += 3) {
  await Promise.all(jobs.slice(i, i + 3).map(async (job) => {
    try {
      const r = await makeSfx(ctx, project, { prompt: job.prompt, duration: job.duration, influence: job.influence, loop: job.loop, cue: job.key || undefined });
      made.push({ job, ...r });
      console.log(`  ✓ ${job.key || "sfx"}  ${r.duration?.toFixed(2)}s  “${job.prompt}”  → ${r.asset}`);
    } catch (e: any) {
      failed++;
      console.log(`  ✗ ${job.key || "sfx"}  ${e.message}`);
    }
  }));
}

// re-read before writing, so edits made meanwhile (studio autosave) are kept
const fresh: Timeline = (await readTimeline(ctx, project)) || tl;
const track = fresh.tracks.find((t) => t.kind === "sfx") || die("Timeline has no SFX track.");
const starts = clipStarts(fresh);
for (const c of track.clips) {
  const a = c.sfx?.cue ? repin.get(c.sfx.cue) : undefined;
  if (!a || !fresh.clips.some((p) => p.id === a.clip)) continue;
  c.anchor = a; c.start = starts[fresh.clips.findIndex((p) => p.id === a.clip)] + a.offset;
}
for (const m of made) {
  // a regenerated cue replaces its old clip
  if (m.job.key) track.clips = track.clips.filter((c) => c.sfx?.cue !== m.job.key);
  const anchor = m.job.anchor && fresh.clips.some((c) => c.id === m.job.anchor!.clip) ? m.job.anchor : null;
  const at = anchor ? starts[fresh.clips.findIndex((c) => c.id === anchor.clip)] + anchor.offset : m.job.start;
  track.clips.push({
    id: uid("sfx_"), label: m.job.label.slice(0, 40), asset: m.asset, assetDuration: m.duration, start: at, anchor,
    in: 0, duration: null, gain: m.job.gain, fadeIn: 0, fadeOut: 0, sfx: m.sfx,
  });
}
await writeTimeline(ctx, project, fresh);
console.log(`Saved timeline.json (${made.length} added${repin.size ? `, ${repin.size} re-pinned` : ""}${failed ? `, ${failed} failed` : ""}). Check: npm run inspect -- ${project}`);
await done(failed ? 1 : 0);
