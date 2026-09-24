// "Prompt an agent": turn what the user is looking at plus their ask into a paste-ready prompt with
// exact paths, ids and times, so a coding agent can make the change without rediscovering context.
import {
  clipIndexAt, clipStarts, layersAt, rateOf, resolveAudio, speedOf, totalDuration, voiceOf,
  type FilmManifest, type Timeline,
} from "../../shared/timeline.ts";
import type { PromptTarget } from "./store.ts";

export interface PromptCtx { tl: Timeline; manifest: FilmManifest | null; dir: string; studio: string }

const s2 = (n: number) => `${n.toFixed(2)}s`;
const pct = (r: number) => `${Math.round(r * 100)}%`;

function sceneUses(c: PromptCtx, sceneId: string): string[] {
  const starts = clipStarts(c.tl);
  return c.tl.clips.flatMap((k, i) =>
    k.scene === sceneId
      ? [`clip ${k.id}: timeline ${s2(starts[i])}–${s2(starts[i] + k.duration)}, source ${k.in}–${k.out}, ${speedOf(k) === 0 ? "hold" : `${pct(speedOf(k))} speed`}`]
      : [],
  );
}

function voOver(c: PromptCtx, clipIds: string[]): string[] {
  return resolveAudio(c.tl)
    .filter((r) => r.track.kind === "vo" && r.clip.anchor && clipIds.includes(r.clip.anchor.clip))
    .map((r) => `“${r.clip.vo!.text}” (${r.clip.id}, ${s2(r.start)}–${s2(r.end)})`);
}

