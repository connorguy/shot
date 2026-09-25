// App state: one external store (timeline + UI), snapshot undo/redo, debounced autosave.
import { useSyncExternalStore } from "react";
import type { FilmManifest, Timeline } from "../../shared/timeline.ts";
import { api, type ElevenVoice, type ProjectInfo, type Status } from "./api.ts";

export type Sel =
  | { kind: "clip"; ids: string[] }
  | { kind: "audio"; id: string }
  | { kind: "track"; id: string }
  | null;

export type Tool = "retime" | "trim";
export type SidePanel = "scenes" | "script" | "audio";

export interface State {
  project: string | null;
  timeline: Timeline | null;
  manifest: FilmManifest | null;
  filmVersion: string | null;
  filmError: string | null;
  sel: Sel;
  tool: Tool;
  snap: boolean;
  zoom: number; // px per second
  playing: boolean;
  loop: boolean;
  panel: SidePanel;
  showSide: boolean; // left panel (scenes, voiceover, music)
  showInspect: boolean; // right panel (inspector)
  fullscreen: boolean; // the preview fills the window (and the screen, where the browser allows)
  save: "saved" | "saving" | "dirty" | "error";
  status: Status | null;
  elevenVoices: ElevenVoice[] | null; // loaded when the ElevenLabs engine is picked
  busy: Record<string, string>; // audio clip id / task -> label
  toast: { msg: string; kind: "info" | "error" } | null;
  exportOpen: boolean;
  assetsVersion: number;
  diskTimeline: string | null; // mtime of timeline.json as we last saved or loaded it
  projects: ProjectInfo[];
  newOpen: boolean;
  promptFor: PromptTarget | null; // "prompt an agent" box
  saveTplOpen: boolean;
}

export type PromptTarget =
  | { kind: "scene"; id: string }
  | { kind: "clip"; id: string }
  | { kind: "audio"; id: string }
  | { kind: "frame"; t: number }
  | { kind: "project" };

// which side panels are open, remembered per browser
const LAYOUT_KEY = "shot.layout";
function savedLayout(): Pick<State, "showSide" | "showInspect"> {
  const d = { showSide: true, showInspect: true };
  try {
    const v = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}");
    return { showSide: v.showSide ?? d.showSide, showInspect: v.showInspect ?? d.showInspect };
  } catch { return d; }
}

let state: State = {
  project: null, timeline: null, manifest: null, filmVersion: null, filmError: null, sel: null,
  tool: "retime", snap: true, zoom: 60, playing: false, loop: false, panel: "scenes", ...savedLayout(), fullscreen: false, save: "saved",
  status: null, elevenVoices: null, busy: {}, toast: null, exportOpen: false, assetsVersion: 0, diskTimeline: null,
  projects: [], newOpen: false, promptFor: null, saveTplOpen: false,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const getState = () => state;
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  emit();
}
export function togglePanel(which: "showSide" | "showInspect") {
  setState((s) => ({ [which]: !s[which] }));
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify({ showSide: state.showSide, showInspect: state.showInspect })); } catch {}
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

// ───────── timeline edits + history ─────────
const undoStack: Timeline[] = [];
const redoStack: Timeline[] = [];
let gestureBase: Timeline | null = null;

function commit(next: Timeline, record: boolean) {
  const prev = state.timeline;
  if (record && prev) {
    undoStack.push(prev);
    if (undoStack.length > 200) undoStack.shift();
    redoStack.length = 0;
  }
  state = { ...state, timeline: next, save: "dirty" };
  emit();
  scheduleSave();
}

let lastCoalesce = { key: "", at: 0 };

/** Mutate a copy of the timeline. Inside a gesture, history is recorded once at endGesture.
 *  Edits sharing a `coalesce` key within 1.5 s (typing) collapse into one undo step. */
export function edit(fn: (tl: Timeline) => void, coalesce?: string) {
  if (!state.timeline) return;
  const next = structuredClone(state.timeline);
  fn(next);
  const now = performance.now();
  const merge = !!coalesce && coalesce === lastCoalesce.key && now - lastCoalesce.at < 1500;
  lastCoalesce = { key: coalesce || "", at: now };
  commit(next, !gestureBase && !merge);
}

export function beginGesture() { gestureBase = state.timeline; }
export function endGesture() {
  const base = gestureBase;
  gestureBase = null;
  if (base && base !== state.timeline) {
    undoStack.push(base);
    redoStack.length = 0;
  }
}
export function cancelGesture() {
  if (gestureBase) { state = { ...state, timeline: gestureBase }; gestureBase = null; emit(); }
}

export function undo() {
  const prev = undoStack.pop();
  if (!prev || !state.timeline) return;
  redoStack.push(state.timeline);
  state = { ...state, timeline: prev, save: "dirty" };
  emit(); scheduleSave();
}
export function redo() {
  const next = redoStack.pop();
  if (!next || !state.timeline) return;
  undoStack.push(state.timeline);
  state = { ...state, timeline: next, save: "dirty" };
  emit(); scheduleSave();
}
export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;

/** Take a timeline that changed on disk (an agent or editor wrote timeline.json). Undoable. */
export function adoptExternal(tl: Timeline, diskTimeline: string | null) {
  if (state.timeline) { undoStack.push(state.timeline); redoStack.length = 0; }
  state = { ...state, timeline: tl, diskTimeline, save: "saved" };
  emit();
}

/** Replace the timeline wholesale (project load); clears history. */
export function loadTimeline(tl: Timeline | null, extra: Partial<State> = {}) {
  undoStack.length = 0; redoStack.length = 0; gestureBase = null;
  state = { ...state, ...extra, timeline: tl, sel: null, save: "saved" };
  emit();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 600);
}
export async function saveNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const { project, timeline } = state;
  if (!project || !timeline || gestureBase) { if (gestureBase) scheduleSave(); return; }
  setState({ save: "saving" });
  try {
    const r = await api.saveTimeline(project, timeline);
    setState({ diskTimeline: r.timelineVersion });
    if (state.timeline === timeline) setState({ save: "saved" });
  } catch (e: any) {
    setState({ save: "error", toast: { msg: `Save failed: ${e.message}`, kind: "error" } });
  }
}

// ───────── helpers ─────────
let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function toast(msg: string, kind: "info" | "error" = "info") {
  setState({ toast: { msg, kind } });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setState({ toast: null }), kind === "error" ? 7000 : 3000);
}
export function setBusy(key: string, label: string | null) {
  setState((s) => {
    const busy = { ...s.busy };
    if (label) busy[key] = label; else delete busy[key];
    return { busy };
  });
}
