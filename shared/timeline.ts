// Timeline model shared by the studio UI (preview, audio engine) and the server (export, CLI).
// Pure data + pure functions only: no DOM, no Node APIs.

export interface FilmBeat { t: number; label: string }
export interface FilmScene {
  id: string;
  label: string;
  section?: string | null;
  start: number;
  end: number;
  beats?: FilmBeat[];
  notes?: string;
  vo?: string;
  error?: string | null; // set by film-kit when the scene's build or draw threw
}
export interface FilmEditClip { scene: string; in: number; out: number; duration: number; xfade?: number; label?: string }
export interface FilmManifest {
  version: 1;
  title?: string;
  width: number;
  height: number;
  fps: number;
  background?: string;
  scenes: FilmScene[];
  edit?: FilmEditClip[] | null;
}

/** One cut on the picture track: a range of a film scene played over `duration` seconds. */
export interface VideoClip {
  id: string;
  scene: string;
  in: number; // source start, on the scene's clock
  out: number; // source end; in === out is a freeze frame
  duration: number; // seconds on the timeline
  xfade?: number; // crossfade in from the previous clip's last frame
  label?: string;
  notes?: string;
}

export type Provider = "gemini" | "say";

export interface Take {
  id: string;
  asset: string;
  duration: number;
  text: string;
  voice: string;
  style: string;
  provider: Provider;
  model: string | null;
  createdAt: string;
  target?: number | null; // length the take was paced for
}

export interface VoLine {
  text: string;
  voice: string | null; // null = project default
  style: string | null; // null = project default
  takes: Take[];
  take: number | null; // index into takes
  target?: number | null; // desired length in seconds: every take is time-stretched (pitch kept) to fit it
}

export interface AudioClip {
  id: string;
  label?: string;
  asset: string | null; // project-relative path
  assetDuration: number | null;
  start: number; // absolute start, used when not anchored
  anchor: { clip: string; offset: number } | null; // ride along with a picture clip
  in: number; // trim into the (time-stretched) asset, in timeline seconds
  duration: number | null; // null = to the end of the asset
  rate?: number; // playback speed, pitch preserved (1 = as recorded; 1.1 = 10% faster). Stretched audio is cached server-side.
  gain: number; // dB
  fadeIn: number;
  fadeOut: number;
  vo?: VoLine;
}

export type TrackKind = "vo" | "music" | "sfx";
export interface Duck { enabled: boolean; amount: number; attack: number; release: number }
export interface AudioTrack {
  id: string;
  kind: TrackKind;
  name: string;
  gain: number; // dB
  mute: boolean;
  solo: boolean;
  duck: Duck | null;
  clips: AudioClip[];
}

export interface DesignedVoice { id: string; name: string; description: string; sample?: string }

export interface Timeline {
  version: 1;
  name: string;
  film: string;
  fps: number;
  width: number;
  height: number;
  clips: VideoClip[];
  tracks: AudioTrack[];
  voice: { provider: Provider; model: string; voice: string; style: string; snapToTarget?: boolean };
  voices: DesignedVoice[];
  master: { gain: number };
  updatedAt?: string;
  seedVo?: boolean; // made from a template: add placeholder VO lines from the scenes' `vo` on first open
}

export const TTS_MODELS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"] as const;
export const MUSIC_MODELS = ["lyria-3.5", "lyria-3-clip-preview"] as const;
export const PREBUILT_VOICES: [string, string][] = [
  ["Zephyr", "Bright"], ["Puck", "Upbeat"], ["Charon", "Informative"], ["Kore", "Firm"], ["Fenrir", "Excitable"],
  ["Leda", "Youthful"], ["Orus", "Firm"], ["Aoede", "Breezy"], ["Callirrhoe", "Easy-going"], ["Autonoe", "Bright"],
  ["Enceladus", "Breathy"], ["Iapetus", "Clear"], ["Umbriel", "Easy-going"], ["Algieba", "Smooth"], ["Despina", "Smooth"],
  ["Erinome", "Clear"], ["Algenib", "Gravelly"], ["Rasalgethi", "Informative"], ["Laomedeia", "Upbeat"], ["Achernar", "Soft"],
  ["Alnilam", "Firm"], ["Schedar", "Even"], ["Gacrux", "Mature"], ["Pulcherrima", "Forward"], ["Achird", "Friendly"],
  ["Zubenelgenubi", "Casual"], ["Vindemiatrix", "Gentle"], ["Sadachbia", "Lively"], ["Sadaltager", "Knowledgeable"], ["Sulafat", "Warm"],
];

