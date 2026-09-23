import { useState } from "react";
import { PREBUILT_VOICES, TTS_MODELS, estimateSpeech, fitTarget, resolveAudio, type Timeline } from "../../shared/timeline.ts";
import { audit } from "../audio/engine.ts";
import { addVoLine, applyTake, findAudio, fitPictureToVo, generateMissing, generateTake } from "../lib/actions.ts";
import { api, fileUrl } from "../lib/api.ts";
import { edit, getState, setState, toast, useStore } from "../lib/store.ts";
import * as transport from "../lib/transport.ts";

export function VoicePicker({ value, onChange, allowDefault }: { value: string | null; onChange: (v: string | null) => void; allowDefault?: boolean }) {
  const voices = useStore((s) => s.timeline?.voices || []);
  const known = value == null || PREBUILT_VOICES.some(([v]) => v === value) || voices.some((v) => v.id === value);
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "__custom" ? prompt("Voice ID (voice_… or an Extended Voice Library name)") || value : e.target.value)}>
      {allowDefault && <option value="">Project default</option>}
      {voices.length > 0 && (
        <optgroup label="Designed voices">
          {voices.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </optgroup>
      )}
      <optgroup label="Prebuilt">
        {PREBUILT_VOICES.map(([v, d]) => <option key={v} value={v}>{v} · {d}</option>)}
      </optgroup>
      {!known && <option value={value!}>{value}</option>}
      <option value="__custom">Custom voice ID…</option>
    </select>
  );
}

function VoiceSettings({ tl }: { tl: Timeline }) {
  const status = useStore((s) => s.status);
  const [design, setDesign] = useState(false);
  const set = (patch: Partial<Timeline["voice"]>) => edit((d) => { Object.assign(d.voice, patch); });
  return (
    <div className="card voice-settings">
      <div className="field-row">
        <label>Engine
          <select value={tl.voice.provider} onChange={(e) => set({ provider: e.target.value as any })}>
            <option value="gemini">Gemini 3.8 TTS{status && !status.gemini ? " (no key)" : ""}</option>
            <option value="say" disabled={status ? !status.say : false}>Draft · macOS say (free)</option>
          </select>
        </label>
        {tl.voice.provider === "gemini" && (
          <label>Model
            <select value={tl.voice.model} onChange={(e) => set({ model: e.target.value })}>
              {TTS_MODELS.map((m) => <option key={m} value={m}>{m.replace("gemini-", "")}</option>)}
            </select>
          </label>
        )}
      </div>
      {tl.voice.provider === "gemini" && (
        <>
          <label>Voice <VoicePicker value={tl.voice.voice} onChange={(v) => v && set({ voice: v })} /></label>
          <label>Default style <input value={tl.voice.style} placeholder="e.g. calm, confident, unhurried" onChange={(e) => set({ style: e.target.value })} /></label>
          <p className="panel-note">Keep style short; most lines need none. Inline tags work in the text: <code>&lt;short pause&gt;</code>, <code>&lt;breath&gt;</code>, <code>&lt;chuckle&gt;</code>. CAPS add emphasis.</p>
          <button className="link" onClick={() => setDesign(!design)}>{design ? "Close voice design" : "Design a custom voice…"}</button>
          {design && <DesignVoice onDone={() => setDesign(false)} />}
        </>
      )}
      <label className="chk" title="Takes are paced toward a line's target length when generated. With this on, the small remaining difference is closed with a pitch-preserving time-stretch.">
        <input type="checkbox" checked={tl.voice.snapToTarget !== false} onChange={(e) => {
          const on = e.target.checked;
          edit((d) => { d.voice.snapToTarget = on; for (const t of d.tracks) for (const c of t.clips) if (c.vo?.target) fitTarget(c, d); });
        }} />
        Snap takes exactly to target lengths
      </label>
      {status && !status.gemini && tl.voice.provider === "gemini" && (
        <p className="warn">No Gemini credentials. Run <code>gcloud auth application-default login</code> (ADC), or add <code>GEMINI_API_KEY</code> to <code>shot/.env</code>, then restart <code>npm run dev</code>. Meanwhile, the Draft engine blocks out timing for free.</p>
      )}
    </div>
  );
}

