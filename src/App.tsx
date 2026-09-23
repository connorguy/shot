import { useEffect } from "react";
import { emptyTimeline, seedVoFromManifest, timelineFromManifest } from "../shared/timeline.ts";
import { addHold, addVoLine, deleteSelection, duplicateSelection, splitAt } from "./lib/actions.ts";
import { api } from "./lib/api.ts";
import { adoptExternal, canRedo, canUndo, getState, loadTimeline, redo, saveNow, setState, toast, undo, useStore } from "./lib/store.ts";
import * as transport from "./lib/transport.ts";
import { AudioPanel } from "./components/AudioPanel.tsx";
import { ExportDialog } from "./components/ExportDialog.tsx";
import { NewProjectDialog } from "./components/NewProjectDialog.tsx";
import { Icon, Logo } from "./components/Icons.tsx";
import { PromptDialog, promptForSelection } from "./components/PromptDialog.tsx";
import { SaveTemplateDialog } from "./components/SaveTemplateDialog.tsx";
import { playhead } from "./lib/playhead.ts";
import { Inspector } from "./components/Inspector.tsx";
import { Preview } from "./components/Preview.tsx";
import { SceneBin } from "./components/SceneBin.tsx";
import { ScriptPanel } from "./components/ScriptPanel.tsx";
import { Timeline } from "./components/Timeline.tsx";

let needsSeed = false;

async function openProject(name: string) {
  transport.pause();
  const { timeline, filmVersion, timelineVersion } = await api.timeline(name);
  needsSeed = !timeline;
  // same film already loaded in the preview: keep its manifest (the iframe will not reload)
  const s = getState();
  const keep = s.project === name && s.filmVersion === filmVersion ? s.manifest : null;
  loadTimeline(timeline || emptyTimeline(name), { project: name, filmVersion, manifest: keep, filmError: null, diskTimeline: timelineVersion });
  if (needsSeed && keep) { needsSeed = false; loadTimeline(timelineFromManifest(keep, keep.title || name)); saveNow(); }
  const u = new URL(location.href);
  u.searchParams.set("project", name);
  history.replaceState(null, "", u);
  setState({ zoom: 40 });
  requestAnimationFrame(() => window.dispatchEvent(new Event("studio:fit")));
}

