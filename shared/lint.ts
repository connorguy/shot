// Problems worth fixing before export. Used by `npm run inspect` and the studio.
import { RATE_MAX, RATE_MIN, rateForTarget, resolveAudio, speedOf, totalDuration, type FilmManifest, type Timeline } from "./timeline.ts";

export interface Issue { level: "error" | "warn" | "info"; where: string; msg: string }

export function lint(tl: Timeline, m: FilmManifest | null): Issue[] {
  const out: Issue[] = [];
  const total = totalDuration(tl);
  const scene = (id: string) => m?.scenes.find((s) => s.id === id);

  for (const s of m?.scenes || []) {
    if (s.error) out.push({ level: "error", where: `scene ${s.id}`, msg: `fails to build or draw: ${s.error.split("\n")[0]}` });
  }
  tl.clips.forEach((c, i) => {
    const where = `clip ${i + 1} (${c.id}, ${c.scene})`;
    const s = scene(c.scene);
    if (m && !s) { out.push({ level: "error", where, msg: `scene "${c.scene}" is not in the film` }); return; }
    if (c.duration <= 0) out.push({ level: "error", where, msg: "duration must be > 0" });
    if (s && (c.in < s.start - 1e-3 || c.out > s.end + 1e-3)) out.push({ level: "warn", where, msg: `source ${c.in}–${c.out} is outside the scene's ${s.start}–${s.end}` });
    if (c.out < c.in) out.push({ level: "error", where, msg: "out is before in" });
    const sp = speedOf(c);
    if (sp > 0 && (sp < 0.25 || sp > 4)) out.push({ level: "info", where, msg: `plays at ${Math.round(sp * 100)}% speed` });
  });

  const clipIds = new Set(tl.clips.map((c) => c.id));
  const vo = resolveAudio(tl).filter((r) => r.track.kind === "vo").sort((a, b) => a.start - b.start);
  vo.forEach((r, i) => {
    const where = `vo ${r.clip.id} “${(r.clip.vo?.text || "").slice(0, 40)}”`;
    if (r.placeholder) out.push({ level: "warn", where, msg: "no audio yet (npm run vo)" });
    const tk = r.clip.vo?.take != null ? r.clip.vo.takes[r.clip.vo.take] : null;
    if (tk && tk.text !== r.clip.vo!.text) out.push({ level: "warn", where, msg: "selected take was recorded from different text" });
    const tg = r.clip.vo?.target;
    if (tg && !r.placeholder && r.clip.assetDuration != null && Math.abs(r.duration - tg) > 0.02) {
      out.push({ level: "warn", where, msg: `can't reach its ${tg.toFixed(2)}s target (needs ${Math.round(rateForTarget(r.clip.assetDuration, tg) * 100)}% speed; limit ${RATE_MIN * 100}–${RATE_MAX * 100}%)` });
    }
    const rate = r.clip.rate || 1;
    if (!r.placeholder && (rate < 0.8 || rate > 1.25)) out.push({ level: "info", where, msg: `plays at ${Math.round(rate * 100)}% speed; beyond ±20% speech can sound processed` });
    const prev = vo[i - 1];
    if (prev && prev.end > r.start + 0.01) out.push({ level: "warn", where, msg: `starts ${(prev.end - r.start).toFixed(2)}s before the previous line ends${prev.placeholder || r.placeholder ? " (estimated read time)" : ""}` });
  });
  for (const r of resolveAudio(tl)) {
    const where = `${r.track.kind} ${r.clip.id}`;
    if (r.clip.anchor && !clipIds.has(r.clip.anchor.clip)) out.push({ level: "warn", where, msg: `pinned to missing clip ${r.clip.anchor.clip}; using start ${r.clip.start}s` });
    if (r.end > total + 0.05 && r.track.kind !== "music") out.push({ level: "warn", where, msg: `runs ${(r.end - total).toFixed(2)}s past the end of the film` });
    if (r.start >= total) out.push({ level: "warn", where, msg: "starts after the film ends" });
  }
  return out;
}