function DesignVoice({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("Narrator");
  const [desc, setDesc] = useState("A warm, grounded narrator with a neutral American accent. Confident and plainspoken, like a founder explaining something they care about. Unhurried pace.");
  const [busy, setB] = useState(false);
  const go = async () => {
    const { project, timeline } = getState();
    if (!project || !timeline) return;
    setB(true);
    try {
      const { voice } = await api.designVoice(project, { name, description: desc, model: timeline.voice.model });
      edit((d) => { d.voices.push(voice); d.voice.voice = voice.id; });
      if (voice.sample) audit(fileUrl(project, voice.sample));
      toast(`Voice “${name}” created and set as the project voice.`);
      onDone();
    } catch (e: any) {
      toast(e.message, "error");
    } finally { setB(false); }
  };
  return (
    <div className="design">
      <label>Name <input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Describe the voice <textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      <button className="primary" disabled={busy} onClick={go}>{busy ? "Designing…" : "Create voice"}</button>
    </div>
  );
}

export function TakeList({ clipId }: { clipId: string }) {
  const tl = useStore((s) => s.timeline)!;
  const project = useStore((s) => s.project)!;
  const f = findAudio(tl, clipId);
  if (!f?.clip.vo || !f.clip.vo.takes.length) return null;
  const vo = f.clip.vo;
  return (
    <div className="takes">
      {vo.takes.map((t, i) => (
        <div key={t.id} className={`take ${vo.take === i ? "on" : ""}`}>
          <button className="icon" title="Listen" onClick={() => audit(fileUrl(project, t.asset))}>▶</button>
          <button className="take-pick" onClick={() => edit((d) => { const g = findAudio(d, clipId); if (g) applyTake(g.clip, i, d); })} title={`${t.voice}${t.style ? ` · ${t.style}` : ""}\n“${t.text}”`}>
            Take {i + 1} <span>{t.duration.toFixed(2)}s · {t.provider === "say" ? "draft" : t.voice}{t.text !== vo.text ? " · old text" : ""}</span>
          </button>
          <button className="icon" title="Remove take" onClick={() => edit((d) => {
            const g = findAudio(d, clipId);
            if (!g?.clip.vo) return;
            g.clip.vo.takes.splice(i, 1);
            const cur = g.clip.vo.take;
            applyTake(g.clip, cur == null || cur === i ? (g.clip.vo.takes.length ? g.clip.vo.takes.length - 1 : null) : cur > i ? cur - 1 : cur, d);
          })}>×</button>
        </div>
      ))}
    </div>
  );
}

export function ScriptPanel() {
  const tl = useStore((s) => s.timeline);
  const sel = useStore((s) => s.sel);
  const busy = useStore((s) => s.busy);
  const manifest = useStore((s) => s.manifest);
  if (!tl) return null;
  const lines = resolveAudio(tl).filter((r) => r.track.kind === "vo").sort((a, b) => a.start - b.start);
  const words = lines.reduce((n, r) => n + r.clip.vo!.text.split(/\s+/).filter(Boolean).length, 0);
  const missing = lines.filter((r) => r.placeholder).length;
  const sceneOf = (clipId?: string) => {
    const c = tl.clips.find((x) => x.id === clipId);
    return c ? manifest?.scenes.find((s) => s.id === c.scene)?.label || c.scene : null;
  };
  return (
    <div className="script">
      <VoiceSettings tl={tl} />
      <div className="script-head">
        <span>{lines.length} lines · {words} words{missing ? ` · ${missing} without audio` : ""}</span>
        <button onClick={() => addVoLine()}>+ Line at playhead</button>
        <button className="primary" disabled={!missing} onClick={generateMissing}>Generate missing</button>
        <button onClick={() => fitPictureToVo()} title="Lengthen each picture clip (slowing it down) until the voiceover pinned to it fits. Never shortens.">Stretch picture to fit VO</button>
      </div>
      {lines.map((r, i) => {
        const c = r.clip, vo = c.vo!;
        const prev = lines[i - 1];
        const clash = prev && prev.end > r.start + 0.01 ? prev.end - r.start : 0;
        const isSel = sel?.kind === "audio" && sel.id === c.id;
        const est = estimateSpeech(vo.text);
        return (
          <div key={c.id} className={`line ${isSel ? "sel" : ""}`} onClick={() => setState({ sel: { kind: "audio", id: c.id } })}>
            <div className="line-meta">
              <button className="time" onClick={() => transport.seek(r.start)} title="Jump here">{r.start.toFixed(2)}s</button>
              <span className="scene">{c.anchor ? `⚲ ${sceneOf(c.anchor.clip) || "?"}` : "free"}</span>
              <span className="grow" />
              <span className="dur">
                {vo.target ? `⇥ ${vo.target.toFixed(2)}s target` : r.placeholder ? `~${est.toFixed(1)}s est.` : `${r.duration.toFixed(2)}s`}
                {!r.placeholder && (c.rate ?? 1) !== 1 ? ` · ${Math.round((c.rate ?? 1) * 100)}%` : ""}
              </span>
            </div>
            <textarea
              rows={2}
              value={vo.text}
              onChange={(e) => { const v = e.target.value; edit((d) => { const g = findAudio(d, c.id); if (g?.clip.vo) g.clip.vo.text = v; }, `text:${c.id}`); }}
            />
            <div className="line-actions">
              <button className="primary sm" disabled={!!busy[c.id] || !vo.text.trim()} onClick={(e) => { e.stopPropagation(); generateTake(c.id); }}>
                {busy[c.id] || `${vo.takes.length ? "New take" : "Generate"}${vo.target ? ` · ${vo.target.toFixed(1)}s` : ""}`}
              </button>
              {vo.take != null && vo.takes[vo.take] && vo.takes[vo.take].text !== vo.text && <span className="stale">text changed since this take</span>}
              {clash > 0 && <span className="stale">starts {clash.toFixed(2)}s before the previous line ends</span>}
            </div>
            {isSel && <TakeList clipId={c.id} />}
          </div>
        );
      })}
      {!lines.length && <p className="panel-empty">No lines yet. Double-click the Voiceover row, or use “+ Line at playhead”.</p>}
    </div>
  );
}