/** What the prompt is about, as [headline, context lines, check command]. */
function describe(c: PromptCtx, target: PromptTarget): { what: string; context: string[]; check: string } {
  const frame = (args: string) => `npm --prefix "${c.studio}" run frame -- "${c.dir}" ${args}`;
  const scene = (id: string) => c.manifest?.scenes.find((s) => s.id === id);

  if (target.kind === "scene" || target.kind === "frame") {
    let id: string, at: number | null = null;
    const context: string[] = [];
    if (target.kind === "frame") {
      const layers = layersAt(c.tl, target.t);
      const top = layers[layers.length - 1];
      id = top.scene;
      at = top.t;
      const i = clipIndexAt(c.tl, target.t);
      context.push(`I'm looking at timeline ${s2(target.t)}, which is scene “${id}” at scene time ${at.toFixed(2)} (clip ${c.tl.clips[i]?.id}).`);
    } else id = target.id;
    const s = scene(id);
    const uses = sceneUses(c, id);
    if (s) {
      context.push(`Scene “${s.id}” (${s.label}${s.section ? `, section ${s.section}` : ""}) lives in film/scenes/${s.id}.js; its own clock runs ${s.start}–${s.end}.`);
      if (s.beats?.length) context.push(`Beats: ${s.beats.map((b) => `${b.label} @ ${b.t}`).join(", ")}.`);
      if (s.notes) context.push(`Notes on the scene: ${s.notes}`);
      if (s.error) context.push(`The scene currently fails: ${s.error.split("\n")[0]}`);
    }
    context.push(uses.length ? `Used on the timeline by ${uses.join("; ")}.` : "Not used on the timeline yet.");
    const vo = voOver(c, c.tl.clips.filter((k) => k.scene === id).map((k) => k.id));
    if (vo.length) context.push(`Voiceover over it: ${vo.join("; ")}.`);
    const t = at ?? (s ? (s.start + s.end) / 2 : 0);
    return {
      what: `the “${id}” scene (film/scenes/${id}.js)${target.kind === "frame" ? " at the frame I'm looking at" : ""}`,
      context,
      check: `${frame(`--scene ${id} --at ${t.toFixed(2)}`)} and look at the PNG (try a few scene times across ${s ? `${s.start}–${s.end}` : "its range"}).`,
    };
  }

  if (target.kind === "clip") {
    const i = c.tl.clips.findIndex((k) => k.id === target.id);
    const k = c.tl.clips[i];
    const start = clipStarts(c.tl)[i];
    const s = scene(k.scene);
    const context = [
      `Picture clip ${k.id} is #${i + 1} of ${c.tl.clips.length} in timeline.json: scene “${k.scene}” (film/scenes/${k.scene}.js${s ? `, ${s.label}` : ""}), timeline ${s2(start)}–${s2(start + k.duration)}, source ${k.in}–${k.out}, ${speedOf(k) === 0 ? "a freeze frame" : `${pct(speedOf(k))} speed`}${k.xfade ? `, ${k.xfade}s crossfade in` : ""}.`,
      `Film length ${s2(totalDuration(c.tl))}. Keep clip ids stable: voiceover lines are pinned to them.`,
    ];
    const vo = voOver(c, [k.id]);
    if (vo.length) context.push(`Voiceover pinned to it: ${vo.join("; ")}.`);
    if (k.notes) context.push(`Notes on the clip: ${k.notes}`);
    return {
      what: `picture clip ${k.id} (scene “${k.scene}”)`,
      context,
      check: `npm --prefix "${c.studio}" run inspect -- "${c.dir}", then ${frame(`${(start + k.duration / 2).toFixed(2)}`)} and look at the PNG.`,
    };
  }

  if (target.kind === "audio") {
    const r = resolveAudio(c.tl).find((x) => x.clip.id === target.id)!;
    const a = r.clip;
    const context: string[] = [];
    if (a.vo) {
      context.push(`Voiceover line ${a.id} in timeline.json (tracks[kind=vo]): “${a.vo.text}”.`);
      context.push(`Plays ${s2(r.start)}–${s2(r.end)}${a.anchor ? `, pinned ${a.anchor.offset}s into picture clip ${a.anchor.clip}` : ""}${a.vo.target ? `, target length ${a.vo.target}s` : ""}${rateOf(a) !== 1 ? `, ${pct(rateOf(a))} speed` : ""}; ${a.vo.takes.length} take(s)${r.placeholder ? ", none generated yet" : ""}.`);
      const v = voiceOf(c.tl, a);
      context.push(`Voice ${v.voice}${v.voice === a.vo.voice ? "" : " (project default)"} on ${c.tl.voice.provider}${v.style ? `, style “${v.style}”` : ""}.`);
      context.push(`After changing the text, generate a take: npm --prefix "${c.studio}" run vo -- "${c.dir}" --line ${a.id}`);
    } else {
      context.push(`${r.track.name} clip ${a.id} in timeline.json: ${a.asset}, ${s2(r.start)}–${s2(r.end)}, gain ${a.gain} dB, fades ${a.fadeIn}/${a.fadeOut}s${rateOf(a) !== 1 ? `, ${pct(rateOf(a))} speed` : ""}.`);
    }
    return {
      what: a.vo ? `voiceover line ${a.id}` : `${r.track.kind} clip ${a.id}`,
      context,
      check: `npm --prefix "${c.studio}" run inspect -- "${c.dir}" (check the VO section and warnings).`,
    };
  }

  return {
    what: "this film",
    context: [
      `${c.tl.name}: ${s2(totalDuration(c.tl))}, ${c.tl.clips.length} picture clips, ${c.manifest?.scenes.length ?? "?"} scenes in film/scenes/. brief.md has the intent.`,
    ],
    check: `npm --prefix "${c.studio}" run inspect -- "${c.dir}" and ${frame("--sheet")}, then look at the contact sheet.`,
  };
}

export function buildPrompt(c: PromptCtx, target: PromptTarget, ask: string): string {
  const d = describe(c, target);
  return [
    `In the video project at ${c.dir} (read its AGENTS.md first), update ${d.what}:`,
    "",
    ask.trim() || "<describe the change>",
    "",
    "Context:",
    ...d.context.map((l) => `- ${l}`),
    "",
    `Check your work: ${d.check} Shot reloads scene files and timeline.json automatically, so the change shows up live.`,
    "Change only what this asks. Keep every frame a pure function of time (see AGENTS.md).",
  ].join("\n");
}

export const promptTitle = (c: PromptCtx, t: PromptTarget) => describe(c, t).what;
