// "Prompt an agent": the user's ask plus the exact ids, files and times of what they're looking at.
// Kept short: the agent already has the project's AGENTS.md for the contract, the tools and how to check its work.
import {
  clipIndexAt, clipStarts, layersAt, rateOf, resolveAudio, speedOf, totalDuration,
  type FilmManifest, type Timeline,
} from "../../shared/timeline.ts";
import type { PromptTarget } from "./store.ts";

export interface PromptCtx { tl: Timeline; manifest: FilmManifest | null; dir: string }

const s2 = (n: number) => `${n.toFixed(2)}s`;
const pct = (r: number) => `${Math.round(r * 100)}%`;
const span = (a: number, b: number) => `${a.toFixed(2)}–${s2(b)}`;
const short = (text: string, n = 80) => { const t = text.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

function sceneUses(c: PromptCtx, sceneId: string): string[] {
  const starts = clipStarts(c.tl);
  return c.tl.clips.flatMap((k, i) => (k.scene === sceneId ? [`${k.id} ${span(starts[i], starts[i] + k.duration)}`] : []));
}

function voOver(c: PromptCtx, clipIds: string[]): string[] {
  return resolveAudio(c.tl)
    .filter((r) => r.track.kind === "vo" && r.clip.anchor && clipIds.includes(r.clip.anchor.clip))
    .map((r) => `“${short(r.clip.vo!.text)}” (${r.clip.id}, ${span(r.start, r.end)})`);
}

/** What the prompt is about: a headline for the dialog and the context lines for the prompt. */
function describe(c: PromptCtx, target: PromptTarget): { what: string; context: string[] } {
  const scene = (id: string) => c.manifest?.scenes.find((s) => s.id === id);

  if (target.kind === "scene" || target.kind === "frame") {
    const context: string[] = [];
    let id: string;
    if (target.kind === "frame") {
      const top = layersAt(c.tl, target.t).at(-1)!;
      id = top.scene;
      context.push(`Frame: ${s2(target.t)} on the timeline = scene “${id}” (film/scenes/${id}.js) at scene time ${top.t.toFixed(2)}, clip ${c.tl.clips[clipIndexAt(c.tl, target.t)]?.id}`);
    } else {
      id = target.id;
      const s = scene(id);
      const uses = sceneUses(c, id);
      context.push(`Scene: “${id}” (film/scenes/${id}.js)${s ? `, clock ${s.start}–${s.end}` : ""}; ${uses.length ? `clips ${uses.join(", ")}` : "not on the timeline"}`);
    }
    const err = scene(id)?.error;
    if (err) context.push(`Currently throws: ${err.split("\n")[0]}`);
    const vo = voOver(c, c.tl.clips.filter((k) => k.scene === id).map((k) => k.id));
    if (vo.length) context.push(`VO: ${vo.join("; ")}`);
    return { what: `the “${id}” scene${target.kind === "frame" ? " at this frame" : ""}`, context };
  }

  if (target.kind === "clip") {
    const i = c.tl.clips.findIndex((k) => k.id === target.id);
    const k = c.tl.clips[i];
    const start = clipStarts(c.tl)[i];
    const context = [
      `Clip: ${k.id}, scene “${k.scene}” (film/scenes/${k.scene}.js), ${span(start, start + k.duration)}, source ${k.in}–${k.out}, ${speedOf(k) === 0 ? "hold" : `${pct(speedOf(k))} speed`}${k.xfade ? `, ${k.xfade}s crossfade in` : ""}`,
    ];
    const vo = voOver(c, [k.id]);
    if (vo.length) context.push(`VO: ${vo.join("; ")}`);
    if (k.notes) context.push(`Notes: ${k.notes}`);
    return { what: `clip ${k.id} (scene “${k.scene}”)`, context };
  }

  if (target.kind === "audio") {
    const r = resolveAudio(c.tl).find((x) => x.clip.id === target.id)!;
    const a = r.clip;
    const rate = rateOf(a) !== 1 ? `, ${pct(rateOf(a))} speed` : "";
    const context = a.vo
      ? [`VO line: ${a.id} “${a.vo.text}”, ${span(r.start, r.end)}${a.anchor ? `, pinned ${a.anchor.offset}s into ${a.anchor.clip}` : ""}${a.vo.target ? `, target ${a.vo.target}s` : ""}${rate}, ${r.placeholder ? "no takes yet" : `${a.vo.takes.length} take(s)`}`]
      : [`${r.track.name}: ${a.id}, ${a.asset}, ${span(r.start, r.end)}, gain ${a.gain} dB, fades ${a.fadeIn}/${a.fadeOut}s${rate}`];
    return { what: a.vo ? `VO line ${a.id}` : `${r.track.kind} clip ${a.id}`, context };
  }

  return {
    what: "this film",
    context: [`Film: ${s2(totalDuration(c.tl))}, ${c.tl.clips.length} clips, ${c.manifest?.scenes.length ?? "?"} scenes`],
  };
}

export function buildPrompt(c: PromptCtx, target: PromptTarget, ask: string): string {
  return [
    ask.trim() || "<describe the change>",
    "",
    `Project: ${c.dir}`,
    ...describe(c, target).context,
  ].join("\n");
}

export const promptTitle = (c: PromptCtx, t: PromptTarget) => describe(c, t).what;
