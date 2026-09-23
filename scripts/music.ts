// npm run music -- <project> "mood and arrangement" [--model lyria-3.5|lyria-3-clip-preview] [--no-structure] [--dry]
// Generate a Lyria track timed to the current cut's sections and put it on the Music track at 0:00.
// --dry prints the prompt without calling the API.
import { musicPrompt, structureFor, totalDuration, uid, type AudioClip } from "../shared/timeline.ts";
import { authStatus } from "../server/gemini.ts";
import { makeMusic } from "../server/media.ts";
import { readTimeline, writeTimeline } from "../server/projects.ts";
import { ctx, die, done, manifestOf, parseArgs, requireProject, timelineOf } from "./_lib.ts";

const args = parseArgs();
const project = requireProject(args._[0], 'npm run music -- <project> "mood" [--model lyria-3.5] [--no-structure] [--dry]');
const mood = args._[1] || "Minimal, confident modern electronic score. Builds through the middle, resolves cleanly on the logo. No vocals.";
const model = String(args.flags.model || "lyria-3.5");
const manifest = await manifestOf(project);
const tl = await timelineOf(project, manifest);
const total = totalDuration(tl);
const useStructure = !args.flags["no-structure"] && model !== "lyria-3-clip-preview";
const prompt = musicPrompt(mood, total, useStructure ? structureFor(tl, manifest) : null);

console.log(`PROMPT (${model})\n${prompt}\n`);
if (args.flags.dry) await done();
if ((await authStatus()).mode === "none") die("No Gemini credentials: add GEMINI_API_KEY to shot/.env or run `gcloud auth application-default login`.");

console.log("Composing… (can take a minute)");
const r = await makeMusic(ctx, project, prompt, model);
const fresh = (await readTimeline(ctx, project)) || tl;
const track = fresh.tracks.find((t) => t.kind === "music") || die("Timeline has no music track.");
const clip: AudioClip = {
  id: uid("music_"), label: "Lyria", asset: r.asset, assetDuration: r.duration, start: 0, anchor: null,
  in: 0, duration: r.duration && r.duration > total ? total : null, gain: 0, fadeIn: 0.3, fadeOut: 1.5,
};
track.clips.push(clip);
await writeTimeline(ctx, project, fresh);
console.log(`${r.asset} (${r.duration?.toFixed(1)}s) added to ${track.name} as ${clip.id}.${track.clips.length > 1 ? ` The track now has ${track.clips.length} clips; mute or delete the old ones.` : ""}`);
await done();
