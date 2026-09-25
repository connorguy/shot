// For projects cloned from a video: the film next to the reference at the same moment, with a similarity score.
//   npm run compare -- <project> 12.5                timeline time 12.5 s
//   npm run compare -- <project> --shot shot-03      across one shot, at its reference frame times (up to 8)
//   npm run compare -- <project> --shot shot-03 --at 5.1   one moment of a shot, on its clock (= reference time)
//   npm run compare -- <project> --sheet             the middle of every shot
// Writes .frames/compare-*.png (reference left, film right) and prints SSIM per frame (1 = identical).
// A shot scene's clock is the reference video's time, so this lines up however the cut is retimed.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { layersAt } from "../shared/timeline.ts";
import { browser, openFilm, renderLayers } from "../server/chrome.ts";
import { projectDir, projectFile } from "../server/projects.ts";
import { readReference, referenceFrame, type RefShot } from "../server/video.ts";
import { ctx, die, done, framesDir, parseArgs, requireProject, timelineOf } from "./_lib.ts";

const run = promisify(execFile);
const args = parseArgs();
const usage = "npm run compare -- <project> <seconds> | --shot <id> [--at <seconds>] | --sheet";
const project = requireProject(args._[0], usage);
const ref = (await readReference(projectDir(ctx, project))) || die("This project wasn't cloned from a video (no reference/shots.json).");
const source = projectFile(ctx, project, ref.source);
if (!existsSync(source)) die(`${ref.source} is missing (it's git-ignored, so a fresh checkout won't have it). Copy the original video there: ${ref.original}`);
const tl = await timelineOf(project);
const shotById = (id: string) => ref.shots.find((s) => s.id === id);
const f2 = (n: number) => n.toFixed(2);

// what to compare: a shot scene at a time on its clock
let pairs: { shot: RefShot; t: number }[];
let name: string;
if (args.flags.sheet) {
  pairs = ref.shots.map((shot) => ({ shot, t: (shot.start + shot.end) / 2 }));
  name = "compare-sheet.png";
} else if (args.flags.shot) {
  const shot = shotById(String(args.flags.shot)) || die(`No shot "${args.flags.shot}". Shots: ${ref.shots.map((s) => s.id).join(", ")}`);
  if (args.flags.at != null) {
    const t = Number(args.flags.at);
    if (!(t >= shot.start && t <= shot.end)) die(`${shot.id} runs ${f2(shot.start)}–${f2(shot.end)} on its clock.`);
    pairs = [{ shot, t }];
    name = `compare-${shot.id}@${f2(t)}.png`;
  } else {
    const fr = shot.frames.length <= 8 ? shot.frames : Array.from({ length: 8 }, (_, j) => shot.frames[Math.round((j * (shot.frames.length - 1)) / 7)]);
    pairs = fr.map((f) => ({ shot, t: f.t }));
    name = `compare-${shot.id}.png`;
  }
} else {
  const t = Number(args._[1]);
  if (!isFinite(t)) die(`usage: ${usage}`);
  const top = layersAt(tl, t).at(-1) || die("The timeline is empty.");
  const shot = shotById(top.scene) || die(`At ${f2(t)}s the timeline shows scene "${top.scene}", which isn't one of the reference shots.`);
  pairs = [{ shot, t: top.t }];
  name = `compare-t${f2(t)}.png`;
}

const fp = await openFilm(projectFile(ctx, project, tl.film), 1, { width: tl.width, height: tl.height });
const scenes = new Set(fp.manifest.scenes.map((s) => s.id));
const placeholders = new Set((await fp.page.evaluate("window.__refPlaceholders || []")) as string[]);
const tmp = await mkdtemp(join(tmpdir(), "shot-compare-"));
const rows: { cap: string; ref: string; film: string }[] = [];
const scores: number[] = [];
try {
  for (const [i, { shot, t }] of pairs.entries()) {
    if (!scenes.has(shot.id)) { console.log(`${shot.id}: no scene with this id in the film, skipped`); continue; }
    await renderLayers(fp.page, [{ scene: shot.id, t, opacity: 1 }]);
    const film = await fp.page.screenshot({ type: "png" });
    const refPng = await referenceFrame(source, t, fp.manifest.width, fp.manifest.height);
    const a = join(tmp, `${i}-ref.png`), b = join(tmp, `${i}-film.png`);
    await writeFile(a, refPng);
    await writeFile(b, film);
    const score = await ssim(a, b);
    scores.push(score);
    const tag = placeholders.has(shot.id) ? " · placeholder (not rebuilt yet)" : "";
    console.log(`${shot.id} @ ${f2(t)}s  SSIM ${score.toFixed(3)}${tag}`);
    rows.push({ cap: `${shot.id} @ ${f2(t)}s · SSIM ${score.toFixed(3)}${tag}`, ref: refPng.toString("base64"), film: film.toString("base64") });
  }
} finally {
  await fp.close();
  await rm(tmp, { recursive: true, force: true });
}
if (!rows.length) die("Nothing to compare.");

// reference left, film right; two pairs per row for sheets and shots
const perRow = rows.length > 1 ? 2 : 1;
const w = rows.length > 1 ? 440 : 960;
const page = await (await browser()).newPage({ viewport: { width: perRow * (2 * w + 40) + 20, height: 300 } });
await page.setContent(`<body style="margin:0;padding:10px;background:#111;font:14px system-ui;color:#ddd;display:grid;grid-template-columns:repeat(${perRow},${2 * w + 8}px);gap:22px 32px">${rows
  .map((r) => `<figure style="margin:0"><div style="display:flex;gap:8px"><img style="width:${w}px;display:block" src="data:image/png;base64,${r.ref}"><img style="width:${w}px;display:block" src="data:image/png;base64,${r.film}"></div><figcaption style="margin-top:6px">${r.cap} <span style="color:#888">· reference | film</span></figcaption></figure>`)
  .join("")}</body>`);
await mkdir(framesDir(project), { recursive: true });
const out = String(args.flags.out || join(framesDir(project), name));
await writeFile(out, await page.screenshot({ fullPage: true }));
await page.close();
const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
console.log(`${out}\n${rows.length} frame(s), mean SSIM ${mean.toFixed(3)}`);
await done();

/** Structural similarity of two images (grayscale, 640 px wide), 0..1. */
async function ssim(a: string, b: string): Promise<number> {
  const r = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", a, "-i", b, "-lavfi", "[0:v]scale=640:-2,format=gray[a];[1:v]scale=640:-2,format=gray[b];[a][b]ssim", "-f", "null", "-"]);
  const m = /All:([\d.]+)/.exec(r.stderr);
  return m ? parseFloat(m[1]) : NaN;
}
