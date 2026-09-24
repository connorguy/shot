// Generate project media (VO takes, Lyria tracks). Shared by the HTTP API and the CLI scripts.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { clamp, estimateSpeech, uid, type Provider, type Take } from "../shared/timeline.ts";
import { elevenText, SPEED_MAX, SPEED_MIN, synthesizeEleven, voiceName } from "./elevenlabs.ts";
import { generateMusic, synthesize } from "./gemini.ts";
import { fileVersion, probeDuration, projectFile, slugify, type Ctx } from "./projects.ts";
import { sayToWav } from "./say.ts";
import { trimSilence, wavDuration } from "./wav.ts";

export interface TakeRequest {
  clipId: string; text: string; voice: string; style: string; model: string; provider: Provider;
  target?: number | null; // seconds the line should take (the clip length on the timeline)
}

// Gemini TTS has no duration parameter; pace is steered through the turn-level style. Levels from slow to fast:
const PACE: Record<number, string> = {
  [-2]: "speaking slowly, with room between phrases",
  [-1]: "a little slower than usual, unhurried",
  0: "",
  1: "a little faster than usual",
  2: "speaking quickly and crisply",
};
const paceLevel = (ratio: number) => (ratio > 1.3 ? 2 : ratio > 1.08 ? 1 : ratio < 0.75 ? -2 : ratio < 0.92 ? -1 : 0);
const wordsIn = (t: string) => t.replace(/<[^>]+>|\|[^|]*\|/g, " ").trim().split(/\s+/).filter(Boolean).length;
const styleFor = (base: string, level: number, target: number | null | undefined) =>
  [base.trim(), PACE[level], target ? `about ${target.toFixed(1)} seconds long` : ""].filter(Boolean).join(", ");

/** Synthesize one line, trim silence, save it under audio/vo, and describe it as a Take.
 *  With a target, the delivery is paced toward it: Gemini through the style (one retry if the first read misses
 *  by more than 12%), ElevenLabs through its speed setting (one correction), `say` through its
 *  wpm rate. (The studio then snaps the rest with a small time-stretch.) */
