// Timeline operations shared by the toolbar, inspector, panels and keyboard shortcuts.
import {
  applyTake, audioStart, clipIndexAt, clipStarts, newVoClip, resolveAudio, sourceAt, uid, voiceOf,
  type AudioClip, type AudioTrack, type Timeline, type TrackKind, type VideoClip,
} from "../../shared/timeline.ts";
import { api } from "./api.ts";
import { playhead } from "./playhead.ts";
import { edit, getState, setBusy, setState, toast } from "./store.ts";

export const MIN_DUR = 1 / 60;

export function findAudio(tl: Timeline, id: string): { track: AudioTrack; clip: AudioClip } | null {
  for (const track of tl.tracks) {
    const clip = track.clips.find((c) => c.id === id);
    if (clip) return { track, clip };
  }
  return null;
}

/** Pin an audio clip to the picture clip under `abs`, so it travels when scenes are reordered. */
export function placeAudio(tl: Timeline, clip: AudioClip, abs: number, anchored: boolean) {
  clip.start = Math.max(0, abs);
  if (!anchored || !tl.clips.length) { clip.anchor = null; return; }
  const starts = clipStarts(tl);
  const i = clipIndexAt(tl, Math.max(0, abs));
  clip.anchor = { clip: tl.clips[i].id, offset: +(abs - starts[i]).toFixed(4) };
}

/** Before removing picture clips: audio pinned to them keeps its absolute time and re-pins to whatever is there next. */
function detachOrphans(tl: Timeline, removed: Set<string>): AudioClip[] {
  const starts = clipStarts(tl);
  const orphans: AudioClip[] = [];
  for (const t of tl.tracks) for (const c of t.clips) {
    if (c.anchor && removed.has(c.anchor.clip)) {
      const i = tl.clips.findIndex((v) => v.id === c.anchor!.clip);
      c.start = (i >= 0 ? starts[i] : 0) + c.anchor.offset;
      c.anchor = null;
      orphans.push(c);
    }
  }
  return orphans;
}

// ───────── picture track ─────────

export function splitAt(t = playhead.get()) {
  edit((tl) => {
    if (!tl.clips.length) return;
    const starts = clipStarts(tl);
    const i = clipIndexAt(tl, t);
    const c = tl.clips[i];
    const into = t - starts[i];
    if (into < MIN_DUR || c.duration - into < MIN_DUR) return;
    const src = sourceAt(c, into / c.duration);
    const b: VideoClip = { ...c, id: uid("c_"), in: src, duration: c.duration - into, xfade: 0 };
    c.out = src; c.duration = into;
    tl.clips.splice(i + 1, 0, b);
    // audio anchored to the first half past the cut moves to the second half
    for (const tr of tl.tracks) for (const a of tr.clips) {
      if (a.anchor?.clip === c.id && a.anchor.offset >= into) a.anchor = { clip: b.id, offset: a.anchor.offset - into };
    }
    setState({ sel: { kind: "clip", ids: [b.id] } });
  });
}

/** Insert a freeze frame of `secs` at the playhead (splits the clip under it). */
export function addHold(secs = 1, t = playhead.get()) {
  edit((tl) => {
    if (!tl.clips.length) return;
    const starts = clipStarts(tl);
    let i = clipIndexAt(tl, t);
    let c = tl.clips[i];
    const into = t - starts[i];
    if (into >= MIN_DUR && c.duration - into >= MIN_DUR) {
      const src = sourceAt(c, into / c.duration);
      const b: VideoClip = { ...c, id: uid("c_"), in: src, duration: c.duration - into, xfade: 0 };
      c.out = src; c.duration = into;
      tl.clips.splice(i + 1, 0, b);
      for (const tr of tl.tracks) for (const a of tr.clips) {
        if (a.anchor?.clip === c.id && a.anchor.offset >= into) a.anchor = { clip: b.id, offset: a.anchor.offset - into };
      }
    } else if (into < MIN_DUR) {
      i -= 1; // hold before this clip = freeze the end of the previous one
      if (i < 0) { i = 0; const f = { ...c, id: uid("c_"), out: c.in, duration: secs, xfade: 0, label: "Hold" }; tl.clips.splice(0, 0, f); setState({ sel: { kind: "clip", ids: [f.id] } }); return; }
      c = tl.clips[i];
    }
    const at = c.out;
    const hold: VideoClip = { id: uid("c_"), scene: c.scene, in: at, out: at, duration: secs, xfade: 0, label: "Hold" };
    tl.clips.splice(i + 1, 0, hold);
    setState({ sel: { kind: "clip", ids: [hold.id] } });
  });
}

