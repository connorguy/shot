import { useEffect, useState } from "react";
import {
  RATE_MAX, RATE_MIN, audioDuration, audioStart, clipStarts, estimateSpeech, fitTarget, rateForTarget, rateOf, resolveAudio, setRate,
  speedOf, stretchedLength, totalDuration,
  type AudioClip, type AudioTrack, type Timeline, type VideoClip,
} from "../../shared/timeline.ts";
import { lint } from "../../shared/lint.ts";
import { MIN_DUR, addHold, deleteSelection, duplicateSelection, findAudio, generateTake, placeAudio, splitAt } from "../lib/actions.ts";
import { api } from "../lib/api.ts";
import { edit, getState, setState, toast, useStore } from "../lib/store.ts";
import * as transport from "../lib/transport.ts";
import { TakeList, VoicePicker } from "./ScriptPanel.tsx";
import { PromptButton } from "./PromptDialog.tsx";
import { playhead } from "../lib/playhead.ts";

/** Numeric field: type or arrow-key; commits valid numbers, one undo step per field burst. */
function Num(props: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string; digits?: number; k: string }) {
  const { value, digits = 2 } = props;
  const [text, setText] = useState(value.toFixed(digits));
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setText(value.toFixed(digits)); }, [value, focus, digits]);
  const commit = (s: string) => {
    const v = parseFloat(s);
    if (!isFinite(v)) return;
    props.onChange(Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, v)));
  };
  return (
    <label className="num">
      <span>{props.label}</span>
      <input
        type="number" step={props.step ?? 0.05} value={text}
        onFocus={() => setFocus(true)}
        onBlur={() => { setFocus(false); setText(value.toFixed(digits)); }}
        onChange={(e) => { setText(e.target.value); commit(e.target.value); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); e.stopPropagation(); }}
      />
      {props.suffix && <em>{props.suffix}</em>}
    </label>
  );
}

export function Inspector() {
  const tl = useStore((s) => s.timeline);
  const sel = useStore((s) => s.sel);
  if (!tl) return null;
  if (sel?.kind === "clip") {
    const clips = tl.clips.filter((c) => sel.ids.includes(c.id));
    if (clips.length === 1) return <ClipInspector tl={tl} clip={clips[0]} />;
    if (clips.length > 1) return <MultiClip tl={tl} clips={clips} />;
  }
  if (sel?.kind === "audio") {
    const f = findAudio(tl, sel.id);
    if (f) return <AudioInspector tl={tl} clip={f.clip} track={f.track} />;
  }
  if (sel?.kind === "track") {
    const t = tl.tracks.find((x) => x.id === sel.id);
    if (t) return <TrackInspector track={t} />;
  }
  return <ProjectInspector tl={tl} />;
}

const setClip = (id: string, fn: (c: VideoClip) => void, k: string) => edit((tl) => { const c = tl.clips.find((x) => x.id === id); if (c) fn(c); }, k);