export async function makeTake(ctx: Ctx, project: string, r: TakeRequest): Promise<Take> {
  const text = r.text.trim();
  if (!text) throw new Error("Line has no text.");
  const target = r.target && r.target > 0.2 ? r.target : null;

  type Try = { wav: Buffer; dur: number; style: string; model: string | null };
  let best: Try | null = null;
  if (r.provider === "say") {
    // `say` takes a words-per-minute rate and is free and instant, so search for the rate that fills the target:
    // length is roughly linear in 1/wpm (plus fixed overhead), so after two reads use the secant through them.
    let wpm = target ? (wordsIn(text) / target) * 60 : undefined;
    const seen: [number, number][] = []; // [1/wpm, seconds]
    for (let attempt = 0; attempt < (target ? 5 : 1); attempt++) {
      if (wpm) wpm = Math.min(500, Math.max(60, wpm));
      const wav = trimSilence(await sayToWav(text, wpm));
      const t: Try = { wav, dur: wavDuration(wav) || 0, style: wpm ? `${Math.round(wpm)} wpm` : "", model: null };
      if (!best || !target || Math.abs(t.dur - target) < Math.abs(best.dur - target)) best = t;
      if (!target || !wpm || Math.abs(t.dur / target - 1) < 0.03) break;
      seen.push([1 / wpm, t.dur]);
      const [a, b] = seen.slice(-2);
      wpm = seen.length < 2 || Math.abs(b[0] - a[0]) < 1e-9 || b[1] === a[1]
        ? wpm * (t.dur / target)
        : 1 / (a[0] + ((target - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
  } else if (r.provider === "elevenlabs") {
    // ElevenLabs has a real pace control (speed, 0.7–1.2): start from the estimate, then correct once from the
    // measured read (length goes roughly as 1/speed), keeping the closer take.
    const spoken = elevenText(text, r.style || "", r.model);
    let speed = target ? clamp(estimateSpeech(text) / target, SPEED_MIN, SPEED_MAX) : 1;
    for (let attempt = 0; attempt < (target ? 2 : 1); attempt++) {
      const out = await synthesizeEleven({ text: spoken, voice: r.voice, model: r.model, speed });
      const wav = trimSilence(out.wav);
      const style = [(r.style || "").trim(), Math.abs(speed - 1) > 0.005 ? `speed ${speed.toFixed(2)}` : ""].filter(Boolean).join(", ");
      const t: Try = { wav, dur: wavDuration(wav) || 0, style, model: out.model };
      if (!best || !target || Math.abs(t.dur - target) < Math.abs(best.dur - target)) best = t;
      if (!target) break;
      const next = clamp(speed * (t.dur / target), SPEED_MIN, SPEED_MAX);
      if (Math.abs(t.dur / target - 1) < 0.06 || Math.abs(next - speed) < 0.01) break;
      speed = next;
    }
  } else {
    let level = target ? paceLevel(estimateSpeech(text) / target) : 0;
    for (let attempt = 0; attempt < (target ? 2 : 1); attempt++) {
      const style = styleFor(r.style || "", level, target);
      const spoken = await synthesize({ text, voice: r.voice, style, model: r.model });
      const wav = trimSilence(spoken.wav);
      const t: Try = { wav, dur: wavDuration(wav) || 0, style, model: spoken.model };
      if (!best || !target || Math.abs(t.dur - target) < Math.abs(best.dur - target)) best = t;
      if (!target) break;
      const miss = t.dur / target;
      if (miss > 1.12 && level < 2) level++;
      else if (miss < 0.88 && level > -2) level--;
      else break;
    }
  }

  const id = uid("t_");
  const rel = `audio/vo/${slugify(r.clipId || "line")}-${id.slice(2)}.wav`;
  await mkdir(projectFile(ctx, project, "audio/vo"), { recursive: true });
  await writeFile(projectFile(ctx, project, rel), best!.wav);
  const name = r.provider === "elevenlabs" ? await voiceName(r.voice) : undefined;
  return {
    id, asset: rel, duration: best!.dur, text,
    voice: r.provider === "say" ? "macOS say" : r.voice, ...(name ? { voiceName: name } : {}), style: best!.style,
    provider: r.provider, model: best!.model, createdAt: new Date().toISOString(), target,
  };
}

/** Generate a Lyria track into audio/music, with the prompt and model output saved next to it. */
export async function makeMusic(ctx: Ctx, project: string, prompt: string, model: string, name = "lyria") {
  const r = await generateMusic(prompt, model);
  model = r.model; // Agent Platform may substitute lyria-3-pro-preview for lyria-3.5
  const rel = `audio/music/${slugify(name)}-${Date.now().toString(36)}.${r.ext}`;
  await mkdir(projectFile(ctx, project, "audio/music"), { recursive: true });
  await writeFile(projectFile(ctx, project, rel), r.data);
  await writeFile(projectFile(ctx, project, rel.replace(/\.\w+$/, ".txt")), `MODEL ${model}\n\nPROMPT\n${prompt}\n\nMODEL OUTPUT\n${r.text}\n`);
  return { asset: rel, duration: await probeDuration(projectFile(ctx, project, rel)), text: r.text };
}

// ───────── time-stretch (clip rate) ─────────

const run = promisify(execFile);
let rubberband: Promise<boolean> | null = null;
const hasRubberband = () =>
  (rubberband ||= run("ffmpeg", ["-hide_banner", "-filters"]).then(({ stdout }) => / rubberband /.test(stdout)).catch(() => false));

/** atempo only spans 0.5–2 per stage, so chain stages for anything outside that. */
function atempoChain(rate: number) {
  const parts: string[] = [];
  let r = rate;
  while (r > 2) { parts.push("atempo=2"); r /= 2; }
  while (r < 0.5) { parts.push("atempo=0.5"); r /= 0.5; }
  parts.push(`atempo=${r.toFixed(4)}`);
  return parts.join(",");
}

/** Pitch-preserving time-stretch of a project audio file (rate > 1 = faster), cached per file version and rate. */
export async function stretched(ctx: Ctx, project: string, asset: string, rate: number): Promise<string> {
  const src = projectFile(ctx, project, asset);
  const r = Math.round(Math.min(4, Math.max(0.25, rate)) * 1000) / 1000;
  const out = join(ctx.root, ".cache", "stretch", project, `${slugify(asset)}-${await fileVersion(src)}-${r.toFixed(3)}.wav`);
  if (existsSync(out)) return out;
  await mkdir(join(out, ".."), { recursive: true });
  const filter = (await hasRubberband()) ? `rubberband=tempo=${r}:transients=smooth:window=short` : atempoChain(r);
  const tmp = out + ".tmp.wav";
  await run("ffmpeg", ["-y", "-v", "error", "-i", src, "-af", filter, "-c:a", "pcm_s16le", tmp]);
  await rename(tmp, out);
  return out;
}
