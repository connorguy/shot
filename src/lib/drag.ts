// Pointer drag helper: tracks dx from the pointerdown, calls back on move/up, handles Escape.
export interface DragInfo { dx: number; dy: number; ev: PointerEvent; moved: boolean }

export function drag(
  down: React.PointerEvent | PointerEvent,
  handlers: { move?: (d: DragInfo) => void; up?: (d: DragInfo) => void; cancel?: () => void },
  threshold = 3,
) {
  const x0 = down.clientX, y0 = down.clientY;
  let moved = false;
  const info = (ev: PointerEvent): DragInfo => ({ dx: ev.clientX - x0, dy: ev.clientY - y0, ev, moved });
  const onMove = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < threshold) return;
    moved = true;
    handlers.move?.(info(ev));
  };
  const cleanup = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("keydown", onKey, true);
    document.body.classList.remove("dragging");
  };
  const onUp = (ev: PointerEvent) => { cleanup(); handlers.up?.(info(ev)); };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape") return;
    ev.stopPropagation();
    cleanup();
    handlers.cancel?.();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("keydown", onKey, true);
  document.body.classList.add("dragging");
}

/** Nearest snap target within `tol` seconds, or null. */
export function snapTo(t: number, targets: number[], tol: number): number | null {
  let best: number | null = null, bd = tol;
  for (const s of targets) { const d = Math.abs(s - t); if (d <= bd) { bd = d; best = s; } }
  return best;
}
