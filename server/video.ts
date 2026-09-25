// Clone a video: new projects can start from a video on disk. ffmpeg finds the cuts (and splits long
// continuous stretches at their stillest moments), samples frames from every shot and pulls the soundtrack; each shot becomes a placeholder scene (film/reference.js) that shows
// its reference frames until an agent rebuilds it as code. A shot scene's clock is the source video's
// time, so `compare` can put any rendered frame next to the original, however the cut is retimed later.
//   <project>/reference/{source.<ext>, shots.json, sheet.jpg, shots/<id>.jpg, frames/<id>/t<time>.jpg}
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { emptyTimeline, uid, type Timeline } from "../shared/timeline.ts";
import { browser } from "./chrome.ts";

const run = promisify(execFile);
const BIG = { maxBuffer: 64 * 1024 * 1024 };

export const VIDEO_EXT = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"]);

export interface RefFrame { t: number; file: string }
/** How a shot begins: the video's start, a visible cut, or a split at a still moment inside continuous picture. */
export type ShotStart = "start" | "cut" | "still";
export interface RefShot { id: string; start: number; end: number; cut: ShotStart; strip: string | null; frames: RefFrame[] }
export interface Reference {
  version: 1;
  source: string; // project-relative copy of the video
  original: string; // where it was imported from
  width: number; height: number; fps: number; duration: number;
  audio: string | null; // project-relative soundtrack, if the video had one
  threshold: number; // scene-change score that counts as a cut
  maxShot: number; // longer continuous stretches were split at still moments
  shots: RefShot[];
}

interface Probe { width: number; height: number; fps: number; duration: number; start: number; hasAudio: boolean }

async function probe(src: string): Promise<Probe> {
  const { stdout } = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", src], BIG);
  const j = JSON.parse(stdout);
  const v = (j.streams || []).find((s: any) => s.codec_type === "video");
  if (!v) throw new Error("That file has no video stream.");
  const rate = (r: string) => { const [a, b] = String(r || "0/1").split("/").map(Number); return b ? a / b : 0; };
  const raw = rate(v.avg_frame_rate) || rate(v.r_frame_rate) || 30;
  // rotated phone videos report landscape sizes with a rotation tag
  const rot = Math.abs(Number(v.tags?.rotate ?? v.side_data_list?.find((d: any) => d.rotation != null)?.rotation ?? 0)) % 180 === 90;
  const duration = parseFloat(j.format?.duration ?? v.duration);
  if (!isFinite(duration) || duration <= 0) throw new Error("Couldn't read the video's length.");
  // the film's stage: the video's aspect, at most 1920 on the long side, even sizes (H.264 export needs them)
  const w0 = rot ? v.height : v.width, h0 = rot ? v.width : v.height;
  const k = Math.min(1, 1920 / Math.max(w0, h0));
  const even = (n: number) => Math.max(2, Math.round((n * k) / 2) * 2);
  return {
    width: even(w0), height: even(h0),
    fps: Math.min(60, Math.max(12, Math.round(raw))), duration, start: parseFloat(j.format?.start_time) || 0,
    hasAudio: (j.streams || []).some((s: any) => s.codec_type === "audio"),
  };
}

interface Score { t: number; s: number }

/** ffmpeg's scene-change score (0..1, how much a frame differs from the one before) for every frame, on the source clock. */
async function sceneScores(src: string, start: number): Promise<Score[]> {
  const r = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", src, "-an", "-vf", "scale=480:-2,select=gte(scene\\,0),metadata=print", "-f", "null", "-"], BIG);
  const out: Score[] = [];
  let t = NaN;
  for (const line of r.stderr.split("\n")) { // "frame:12 pts:… pts_time:0.4" then "lavfi.scene_score=0.0123"
    const pt = /pts_time:([\d.]+)/.exec(line);
    if (pt) t = parseFloat(pt[1]) - start;
    const sc = /lavfi\.scene_score=([\d.]+)/.exec(line);
    if (sc && isFinite(t)) out.push({ t, s: parseFloat(sc[1]) });
  }
  return out.sort((a, b) => a.t - b.t);
}

export interface SegmentOptions { threshold: number; minShot: number; maxShot: number; target: number }