export function App() {
  const project = useStore((s) => s.project);
  const manifest = useStore((s) => s.manifest);
  const tl = useStore((s) => s.timeline);
  const panel = useStore((s) => s.panel);
  const save = useStore((s) => s.save);
  const toastMsg = useStore((s) => s.toast);
  const status = useStore((s) => s.status);
  const projects = useStore((s) => s.projects);
  const refreshProjects = () => api.projects().then((ps) => { setState({ projects: ps }); return ps; });

  useEffect(() => {
    api.status().then((status) => setState({ status })).catch(() => {});
    refreshProjects().then((ps) => {
      const want = new URL(location.href).searchParams.get("project");
      const pick = ps.find((p) => p.name === want) || ps[0];
      if (pick) openProject(pick.name);
    }).catch((e) => toast(e.message, "error"));
  }, []);

  // first open of a film: build the timeline from its default cut (or, for a template copy, add its VO lines)
  useEffect(() => {
    const cur = getState().timeline;
    if (!needsSeed && cur?.seedVo && manifest && project) {
      loadTimeline(seedVoFromManifest(structuredClone(cur), manifest), {});
      saveNow();
      return;
    }
    if (!needsSeed || !manifest || !project) return;
    needsSeed = false;
    loadTimeline(timelineFromManifest(manifest, manifest.title || project), {});
    requestAnimationFrame(() => window.dispatchEvent(new Event("studio:fit")));
    saveNow().then(refreshProjects);
  }, [manifest, project]);

  // pick up changes made outside the studio: scene files (reload the film) and timeline.json (adopt it)
  useEffect(() => {
    if (!project) return;
    let warned = "";
    const id = setInterval(async () => {
      const v = await api.versions(project).catch(() => null);
      const s = getState();
      if (!v || s.project !== project) return;
      if (v.film && v.film !== s.filmVersion) { setState({ filmVersion: v.film }); toast("Film source changed. Reloaded."); }
      if (v.timeline && s.diskTimeline && v.timeline !== s.diskTimeline && s.save !== "saving") {
        if (s.save === "saved") {
          const r = await api.timeline(project).catch(() => null);
          if (r?.timeline && getState().save === "saved") { adoptExternal(r.timeline, r.timelineVersion); toast("timeline.json changed on disk. Loaded it (⌘Z to go back)."); }
        } else if (warned !== v.timeline) {
          warned = v.timeline;
          toast("timeline.json changed on disk while you have unsaved edits. Your next save will overwrite it.", "error");
        }
      }
    }, 1500);
    return () => clearInterval(id);
  }, [project]);

  useEffect(() => { transport.timelineChanged(); }, [tl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true]") || document.querySelector("dialog[open]")) return;
      const mod = e.metaKey || e.ctrlKey;
      const fps = getState().timeline?.fps || 30;
      const k = e.key.toLowerCase();
      const run = (f: () => void) => { e.preventDefault(); f(); };
      if (k === " ") return run(transport.toggle);
      if (k === "arrowleft") return run(() => transport.step(e.shiftKey ? -fps : -1));
      if (k === "arrowright") return run(() => transport.step(e.shiftKey ? fps : 1));
      if (k === "home") return run(() => transport.seek(0));
      if (k === "end") return run(() => transport.seek(1e9));
      if (mod && k === "z") return run(e.shiftKey ? redo : undo);
      if (mod && k === "y") return run(redo);
      if (mod && k === "s") return run(saveNow);
      if (mod && k === "d") return run(duplicateSelection);
      if (mod && k === "e") return run(() => setState({ exportOpen: true }));
      if (mod) return;
      if (k === "backspace" || k === "delete") return run(deleteSelection);
      if (k === "s") return run(() => splitAt());
      if (k === "h") return run(() => addHold(1));
      if (k === "v") return run(() => addVoLine());
      if (k === "r") return run(() => setState({ tool: "retime" }));
      if (k === "t") return run(() => setState({ tool: "trim" }));
      if (k === "l") return run(() => setState({ loop: !getState().loop }));
      if (k === "p") return run(() => promptForSelection(playhead.get()));
      if (k === "z") return run(() => window.dispatchEvent(new Event("studio:fit")));
      if (k === "escape") return run(() => setState({ sel: null }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openFolder = async () => {
    const r = await api.pick("project").catch(() => ({ path: null }));
    const path = r.path || prompt("Path to a project folder (the one with film.html):");
    if (!path) return;
    try {
      const { id } = await api.openFolder(path);
      await refreshProjects();
      await openProject(id);
    } catch (e: any) { toast(e.message, "error"); }
  };

  return (
    <div className="app">
      <header className="topbar">
        <b className="brand"><Logo />Shot</b>
        <select
          value={project || ""}
          aria-label="Project"
          onChange={(e) => { const v = e.target.value; if (v === "__open") { e.target.value = project || ""; openFolder(); } else openProject(v); }}
        >
          {!project && <option value="" disabled>No project open</option>}
          {projects.map((p) => <option key={p.name} value={p.name} title={p.dir}>{p.title}</option>)}
          <option value="__open">Open project folder…</option>
        </select>
        {project && <ProjectPathButtons project={project} dir={projects.find((p) => p.name === project)?.dir} />}
        <button onClick={openFolder} title="Open a project folder from anywhere on disk (the folder with film.html)">Open</button>
        <button onClick={() => setState({ newOpen: true })} title="New project folder anywhere on disk, with AGENTS.md and a starter film">New</button>
        <span className="sep" />
        <button className="icon" disabled={!canUndo()} onClick={undo} title="Undo (⌘Z)">↶</button>
        <button className="icon" disabled={!canRedo()} onClick={redo} title="Redo (⇧⌘Z)">↷</button>
        <span className={`save ${save}`}>{save === "saved" ? "Saved" : save === "saving" ? "Saving…" : save === "dirty" ? "Edited" : "Save failed"}</span>
        <div className="grow" />
        {status && (
          <span className="status">
            <i
              className={status.gemini ? "ok" : "off"}
              title={status.auth.mode === "key" ? "Gemini: API key from shot/.env"
                : status.auth.mode === "adc" ? `Gemini: Application Default Credentials, project ${status.auth.project ?? "?"} (${status.auth.backend})`
                : `No Gemini credentials. Add GEMINI_API_KEY to shot/.env or run: gcloud auth application-default login${status.auth.error ? `\n${status.auth.error}` : ""}`}
            />Gemini{status.auth.mode === "adc" ? " · ADC" : ""}
            <i className={status.ffmpeg ? "ok" : "off"} title="ffmpeg for export" />ffmpeg
          </span>
        )}
        <button className="primary" disabled={!tl} onClick={() => setState({ exportOpen: true })}>Export</button>
      </header>

      {!project ? (
        <div className="empty-state">
          <h2>No projects yet</h2>
          <p>Start a new video project anywhere on disk, or open an existing project folder.</p>
          <div className="btn-row">
            <button className="primary" onClick={() => setState({ newOpen: true })}>New project</button>
            <button onClick={openFolder}>Open folder</button>
          </div>
        </div>
      ) : (
        <main className="workspace">
          <aside className="side">
            <nav className="tabs">
              {(["scenes", "script", "audio"] as const).map((p) => (
                <button key={p} className={panel === p ? "on" : ""} onClick={() => setState({ panel: p })}>
                  {p === "scenes" ? "Scenes" : p === "script" ? "Voiceover" : "Music & SFX"}
                </button>
              ))}
            </nav>
            <div className="side-body">
              {panel === "scenes" && <SceneBin />}
              {panel === "script" && <ScriptPanel />}
              {panel === "audio" && <AudioPanel />}
            </div>
          </aside>
          <section className="center"><Preview /></section>
          <aside className="inspect"><Inspector /></aside>
          <section className="bottom"><Timeline /></section>
        </main>
      )}
      <ExportDialog />
      <PromptDialog />
      <SaveTemplateDialog />
      <NewProjectDialog onCreated={async (id) => { await refreshProjects(); await openProject(id); }} />
      {toastMsg && <div className={`toast ${toastMsg.kind}`} onClick={() => setState({ toast: null })}>{toastMsg.msg}</div>}
    </div>
  );
}

function ProjectPathButtons({ project, dir }: { project: string; dir?: string }) {
  const copy = async () => {
    if (!dir) return;
    try {
      await navigator.clipboard.writeText(dir);
      toast(`Copied ${dir}`);
    } catch {
      prompt("Project folder:", dir);
    }
  };
  return (
    <span className="path-btns">
      <button className="icon" onClick={() => api.revealProject(project)} title={`Show in Finder\n${dir || ""}`} aria-label="Show project folder in Finder">
        <Icon name="folder" />
      </button>
      <button className="icon" onClick={copy} disabled={!dir} title={`Copy path\n${dir || ""}`} aria-label="Copy project folder path">
        <Icon name="copy" />
      </button>
    </span>
  );
}
