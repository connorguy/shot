import { useEffect, useRef, useState } from "react";
import { layersAt, totalDuration } from "../../shared/timeline.ts";
import { api } from "../lib/api.ts";
import { playhead } from "../lib/playhead.ts";
import { setState, toast, useStore } from "../lib/store.ts";

/** Save the open project as a film template (templates/films/<id>): scenes, styles, assets and the cut, no audio. */
export function SaveTemplateDialog() {
  const open = useStore((s) => s.saveTplOpen);
  const project = useStore((s) => s.project);
  const tl = useStore((s) => s.timeline);
  const version = useStore((s) => s.filmVersion);
  const dlg = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cut, setCut] = useState(true);
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) {
      setErr(null); setExists(false);
      setName((n) => n || `${tl?.name || "Untitled"} style`);
      const t = playhead.get();
      setAt(t > 0.05 ? t : (tl ? totalDuration(tl) * 0.35 : 0));
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, tl]);

  if (!tl || !project) return <dialog ref={dlg} />;
  const layer = layersAt(tl, at).slice(-1)[0];

  const save = async (overwrite = false) => {
    setBusy(true); setErr(null);
    try {
      const r = await api.saveTemplate(project, { name, description: desc, at, includeCut: cut, overwrite });
      setState({ saveTplOpen: false });
      setName(""); setDesc("");
      toast(`Saved template “${name}” to templates/films/${r.id}. It's in New now.`);
    } catch (e: any) {
      setErr(e.message);
      setExists(/already exists/.test(e.message));
    } finally { setBusy(false); }
  };

  return (
    <dialog ref={dlg} className="export savetpl" onClose={() => setState({ saveTplOpen: false })}>
      <h3>Save as template</h3>
      <p>Keeps this film's scenes, styles, fonts, images and {cut ? "cut" : "default cut"}, so new projects can start from the look. Music, voiceover takes and designed voices are left out; the scenes' draft lines come back as empty voiceover slots.</p>
      {layer && <img className="cover" src={api.thumbUrl(project, tl.film, version, layer.scene, Math.round(layer.t * 20) / 20, 480)} alt="Cover frame" />}
      <label>Name <input autoFocus value={name} onChange={(e) => { setName(e.target.value); setExists(false); }} /></label>
      <label>Description <textarea rows={2} value={desc} placeholder="What the style is good for: type, colors, pacing…" onChange={(e) => setDesc(e.target.value)} /></label>
      <label className="chk"><input type="checkbox" checked={cut} onChange={(e) => setCut(e.target.checked)} /> Include this cut (clip order and timing)</label>
      <p className="panel-note">Cover: the frame at {at.toFixed(2)}s ({playhead.get() > 0.05 ? "the playhead" : "35% in"}). Move the playhead first to pick another.</p>
      {err && <p className="warn">{err}</p>}
      <div className="btn-row end">
        <button onClick={() => setState({ saveTplOpen: false })}>Cancel</button>
        {exists && <button className="danger" disabled={busy} onClick={() => save(true)}>Replace it</button>}
        <button className="primary" disabled={busy || !name.trim()} onClick={() => save(false)}>{busy ? "Saving…" : "Save template"}</button>
      </div>
    </dialog>
  );
}
