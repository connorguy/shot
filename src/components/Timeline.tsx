import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  RATE_MAX, RATE_MIN, audioStart, clipStarts, rateOf, resolveAudio, setRate, sourceAt, speedOf, stretchedLength, totalDuration,
  type AudioClip, type AudioTrack, type Timeline as TL, type VideoClip,
} from "../../shared/timeline.ts";
import {
  MIN_DUR, addAsset, addHold, addVoLine, deleteSelection, findAudio, insertScene, moveClips, placeAudio, splitAt,
} from "../lib/actions.ts";
import { api, fileUrl } from "../lib/api.ts";
import { drag, snapTo } from "../lib/drag.ts";
import { playhead, usePlayhead } from "../lib/playhead.ts";
import { beginGesture, cancelGesture, edit, endGesture, getState, setState, toast, useStore } from "../lib/store.ts";
import * as transport from "../lib/transport.ts";
import { Waveform } from "./Waveform.tsx";

const HEAD_W = 164;
const VIDEO_H = 72;
const THUMB_W = Math.round(((VIDEO_H - 4) * 16) / 9);
const SNAP_PX = 8;

export function Timeline() {
  const tl = useStore((s) => s.timeline);
  const pps = useStore((s) => s.zoom);
  const scroller = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(800);
  const [snapLine, setSnapLine] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ctrl/cmd + wheel (or pinch) zooms around the pointer
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const cur = getState().zoom;
      const t = (el.scrollLeft + px) / cur;
      const next = Math.min(1200, Math.max(8, cur * Math.exp(-e.deltaY * 0.01)));
      setState({ zoom: next });
      requestAnimationFrame(() => { el.scrollLeft = t * next - px; });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onFit = () => {
      const el = scroller.current, t = getState().timeline;
      if (el && t) setState({ zoom: Math.max(8, (el.clientWidth - 48) / Math.max(1, totalDuration(t))) });
    };
    window.addEventListener("studio:fit", onFit);
    return () => window.removeEventListener("studio:fit", onFit);
  }, []);

  if (!tl) return <div className="timeline" />;
  const total = totalDuration(tl);
  const width = Math.max(total * pps + 320, viewW);
  const fit = () => window.dispatchEvent(new Event("studio:fit"));
  const x2t = (clientX: number) => {
    const el = scroller.current!;
    return (clientX - el.getBoundingClientRect().left + el.scrollLeft) / pps;
  };
  const env: Env = { tl, pps, x2t, setSnapLine };

  return (
    <div className="timeline">
      <Toolbar onFit={fit} />
      <div className="tl-body">
        <div className="tl-heads" style={{ width: HEAD_W }}>
          <div className="tl-head ruler-head" />
          <div className="tl-head" style={{ height: VIDEO_H }}><span className="tname">Picture</span></div>
          {tl.tracks.map((t) => <TrackHead key={t.id} track={t} height={laneLayout(tl, t).height} />)}
        </div>
        <div className="tl-scroll" ref={scroller}>
          <div className="tl-canvas" style={{ width }}>
            <Ruler total={total} pps={pps} width={width} x2t={x2t} />
            <VideoRow env={env} />
            {tl.tracks.map((t) => <AudioRow key={t.id} env={env} track={t} />)}
            <PlayheadLine pps={pps} scroller={scroller} />
            <div className="tl-end" style={{ left: total * pps }} />
            {snapLine != null && <div className="snapline" style={{ left: snapLine * pps }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

interface Env { tl: TL; pps: number; x2t: (x: number) => number; setSnapLine: (t: number | null) => void }

/** Overlapping clips on a track stack into lanes; the row grows so each lane stays readable. */
function laneLayout(tl: TL, track: AudioTrack) {
  const lane = new Map<string, number>();
  const overlap = new Set<string>();
  const ends: number[] = [];
  const rows = resolveAudio(tl).filter((r) => r.track.id === track.id).sort((a, b) => a.start - b.start);
  for (const r of rows) {
    let l = ends.findIndex((e) => e <= r.start + 1e-3);
    if (l < 0) { l = ends.length; ends.push(0); }
    if (l > 0) overlap.add(r.clip.id);
    ends[l] = r.end;
    lane.set(r.clip.id, l);
  }
  const lanes = Math.max(1, ends.length);
  const height = lanes === 1 ? 46 : 8 + lanes * 24;
  return { lane, overlap, lanes, height, laneH: (height - 8) / lanes };
}

function Toolbar({ onFit }: { onFit: () => void }) {
  const tool = useStore((s) => s.tool);
  const snap = useStore((s) => s.snap);
  const zoom = useStore((s) => s.zoom);
  const sel = useStore((s) => s.sel);
  return (
    <div className="tl-toolbar">
      <div className="seg" role="group" aria-label="Edge tool">
        <button className={tool === "retime" ? "on" : ""} onClick={() => setState({ tool: "retime" })} title="Edge drags change speed: picture clips (right edge) and voiceover lines (either edge, pitch kept) (R)">Retime</button>
        <button className={tool === "trim" ? "on" : ""} onClick={() => setState({ tool: "trim" })} title="Edge drags trim: picture clips and voiceover lines keep their speed (T)">Trim</button>
      </div>
      <button onClick={() => splitAt()} title="Split the clip under the playhead (S)">Split</button>
      <button onClick={() => addHold(1)} title="Insert a 1 s freeze frame at the playhead (H)">Hold</button>
      <button onClick={() => addVoLine()} title="New voiceover line at the playhead (V)">+ VO line</button>
      <button onClick={deleteSelection} disabled={!sel || sel.kind === "track"} title="Ripple delete (⌫)">Delete</button>
      <label className="chk" title="Snap to clip edges, voiceover and the playhead (hold ⌥ to bypass)">
        <input type="checkbox" checked={snap} onChange={(e) => setState({ snap: e.target.checked })} /> Snap
      </label>
      <div className="grow" />
      <span className="hint">⌘-scroll to zoom</span>
      <input type="range" min={8} max={600} value={Math.min(600, zoom)} onChange={(e) => setState({ zoom: +e.target.value })} aria-label="Zoom" />
      <button onClick={onFit} title="Fit timeline to window (Z)">Fit</button>
    </div>
  );
}

function TrackHead({ track, height }: { track: AudioTrack; height: number }) {
  const sel = useStore((s) => s.sel);
  const active = sel?.kind === "track" && sel.id === track.id;
  const set = (patch: Partial<AudioTrack>) => edit((tl) => { Object.assign(tl.tracks.find((t) => t.id === track.id)!, patch); });
  return (
    <div className={`tl-head kind-${track.kind} ${active ? "sel" : ""}`} style={{ height }} onClick={() => setState({ sel: { kind: "track", id: track.id } })}>
      <span className="tname">{track.name}</span>
      <span className="tbtns" onClick={(e) => e.stopPropagation()}>
        <button className={track.mute ? "on mute" : ""} onClick={() => set({ mute: !track.mute })} title="Mute">M</button>
        <button className={track.solo ? "on solo" : ""} onClick={() => set({ solo: !track.solo })} title="Solo">S</button>
        {track.duck && (
          <button className={track.duck.enabled ? "on" : ""} title="Duck under voiceover" onClick={() => set({ duck: { ...track.duck!, enabled: !track.duck!.enabled } })}>D</button>
        )}
      </span>
    </div>
  );
}

function Ruler({ total, pps, width, x2t }: { total: number; pps: number; width: number; x2t: (x: number) => number }) {
  const steps = [1 / 30, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
  const major = steps.find((s) => s * pps >= 64) || 60;
  const minor = major / (major >= 1 ? 4 : 5);
  const ticks: React.ReactNode[] = [];
  const end = width / pps;
  for (let i = 0; i * minor <= end; i++) {
    const t = i * minor;
    const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
    ticks.push(
      <div key={i} className={`tick ${isMajor ? "major" : ""} ${t > total ? "past" : ""}`} style={{ left: t * pps }}>
        {isMajor && <span>{major < 1 ? t.toFixed(major < 0.25 ? 2 : 1) : `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`}</span>}
      </div>,
    );
  }
  const onDown = (e: React.PointerEvent) => {
    transport.seek(x2t(e.clientX));
    drag(e, { move: ({ ev }) => transport.seek(x2t(ev.clientX)) }, 0);
  };
  return <div className="ruler" onPointerDown={onDown}>{ticks}</div>;
}

function PlayheadLine({ pps, scroller }: { pps: number; scroller: React.RefObject<HTMLDivElement | null> }) {
  const t = usePlayhead();
  const playing = useStore((s) => s.playing);
  useEffect(() => {
    const el = scroller.current;
    if (!el || !playing) return;
    const x = t * pps;
    if (x > el.scrollLeft + el.clientWidth - 60 || x < el.scrollLeft) el.scrollLeft = Math.max(0, x - 80);
  }, [t, pps, playing, scroller]);
  return <div className="playhead" style={{ transform: `translateX(${t * pps}px)` }}><i /></div>;
}

// ───────── picture row ─────────

function VideoRow({ env }: { env: Env }) {
  const { tl, pps, x2t } = env;
  const sel = useStore((s) => s.sel);
  const manifest = useStore((s) => s.manifest);
  const [reorder, setReorder] = useState<{ ids: string[]; dx: number; target: number } | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const starts = clipStarts(tl);
  const total = totalDuration(tl);
  const selIds = sel?.kind === "clip" ? sel.ids : [];

  const targetIndex = (t: number, exclude: string[]) => {
    for (let i = 0; i < tl.clips.length; i++) {
      if (exclude.includes(tl.clips[i].id)) continue;
      if (starts[i] + tl.clips[i].duration / 2 > t) return i;
    }
    return tl.clips.length;
  };
  const boundaryX = (i: number) => (i >= tl.clips.length ? total : starts[i]) * pps;

  const onClipDown = (e: React.PointerEvent, c: VideoClip) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const ids = e.shiftKey ? [...new Set([...selIds, c.id])] : selIds.includes(c.id) ? selIds : [c.id];
    setState({ sel: { kind: "clip", ids } });
    drag(e, {
      move: ({ dx, ev }) => setReorder({ ids, dx, target: targetIndex(x2t(ev.clientX), ids) }),
      up: ({ moved, ev }) => {
        setReorder(null);
        if (!moved) { if (!e.shiftKey && !selIds.includes(c.id)) setState({ sel: { kind: "clip", ids: [c.id] } }); return; }
        const target = targetIndex(x2t(ev.clientX), ids);
        moveClips(ids, target);
      },
      cancel: () => setReorder(null),
    });
  };

  const onEdgeDown = (e: React.PointerEvent, c: VideoClip, side: "l" | "r") => {
    e.stopPropagation();
    const tool = getState().tool;
    const i = tl.clips.findIndex((x) => x.id === c.id);
    const start = starts[i];
    const sp = speedOf(c);
    const scene = manifest?.scenes.find((s) => s.id === c.scene);
    // snap targets that do not move while this clip changes length
    const targets = [playhead.get(), ...starts.slice(0, i + 1)];
    for (const r of resolveAudio(tl)) {
      const ai = r.clip.anchor ? tl.clips.findIndex((v) => v.id === r.clip.anchor!.clip) : -1;
      if (!r.clip.anchor || ai <= i) targets.push(r.start, r.end);
    }
    setState({ sel: { kind: "clip", ids: [c.id] } });
    beginGesture();
    drag(e, {
      move: ({ dx, ev }) => {
        const d = dx / pps;
        let snapped: number | null = null;
        edit((d2) => {
          const k = d2.clips.find((x) => x.id === c.id)!;
          if (side === "r" && (tool === "retime" || sp === 0)) {
            let end = start + Math.max(MIN_DUR, c.duration + d);
            if (getState().snap && !ev.altKey) { snapped = snapTo(end, targets, SNAP_PX / pps); if (snapped != null && snapped > start + MIN_DUR) end = snapped; else snapped = null; }
            k.duration = +(end - start).toFixed(4);
          } else if (side === "r") {
            let end = start + c.duration + d;
            if (getState().snap && !ev.altKey) { snapped = snapTo(end, targets, SNAP_PX / pps); if (snapped != null) end = snapped; }
            const out = Math.min(scene ? scene.end : Infinity, Math.max(c.in + MIN_DUR * sp, c.in + (end - start) * sp));
            k.out = +out.toFixed(4);
            k.duration = +((k.out - k.in) / sp).toFixed(4);
          } else {
            // left edge (trim): move the in point; clip start stays put (ripple)
            const newIn = Math.max(scene ? scene.start : -Infinity, Math.min(c.out - MIN_DUR * sp, c.in + d * sp));
            k.in = +newIn.toFixed(4);
            k.duration = +((k.out - k.in) / sp).toFixed(4);
          }
        });
        env.setSnapLine(snapped);
      },
      up: () => { env.setSnapLine(null); endGesture(); },
      cancel: () => { env.setSnapLine(null); cancelGesture(); },
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("text/x-scene")) return;
    e.preventDefault();
    setDropAt(targetIndex(x2t(e.clientX), []));
  };
  const onDrop = (e: React.DragEvent) => {
    const scene = e.dataTransfer.getData("text/x-scene");
    setDropAt(null);
    if (scene) { e.preventDefault(); insertScene(scene, targetIndex(x2t(e.clientX), [])); return; }
    dropFiles(e, "music", x2t(e.clientX));
  };

  return (
    <div
      className="row video-row"
      style={{ height: VIDEO_H }}
      onPointerDown={(e) => { if (e.button === 0) { setState({ sel: null }); transport.seek(x2t(e.clientX)); } }}
      onDragOver={onDragOver}
      onDragLeave={() => setDropAt(null)}
      onDrop={onDrop}
    >
      {tl.clips.map((c, i) => {
        const dragging = reorder?.ids.includes(c.id);
        const missing = manifest && !manifest.scenes.some((s) => s.id === c.scene);
        return (
          <VideoClipView
            key={c.id}
            clip={c}
            left={starts[i] * pps}
            width={c.duration * pps}
            selected={selIds.includes(c.id)}
            missing={!!missing}
            style={dragging ? { transform: `translateX(${reorder!.dx}px)`, zIndex: 20, opacity: 0.85 } : undefined}
            onDown={(e) => onClipDown(e, c)}
            onEdge={(e, side) => onEdgeDown(e, c, side)}
          />
        );
      })}
      {reorder && <div className="insert-marker" style={{ left: boundaryX(reorder.target) }} />}
      {dropAt != null && <div className="insert-marker" style={{ left: boundaryX(dropAt) }} />}
    </div>
  );
}

function VideoClipView(props: {
  clip: VideoClip; left: number; width: number; selected: boolean; missing: boolean; style?: React.CSSProperties;
  onDown: (e: React.PointerEvent) => void; onEdge: (e: React.PointerEvent, side: "l" | "r") => void;
}) {
  const { clip: c, left, width, selected, missing } = props;
  const project = useStore((s) => s.project)!;
  const film = useStore((s) => s.timeline!.film);
  const version = useStore((s) => s.filmVersion);
  const tool = useStore((s) => s.tool);
  const manifest = useStore((s) => s.manifest);
  const scene = manifest?.scenes.find((s) => s.id === c.scene);
  const sp = speedOf(c);
  const n = Math.max(1, Math.min(40, Math.ceil(width / THUMB_W)));
  const thumbs = width > 24 && !missing
    ? Array.from({ length: n }, (_, k) => {
        const t = Math.round(sourceAt(c, (k + 0.5) / n) * 20) / 20;
        return <img key={k} src={api.thumbUrl(project, film, version, c.scene, t)} style={{ left: k * THUMB_W, width: THUMB_W }} alt="" draggable={false} loading="lazy" />;
      })
    : null;
  const beats = (scene?.beats || []).filter((b) => b.t > c.in && b.t < c.out);
  const pct = Math.round(sp * 100);
  return (
    <div
      className={`vclip ${selected ? "sel" : ""} ${missing ? "missing" : ""} ${sp === 0 ? "hold" : ""}`}
      style={{ left, width, ...props.style }}
      onPointerDown={props.onDown}
      title={`${scene?.label || c.scene} · ${c.duration.toFixed(2)}s · source ${c.in.toFixed(2)}–${c.out.toFixed(2)}`}
    >
      <div className="strip">{thumbs}</div>
      {beats.map((b) => <i key={b.t} className="beat" style={{ left: ((b.t - c.in) / (c.out - c.in)) * width }} title={b.label} />)}
      {(c.xfade || 0) > 0 && <i className="xfade" style={{ width: (c.xfade || 0) * (width / c.duration) }} />}
      {width > 34 && (
        <div className="vlabel">
          <b>{c.label || scene?.label || c.scene}</b>
          {sp === 0 ? <em>hold</em> : pct !== 100 ? <em className={pct < 100 ? "slow" : "fast"}>{pct}%</em> : null}
        </div>
      )}
      {width > 60 && <div className="vdur">{c.duration.toFixed(2)}s</div>}
      {tool === "trim" && sp > 0 && <span className="edge l" onPointerDown={(e) => props.onEdge(e, "l")} />}
      <span className="edge r" onPointerDown={(e) => props.onEdge(e, "r")} />
    </div>
  );
}

// ───────── audio rows ─────────

function AudioRow({ env, track }: { env: Env; track: AudioTrack }) {
  const { tl, pps, x2t } = env;
  const sel = useStore((s) => s.sel);
  const busy = useStore((s) => s.busy);
  const project = useStore((s) => s.project)!;
  const starts = clipStarts(tl);
  const total = totalDuration(tl);
  const resolved = new Map(resolveAudio(tl).map((r) => [r.clip.id, r]));
  const [over, setOver] = useState(false);
  const { lane, overlap, lanes, height, laneH } = laneLayout(tl, track);

  const snapTargets = (excludeId: string) => {
    const pts = [playhead.get(), total, ...starts];
    for (const r of resolveAudio(tl)) if (r.clip.id !== excludeId) pts.push(r.start, r.end);
    return pts;
  };

  const onDown = (e: React.PointerEvent, c: AudioClip, mode: "move" | "l" | "r") => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setState({ sel: { kind: "audio", id: c.id } });
    const s0 = audioStart(tl, c, starts);
    const dur0 = resolved.get(c.id)!.duration;
    const anchored = !!c.anchor; // unpinned clips (music by default) keep absolute time
    const targets = snapTargets(c.id);
    // edge drags: voiceover follows the Retime/Trim tool (retime = change speed, pitch kept); music/SFX trim.
    // ⇧ at pointer-down flips it, so music can be stretched too.
    const stretch = mode !== "move" && !!c.asset && ((track.kind === "vo" && getState().tool === "retime") !== e.shiftKey);
    const r0 = rateOf(c);
    const slot = mode !== "move" && !c.asset && !!c.vo; // VO line without audio yet: edges set its target length
    beginGesture();
    drag(e, {
      move: ({ dx, ev }) => {
        const d = dx / pps;
        const tol = getState().snap && !ev.altKey ? SNAP_PX / pps : 0;
        let snapped: number | null = null;
        edit((d2) => {
          const f = findAudio(d2, c.id);
          if (!f) return;
          const k = f.clip;
          if (slot) {
            let len = mode === "r" ? dur0 + d : dur0 - d;
            const edge = mode === "r" ? s0 + len : s0 + dur0 - len;
            const sn = snapTo(edge, targets, tol);
            if (sn != null) { len = mode === "r" ? sn - s0 : s0 + dur0 - sn; snapped = sn; }
            len = Math.max(0.3, len);
            k.vo!.target = +len.toFixed(3);
            if (mode === "l") placeAudio(d2, k, s0 + dur0 - len, anchored);
          } else if (stretch) {
            // new length -> new rate; trim scales with it so the same words stay in
            let len = mode === "r" ? dur0 + d : dur0 - d;
            const edge = mode === "r" ? s0 + len : s0 + dur0 - len;
            const sn = snapTo(edge, targets, tol);
            if (sn != null) { len = mode === "r" ? sn - s0 : s0 + dur0 - sn; snapped = sn; }
            const r1 = Math.min(RATE_MAX, Math.max(RATE_MIN, r0 * dur0 / Math.max(0.05, len)));
            k.rate = c.rate; k.in = c.in; k.duration = c.duration;
            setRate(k, r1);
            const real = dur0 * r0 / r1;
            if (snapped != null && Math.abs(real - len) > 0.01) snapped = null; // clamped: not on the snap point
            if (mode === "l") placeAudio(d2, k, s0 + dur0 - real, anchored);
            // a whole take dragged to a length becomes the line's target, so new takes land on it too
            if (k.vo) k.vo.target = c.in === 0 && c.duration == null ? +real.toFixed(3) : null;
          } else if (mode === "move") {
            let ns = Math.max(0, s0 + d);
            const a = snapTo(ns, targets, tol), b = snapTo(ns + dur0, targets, tol);
            if (a != null && (b == null || Math.abs(a - ns) <= Math.abs(b - ns - dur0))) { ns = a; snapped = a; }
            else if (b != null) { ns = b - dur0; snapped = b; }
            placeAudio(d2, k, ns, anchored);
          } else if (mode === "l") {
            const maxShift = dur0 - 0.05;
            let shift = Math.min(maxShift, Math.max(-c.in, d));
            const sn = snapTo(s0 + shift, targets, tol);
            if (sn != null) { shift = Math.min(maxShift, Math.max(-c.in, sn - s0)); snapped = s0 + shift; }
            k.in = +(c.in + shift).toFixed(4);
            k.duration = +(dur0 - shift).toFixed(4);
            placeAudio(d2, k, s0 + shift, anchored);
            if (k.vo) k.vo.target = null; // trimmed by hand: no longer "the whole line in N seconds"
          } else {
            const full = stretchedLength(c);
            const max = full != null ? full - c.in : Infinity;
            let end = s0 + Math.min(max, Math.max(0.05, dur0 + d));
            const sn = snapTo(end, targets, tol);
            if (sn != null && sn - s0 <= max && sn - s0 >= 0.05) { end = sn; snapped = sn; }
            k.duration = +(end - s0).toFixed(4);
            if (k.vo) k.vo.target = null;
          }
        });
        env.setSnapLine(snapped);
      },
      up: () => { env.setSnapLine(null); endGesture(); },
      cancel: () => { env.setSnapLine(null); cancelGesture(); },
    });
  };

  return (
    <div
      className={`row audio-row kind-${track.kind} ${track.mute ? "muted" : ""} ${over ? "over" : ""}`}
      style={{ height }}
      onPointerDown={(e) => { if (e.button === 0) { setState({ sel: null }); transport.seek(x2t(e.clientX)); } }}
      onDoubleClick={(e) => { if (track.kind === "vo") addVoLine(x2t(e.clientX)); }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes("text/x-asset")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const asset = e.dataTransfer.getData("text/x-asset");
        if (asset) { e.preventDefault(); const [path, dur] = asset.split("|"); addAsset(track.kind, path, dur ? +dur : null, x2t(e.clientX)); return; }
        dropFiles(e, track.kind, x2t(e.clientX));
      }}
    >
      {track.clips.map((c) => {
        const r = resolved.get(c.id)!;
        const left = r.start * pps, width = Math.max(4, r.duration * pps);
        const isSel = sel?.kind === "audio" && sel.id === c.id;
        const text = c.vo ? c.vo.text : c.label || c.asset?.split("/").pop();
        const fi = Math.min(c.fadeIn, r.duration / 2) * pps, fo = Math.min(c.fadeOut, r.duration / 2) * pps;
        return (
          <div
            key={c.id}
            className={`aclip ${isSel ? "sel" : ""} ${r.placeholder ? "placeholder" : ""} ${busy[c.id] ? "busy" : ""} ${r.end > total + 0.01 ? "overrun" : ""} ${overlap.has(c.id) && track.kind === "vo" ? "overlap" : ""}`}
            style={{ left, width, top: 4 + lane.get(c.id)! * laneH, height: laneH - (lanes > 1 ? 1 : 0), bottom: "auto" }}
            onPointerDown={(e) => onDown(e, c, "move")}
            onDoubleClick={(e) => { e.stopPropagation(); setState({ sel: { kind: "audio", id: c.id }, panel: c.vo ? "script" : getState().panel }); }}
            title={`${text}\n${r.start.toFixed(2)}s → ${r.end.toFixed(2)}s${rateOf(c) !== 1 ? ` · ${Math.round(rateOf(c) * 100)}% speed` : ""}${c.anchor ? " · follows picture" : ""}${overlap.has(c.id) ? "\nOverlaps another clip on this track" : ""}\n${track.kind === "vo" ? "Drag an edge: Retime tool changes speed, Trim tool cuts (⇧ swaps)" : "Drag an edge to trim (⇧-drag changes speed)"}`}
          >
            {c.asset && <Waveform url={fileUrl(project, c.asset)} from={c.in * rateOf(c)} duration={r.duration * rateOf(c)} width={width} />}
            {fi > 1 && <i className="fade in" style={{ width: fi }} />}
            {fo > 1 && <i className="fade out" style={{ width: fo }} />}
            <span className="alabel">
              {c.anchor && <b className="pin" title="Follows its scene">⚲</b>}
              {rateOf(c) !== 1 && <em className={`rate ${rateOf(c) > 1 ? "fast" : "slow"}`} title="Playback speed (pitch kept)">{Math.round(rateOf(c) * 100)}%</em>}
              {c.vo?.target ? <em className="rate target" title={`Target length ${c.vo.target.toFixed(2)}s: takes are fitted to it`}>⇥ {c.vo.target.toFixed(1)}s</em> : null}
              {busy[c.id] || text}
            </span>
            {(!r.placeholder || c.vo) && <span className="edge l" onPointerDown={(e) => onDown(e, c, "l")} />}
            {(!r.placeholder || c.vo) && <span className="edge r" onPointerDown={(e) => onDown(e, c, "r")} />}
          </div>
        );
      })}
    </div>
  );
}

async function dropFiles(e: React.DragEvent, kind: "vo" | "music" | "sfx", at: number) {
  const files = [...e.dataTransfer.files].filter((f) => /^audio\//.test(f.type) || /\.(wav|mp3|m4a|aac|ogg|flac|aiff?)$/i.test(f.name));
  if (!files.length) return;
  e.preventDefault();
  const project = getState().project;
  if (!project) return;
  const k = kind === "vo" ? "sfx" : kind;
  for (const f of files) {
    try {
      const r = await api.upload(project, k, f);
      addAsset(k, r.asset, r.duration, at, f.name);
      setState((s) => ({ assetsVersion: s.assetsVersion + 1 }));
    } catch (err: any) {
      toast(err.message, "error");
    }
  }
}