export const uid = (p = "") => p + Math.random().toString(36).slice(2, 9);
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const dbToGain = (db: number) => Math.pow(10, db / 20);

/** Rough read time for a VO line before any take exists (≈160 wpm plus a breath). */
export function estimateSpeech(text: string): number {
  const words = text.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  const pauses = (text.match(/<(short|long) pause>/g) || []).length * 0.4;
  return Math.max(0.6, words / 2.65 + 0.25 + pauses);
}

// ───────── picture track ─────────

export function clipStarts(tl: Timeline): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const c of tl.clips) { out.push(acc); acc += c.duration; }
  return out;
}

export const totalDuration = (tl: Timeline) => tl.clips.reduce((a, c) => a + c.duration, 0);
export const frameCount = (tl: Timeline) => Math.round(totalDuration(tl) * tl.fps);
export const speedOf = (c: VideoClip) => (c.duration > 0 ? (c.out - c.in) / c.duration : 0);

export function clipIndexAt(tl: Timeline, t: number): number {
  let acc = 0;
  for (let i = 0; i < tl.clips.length; i++) {
    acc += tl.clips[i].duration;
    if (t < acc) return i;
  }
  return tl.clips.length - 1;
}

/** Source (scene clock) time for a position inside a clip. u is 0..1 across the clip. */
export const sourceAt = (c: VideoClip, u: number) => c.in + (c.out - c.in) * clamp(u, 0, 0.999999);

export interface Layer { scene: string; t: number; opacity: number }

/** What the film should draw at timeline time t. Mirrors FilmKit.layersAt. */
export function layersAt(tl: Timeline, t: number): Layer[] {
  if (!tl.clips.length) return [];
  const i = clipIndexAt(tl, t);
  const starts = clipStarts(tl);
  const c = tl.clips[i];
  const into = t - starts[i];
  const src = sourceAt(c, c.duration > 0 ? into / c.duration : 0);
  const xf = c.xfade || 0;
  if (xf > 0 && i > 0 && into < xf) {
    const p = tl.clips[i - 1];
    return [
      { scene: p.scene, t: p.out > p.in ? p.out - 1e-4 : p.out, opacity: 1 },
      { scene: c.scene, t: src, opacity: clamp(into / xf, 0, 1) },
    ];
  }
  return [{ scene: c.scene, t: src, opacity: 1 }];
}

// ───────── audio ─────────

export interface ResolvedAudio {
  clip: AudioClip;
  track: AudioTrack;
  start: number;
  end: number;
  in: number;
  duration: number;
  placeholder: boolean; // VO line with no take yet
}

export function voiceOf(tl: Timeline, c: AudioClip) {
  return { voice: c.vo?.voice || tl.voice.voice, style: c.vo?.style ?? tl.voice.style };
}

export const RATE_MIN = 0.5, RATE_MAX = 2;
export const rateOf = (c: AudioClip) => (c.rate && c.rate > 0 ? c.rate : 1);
/** Length of the clip's audio once stretched to its rate. */
export const stretchedLength = (c: AudioClip) => (c.assetDuration != null ? c.assetDuration / rateOf(c) : null);

/** Change a clip's speed and keep its trim proportional (the same words stay in). */
export function setRate(c: AudioClip, rate: number) {
  const r1 = +clamp(rate, RATE_MIN, RATE_MAX).toFixed(4);
  const f = rateOf(c) / r1;
  c.in = +(c.in * f).toFixed(4);
  if (c.duration != null) c.duration = +(c.duration * f).toFixed(4);
  c.rate = r1 === 1 ? undefined : r1;
}

/** Speed a take needs to fill `target` seconds, before clamping. */
export const rateForTarget = (natural: number, target: number) => natural / Math.max(0.05, target);

/** Make a VO clip with a target length play its whole take at the speed that fills it
 *  (unless the project turned snapping off: then takes play at natural speed and only the pacing aims at the target). */
export function fitTarget(c: AudioClip, tl?: Pick<Timeline, "voice"> | null) {
  const target = c.vo?.target;
  if (!target || c.assetDuration == null) return;
  if (tl && tl.voice.snapToTarget === false) { c.in = 0; c.duration = null; c.rate = undefined; return; }
  c.in = 0;
  c.duration = null;
  c.rate = undefined;
  setRate(c, rateForTarget(c.assetDuration, target));
}