function ClipInspector({ tl, clip: c }: { tl: Timeline; clip: VideoClip }) {
  const manifest = useStore((s) => s.manifest);
  const scene = manifest?.scenes.find((s) => s.id === c.scene);
  const i = tl.clips.findIndex((x) => x.id === c.id);
  const start = clipStarts(tl)[i];
  const sp = speedOf(c);
  const hold = c.in === c.out;
  const k = (f: string) => `${c.id}:${f}`;
  const vo = resolveAudio(tl).filter((r) => r.clip.anchor?.clip === c.id);
  const voEnd = vo.length ? Math.max(...vo.map((r) => r.clip.anchor!.offset + r.duration)) : 0;
  return (
    <div className="inspector">
      <h3>{hold ? "Hold" : "Clip"} <span>{i + 1} of {tl.clips.length} · starts {start.toFixed(2)}s</span></h3>
      <label>Scene
        <select value={c.scene} onChange={(e) => {
          const s = manifest?.scenes.find((x) => x.id === e.target.value);
          setClip(c.id, (d) => { d.scene = e.target.value; if (s) { d.in = s.start; d.out = s.end; d.duration = +((s.end - s.start) / (sp || 1)).toFixed(4); } }, k("scene"));
        }}>
          {manifest?.scenes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          {!scene && <option value={c.scene}>{c.scene} (missing)</option>}
        </select>
      </label>
      <label>Label <input value={c.label || ""} placeholder={scene?.label} onChange={(e) => setClip(c.id, (d) => { d.label = e.target.value || undefined; }, k("label"))} /></label>
      <div className="grid2">
        <Num k="dur" label="Duration" suffix="s" value={c.duration} min={MIN_DUR} onChange={(v) => setClip(c.id, (d) => { d.duration = v; }, k("dur"))} />
        {!hold && <Num k="speed" label="Speed" suffix="%" digits={0} step={5} value={sp * 100} min={5} max={1000} onChange={(v) => setClip(c.id, (d) => { d.duration = +((d.out - d.in) / (v / 100)).toFixed(4); }, k("speed"))} />}
        <Num k="in" label={hold ? "Frame at" : "Source in"} suffix="s" value={c.in} min={scene?.start} max={hold ? scene?.end : c.out} onChange={(v) => setClip(c.id, (d) => { if (hold) { d.in = d.out = v; } else { const s = speedOf(d); d.in = v; d.duration = +((d.out - v) / s).toFixed(4); } }, k("in"))} />
        {!hold && <Num k="out" label="Source out" suffix="s" value={c.out} min={c.in} max={scene?.end} onChange={(v) => setClip(c.id, (d) => { const s = speedOf(d); d.out = v; d.duration = +((v - d.in) / s).toFixed(4); }, k("out"))} />}
        <Num k="xf" label="Crossfade in" suffix="s" value={c.xfade || 0} min={0} max={c.duration} onChange={(v) => setClip(c.id, (d) => { d.xfade = v; }, k("xf"))} />
      </div>
      {scene && !hold && (c.in !== scene.start || c.out !== scene.end) && (
        <button className="link" onClick={() => setClip(c.id, (d) => { d.in = scene.start; d.out = scene.end; d.duration = +((scene.end - scene.start) / (sp || 1)).toFixed(4); }, k("reset"))}>
          Reset to full scene ({scene.start.toFixed(2)}–{scene.end.toFixed(2)})
        </button>
      )}
      {vo.length > 0 && (
        <div className="card tight">
          <p>{vo.length} voiceover line{vo.length > 1 ? "s" : ""} follow this clip; the last ends {voEnd.toFixed(2)}s in{voEnd > c.duration ? `, ${(voEnd - c.duration).toFixed(2)}s past the cut` : ""}.</p>
          <button className="sm" onClick={() => setClip(c.id, (d) => { d.duration = +Math.max(MIN_DUR, voEnd + 0.25).toFixed(4); }, k("fitvo"))}>Fit clip to voiceover (+0.25s)</button>
        </div>
      )}
      {scene?.beats && scene.beats.length > 0 && (
        <div className="beats">
          <span>Beats</span>
          {scene.beats.map((b) => (
            <button key={b.t} className="chip" disabled={b.t <= c.in || b.t >= c.out}
              onClick={() => { const t = start + ((b.t - c.in) / (c.out - c.in)) * c.duration; transport.seek(t); splitAt(t); }}
              title="Split this clip at the beat">
              ✂ {b.label} <em>{b.t.toFixed(2)}</em>
            </button>
          ))}
        </div>
      )}
      {scene?.notes && <p className="panel-note">{scene.notes}</p>}
      <div className="btn-row">
        <PromptButton target={{ kind: "scene", id: c.scene }} className="" label="✎ Prompt: change this scene…" />
        <PromptButton target={{ kind: "clip", id: c.id }} className="" label="✎ Prompt: this clip's timing…" />
      </div>
      <div className="btn-row">
        <button onClick={() => splitAt()}>Split at playhead</button>
        <button onClick={() => addHold(1)}>Add hold</button>
        <button onClick={duplicateSelection}>Duplicate</button>
        <button className="danger" onClick={deleteSelection}>Delete</button>
      </div>
      <Notes value={c.notes || ""} onChange={(v) => setClip(c.id, (d) => { d.notes = v || undefined; }, k("notes"))} />
    </div>
  );
}

function MultiClip({ tl, clips }: { tl: Timeline; clips: VideoClip[] }) {
  const total = clips.reduce((a, c) => a + c.duration, 0);
  const [pct, setPct] = useState(100);
  return (
    <div className="inspector">
      <h3>{clips.length} clips <span>{total.toFixed(2)}s together</span></h3>
      <Num k="multi" label="Scale durations" suffix="%" digits={0} step={5} value={pct} min={10} max={500} onChange={setPct} />
      <button className="primary" onClick={() => {
        edit((d) => { for (const c of d.clips) if (clips.some((x) => x.id === c.id)) c.duration = +(c.duration * pct / 100).toFixed(4); });
        setPct(100);
      }}>Apply → {(total * pct / 100).toFixed(2)}s</button>
      <div className="btn-row">
        <button onClick={duplicateSelection}>Duplicate</button>
        <button className="danger" onClick={deleteSelection}>Delete</button>
      </div>
      <p className="panel-note">Shift-click clips to add to the selection. {tl.clips.length} clips on the timeline.</p>
    </div>
  );
}

function AudioInspector({ tl, clip: c, track }: { tl: Timeline; clip: AudioClip; track: AudioTrack }) {
  const busy = useStore((s) => s.busy);
  const manifest = useStore((s) => s.manifest);
  const r = resolveAudio(tl).find((x) => x.clip.id === c.id)!;
  const k = (f: string) => `${c.id}:${f}`;
  const set = (fn: (a: AudioClip, d: Timeline) => void, f: string) => edit((d) => { const g = findAudio(d, c.id); if (g) fn(g.clip, d); }, k(f));
  const anchorClip = c.anchor ? tl.clips.find((x) => x.id === c.anchor!.clip) : null;
  const anchorLabel = anchorClip ? manifest?.scenes.find((s) => s.id === anchorClip.scene)?.label || anchorClip.scene : null;
  const start = audioStart(tl, c);
  return (
    <div className="inspector">
      <h3>{c.vo ? "Voiceover line" : track.kind === "music" ? "Music" : "Sound"} <span>{r.start.toFixed(2)}s → {r.end.toFixed(2)}s</span></h3>
      {c.vo && (
        <>
          <textarea rows={4} value={c.vo.text} onChange={(e) => { const v = e.target.value; set((a) => { a.vo!.text = v; }, "text"); }} />
          <div className="grid2">
            <label>Voice <VoicePicker allowDefault value={c.vo.voice} onChange={(v) => set((a) => { a.vo!.voice = v; }, "voice")} /></label>
            <label>Style <input value={c.vo.style ?? ""} placeholder={tl.voice.style || "project default"} onChange={(e) => { const v = e.target.value; set((a) => { a.vo!.style = v === "" ? null : v; }, "style"); }} /></label>
          </div>
          <TargetLength tl={tl} clip={c} set={set} />
          <button className="primary" disabled={!!busy[c.id]} onClick={() => generateTake(c.id)}>{busy[c.id] || `${c.vo.takes.length ? "Generate another take" : "Generate take"}${c.vo.target ? ` to fit ${c.vo.target.toFixed(2)}s` : ""}`}</button>
          <TakeList clipId={c.id} />
        </>
      )}
      {!c.vo && <label>Label <input value={c.label || ""} onChange={(e) => set((a) => { a.label = e.target.value; }, "label")} /></label>}
      <div className="grid2">
        <Num k="start" label="Starts at" suffix="s" value={start} min={0} onChange={(v) => set((a, d) => placeAudio(d, a, v, !!a.anchor), "start")} />
        {!r.placeholder && <Num k="in" label="Trim start" suffix="s" value={c.in} min={0} max={(stretchedLength(c) ?? 1e9) - 0.05} onChange={(v) => set((a) => { const dur = r.duration - (v - a.in); a.in = v; if (a.duration != null) a.duration = Math.max(0.05, dur); }, "in")} />}
        {!r.placeholder && <Num k="dur" label="Length" suffix="s" value={r.duration} min={0.05} max={stretchedLength(c) != null ? stretchedLength(c)! - c.in : undefined} onChange={(v) => set((a) => { a.duration = v; }, "dur")} />}
        {!r.placeholder && <Num k="rate" label="Speed (pitch kept)" suffix="%" digits={0} step={1} value={rateOf(c) * 100} min={RATE_MIN * 100} max={RATE_MAX * 100} onChange={(v) => set((a) => { setRate(a, v / 100); if (a.vo?.target) a.vo.target = +audioDuration(a).toFixed(3); }, "rate")} />}
        <Num k="gain" label="Gain" suffix="dB" digits={1} step={0.5} value={c.gain} min={-60} max={24} onChange={(v) => set((a) => { a.gain = v; }, "gain")} />
        <Num k="fi" label="Fade in" suffix="s" value={c.fadeIn} min={0} onChange={(v) => set((a) => { a.fadeIn = v; }, "fi")} />
        <Num k="fo" label="Fade out" suffix="s" value={c.fadeOut} min={0} onChange={(v) => set((a) => { a.fadeOut = v; }, "fo")} />
      </div>
      {rateOf(c) !== 1 && (
        <button className="link" onClick={() => set((a) => { setRate(a, 1); if (a.vo) a.vo.target = null; }, "rate-reset")}>Reset speed to 100% ({(r.duration * rateOf(c)).toFixed(2)}s)</button>
      )}
      {track.kind === "music" && r.end > totalDuration(tl) + 0.05 && (
        <button className="sm" onClick={() => set((a, d) => { a.duration = Math.max(0.05, totalDuration(d) - start); a.fadeOut = Math.max(a.fadeOut, 1.5); }, "fitend")}>Trim to end of film with a fade</button>
      )}
      <label className="chk">
        <input type="checkbox" checked={!!c.anchor} onChange={(e) => { const on = e.target.checked; set((a, d) => placeAudio(d, a, start, on), "anchor"); }} />
        Follow the picture{anchorLabel ? `: pinned ${c.anchor!.offset.toFixed(2)}s into “${anchorLabel}”` : ""}
      </label>
      <div className="btn-row">
        <PromptButton target={{ kind: "audio", id: c.id }} className="" label={`✎ Prompt: change this ${c.vo ? "line" : "clip"}…`} />
      </div>
      <div className="btn-row">
        <button onClick={() => transport.seek(r.start)}>Jump to start</button>
        <button onClick={duplicateSelection}>Duplicate</button>
        <button className="danger" onClick={deleteSelection}>Delete</button>
      </div>
      {c.asset && <p className="panel-note mono">{c.asset}</p>}
    </div>
  );
}

/** A VO line's target length: takes are time-stretched (pitch kept) to land on it. */
function TargetLength({ tl, clip: c, set }: { tl: Timeline; clip: AudioClip; set: (fn: (a: AudioClip, d: Timeline) => void, f: string) => void }) {
  const vo = c.vo!;
  const all = resolveAudio(tl);
  const me = all.find((r) => r.clip.id === c.id)!;
  const next = all.filter((r) => r.track.kind === "vo" && r.clip.id !== c.id && r.start > me.start + 0.01).sort((a, b) => a.start - b.start)[0];
  const gap = +((next ? next.start : totalDuration(tl)) - me.start - 0.15).toFixed(2);
  const natural = c.assetDuration ?? estimateSpeech(vo.text);
  const setTarget = (v: number | null) => set((a, d) => {
    a.vo!.target = v == null ? null : Math.max(0.3, +v.toFixed(3));
    if (v == null) { if (a.asset) { a.rate = undefined; a.in = 0; a.duration = null; } } else fitTarget(a, d);
  }, "target");
  const need = vo.target ? rateForTarget(natural, vo.target) : null;
  return (
    <div className="card tight target">
      <div className="field-row">
        {vo.target != null ? (
          <Num k="target" label="Target length" suffix="s" value={vo.target} min={0.3} onChange={(v) => setTarget(v)} />
        ) : (
          <label>Target length <button className="sm" onClick={() => setTarget(me.duration)}>Lock current length ({me.duration.toFixed(2)}s)</button></label>
        )}
      </div>
      <div className="btn-row">
        {gap > 0.3 && <button className="sm" onClick={() => setTarget(gap)} title="Fill the time until the next voiceover line (or the end), minus a breath">Fill until {next ? "next line" : "end"} ({gap.toFixed(2)}s)</button>}
        {vo.target != null && <button className="sm" onClick={() => setTarget(null)}>Clear target</button>}
      </div>
      <p className="panel-note">
        {c.asset ? `Take reads in ${natural.toFixed(2)}s at natural speed.` : `Estimated read: ~${natural.toFixed(1)}s.`}
        {need != null && ` Target needs ${Math.round(need * 100)}% speed${need < RATE_MIN || need > RATE_MAX ? " (out of range; edit the text)" : need < 0.8 || need > 1.25 ? " (noticeable; consider rewording)" : ""}.`}
        {" "}Generating paces the read toward the target (Gemini has no length parameter, so the pace goes in the delivery style, with one retry if it misses){tl.voice.snapToTarget !== false ? ", then a small time-stretch lands it exactly" : ""}. Drag the clip's edges in Retime mode to set it by eye.
      </p>
    </div>
  );
}

function TrackInspector({ track }: { track: AudioTrack }) {
  const set = (fn: (t: AudioTrack) => void, f: string) => edit((d) => { const t = d.tracks.find((x) => x.id === track.id); if (t) fn(t); }, `${track.id}:${f}`);
  return (
    <div className="inspector">
      <h3>{track.name} <span>{track.clips.length} clips</span></h3>
      <label>Name <input value={track.name} onChange={(e) => set((t) => { t.name = e.target.value; }, "name")} /></label>
      <Num k="gain" label="Track gain" suffix="dB" digits={1} step={0.5} value={track.gain} min={-60} max={24} onChange={(v) => set((t) => { t.gain = v; }, "gain")} />
      <label className="chk"><input type="checkbox" checked={track.mute} onChange={(e) => set((t) => { t.mute = e.target.checked; }, "mute")} /> Mute</label>
      <label className="chk"><input type="checkbox" checked={track.solo} onChange={(e) => set((t) => { t.solo = e.target.checked; }, "solo")} /> Solo</label>
      {track.kind !== "vo" && (
        <div className="card tight">
          <label className="chk">
            <input type="checkbox" checked={!!track.duck?.enabled} onChange={(e) => set((t) => { t.duck = { amount: -12, attack: 0.25, release: 0.6, ...(t.duck || {}), enabled: e.target.checked }; }, "duck")} />
            Duck under voiceover
          </label>
          {track.duck?.enabled && (
            <div className="grid2">
              <Num k="amt" label="Depth" suffix="dB" digits={1} step={1} value={track.duck.amount} min={-40} max={0} onChange={(v) => set((t) => { t.duck!.amount = v; }, "amt")} />
              <Num k="att" label="Attack" suffix="s" value={track.duck.attack} min={0} max={3} onChange={(v) => set((t) => { t.duck!.attack = v; }, "att")} />
              <Num k="rel" label="Release" suffix="s" value={track.duck.release} min={0} max={5} onChange={(v) => set((t) => { t.duck!.release = v; }, "rel")} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectInspector({ tl }: { tl: Timeline }) {
  const manifest = useStore((s) => s.manifest);
  const total = totalDuration(tl);
  const issues = lint(tl, manifest);
  const dir = useStore((s) => s.projects.find((p) => p.name === s.project)?.dir);
  return (
    <div className="inspector">
      <h3>{tl.name} <span>{total.toFixed(2)}s · {tl.clips.length} clips · {tl.fps} fps</span></h3>
      <Num k="master" label="Master gain" suffix="dB" digits={1} step={0.5} value={tl.master.gain} min={-40} max={12} onChange={(v) => edit((d) => { d.master.gain = v; }, "master")} />
      <label>Title <input value={tl.name} onChange={(e) => { const v = e.target.value; edit((d) => { d.name = v; }, "name"); }} /></label>
      <p className="panel-note">
        Film: <code>{tl.film}</code> · {manifest ? `${manifest.scenes.length} scenes, ${manifest.width}×${manifest.height}` : "loading…"}.
        Select a clip, a voiceover line or a track header to edit it.
      </p>
      {issues.length > 0 && (
        <div className="card tight issues">
          <b style={{ background: "none", padding: 0, fontSize: 12 }}>{issues.length} to check</b>
          {issues.slice(0, 12).map((i, k) => <div key={k} className={`lvl-${i.level}`}><b>{i.level}</b><span>{i.where}: {i.msg}</span></div>)}
        </div>
      )}
      <div className="card tight keys">
        <b>Keys</b>
        <span><kbd>Space</kbd> play</span><span><kbd>←</kbd><kbd>→</kbd> frame</span><span><kbd>⇧←</kbd><kbd>⇧→</kbd> 1 s</span>
        <span><kbd>S</kbd> split</span><span><kbd>H</kbd> hold</span><span><kbd>V</kbd> VO line</span><span><kbd>R</kbd>/<kbd>T</kbd> retime / trim</span>
        <span><kbd>P</kbd> prompt an agent</span><span><kbd>⌫</kbd> delete</span><span><kbd>⌘D</kbd> duplicate</span><span><kbd>⌘Z</kbd> undo</span><span><kbd>Z</kbd> fit</span><span><kbd>[</kbd><kbd>]</kbd> panels</span><span><kbd>⌥</kbd>-drag no snap</span>
      </div>
      <div className="btn-row">
        <PromptButton target={{ kind: "project" }} className="" label="✎ Prompt an agent about the film…" />
        <PromptButton target={() => ({ kind: "frame", t: playhead.get() })} className="" label="✎ …about this frame" />
      </div>
      <div className="btn-row">
        <button onClick={() => setState({ saveTplOpen: true })} title="Save this film's look (scenes, styles, cut) as a template for new projects; no audio">Save as template…</button>
      </div>
      <button onClick={() => setState({ exportOpen: true })} className="primary">Export MP4…</button>
      <div className="card tight">
        <b style={{ fontSize: 12 }}>Project folder</b>
        <code className="path" title={dir}>{dir || "…"}</code>
        <div className="btn-row">
          <button className="sm" onClick={() => api.revealProject(getState().project!)}>Show in Finder</button>
          <button className="sm" disabled={!dir} onClick={() => { if (dir) navigator.clipboard.writeText(dir).then(() => toast(`Copied ${dir}`), () => prompt("Project folder:", dir)); }}>Copy path</button>
        </div>
        <p className="panel-note">Edits save to <code>timeline.json</code> automatically; the last 40 saves are in <code>.history/</code>. <code>AGENTS.md</code> there explains the project to agents.</p>
      </div>
    </div>
  );
}

function Notes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <label>Notes <textarea rows={2} value={value} placeholder="Direction for the next design pass…" onChange={(e) => onChange(e.target.value)} /></label>;
}
