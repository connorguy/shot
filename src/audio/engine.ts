// Web Audio engine. The same schedule() drives live preview (AudioContext) and the export mix
// (OfflineAudioContext), so what you hear while tinkering is what lands in the MP4.
import {
  audibleTracks, dbToGain, duckEnvelope, rateOf, resolveAudio, totalDuration, type AudioTrack, type Timeline,
} from "../../shared/timeline.ts";
import { audioUrl } from "../lib/api.ts";

let ctx: AudioContext | null = null;
const ac = () => (ctx ||= new AudioContext({ latencyHint: "interactive" }));

const buffers = new Map<string, Promise<AudioBuffer>>();
const decoded = new Map<string, AudioBuffer>();
const listeners = new Set<() => void>();

export function loadBuffer(url: string): Promise<AudioBuffer> {
  let p = buffers.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`${r.status} loading ${url}`); return r.arrayBuffer(); })
      .then((b) => ac().decodeAudioData(b))
      .then((buf) => { decoded.set(url, buf); listeners.forEach((l) => l()); return buf; });
    p.catch(() => buffers.delete(url));
    buffers.set(url, p);
  }
  return p;
}
export const getDecoded = (url: string) => decoded.get(url) || null;
export const onDecoded = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Make sure every asset the timeline uses is decoded. */
export async function preload(project: string, tl: Timeline) {
  const urls = new Set<string>();
  for (const t of tl.tracks) for (const c of t.clips) if (c.asset) urls.add(audioUrl(project, c.asset, rateOf(c)));
  await Promise.all([...urls].map((u) => loadBuffer(u).catch(() => null)));
}

/** Piecewise-linear gain automation over timeline time, mapped onto a context clock. */
function automate(param: AudioParam, pts: [number, number][], from: number, when: number, base: number) {
  const at = (T: number) => {
    if (!pts.length) return 1;
    if (T <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const [t1, v1] = pts[i], [t0, v0] = pts[i - 1];
      if (T <= t1) return t1 === t0 ? v1 : v0 + ((v1 - v0) * (T - t0)) / (t1 - t0);
    }
    return pts[pts.length - 1][1];
  };
  param.setValueAtTime(base * at(from), when);
  for (const [T, v] of pts) if (T > from) param.linearRampToValueAtTime(base * v, when + (T - from));
}

/** Schedule every audible clip from timeline time `from`, starting at context time `when`. */
function schedule(c: BaseAudioContext, project: string, tl: Timeline, from: number, when: number, dest: AudioNode): AudioScheduledSourceNode[] {
  const end = totalDuration(tl);
  const audible = audibleTracks(tl);
  const master = c.createGain();
  master.gain.value = dbToGain(tl.master.gain);
  master.connect(dest);
  const trackNodes = new Map<string, GainNode>();
  const trackNode = (t: AudioTrack) => {
    let g = trackNodes.get(t.id);
    if (!g) {
      g = c.createGain();
      automate(g.gain, duckEnvelope(tl, t), from, when, dbToGain(t.gain));
      g.connect(master);
      trackNodes.set(t.id, g);
    }
    return g;
  };
  const nodes: AudioScheduledSourceNode[] = [];
  for (const r of resolveAudio(tl)) {
    if (r.placeholder || !audible.has(r.track.id)) continue;
    const stop = Math.min(r.end, end);
    if (stop <= from || r.start >= end) continue;
    const buf = decoded.get(audioUrl(project, r.clip.asset!, rateOf(r.clip)));
    if (!buf) continue;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    const fadeIn = Math.min(r.clip.fadeIn, r.duration / 2), fadeOut = Math.min(r.clip.fadeOut, r.duration / 2);
    const pts: [number, number][] = [];
    if (fadeIn > 0) pts.push([r.start, 0], [r.start + fadeIn, 1]); else pts.push([r.start, 1]);
    if (fadeOut > 0) pts.push([r.end - fadeOut, 1], [r.end, 0]);
    automate(g.gain, pts, Math.max(from, r.start), when + Math.max(0, r.start - from), dbToGain(r.clip.gain));
    src.connect(g).connect(trackNode(r.track));
    const skip = Math.max(0, from - r.start);
    const len = stop - r.start - skip;
    if (len <= 0.001) continue;
    src.start(when + Math.max(0, r.start - from), r.in + skip, len);
    nodes.push(src);
  }
  return nodes;
}

// ───────── live playback ─────────
let live: { nodes: AudioScheduledSourceNode[]; ctxStart: number; from: number } | null = null;

export async function play(project: string, tl: Timeline, from: number) {
  stop();
  const c = ac();
  await c.resume();
  await preload(project, tl);
  const when = c.currentTime + 0.06;
  live = { nodes: schedule(c, project, tl, from, when, c.destination), ctxStart: when, from };
}

export function stop() {
  if (!live) return;
  for (const n of live.nodes) { try { n.stop(); } catch { /* not started */ } }
  live = null;
}

/** Current timeline time while playing (audio clock is the master clock). */
export function clock(): number | null {
  if (!live || !ctx) return null;
  return live.from + Math.max(0, ctx.currentTime - live.ctxStart);
}

// one-off audition of a single asset (takes, library)
let audition: AudioBufferSourceNode | null = null;
export async function audit(url: string | null) {
  try { audition?.stop(); } catch { /* ignore */ }
  audition = null;
  if (!url) return;
  const c = ac();
  await c.resume();
  const buf = await loadBuffer(url);
  const s = c.createBufferSource();
  s.buffer = buf;
  s.connect(c.destination);
  s.start();
  audition = s;
}

// ───────── export mix ─────────
export async function renderMix(project: string, tl: Timeline, sampleRate = 48000): Promise<Blob | null> {
  await preload(project, tl);
  const hasAudio = resolveAudio(tl).some((r) => !r.placeholder);
  if (!hasAudio) return null;
  const len = Math.ceil(totalDuration(tl) * sampleRate);
  const off = new OfflineAudioContext(2, len, sampleRate);
  schedule(off, project, tl, 0, 0, off.destination);
  return encodeWav(await off.startRendering());
}

export function encodeWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); out.setUint32(4, 36 + n * ch * 2, true); w(8, "WAVE"); w(12, "fmt ");
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  w(36, "data"); out.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-1, Math.min(1, data[c][i]));
    out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    o += 2;
  }
  return new Blob([out.buffer], { type: "audio/wav" });
}

// ───────── waveform peaks ─────────
const peakCache = new WeakMap<AudioBuffer, Float32Array>();
const PEAKS_PER_SEC = 200;

/** Max-abs peaks at 200/s, mixed down to mono. */
export function peaks(buf: AudioBuffer): Float32Array {
  let p = peakCache.get(buf);
  if (p) return p;
  const step = Math.max(1, Math.floor(buf.sampleRate / PEAKS_PER_SEC));
  const n = Math.ceil(buf.length / step);
  p = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      let m = 0;
      const e = Math.min(d.length, (i + 1) * step);
      for (let j = i * step; j < e; j++) { const v = Math.abs(d[j]); if (v > m) m = v; }
      if (m > p[i]) p[i] = m;
    }
  }
  peakCache.set(buf, p);
  return p;
}
export const PEAK_RATE = PEAKS_PER_SEC;