export function deleteSelection() {
  const sel = getState().sel;
  if (!sel) return;
  if (sel.kind === "clip") {
    edit((tl) => {
      const ids = new Set(sel.ids);
      const orphans = detachOrphans(tl, ids);
      tl.clips = tl.clips.filter((c) => !ids.has(c.id));
      for (const c of orphans) placeAudio(tl, c, c.start, true);
    });
  } else if (sel.kind === "audio") {
    edit((tl) => { for (const t of tl.tracks) t.clips = t.clips.filter((c) => c.id !== sel.id); });
  }
  setState({ sel: null });
}

export function duplicateSelection() {
  const sel = getState().sel;
  if (!sel) return;
  if (sel.kind === "clip") {
    edit((tl) => {
      const last = Math.max(...sel.ids.map((id) => tl.clips.findIndex((c) => c.id === id)));
      const copies = tl.clips.filter((c) => sel.ids.includes(c.id)).map((c) => ({ ...c, id: uid("c_") }));
      tl.clips.splice(last + 1, 0, ...copies);
      setState({ sel: { kind: "clip", ids: copies.map((c) => c.id) } });
    });
  } else if (sel.kind === "audio") {
    edit((tl) => {
      const f = findAudio(tl, sel.id);
      if (!f) return;
      const copy: AudioClip = structuredClone(f.clip);
      copy.id = uid(f.track.kind + "_");
      const s = audioStart(tl, f.clip);
      placeAudio(tl, copy, s + 0.5, !!f.clip.anchor);
      f.track.clips.push(copy);
      setState({ sel: { kind: "audio", id: copy.id } });
    });
  }
}

export function insertScene(sceneId: string, index?: number) {
  const m = getState().manifest;
  const s = m?.scenes.find((x) => x.id === sceneId);
  if (!s) return;
  edit((tl) => {
    const c: VideoClip = { id: uid("c_"), scene: s.id, in: s.start, out: s.end, duration: +(s.end - s.start).toFixed(4), xfade: 0 };
    tl.clips.splice(index ?? tl.clips.length, 0, c);
    setState({ sel: { kind: "clip", ids: [c.id] } });
  });
}

export function moveClips(ids: string[], toIndex: number) {
  edit((tl) => {
    const moving = tl.clips.filter((c) => ids.includes(c.id));
    const idxBefore = tl.clips.slice(0, toIndex).filter((c) => ids.includes(c.id)).length;
    tl.clips = tl.clips.filter((c) => !ids.includes(c.id));
    tl.clips.splice(toIndex - idxBefore, 0, ...moving);
  });
}

// ───────── audio ─────────

export function addVoLine(t = playhead.get(), text = "New line") {
  let id = "";
  edit((tl) => {
    const vo = tl.tracks.find((x) => x.kind === "vo");
    if (!vo) return;
    const c = newVoClip(text, null, t);
    placeAudio(tl, c, t, true);
    vo.clips.push(c);
    id = c.id;
  });
  if (id) setState({ sel: { kind: "audio", id }, panel: "script" });
  return id;
}

