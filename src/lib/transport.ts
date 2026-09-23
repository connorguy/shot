// Play/pause/seek. The audio clock drives the playhead while playing; the preview listens to the playhead.
import { totalDuration } from "../../shared/timeline.ts";
import * as engine from "../audio/engine.ts";
import { playhead } from "./playhead.ts";
import { getState, setState, toast } from "./store.ts";

let raf = 0;
let restartTimer: ReturnType<typeof setTimeout> | null = null;

function frameLoop() {
  const s = getState();
  if (!s.playing || !s.timeline) return;
  const t = engine.clock();
  if (t != null) {
    const end = totalDuration(s.timeline);
    if (t >= end) {
      if (s.loop) { start(0); return; }
      pause();
      playhead.set(end);
      return;
    }
    playhead.set(t);
  }
  raf = requestAnimationFrame(frameLoop);
}

async function start(from: number) {
  const s = getState();
  if (!s.project || !s.timeline) return;
  cancelAnimationFrame(raf);
  playhead.set(from);
  setState({ playing: true });
  try {
    await engine.play(s.project, s.timeline, from);
  } catch (e: any) {
    toast(`Audio: ${e.message}`, "error");
  }
  if (getState().playing) raf = requestAnimationFrame(frameLoop);
}

export function play() {
  const s = getState();
  if (!s.timeline) return;
  const end = totalDuration(s.timeline);
  start(playhead.get() >= end - 1e-3 ? 0 : playhead.get());
}

export function pause() {
  cancelAnimationFrame(raf);
  engine.stop();
  setState({ playing: false });
}

export const toggle = () => (getState().playing ? pause() : play());

export function seek(t: number) {
  const s = getState();
  if (!s.timeline) return;
  const end = totalDuration(s.timeline);
  const v = Math.max(0, Math.min(end, t));
  if (s.playing) start(v);
  else playhead.set(v);
}

export function step(frames: number) {
  const s = getState();
  if (!s.timeline) return;
  if (s.playing) pause();
  const f = Math.round(playhead.get() * s.timeline.fps) + frames;
  seek(f / s.timeline.fps);
}

/** Timeline changed while playing: reschedule audio from the current position (debounced). */
export function timelineChanged() {
  if (!getState().playing) return;
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => { if (getState().playing) start(playhead.get()); }, 120);
}
