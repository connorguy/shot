// npm run music -- <project> "mood and arrangement" [--engine lyria|elevenlabs] [--model lyria-3.5|lyria-3-clip-preview] [--no-structure] [--dry]
// Generate a track timed to the current cut's sections and put it on the Music track at 0:00.
// Lyria (default) gets a text prompt with a timed section map. ElevenLabs (ELEVENLABS_API_KEY) gets a sectioned
// composition plan, one section per cut section, with the section lengths held. --dry prints the prompt or plan.
import { elevenMusicPlan, musicPrompt, musicSections, structureFor, totalDuration, uid, type AudioClip } from "../shared/timeline.ts";
import { elevenAvailable } from "../server/elevenlabs.ts";
import { authStatus } from "../server/gemini.ts";
import { makeMusic } from "../server/media.ts";
import { readTimeline, writeTimeline } from "../server/projects.ts";
import { ctx, die, done, manifestOf, parseArgs, requireProject, timelineOf } from "./_lib.ts";

const args = parseArgs();
const project = requireProject(args._[0], 'npm run music -- <project> "mood" [--engine lyria|elevenlabs] [--model lyria-3.5] [--no-structure] [--dry]');
const mood = args._[1] || "Minimal, confident modern electronic score. Builds through the middle, resolves cleanly on the logo. No vocals.";
const engine = String(args.flags.engine || "lyria");
if (engine !== "lyria" && engine !== "elevenlabs") die(`--engine is lyria or elevenlabs, not "${engine}".`);
const model = String(args.flags.model || "lyria-3.5");
const manifest = await manifestOf(project);
const tl = await timelineOf(project, manifest);
const total = totalDuration(tl);
const useStructure = !args.flags["no-structure"] && (engine === "elevenlabs" || model !== "lyria-3-clip-preview");

let prompt: string, plan = null as ReturnType<typeof elevenMusicPlan> | null;
if (engine === "elevenlabs") {
  prompt = mood;
  plan = useStructure ? elevenMusicPlan(mood, musicSections(tl, manifest), total) : null;
  console.log(plan ? `COMPOSITION PLAN (ElevenLabs music_v1)\n${JSON.stringify(plan, null, 2)}\n` : `PROMPT (ElevenLabs, ${Math.ceil(total)} s)\n${mood}\n`);
} else {
  prompt = musicPrompt(mood, total, useStructure ? structureFor(tl, manifest) : null);
  console.log(`PROMPT (${model})\n${prompt}\n`);
}
if (args.flags.dry) await done();
if (engine === "elevenlabs" && !elevenAvailable()) die("No ElevenLabs key: add ELEVENLABS_API_KEY to shot/.env.");
if (engine === "lyria" && (await authStatus()).mode === "none") die("No Gemini credentials: add GEMINI_API_KEY to shot/.env or run `gcloud auth application-default login`. Or use --engine elevenlabs.");

console.log("Composing… (can take a minute)");
const r = await makeMusic(ctx, project, { engine: engine as "lyria" | "elevenlabs", prompt, model, plan, seconds: total, name: engine });
const fresh = (await readTimeline(ctx, project)) || tl;
const track = fresh.tracks.find((t) => t.kind === "music") || die("Timeline has no music track.");
const clip: AudioClip = {
  id: uid("music_"), label: engine === "elevenlabs" ? "ElevenLabs" : "Lyria", asset: r.asset, assetDuration: r.duration, start: 0, anchor: null,
  in: 0, duration: r.duration && r.duration > total ? total : null, gain: 0, fadeIn: 0.3, fadeOut: 1.5,
};
track.clips.push(clip);
await writeTimeline(ctx, project, fresh);
console.log(`${r.asset} (${r.duration?.toFixed(1)}s) added to ${track.name} as ${clip.id}.${track.clips.length > 1 ? ` The track now has ${track.clips.length} clips; mute or delete the old ones.` : ""}`);
await done();