/** Shots from scene scores. A frame scoring `threshold` or more is a cut. Motion graphics often change scenes
 *  with no visible cut at all, so stretches longer than `maxShot` are split about every `target` seconds, at
 *  the stillest moment near each split (where the rebuilt scenes can meet without a visible seam). */
export function segment(scores: Score[], duration: number, o: SegmentOptions): { start: number; end: number; cut: ShotStart }[] {
  const bounds: { t: number; cut: ShotStart }[] = [{ t: 0, cut: "start" }];
  for (const f of scores) {
    if (f.s >= o.threshold && f.t - bounds[bounds.length - 1].t >= o.minShot && duration - f.t >= o.minShot) bounds.push({ t: f.t, cut: "cut" });
  }
  // motion around t: the summed scores within ±0.2 s (prefix sums over the sorted scores)
  const pre = [0];
  for (const f of scores) pre.push(pre[pre.length - 1] + f.s);
  const idx = (t: number) => { let lo = 0, hi = scores.length; while (lo < hi) { const m = (lo + hi) >> 1; if (scores[m].t < t) lo = m + 1; else hi = m; } return lo; };
  const motion = (t: number) => pre[idx(t + 0.2)] - pre[idx(t - 0.2)];

  const out: { start: number; end: number; cut: ShotStart }[] = [];
  bounds.forEach((bd, i) => {
    const a = bd.t, b = i + 1 < bounds.length ? bounds[i + 1].t : duration;
    const cuts: { t: number; cut: ShotStart }[] = [bd];
    const n = b - a > o.maxShot ? Math.round((b - a) / o.target) : 1;
    for (let k = 1; k < n; k++) {
      const ideal = a + ((b - a) * k) / n, win = (b - a) / n / 3, prev = cuts[cuts.length - 1].t;
      let best: number | null = null, cost = Infinity;
      for (let j = idx(ideal - win); j < scores.length && scores[j].t <= ideal + win; j++) {
        const t = scores[j].t;
        if (t - prev < o.minShot || b - t < o.minShot) continue;
        const c = motion(t) + 0.002 * Math.abs(t - ideal); // stillest, then nearest the ideal spot
        if (c < cost) { cost = c; best = t; }
      }
      if (best != null) cuts.push({ t: best, cut: "still" });
    }
    cuts.forEach((c, m) => out.push({ start: c.t, end: m + 1 < cuts.length ? cuts[m + 1].t : b, cut: c.cut }));
  });
  return out;
}

async function grab(src: string, t: number, out: string, width: number) {
  await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", t.toFixed(3), "-i", src, "-frames:v", "1", "-vf", `scale='min(${width},iw)':-2`, "-q:v", "3", out]);
}

/** One reference frame at source time t, at the film's size, as PNG bytes (for `compare`). */
export async function referenceFrame(src: string, t: number, width: number, height: number): Promise<Buffer> {
  const r = await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", Math.max(0, t).toFixed(3), "-i", src, "-frames:v", "1",
    "-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`, "-f", "image2pipe", "-vcodec", "png", "-"],
    { ...BIG, encoding: "buffer" as const });
  if (!r.stdout.length) throw new Error(`No reference frame at ${t.toFixed(2)}s`);
  return r.stdout;
}

/** Run jobs with a small pool of workers. */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

const dataUrl = async (p: string) => `data:image/jpeg;base64,${(await readFile(p)).toString("base64")}`;

/** A captioned grid of images, rendered in headless Chrome. */
async function grid(cells: { file: string; cap: string }[], cols: number, cellW: number, out: string) {
  cols = Math.min(cols, cells.length);
  const b = await browser();
  const page = await b.newPage({ viewport: { width: cols * (cellW + 16) + 16, height: 300 } });
  try {
    const imgs = await Promise.all(cells.map((c) => dataUrl(c.file)));
    await page.setContent(`<body style="margin:0;padding:16px;background:#111;font:15px system-ui;color:#ddd;display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:16px">${cells
      .map((c, i) => `<figure style="margin:0"><img style="width:${cellW}px;display:block;border-radius:3px" src="${imgs[i]}"><figcaption style="margin-top:6px">${c.cap}</figcaption></figure>`)
      .join("")}</body>`);
    await writeFile(out, await page.screenshot({ fullPage: true, type: "jpeg", quality: 80 }));
  } finally {
    await page.close();
  }
}

