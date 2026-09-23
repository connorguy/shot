import { useEffect, useRef, useState } from "react";
import { buildPrompt, promptTitle, type PromptCtx } from "../lib/prompt.ts";
import { getState, setState, toast, useStore, type PromptTarget } from "../lib/store.ts";

/** Open the "prompt an agent" box for something on screen. */
export const askAgent = (t: PromptTarget) => setState({ promptFor: t });

export function PromptButton({ target, label, className = "icon" }: { target: PromptTarget | (() => PromptTarget); label?: string; className?: string }) {
  return (
    <button
      className={className}
      title="Copy a prompt for an agent to change this (P)"
      onClick={(e) => { e.stopPropagation(); askAgent(typeof target === "function" ? target() : target); }}
    >
      {label ?? "✎"}
    </button>
  );
}

export function PromptDialog() {
  const target = useStore((s) => s.promptFor);
  const tl = useStore((s) => s.timeline);
  const manifest = useStore((s) => s.manifest);
  const status = useStore((s) => s.status);
  const dir = useStore((s) => s.projects.find((p) => p.name === s.project)?.dir);
  const dlg = useRef<HTMLDialogElement>(null);
  const [ask, setAsk] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (target && !d.open) d.showModal();
    if (!target && d.open) d.close();
  }, [target]);

  const ctx: PromptCtx | null = tl && dir && status ? { tl, manifest, dir, studio: status.studioRoot } : null;
  const text = ctx && target ? buildPrompt(ctx, target, ask) : "";

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast("Prompt copied. Paste it into your agent.");
      setAsk("");
      setState({ promptFor: null });
    } catch {
      setShow(true);
      toast("Couldn't reach the clipboard; select the prompt below and copy it.", "error");
    }
  };

  return (
    <dialog ref={dlg} className="export prompt" onClose={() => setState({ promptFor: null })}>
      <h3>Prompt an agent</h3>
      {ctx && target && <p>Change {promptTitle(ctx, target)}. The copied prompt includes the project path, the file and the timing, so the agent starts in the right place.</p>}
      <label>What should change?
        <textarea
          autoFocus rows={4} value={ask}
          placeholder="e.g. make the product tiles land one at a time, and hold the last frame half a second longer"
          onChange={(e) => setAsk(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); copy(); } }}
        />
      </label>
      <button className="link" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"} full prompt</button>
      {show && <textarea className="mono prompt-preview" readOnly rows={12} value={text} onFocus={(e) => e.target.select()} />}
      <div className="btn-row end">
        <button onClick={() => setState({ promptFor: null })}>Cancel</button>
        <button className="primary" disabled={!ask.trim()} onClick={copy} title="⌘↵">Copy prompt</button>
      </div>
    </dialog>
  );
}

/** Keyboard: P opens the box for the current selection, or for the frame under the playhead. */
export function promptForSelection(playheadT: number) {
  const sel = getState().sel;
  askAgent(
    sel?.kind === "clip" && sel.ids.length === 1 ? { kind: "clip", id: sel.ids[0] }
      : sel?.kind === "audio" ? { kind: "audio", id: sel.id }
      : { kind: "frame", t: playheadT },
  );
}