export function addAsset(kind: TrackKind, asset: string, duration: number | null, at = playhead.get(), label?: string) {
  let id = "";
  edit((tl) => {
    const track = tl.tracks.find((x) => x.kind === kind);
    if (!track) return;
    const c: AudioClip = {
      id: uid(kind + "_"), label: label || asset.split("/").pop(), asset, assetDuration: duration, start: at, anchor: null,
      in: 0, duration: null, gain: 0, fadeIn: kind === "music" ? 0.5 : 0, fadeOut: kind === "music" ? 1.5 : 0,
    };
    placeAudio(tl, c, at, kind !== "music");
    track.clips.push(c);
    id = c.id;
  });
  if (id) setState({ sel: { kind: "audio", id } });
  return id;
}

export async function generateTake(clipId: string) {
  const s = getState();
  const tl = s.timeline, project = s.project;
  if (!tl || !project) return;
  const f = findAudio(tl, clipId);
  if (!f?.clip.vo) return;
  const { voice, style } = voiceOf(tl, f.clip);
  const provider = tl.voice.provider;
  if (provider === "gemini" && !s.status?.gemini) {
    toast("No Gemini credentials. Run `gcloud auth application-default login` (ADC) or add GEMINI_API_KEY to shot/.env, then restart. Or switch the engine to Draft (macOS say).", "error");
    return;
  }
  const tg = f.clip.vo.target;
  setBusy(clipId, `${provider === "say" ? "Drafting" : "Generating"}${tg ? ` to ${tg.toFixed(1)}s` : ""}…`);
  try {
    const { take } = await api.tts(project, { clipId, text: f.clip.vo.text, voice, style, model: tl.voice.model, provider, target: f.clip.vo.target ?? null });
    edit((d) => {
      const g = findAudio(d, clipId);
      if (!g?.clip.vo) return;
      g.clip.vo.takes.push(take);
      applyTake(g.clip, g.clip.vo.takes.length - 1, d);
    });
  } catch (e: any) {
    toast(e.message, "error");
  } finally {
    setBusy(clipId, null);
  }
}

export { applyTake };

export async function generateMissing() {
  const tl = getState().timeline;
  if (!tl) return;
  const todo = tl.tracks.filter((t) => t.kind === "vo").flatMap((t) => t.clips).filter((c) => c.vo && !c.asset && c.vo.text.trim());
  if (!todo.length) return toast("Every line already has a take.");
  for (let i = 0; i < todo.length; i += 3) await Promise.all(todo.slice(i, i + 3).map((c) => generateTake(c.id)));
}

/** Lengthen picture (never shorten) so each voiceover line finishes before the next one starts.
 *  A line owns the clips from the one it is pinned to up to the next line's clip; if it runs long,
 *  that whole span slows down evenly, so multi-clip scenes keep their internal rhythm. */
export function fitPictureToVo(pad = 0.2) {
  let changed = 0;
  edit((tl) => {
    const groups = new Map<number, { end: number; first: number }>();
    for (const r of resolveAudio(tl)) {
      if (r.track.kind !== "vo" || !r.clip.anchor || r.placeholder) continue;
      const i = tl.clips.findIndex((c) => c.id === r.clip.anchor!.clip);
      if (i < 0) continue;
      const g = groups.get(i) || { end: 0, first: Infinity };
      g.end = Math.max(g.end, r.clip.anchor.offset + r.duration + pad);
      g.first = Math.min(g.first, r.clip.anchor.offset);
      groups.set(i, g);
    }
    const idx = [...groups.keys()].sort((a, b) => a - b);
    idx.forEach((a, k) => {
      const b = k + 1 < idx.length ? idx[k + 1] : tl.clips.length;
      const nextOffset = k + 1 < idx.length ? Math.max(0, groups.get(b)!.first) : 0;
      const span = tl.clips.slice(a, b);
      const S = span.reduce((n, c) => n + c.duration, 0);
      const need = groups.get(a)!.end - nextOffset;
      if (S <= 0 || need <= S + 1e-3) return;
      const f = need / S;
      for (const c of span) c.duration = +(c.duration * f).toFixed(4);
      changed += span.length;
    });
  });
  toast(changed ? `Stretched ${changed} clip${changed > 1 ? "s" : ""} so each line finishes before the next.` : "Every line already fits.");
}