const f2 = (n: number) => n.toFixed(2);

export interface ImportOptions { threshold?: number; minShot?: number; maxShot?: number; step?: number; log?: (s: string) => void }

/** Analyze `src` and write the reference folder, the placeholder film and timeline.json into project `dir`.
 *  `dir` already holds templates/project; `lib` and `styles` are the starter film's lib.js and styles.css. */
export async function importVideo(src: string, dir: string, title: string, starter: { lib: string; styles: string }, o: ImportOptions = {}) {
  const log = o.log || (() => {});
  const threshold = o.threshold ?? 0.3, minShot = o.minShot ?? 0.4, maxShot = o.maxShot ?? 6;
  const ext = extname(src).toLowerCase();
  const info = await probe(src).catch((e) => {
    throw new Error(e.code === "ENOENT" ? "Cloning a video needs ffmpeg (brew install ffmpeg)." : `Couldn't read that video. ${String(e.stderr || e.message).trim().split("\n").pop()?.replace(/^.*?: /, "")}`);
  });
  // about one frame every half second, capped near 240 frames so long videos stay light
  const step = o.step ?? Math.max(0.5, info.duration / 240);

  const refDir = join(dir, "reference");
  await mkdir(join(refDir, "frames"), { recursive: true });
  await mkdir(join(refDir, "shots"), { recursive: true });
  const source = `reference/source${ext}`;
  await copyFile(src, join(dir, source));

  log("Finding cuts…");
  const ranges = segment(await sceneScores(src, info.start), info.duration, { threshold, minShot, maxShot, target: Math.max(minShot * 2, Math.min(4, maxShot * 0.7)) });
  const pad = String(ranges.length).length < 2 ? 2 : String(ranges.length).length;
  const shots: RefShot[] = ranges.map(({ start: a, end: b, cut }, i) => {
    const id = `shot-${String(i + 1).padStart(pad, "0")}`;
    const n = Math.max(2, Math.ceil((b - a) / step));
    const frames = Array.from({ length: n }, (_, j) => {
      const t = +(a + ((b - a) * j) / n + 0.5 / info.fps).toFixed(3);
      return { t, file: `reference/frames/${id}/t${f2(t)}.jpg` };
    });
    return { id, start: +a.toFixed(3), end: +b.toFixed(3), cut, strip: null, frames };
  });

  log(`Sampling ${shots.reduce((s, x) => s + x.frames.length, 0)} frames from ${shots.length} shots…`);
  for (const s of shots) await mkdir(join(refDir, "frames", s.id), { recursive: true });
  await pool(shots.flatMap((s) => s.frames), 6, (f) => grab(src, f.t, join(dir, f.file), 960));

  let audio: string | null = null;
  if (info.hasAudio) {
    log("Extracting the soundtrack…");
    audio = "audio/music/original-audio.wav";
    await mkdir(join(dir, "audio", "music"), { recursive: true });
    await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", join(dir, audio)], BIG)
      .catch(() => { audio = null; });
  }

  // contact sheets for agents: one frame per shot, and each shot's frames with their times
  log("Drawing contact sheets…");
  try {
    await grid(shots.map((s) => ({ file: join(dir, s.frames[Math.floor(s.frames.length / 2)].file), cap: `${s.id} · ${f2(s.start)}–${f2(s.end)}s` })), 4, 400, join(refDir, "sheet.jpg"));
    for (const s of shots) {
      const pick = s.frames.length <= 8 ? s.frames : Array.from({ length: 8 }, (_, j) => s.frames[Math.round((j * (s.frames.length - 1)) / 7)]);
      s.strip = `reference/shots/${s.id}.jpg`;
      await grid(pick.map((f) => ({ file: join(dir, f.file), cap: `${f2(f.t)}s` })), 4, 400, join(dir, s.strip));
    }
  } catch (e: any) {
    log(`Skipped contact sheets: ${e.message}`);
    for (const s of shots) s.strip = null;
  }

  const ref: Reference = { version: 1, source, original: src, width: info.width, height: info.height, fps: info.fps, duration: +info.duration.toFixed(3), audio, threshold, maxShot, shots };
  await writeFile(join(refDir, "shots.json"), JSON.stringify(ref, null, 2) + "\n");

  await writeFilm(dir, title, ref, starter);
  await writeFile(join(dir, "timeline.json"), JSON.stringify(timelineFor(ref, title), null, 2) + "\n");
  await noteInAgents(dir, ref);
  return ref;
}

