import { useEffect, useRef, useState } from "react";
import { api, type TemplateInfo } from "../lib/api.ts";
import { setState, toast, useStore } from "../lib/store.ts";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "film";

/** New project anywhere on disk: scaffolds AGENTS.md, CLAUDE.md, brief.md, .gitignore and a starter film
 *  (or a design from a Claude session), registers it, and opens it. */
export function NewProjectDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const open = useStore((s) => s.newOpen);
  const dlg = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [parent, setParent] = useState("");
  const [start, setStart] = useState<"template" | "design">("template");
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [tpl, setTpl] = useState("starter");
  const [design, setDesign] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) {
      setErr(null);
      api.newDefaults().then((r) => setParent((p) => p || r.parent)).catch(() => {});
      api.templates().then(setTemplates).catch(() => setTemplates([]));
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const choose = async (kind: "folder" | "design") => {
    const r = await api.pick(kind, kind === "folder" ? parent : undefined).catch(() => ({ path: null }));
    if (!r.path) return;
    if (kind === "folder") setParent(r.path);
    else { setDesign(r.path); setStart("design"); }
  };

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api.createProject({
        name: slug(title), title: title.trim(), parent: parent.trim(),
        from: start === "design" ? design.trim() : null, template: start === "template" ? tpl : null,
      });
      setState({ newOpen: false });
      setTitle(""); setDesign(""); setStart("template");
      onCreated(r.id);
      toast(`Created ${r.dir}. Its AGENTS.md explains the project to any agent.`);
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
          <button key={t.id} className={`tpl ${start === "template" && tpl === t.id ? "on" : ""}`} onClick={() => { setStart("template"); setTpl(t.id); }} title={t.description}>
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
      </div>
      {start === "template" && <p className="panel-note">{templates.find((t) => t.id === tpl)?.description} Templates carry the scenes, styles and cut, never audio; draft voiceover lines come back as empty slots.</p>}
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
  film/          film-kit.js · lib.js · styles.css · scenes/*.js · edit.js
  audio/  exports/  .gitignore`}</pre>
      )}
      {err && <p className="warn">{err}</p>}
      <div className="btn-row end">
        <button onClick={() => setState({ newOpen: false })}>Cancel</button>
        <button className="primary" disabled={busy || !target || (start === "design" && !design.trim())} onClick={create}>{busy ? "Creating…" : "Create project"}</button>
      </div>
    </dialog>
  );
}
