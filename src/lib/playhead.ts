// The playhead changes every frame during playback, so it lives outside React state.
// Only the few components that draw it subscribe.
import { useSyncExternalStore } from "react";

let t = 0;
const subs = new Set<(t: number) => void>();

export const playhead = {
  get: () => t,
  set(v: number) {
    if (v === t) return;
    t = v;
    subs.forEach((f) => f(t));
  },
  subscribe(f: (t: number) => void) {
    subs.add(f);
    return () => { subs.delete(f); };
  },
};

export function usePlayhead(): number {
  return useSyncExternalStore((cb) => playhead.subscribe(cb), () => t);
}