async function writeFilm(dir: string, title: string, ref: Reference, starter: { lib: string; styles: string }) {
  await mkdir(join(dir, "film", "scenes"), { recursive: true });
  const lib = starter.lib.replace(/FilmKit\.create\(\{[^}]*\}\)/, `FilmKit.create({ title: ${JSON.stringify(title)}, width: ${ref.width}, height: ${ref.height}, fps: ${ref.fps}, background: '#000000' })`);
  await writeFile(join(dir, "film", "lib.js"), lib);
  await writeFile(join(dir, "film", "styles.css"), starter.styles);
  await writeFile(join(dir, "film", "reference.js"), REFERENCE_JS);
  for (const [i, s] of ref.shots.entries()) {
    const frames = s.frames.map((f) => `  [${f.t}, '${f.file}'],`).join("\n");
    await writeFile(join(dir, "film", "scenes", `${s.id}.js`), `// ${s.id}: shot ${i + 1} of ${ref.shots.length} in ${ref.source}, ${f2(s.start)}–${f2(s.end)}s.
// PLACEHOLDER: shows the reference frames. Rebuild it as code: replace refScene(...) with film.scene(...) and keep the
// same id, start and end (the scene clock is the reference video's time). Reference: ${s.strip || `reference/frames/${s.id}/`}
refScene({
  id: '${s.id}', label: 'Shot ${i + 1}', start: ${s.start}, end: ${s.end},
  notes: 'Placeholder. Rebuild from ${s.strip || `reference/frames/${s.id}/`}.',
}, [
${frames}
]);
`);
  }
  await writeFile(join(dir, "film", "edit.js"), `// Default cut: every shot at its original length, in order. timeline.json is the source of truth after this.
film.edit([
${ref.shots.map((s) => `  { scene: '${s.id}' },`).join("\n")}
]);
film.start();
`);
  await writeFile(join(dir, "film.html"), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"))}</title>
<link rel="stylesheet" href="film/styles.css">
</head>
<body>
<script src="film/film-kit.js"></script>
<script src="film/lib.js"></script>
<!-- placeholders for shots not rebuilt yet; remove once no scene calls refScene -->
<script src="film/reference.js"></script>
<!-- one file per scene; this order is the scene bin order in the studio -->
${ref.shots.map((s) => `<script src="film/scenes/${s.id}.js"></script>`).join("\n")}
<!-- default cut + start: must stay last -->
<script src="film/edit.js"></script>
</body>
</html>
`);
}

/** The cut as imported: one clip per shot at native speed, plus the original soundtrack on the Music track. */
function timelineFor(ref: Reference, title: string): Timeline {
  const tl = emptyTimeline(title);
  tl.fps = ref.fps; tl.width = ref.width; tl.height = ref.height;
  tl.clips = ref.shots.map((s) => ({ id: uid("c_"), scene: s.id, in: s.start, out: s.end, duration: +(s.end - s.start).toFixed(3), xfade: 0 }));
  const music = tl.tracks.find((t) => t.kind === "music");
  if (ref.audio && music) {
    // +dB to cancel the track's default gain, so the reference plays as loud as the original
    music.clips.push({ id: uid("a_"), label: "Original audio", asset: ref.audio, assetDuration: ref.duration, start: 0, anchor: null, in: 0, duration: null, gain: -music.gain, fadeIn: 0, fadeOut: 0 });
  }
  return tl;
}

async function noteInAgents(dir: string, ref: Reference) {
  const p = join(dir, "AGENTS.md");
  const agents = await readFile(p, "utf8");
  const note = `## Rebuilding the reference video

This project was cloned from a video: \`${ref.source}\` (${ref.width}×${ref.height}, ${ref.fps} fps, ${f2(ref.duration)} s, ${ref.shots.length} shots). The job is to rebuild it as code, shot by shot.

- \`reference/shots.json\` lists the shots Shot detected: id, start and end in the source video, and the sampled frames.
- \`reference/sheet.jpg\` shows one frame per shot. \`reference/shots/<id>.jpg\` shows one shot's frames with their times. Full frames are in \`reference/frames/<id>/\`.
- Each \`film/scenes/shot-NN.js\` starts as a placeholder that shows the reference frames (\`refScene\` in \`film/reference.js\`). Rebuild it by replacing \`refScene(...)\` with a real \`film.scene(...)\` that keeps the same \`id\`, \`start\` and \`end\`.
- A shot scene's clock is the source video's time: scene time 5.1 in a shot is 5.1 s into the reference video. Keep the ids and clocks so \`compare\` can line them up after any retiming.
- ${ref.audio ? `The original soundtrack is the "Original audio" clip on the Music track (\`${ref.audio}\`), so timing can be checked against it. Remove that clip once the film has its own voiceover and music.` : "The reference video has no soundtrack."}
- Each shot's \`cut\` in \`shots.json\` says how it begins. \`"cut"\` is a visible cut. \`"still"\` means the picture was continuous there and Shot split a long stretch at its stillest moment, so the previous shot's last frame and this shot's first frame must match.
- Detection can merge two shots (fades, dissolves) or split one (flashes, fast motion). If it did, fix the scene files, \`timeline.json\` and \`reference/shots.json\` together.

For each shot:

1. Look at \`reference/shots/<id>.jpg\`, and open full frames for detail (type, colors, layout).
2. Write the scene. Shared styles and helpers go in \`film/styles.css\` and \`film/lib.js\`.
3. Run \`compare -- . --shot <id>\`. It renders the scene next to the reference at the same times and prints a similarity score (SSIM, 1 = identical). Look at the image, fix, repeat.
4. When no scene calls \`refScene\` any more, delete \`film/reference.js\` and its script tag in \`film.html\`.

`;
  await writeFile(p, agents.replace("## Layout", `${note}## Layout`));
  const gi = join(dir, ".gitignore");
  if (existsSync(gi)) await writeFile(gi, (await readFile(gi, "utf8")) + `# the reference video (large; frames and shots.json stay)\n${ref.source}\n`);
}

