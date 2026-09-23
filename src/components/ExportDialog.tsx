import { useEffect, useRef, useState } from "react";
import { resolveAudio, totalDuration } from "../../shared/timeline.ts";
import { renderMix } from "../audio/engine.ts";
import { api, fileUrl, type Job } from "../lib/api.ts";
import { getState, saveNow, setState, useStore } from "../lib/store.ts";

export function ExportDialog() {
  const open = useStore((s) => s.exportOpen);
  const tl = useStore((s) => s.timeline);
  const project = useStore((s) => s.project);
  const status = useStore((s) => s.status);
  const [draft, setDraft] = useState(true);
  const [phase, setPhase] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  if (!tl || !project) return <dialog ref={dlg} />;
  const total = totalDuration(tl);
  const placeholders = resolveAudio(tl).filter((r) => r.placeholder).length;
  const running = !!phase || job?.status === "running";

  const start = async () => {
    setErr(null); setJob(null);
    try {
      setPhase("Saving timeline…");
      await saveNow();
      setPhase("Mixing audio…");
      const mix = await renderMix(project, getState().timeline!);
      setPhase("Starting render…");
      const j = await api.export(project, mix, draft);
      setJob(j); setPhase(null);
      poll.current = setInterval(async () => {
        const next = await api.job(j.id).catch(() => null);
        if (!next) return;
        setJob(next);
        if (next.status !== "running" && poll.current) { clearInterval(poll.current); poll.current = null; }
      }, 400);
    } catch (e: any) {
      setErr(e.message); setPhase(null);
    }
  };

  const pct = job ? (job.phase === "encoding" ? 99 : Math.round((job.done / Math.max(1, job.total)) * 98)) : 0;
  const secs = job ? ((job.finishedAt || Date.now()) - job.startedAt) / 1000 : 0;
  return (
    <dialog ref={dlg} className="export" onClose={() => setState({ exportOpen: false })} onCancel={(e) => { if (running) e.preventDefault(); }}>
      <h3>Export MP4</h3>
      <p>{total.toFixed(2)}s · {Math.round(total * tl.fps)} frames · rendered frame-by-frame in headless Chrome, encoded with ffmpeg.</p>
      <div className="seg big">
        <button className={draft ? "on" : ""} disabled={running} onClick={() => setDraft(true)}>Draft<span>960×540 · fast</span></button>
        <button className={!draft ? "on" : ""} disabled={running} onClick={() => setDraft(false)}>Final<span>{tl.width}×{tl.height} · CRF 17</span></button>
      </div>
      {placeholders > 0 && <p className="warn">{placeholders} voiceover line{placeholders > 1 ? "s have" : " has"} no audio yet and will be silent.</p>}
      {status && !status.ffmpeg && <p className="warn">ffmpeg not found. Install it with <code>brew install ffmpeg</code>.</p>}
      {(phase || job) && (
        <div className="progress">
          <div className="bar"><i style={{ width: `${job?.status === "done" ? 100 : pct}%` }} /></div>
          <span>{phase || (job!.status === "running" ? `${job!.phase} · ${job!.done}/${job!.total} · ${secs.toFixed(0)}s` : job!.status === "done" ? `Done in ${secs.toFixed(1)}s` : job!.error)}</span>
        </div>
      )}
      {err && <p className="warn">{err}</p>}
      {job?.status === "error" && <p className="warn">{job.error}</p>}
      {job?.status === "done" && job.output && (
        <div className="result">
          <video src={fileUrl(project, job.output)} controls />
          <div className="btn-row">
            <a className="btn" href={fileUrl(project, job.output)} target="_blank" rel="noreferrer">Open</a>
            <button onClick={() => api.reveal(project, job.output!)}>Show in Finder</button>
            <code>{job.output}</code>
          </div>
        </div>
      )}
      <div className="btn-row end">
        {job?.status === "running" && <button onClick={() => api.cancelJob(job.id)}>Cancel render</button>}
        <button disabled={running} onClick={() => setState({ exportOpen: false })}>Close</button>
        <button className="primary" disabled={running} onClick={start}>{job?.status === "done" ? "Export again" : "Export"}</button>
      </div>
    </dialog>
  );
}