export function audioDuration(c: AudioClip): number {
  if (c.duration != null) return c.duration;
  if (!c.asset && c.vo?.target) return c.vo.target;
  const len = stretchedLength(c);
  if (len != null) return Math.max(0.05, len - c.in);
  if (c.vo) return estimateSpeech(c.vo.text);
  return 1;
}

export function audioStart(tl: Timeline, c: AudioClip, starts = clipStarts(tl)): number {
  if (c.anchor) {
    const i = tl.clips.findIndex((v) => v.id === c.anchor!.clip);
    if (i >= 0) return starts[i] + c.anchor.offset;
  }
  return c.start;
}

export function resolveAudio(tl: Timeline): ResolvedAudio[] {
  const starts = clipStarts(tl);
  const out: ResolvedAudio[] = [];
  for (const track of tl.tracks) {
    for (const clip of track.clips) {
      const start = audioStart(tl, clip, starts);
      const duration = audioDuration(clip);
      out.push({ clip, track, start, end: start + duration, in: clip.in, duration, placeholder: !clip.asset });
    }
  }
  return out;
}

export function audibleTracks(tl: Timeline): Set<string> {
  const solo = tl.tracks.some((t) => t.solo);
  return new Set(tl.tracks.filter((t) => !t.mute && (!solo || t.solo)).map((t) => t.id));
}

/** Gain breakpoints (linear) for a ducked track: dips under every audible VO clip. */
export function duckEnvelope(tl: Timeline, track: AudioTrack): [number, number][] {
  const d = track.duck;
  if (!d || !d.enabled) return [];
  const audible = audibleTracks(tl);
  const spans = resolveAudio(tl)
    .filter((r) => r.track.kind === "vo" && audible.has(r.track.id) && !r.placeholder)
    .map((r) => [r.start - d.attack, r.end + d.release] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([...s]);
  }
  const low = dbToGain(d.amount);
  const pts: [number, number][] = [[0, 1]];
  for (const [a, b] of merged) {
    const a0 = Math.max(0, a);
    pts.push([a0, 1], [a0 + d.attack, low], [Math.max(a0 + d.attack, b - d.release), low], [b, 1]);
  }
  return pts;
}