export async function readReference(dir: string): Promise<Reference | null> {
  const p = join(dir, "reference", "shots.json");
  if (!existsSync(p)) return null;
  return JSON.parse(await readFile(p, "utf8"));
}

const REFERENCE_JS = `// Placeholders for a film cloned from a video (Shot's video import). A placeholder scene shows the reference
// video's frames until it's rebuilt as code. Once no scene calls refScene, delete this file and its <script> tag.

/** Register a placeholder scene. frames: [[t, src], ...] sorted by t, on the scene's clock (= reference video time). */
function refScene(meta, frames) {
  const imgs = frames.map(([t, src]) => { const img = new Image(); img.src = src; return { t, img }; });
  film.before(Promise.all(imgs.map((f) => f.img.decode().catch(() => {}))));
  (window.__refPlaceholders = window.__refPlaceholders || []).push(meta.id);
  film.scene(meta, el => {
    const box = mk(el, null, { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px', background: '#000' });
    for (const f of imgs) {
      Object.assign(f.img.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', objectFit: 'contain' });
      box.appendChild(f.img);
    }
    mk(el, null, {
      position: 'absolute', left: '24px', bottom: '24px', padding: '8px 14px', borderRadius: '8px', background: 'rgba(0,0,0,.6)',
      color: '#fff', font: '500 22px/1.2 system-ui, sans-serif', letterSpacing: '.02em',
    }, (meta.label || meta.id) + ' · reference frame');
    return t => {
      let k = 0;
      for (let j = 0; j < imgs.length; j++) if (imgs[j].t <= t + 1e-3) k = j;
      imgs.forEach((f, j) => { f.img.style.display = j === k ? 'block' : 'none'; });
    };
  });
}
`;
