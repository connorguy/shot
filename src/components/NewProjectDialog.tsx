import { useEffect, useRef, useState } from "react";
import { ASPECTS, aspectOf, type Aspect } from "../../shared/timeline.ts";
import { api, type TemplateInfo } from "../lib/api.ts";
import { setState, toast, useStore } from "../lib/store.ts";

/** "~/Movies/Launch_film-v2.mp4" → "Launch film v2" */
const videoTitle = (path: string) => (path.split("/").pop() || "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "film";

/** New project anywhere on disk: scaffolds AGENTS.md, CLAUDE.md, brief.md, .gitignore and a starter film
 *  (or a design from a Claude session, or placeholders cloned from a video), registers it, and opens it. */
export function NewProjectDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const open = useStore((s) => s.newOpen);
  const dlg = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [parent, setParent] = useState("");
  const [start, setStart] = useState<"template" | "design" | "video">("template");
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [tpl, setTpl] = useState("starter");
  const [aspect, setAspect] = useState<Aspect>("landscape");
  const [design, setDesign] = useState("");
  const [video, setVideo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) {
      setErr(null);
      api.newDefaults().then((r) => setParent((p) => p || r.parent)).catch(() => {});
      api.templates().then((ts) => {
        setTemplates(ts);
        const t = ts.find((x) => x.id === tpl);
        if (t) setAspect(aspectOf(t.width, t.height));
      }).catch(() => setTemplates([]));
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const choose = async (kind: "folder" | "design" | "video") => {
    const r = await api.pick(kind, kind === "folder" ? parent : undefined).catch(() => ({ path: null }));
    if (!r.path) return;
    if (kind === "folder") setParent(r.path);
    else if (kind === "design") { setDesign(r.path); setStart("design"); }
    else { setVideo(r.path); setStart("video"); if (!title.trim()) setTitle(videoTitle(r.path)); }
  };

  const tplInfo = templates.find((x) => x.id === tpl);
  const native = tplInfo ? aspectOf(tplInfo.width, tplInfo.height) : aspect;

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api.createProject({
        name: slug(title), title: title.trim(), parent: parent.trim(),
        from: start === "design" ? design.trim() : null, template: start === "template" ? tpl : null,
        video: start === "video" ? video.trim() : null, aspect: start === "template" && aspect !== native ? aspect : null, // unchanged: keep the template's exact size
      });
      setState({ newOpen: false });
      setTitle(""); setDesign(""); setVideo(""); setStart("template");
      onCreated(r.id);
      toast(start === "video"
        ? `Created ${r.dir}. Each shot is a placeholder: ask an agent in that folder to rebuild them (its AGENTS.md explains how).`
        : `Created ${r.dir}. Its AGENTS.md explains the project to any agent.`);
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  const target = parent && title.trim() ? `${parent.replace(/\/$/, "")}/${slug(title)}` : null;
  return (
    <dialog ref={dlg} className="export newproj" onClose={() => setState({ newOpen: false })}>
      <h3>New video project</h3>
      <p>A folder with everything a person or an agent needs: the film as code, an <code>AGENTS.md</code> explaining how it all works, and a brief to fill in.</p>
      <label>Name
        <input autoFocus value={title} placeholder="Launch film v2" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && target) create(); }} />
      </label>
      <label>Location
        <span className="path-row">
          <input value={parent} onChange={(e) => setParent(e.target.value)} placeholder="/Users/you/Movies" spellCheck={false} />
          <button onClick={() => choose("folder")} title="macOS folder picker; or type a path">Choose…</button>
        </span>
      </label>
      <label>Start from</label>
      <div className="tpl-grid">
        {templates.map((t) => (
          <button key={t.id} className={`tpl ${start === "template" && tpl === t.id ? "on" : ""}`} onClick={() => { setStart("template"); setTpl(t.id); setAspect(aspectOf(t.width, t.height)); }} title={t.description}>
            {t.hasPreview ? <img src={api.templatePreview(t.id)} alt="" /> : <span className="noprev" />}
            <b>{t.name}</b>
            <span>{[t.scenes ? `${t.scenes} scenes` : null, t.duration ? `${t.duration.toFixed(0)}s` : null].filter(Boolean).join(" · ") || "template"}</span>
          </button>
        ))}
        <button className={`tpl design ${start === "design" ? "on" : ""}`} onClick={() => setStart("design")} title="A zip, film.html or folder from a Claude design session">
          <span className="noprev">↧</span>
          <b>A design from Claude</b>
          <span>zip, film.html or folder</span>
        </button>
        <button className={`tpl design ${start === "video" ? "on" : ""}`} onClick={() => { setStart("video"); if (!video) choose("video"); }} title="Clone a video on disk: one placeholder scene per shot, at the original timing, for an agent to rebuild as code">
          <span className="noprev">▶</span>
          <b>Clone a video</b>
          <span>mp4, mov, webm…</span>
        </button>
      </div>
      {start === "template" && (
        <>
          <p className="panel-note">{tplInfo?.description} Templates carry the scenes, styles and cut, never audio; draft voiceover lines come back as empty slots.</p>
          <label>Aspect</label>
          <div className="seg big aspect" role="group" aria-label="Aspect">
            {(Object.keys(ASPECTS) as Aspect[]).map((a) => (
              <button key={a} className={aspect === a ? "on" : ""} aria-pressed={aspect === a} onClick={() => setAspect(a)}>
                <i style={{ aspectRatio: `${ASPECTS[a].width} / ${ASPECTS[a].height}` }} />
                {ASPECTS[a].label}<span>{ASPECTS[a].ratio} · {ASPECTS[a].width}×{ASPECTS[a].height}</span>
              </button>
            ))}
          </div>
          {aspect !== native && <p className="panel-note">This template was laid out for {ASPECTS[native].label.toLowerCase()}. Scenes that place things by <code>W</code> and <code>H</code> adapt; ask an agent to re-lay out the rest.</p>}
        </>
      )}
      {start === "video" && (
        <>
          <label>Video
            <span className="path-row">
              <input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="~/Movies/launch-film.mp4" spellCheck={false} />
              <button onClick={() => choose("video")}>Choose…</button>
            </span>
          </label>
          <p className="panel-note">Shot finds the cuts, saves reference frames and the soundtrack, and makes one placeholder scene per shot at the original timing. Then an agent rebuilds each shot as code and checks it against the original with <code>compare</code>.</p>
        </>
      )}
      {start === "design" && (
        <label>Design
          <span className="path-row">
            <input value={design} onChange={(e) => setDesign(e.target.value)} placeholder="~/Downloads/launch-v2.zip" spellCheck={false} />
            <button onClick={() => choose("design")}>Choose…</button>
          </span>
        </label>
      )}
      {target && (
        <pre className="tree">{`${target}/
  AGENTS.md      how everything works (layout, scene rules, timeline.json, commands)
  CLAUDE.md      → AGENTS.md
  brief.md       what the film says; fill in first
  film.html      loads the scenes in order
  film/          film-kit.js · lib.js · styles.css · scenes/*.js · edit.js${start === "video" ? `
  reference/     the video, its shots, contact sheets and frames` : ""}
  audio/  exports/  .gitignore`}</pre>
      )}
      {err && <p className="warn">{err}</p>}
      <div className="btn-row end">
        <button onClick={() => setState({ newOpen: false })}>Cancel</button>
        <button className="primary" disabled={busy || !target || (start === "design" && !design.trim()) || (start === "video" && !video.trim())} onClick={create}>
          {busy ? (start === "video" ? "Analyzing video…" : "Creating…") : "Create project"}
        </button>
      </div>
    </dialog>
  );
}
