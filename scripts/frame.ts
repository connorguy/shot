// Stills an agent can look at.
//   npm run frame -- <project> 12.5                 timeline time 12.5 s
//   npm run frame -- <project> --scene chart --at 17.2   one scene at its own clock time
//   npm run frame -- <project> --sheet [--cols 4]   contact sheet: one frame per picture clip (mid-clip)
// Options: --out <file.png>, --scale 0.5 (default 1 for stills, 0.25 per sheet cell)
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { clipStarts, layersAt, speedOf, totalDuration } from "../shared/timeline.ts";
import { browser, openFilm, renderLayers } from "../server/chrome.ts";
import { projectFile } from "../server/projects.ts";
import { ctx, die, done, framesDir, parseArgs, requireProject, timelineOf } from "./_lib.ts";

const args = parseArgs();
const usage = "npm run frame -- <project> <seconds> | --scene <id> --at <seconds> | --sheet";
const project = requireProject(args._[0], usage);
const outDir = framesDir(project); // <project>/.frames, git-ignored
await mkdir(outDir, { recursive: true });
const tl = await timelineOf(project);
const filmPath = projectFile(ctx, project, tl.film);

if (args.flags.sheet) {
  const cell = 0.25;
  const fp = await openFilm(filmPath, cell, { width: tl.width, height: tl.height });
  const starts = clipStarts(tl);
  const cells: { img: string; cap: string }[] = [];
  for (let i = 0; i < tl.clips.length; i++) {
    const c = tl.clips[i];
    const t = starts[i] + c.duration / 2;
    await renderLayers(fp.page, layersAt(tl, t));
    const png = await fp.page.screenshot({ type: "jpeg", quality: 80 });
    const sp = speedOf(c);
    cells.push({ img: png.toString("base64"), cap: `${i + 1}. ${c.scene} · ${starts[i].toFixed(2)}–${(starts[i] + c.duration).toFixed(2)}s · ${sp === 0 ? "hold" : Math.round(sp * 100) + "%"}` });
  }
  await fp.close();
  const cols = Number(args.flags.cols) || 4;
  const b = await browser();
  const page = await b.newPage({ viewport: { width: cols * 500 + 20, height: 400 } });
  await page.setContent(`<body style="margin:0;padding:10px;background:#111;font:14px system-ui;color:#ddd;display:grid;grid-template-columns:repeat(${cols},480px);gap:20px">${cells
    .map((c) => `<figure style="margin:0"><img style="width:480px;display:block;border-radius:4px" src="data:image/jpeg;base64,${c.img}"><figcaption style="margin-top:6px">${c.cap}</figcaption></figure>`)
    .join("")}</body>`);
  const file = String(args.flags.out || join(outDir, "sheet.png"));
  await writeFile(file, await page.screenshot({ fullPage: true }));
  await page.close();
  console.log(`${file}\n${tl.clips.length} clips, ${totalDuration(tl).toFixed(2)}s`);
  await done();
}

const scale = Number(args.flags.scale) || 1;
const fp = await openFilm(filmPath, scale, { width: tl.width, height: tl.height });
let file: string, desc: string;
if (args.flags.scene) {
  const id = String(args.flags.scene);
  const s = fp.manifest.scenes.find((x) => x.id === id) || die(`No scene "${id}". Scenes: ${fp.manifest.scenes.map((x) => x.id).join(", ")}`);
  const at = args.flags.at != null ? Number(args.flags.at) : (s.start + s.end) / 2;
  await renderLayers(fp.page, [{ scene: id, t: at, opacity: 1 }]);
  file = String(args.flags.out || join(outDir, `${id}@${at.toFixed(2)}.png`));
  desc = `scene ${id} at scene time ${at.toFixed(2)}s (clock ${s.start}–${s.end})`;
} else {
  const t = Number(args._[1]);
  if (!isFinite(t)) die(`usage: ${usage}`);
  const layers = layersAt(tl, t);
  await renderLayers(fp.page, layers);
  file = String(args.flags.out || join(outDir, `t${t.toFixed(2)}.png`));
  desc = `timeline ${t.toFixed(2)}s → ${layers.map((l) => `${l.scene}@${l.t.toFixed(2)}${l.opacity < 1 ? ` (${Math.round(l.opacity * 100)}%)` : ""}`).join(" + ")}`;
}
await writeFile(file, await fp.page.screenshot({ type: "png" }));
const err = fp.manifest.scenes.filter((s) => s.error).map((s) => s.id);
await fp.close();
console.log(`${file}\n${desc}${err.length ? `\nbroken scenes: ${err.join(", ")}` : ""}`);
await done();