// ───────── music ─────────

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`;

/** Timed section map for Lyria, built from the current cut: "[0:00 - 0:04] Hook: …". */
export function structureFor(tl: Timeline, m: FilmManifest | null): string {
  const starts = clipStarts(tl);
  const rows: { name: string; a: number; b: number; labels: string[] }[] = [];
  tl.clips.forEach((c, i) => {
    const s = m?.scenes.find((x) => x.id === c.scene);
    const name = s?.section || s?.label || c.scene;
    const label = s?.label || c.scene;
    const last = rows[rows.length - 1];
    if (last && last.name === name) { last.b = starts[i] + c.duration; if (!last.labels.includes(label)) last.labels.push(label); }
    else rows.push({ name, a: starts[i], b: starts[i] + c.duration, labels: [label] });
  });
  return rows.map((r) => `[${mmss(r.a)} - ${mmss(r.b)}] ${r.name}: ${r.labels.join(", ")}`).join("\n");
}

export function musicPrompt(mood: string, seconds: number, structure: string | null): string {
  return [
    mood.trim(),
    `Instrumental only, no vocals. The track should be about ${Math.ceil(seconds)} seconds long.`,
    structure ? `Follow this timeline:\n${structure}` : "",
  ].filter(Boolean).join("\n\n");
}

// ───────── construction ─────────

export function emptyTimeline(name: string, film = "film.html"): Timeline {
  return {
    version: 1, name, film, fps: 30, width: 1920, height: 1080, clips: [],
    tracks: [
      { id: "vo", kind: "vo", name: "Voiceover", gain: 0, mute: false, solo: false, duck: null, clips: [] },
      { id: "music", kind: "music", name: "Music", gain: -6, mute: false, solo: false, duck: { enabled: true, amount: -12, attack: 0.25, release: 0.6 }, clips: [] },
      { id: "sfx", kind: "sfx", name: "SFX", gain: 0, mute: false, solo: false, duck: null, clips: [] },
    ],
    voice: { provider: "gemini", model: TTS_MODELS[0], voice: "Kore", style: "" },
    voices: [],
    master: { gain: 0 },
  };
}

/** Select take `idx` (or none) on a VO clip: the clip plays that take's file from the start, fitted to its target. */
export function applyTake(c: AudioClip, idx: number | null, tl?: Pick<Timeline, "voice"> | null) {
  if (!c.vo) return;
  c.vo.take = idx;
  const t = idx == null ? null : c.vo.takes[idx];
  c.asset = t ? t.asset : null;
  c.assetDuration = t ? t.duration : null;
  c.in = 0;
  c.duration = null;
  fitTarget(c, tl);
}

export function newVoClip(text: string, anchor: AudioClip["anchor"], start = 0): AudioClip {
  return {
    id: uid("vo_"), asset: null, assetDuration: null, start, anchor, in: 0, duration: null, gain: 0, fadeIn: 0, fadeOut: 0,
    vo: { text, voice: null, style: null, takes: [], take: null },
  };
}

/** First timeline for a film: its default cut (or every scene in order) plus placeholder VO from scene notes. */
export function timelineFromManifest(m: FilmManifest, name: string, film = "film.html"): Timeline {
  const tl = emptyTimeline(name, film);
  tl.fps = m.fps || 30;
  tl.width = m.width || 1920;
  tl.height = m.height || 1080;
  const edit: FilmEditClip[] = m.edit && m.edit.length
    ? m.edit
    : m.scenes.map((s) => ({ scene: s.id, in: s.start, out: s.end, duration: s.end - s.start }));
  tl.clips = edit.map((e) => ({ id: uid("c_"), scene: e.scene, in: e.in, out: e.out, duration: e.duration, xfade: e.xfade || 0, label: e.label }));
  return seedVoFromManifest(tl, m);
}

/** Placeholder VO lines (text, no audio) from each used scene's `vo`, pinned to the first clip showing it. */
export function seedVoFromManifest(tl: Timeline, m: FilmManifest): Timeline {
  const vo = tl.tracks.find((t) => t.kind === "vo");
  delete tl.seedVo;
  if (!vo) return tl;
  const seen = new Set<string>();
  for (const c of tl.clips) {
    const s = m.scenes.find((x) => x.id === c.scene);
    if (!s || !s.vo || seen.has(s.id)) continue;
    seen.add(s.id);
    vo.clips.push(newVoClip(s.vo, { clip: c.id, offset: 0.15 }));
  }
  return tl;
}

/** A timeline reduced to what a template keeps: the cut, track setup and voice settings. No audio clips,
 *  no takes, no designed voices (those ids belong to one Google project). */
export function templateTimeline(tl: Timeline, name: string): Timeline {
  const t = structuredClone(tl);
  for (const tr of t.tracks) { tr.clips = []; tr.mute = false; tr.solo = false; }
  t.voices = [];
  if (t.voice.voice.startsWith("voice_")) t.voice.voice = "Kore";
  t.name = name;
  delete t.updatedAt;
  t.seedVo = true;
  return t;
}

/** Keep a timeline loadable after hand edits or older versions. */
export function normalizeTimeline(tl: Timeline): Timeline {
  const base = emptyTimeline(tl.name || "untitled", tl.film || "film.html");
  const out: Timeline = { ...base, ...tl, voice: { ...base.voice, ...(tl.voice || {}) }, master: { ...base.master, ...(tl.master || {}) } };
  out.voices = tl.voices || [];
  out.clips = (tl.clips || []).map((c) => ({ ...c, id: c.id || uid("c_") }));
  out.tracks = (tl.tracks && tl.tracks.length ? tl.tracks : base.tracks).map((t) => ({
    ...t,
    clips: (t.clips || []).map((c) => ({
      ...c,
      in: c.in ?? 0, gain: c.gain ?? 0, fadeIn: c.fadeIn ?? 0, fadeOut: c.fadeOut ?? 0, anchor: c.anchor ?? null, start: c.start ?? 0,
      duration: c.duration ?? null, assetDuration: c.assetDuration ?? null, asset: c.asset ?? null,
    })),
  }));
  return out;
}

export function fmtTime(t: number, fps = 30, frames = false): string {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  if (frames) {
    const whole = Math.floor(sec);
    const f = Math.floor((sec - whole) * fps + 1e-6);
    return `${m}:${String(whole).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
  }
  return `${m}:${sec.toFixed(2).padStart(5, "0")}`;
}
