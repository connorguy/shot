// npm run inspect -- <project> [--json]
// The cut at a glance: scenes, picture clips with times and speed, audio, and problems to fix.
import { lint } from "../shared/lint.ts";
import { clipStarts, resolveAudio, speedOf, totalDuration } from "../shared/timeline.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectDir } from "../server/projects.ts";
import { ROOT, ctx, done, manifestOf, parseArgs, requireProject, timelineOf } from "./_lib.ts";

const args = parseArgs();
const project = requireProject(args._[0], "npm run inspect -- <project> [--json]");
const manifest = await manifestOf(project);
const tl = await timelineOf(project, manifest);
const starts = clipStarts(tl);
const audio = resolveAudio(tl);
const issues = lint(tl, manifest);
const kit = join(projectDir(ctx, project), "film", "film-kit.js");
if (existsSync(kit) && readFileSync(kit, "utf8") !== readFileSync(join(ROOT, "film-kit", "film-kit.js"), "utf8")) {
  issues.push({ level: "info", where: "film/film-kit.js", msg: "differs from shot/film-kit/film-kit.js; copy the newer one over if the studio was updated" });
}

if (args.flags.json) {
  console.log(JSON.stringify({
    project, title: tl.name, duration: totalDuration(tl), fps: tl.fps,
    scenes: manifest.scenes.map((s) => ({ ...s, uses: tl.clips.filter((c) => c.scene === s.id).length })),
    clips: tl.clips.map((c, i) => ({ ...c, start: starts[i], end: starts[i] + c.duration, speed: speedOf(c) })),
    audio: audio.map((r) => ({ id: r.clip.id, track: r.track.id, kind: r.track.kind, start: r.start, end: r.end, asset: r.clip.asset, anchor: r.clip.anchor, text: r.clip.vo?.text ?? null, takes: r.clip.vo?.takes.length ?? null })),
    issues,
  }, null, 2));
  await done();
}

const f = (n: number) => n.toFixed(2).padStart(6);
const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
console.log(`${tl.name}  ·  ${totalDuration(tl).toFixed(2)}s  ·  ${tl.clips.length} clips  ·  ${tl.fps} fps  ·  ${projectDir(ctx, project)}\n`);

console.log("SCENES (film/scenes/<id>.js)  id · section · scene clock · uses");
for (const s of manifest.scenes) {
  const n = tl.clips.filter((c) => c.scene === s.id).length;
  console.log(`  ${pad(s.id, 12)} ${pad(s.section || "", 12)} ${f(s.start)}–${f(s.end)}  ${n ? `${n}×` : "unused"}${s.error ? "  ✗ BROKEN" : ""}  ${s.label}`);
}

console.log("\nPICTURE  # · clip id · scene · timeline start–end · duration · speed · source in–out");
tl.clips.forEach((c, i) => {
  const sp = speedOf(c);
  console.log(`  ${String(i + 1).padStart(2)}  ${pad(c.id, 11)} ${pad(c.scene, 10)} ${f(starts[i])}–${f(starts[i] + c.duration)}  ${f(c.duration)}s  ${sp === 0 ? "  hold" : `${String(Math.round(sp * 100)).padStart(4)}%`}  ${f(c.in)}–${f(c.out)}${c.xfade ? `  xfade ${c.xfade}s` : ""}`);
});

for (const track of tl.tracks) {
  const rows = audio.filter((r) => r.track.id === track.id).sort((a, b) => a.start - b.start);
  console.log(`\n${track.name.toUpperCase()} (${track.kind}, ${track.gain} dB${track.mute ? ", muted" : ""}${track.duck?.enabled ? `, ducks ${track.duck.amount} dB under VO` : ""})`);
  if (!rows.length) console.log("  (empty)");
  for (const r of rows) {
    const pin = r.clip.anchor ? `pinned to ${r.clip.anchor.clip} +${r.clip.anchor.offset}s` : "absolute";
    const what = r.clip.vo ? `“${r.clip.vo.text}”  [${r.placeholder ? "no audio" : `take ${(r.clip.vo.take ?? 0) + 1}/${r.clip.vo.takes.length}`}]` : r.clip.asset || "";
    console.log(`  ${pad(r.clip.id, 11)} ${f(r.start)}–${f(r.end)}  ${pad(pin, 26)} ${what}`);
  }
}

console.log(`\nISSUES (${issues.length})`);
if (!issues.length) console.log("  none");
for (const i of issues) console.log(`  ${i.level.toUpperCase().padEnd(5)} ${i.where}: ${i.msg}`);
await done(issues.some((i) => i.level === "error") ? 2 : 0);
