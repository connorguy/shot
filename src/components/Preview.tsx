import { useEffect, useRef, useState } from "react";
import { ensureFilmApi } from "../../shared/filmShim.ts";
import { layersAt, totalDuration, fmtTime } from "../../shared/timeline.ts";
import { fileUrl } from "../lib/api.ts";
import { playhead, usePlayhead } from "../lib/playhead.ts";
import { getState, setState, useStore } from "../lib/store.ts";
import * as transport from "../lib/transport.ts";
import { Icon } from "./Icons.tsx";

/** The film itself, in an iframe at native size (?render) scaled to fit: pixel-identical to export. */
export function Preview() {
  const project = useStore((s) => s.project);
  const film = useStore((s) => s.timeline?.film);
  const version = useStore((s) => s.filmVersion);
  const tl = useStore((s) => s.timeline);
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.4);
  const [ready, setReady] = useState(false);
  const W = tl?.width || 1920, H = tl?.height || 1080;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setScale(Math.min(r.width / W, r.height / H));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [W, H]);

  // after each (re)load, wait for the film to register its scenes
  const [loads, setLoads] = useState(0);
  useEffect(() => {
    setReady(false);
    const f = frame.current;
    if (!loads || !f) return;
    let alive = true;
    const started = performance.now();
    const poll = () => {
      if (!alive) return;
      const w = f.contentWindow as any;
      if (w && ensureFilmApi(w)) {
        try {
          setState({ manifest: w.__film.manifest(), filmError: null });
          setReady(true);
        } catch (e: any) { setState({ filmError: e.message }); }
        return;
      }
      if (performance.now() - started > 30000) { setState({ filmError: "Film never exposed window.__film. See shot/film-kit/README.md." }); return; }
      setTimeout(poll, 60);
    };
    poll();
    return () => { alive = false; };
  }, [loads]);

  // draw whenever the playhead or the timeline changes
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    const draw = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = frame.current?.contentWindow as any;
        const t = getState().timeline;
        if (!w?.__film || !t) return;
        try { w.__film.renderFrame(layersAt(t, playhead.get())); } catch (e) { console.error(e); }
      });
    };
    draw();
    const un = playhead.subscribe(draw);
    return () => { un(); cancelAnimationFrame(raf); };
  }, [ready, tl]);

  if (!project || !film) return <div className="preview-wrap" />;
  return (
    <div className="preview">
      <div className="preview-wrap" ref={wrap}>
        <div className="preview-box" style={{ width: W * scale, height: H * scale }}>
          <iframe
            ref={frame}
            title="Film preview"
            onLoad={() => setLoads((n) => n + 1)}
            src={`${fileUrl(project, film)}?render&v=${version || 0}`}
            style={{ width: W, height: H, transform: `scale(${scale})` }}
          />
        </div>
      </div>
      <Transport />
    </div>
  );
}

function Transport() {
  const t = usePlayhead();
  const tl = useStore((s) => s.timeline);
  const playing = useStore((s) => s.playing);
  const loop = useStore((s) => s.loop);
  const [frames, setFrames] = useState(false);
  if (!tl) return null;
  const end = totalDuration(tl);
  return (
    <div className={`transport ${playing ? "playing" : ""}`}>
      <div className="keys-row">
        <button className="key" title="Start (Home)" onClick={() => transport.seek(0)}><Icon name="start" /></button>
        <button className="key" title="Back one frame (←)" onClick={() => transport.step(-1)}><Icon name="prev" /></button>
        <button className="key play" title="Play / pause (Space)" onClick={transport.toggle}><Icon name={playing ? "pause" : "play"} /></button>
        <button className="key" title="Forward one frame (→)" onClick={() => transport.step(1)}><Icon name="next" /></button>
        <button className="key" title="End (End)" onClick={() => transport.seek(end)}><Icon name="end" /></button>
      </div>
      <button className="timecode" title="Toggle seconds / frames" onClick={() => setFrames(!frames)}>
        <i className="rec" />
        <b>{fmtTime(t, tl.fps, frames)}</b><span>{fmtTime(end, tl.fps, frames)}</span>
        <em>{frames ? "m:s:f" : "m:s"}</em>
      </button>
      <div className="keys-row">
        <button className={`key ${loop ? "on" : ""}`} title="Loop (L)" onClick={() => setState({ loop: !loop })}><Icon name="loop" /></button>
        <button className="key" title="Copy a prompt for an agent to change what's on screen now (P)" onClick={() => setState({ promptFor: { kind: "frame", t: playhead.get() } })}><Icon name="pencil" /></button>
      </div>
    </div>
  );
}
