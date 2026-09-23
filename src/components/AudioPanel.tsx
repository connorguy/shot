import { useEffect, useMemo, useState } from "react";
import { MUSIC_MODELS, musicPrompt, structureFor, totalDuration } from "../../shared/timeline.ts";
import { audit } from "../audio/engine.ts";
import { addAsset } from "../lib/actions.ts";
import { api, fileUrl, type Asset } from "../lib/api.ts";
import { getState, setState, toast, useStore } from "../lib/store.ts";

function MusicGen() {
  const tl = useStore((s) => s.timeline)!;
  const manifest = useStore((s) => s.manifest);
  const status = useStore((s) => s.status);
  const [mood, setMood] = useState("Minimal, confident modern electronic. Warm analog synth pulse, soft kick that enters around the first reveal, builds through the middle, resolves to a clean, optimistic finish on the logo. No vocals.");
  const [model, setModel] = useState<string>(MUSIC_MODELS[0]);
  const [useStructure, setUseStructure] = useState(true);
  const [structure, setStructure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = totalDuration(tl);
  const autoStructure = useMemo(() => structureFor(tl, manifest), [tl, manifest]);
  const struct = structure ?? autoStructure;
  const prompt = musicPrompt(mood, total, useStructure && model !== "lyria-3-clip-preview" ? struct : null);

  const go = async () => {
    const { project } = getState();
    if (!project) return;
    setBusy(true);
    try {
      const r = await api.music(project, { prompt, model, name: "lyria" });
      addAsset("music", r.asset, r.duration, 0, `Lyria · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
      setState((s) => ({ assetsVersion: s.assetsVersion + 1 }));
      toast("Music added to the Music track at 0:00.");
    } catch (e: any) {
      toast(e.message, "error");
    } finally { setBusy(false); }
  };

  return (
    <div className="card">
      <h4>Generate music · Lyria</h4>
      <label>Mood and arrangement <textarea rows={4} value={mood} onChange={(e) => setMood(e.target.value)} /></label>
      <div className="field-row">
        <label>Model
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="lyria-3.5">Lyria 3.5 (full length, follows timing)</option>
            <option value="lyria-3-clip-preview">Lyria 3 Clip (30 s loop)</option>
          </select>
        </label>
      </div>
      {model !== "lyria-3-clip-preview" && (
        <>
          <label className="chk"><input type="checkbox" checked={useStructure} onChange={(e) => setUseStructure(e.target.checked)} /> Time sections to the current cut</label>
          {useStructure && (
            <label>Section map <span className="sub">(edit freely; <button className="link" onClick={() => setStructure(null)}>reset from timeline</button>)</span>
              <textarea rows={Math.min(10, struct.split("\n").length + 1)} className="mono" value={struct} onChange={(e) => setStructure(e.target.value)} />
            </label>
          )}
        </>
      )}
      <button className="primary" disabled={busy || !status?.gemini} onClick={go}>{busy ? "Composing… (can take a minute)" : "Generate track"}</button>
      {status && !status.gemini && <p className="warn">Needs Gemini credentials: <code>gcloud auth application-default login</code> or <code>GEMINI_API_KEY</code> in <code>shot/.env</code>. You can still drop in your own tracks below.</p>}
      {status?.auth.mode === "adc" && status.auth.backend === "agent-platform" && <p className="panel-note">Using Agent Platform: Lyria 3.5 maps to <code>lyria-3-pro-preview</code>.</p>}
    </div>
  );
}

function Library() {
  const project = useStore((s) => s.project)!;
  const v = useStore((s) => s.assetsVersion);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [kind, setKind] = useState<"music" | "sfx">("music");
  useEffect(() => { api.assets(project).then(setAssets).catch(() => setAssets([])); }, [project, v]);

  const upload = async (files: FileList | null) => {
    for (const f of [...(files || [])]) {
      try {
        const r = await api.upload(project, kind, f);
        addAsset(kind, r.asset, r.duration, kind === "music" ? 0 : undefined, f.name);
      } catch (e: any) { toast(e.message, "error"); }
    }
    setState((s) => ({ assetsVersion: s.assetsVersion + 1 }));
  };

  const shown = assets.filter((a) => a.kind !== "vo");
  return (
    <div className="card">
      <h4>Your audio</h4>
      <div className="field-row">
        <label className="file-btn">Upload…<input type="file" accept="audio/*" multiple onChange={(e) => upload(e.target.files)} /></label>
        <label>as
          <select value={kind} onChange={(e) => setKind(e.target.value as any)}>
            <option value="music">Music (starts at 0:00)</option>
            <option value="sfx">SFX (at playhead)</option>
          </select>
        </label>
      </div>
      <p className="panel-note">Or drop audio files straight onto a track. Drag rows below onto the timeline.</p>
      <div className="assets">
        {shown.map((a) => (
          <div key={a.asset} className="asset" draggable onDragStart={(e) => e.dataTransfer.setData("text/x-asset", `${a.asset}|${a.duration ?? ""}`)}>
            <button className="icon" onClick={() => audit(fileUrl(project, a.asset))} title="Listen">▶</button>
            <span className="name" title={a.asset}>{a.asset.split("/").pop()}</span>
            <span className="dur">{a.duration ? `${a.duration.toFixed(1)}s` : ""}</span>
            <button className="sm" onClick={() => addAsset(a.kind === "music" ? "music" : "sfx", a.asset, a.duration, a.kind === "music" ? 0 : undefined)}>Add</button>
          </div>
        ))}
        {!shown.length && <p className="panel-empty">No music or SFX yet.</p>}
        {shown.length > 0 && <button className="link" onClick={() => audit(null)}>Stop preview</button>}
      </div>
    </div>
  );
}

export function AudioPanel() {
  const tl = useStore((s) => s.timeline);
  if (!tl) return null;
  return (
    <div className="audio-panel">
      <MusicGen />
      <Library />
    </div>
  );
}
