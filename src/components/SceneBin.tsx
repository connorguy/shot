import { clipStarts, type FilmScene } from "../../shared/timeline.ts";
import { insertScene } from "../lib/actions.ts";
import { api } from "../lib/api.ts";
import { PromptButton } from "./PromptDialog.tsx";
import { setState, useStore } from "../lib/store.ts";
import * as transport from "../lib/transport.ts";

/** Every scene the film registered, grouped by section. Drag onto the Picture row or click + to append. */
export function SceneBin() {
  const manifest = useStore((s) => s.manifest);
  const tl = useStore((s) => s.timeline);
  const project = useStore((s) => s.project);
  const version = useStore((s) => s.filmVersion);
  const filmError = useStore((s) => s.filmError);
  if (filmError) return <div className="panel-empty error">{filmError}</div>;
  if (!manifest || !tl || !project) return <div className="panel-empty">Loading film…</div>;

  const uses = (id: string) => tl.clips.filter((c) => c.scene === id).length;
  const starts = clipStarts(tl);
  const jump = (s: FilmScene) => {
    const i = tl.clips.findIndex((c) => c.scene === s.id);
    if (i >= 0) { transport.seek(starts[i] + 0.001); setState({ sel: { kind: "clip", ids: [tl.clips[i].id] } }); }
  };
  const groups: [string, FilmScene[]][] = [];
  for (const s of manifest.scenes) {
    const g = s.section || "Scenes";
    const last = groups[groups.length - 1];
    if (last && last[0] === g) last[1].push(s); else groups.push([g, [s]]);
  }
  return (
    <div className="scenebin">
      <p className="panel-note">{manifest.scenes.length} scenes in <b>{manifest.title || tl.film}</b>, one file each in <code>film/scenes/</code>. Edits to those files reload here automatically. Drag a scene onto the Picture row to insert it.</p>
      {groups.map(([g, list]) => (
        <section key={g}>
          <h4>{g}</h4>
          {list.map((s) => {
            const n = uses(s.id);
            const t = s.start + (s.end - s.start) * 0.62;
            return (
              <div
                key={s.id}
                className={`scene-card ${n ? "" : "unused"} ${s.error ? "broken" : ""}`}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/x-scene", s.id); e.dataTransfer.effectAllowed = "copy"; }}
                onClick={() => jump(s)}
                title={s.error || s.notes || s.label}
              >
                <img src={api.thumbUrl(project, tl.film, version, s.id, Math.round(t * 20) / 20)} alt="" draggable={false} />
                <div className="meta">
                  <b>{s.label}</b>
                  <span>{s.id} · {(s.end - s.start).toFixed(2)}s{n ? ` · used ${n}×` : " · unused"}</span>
                  {s.error ? <span className="err">✗ {s.error.split("\n")[0]}</span> : s.vo && <span className="vo-hint">“{s.vo}”</span>}
                </div>
                <span className="card-actions">
                  <PromptButton target={{ kind: "scene", id: s.id }} />
                  <button className="icon" title="Append to the end of the timeline" onClick={(e) => { e.stopPropagation(); insertScene(s.id); }}>+</button>
                </span>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
