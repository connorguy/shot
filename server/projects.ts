// Projects: one folder per film, anywhere on disk.
//   <dir>/{AGENTS.md, CLAUDE.md, brief.md, film.html, film/, timeline.json, audio/{vo,music,sfx}, exports/}
// Folders under shot/projects/ are found automatically; others are remembered in a registry
// (~/.shot/projects.json) and addressed by a short id everywhere (API routes, CLI, caches).
import { execFile, execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { copyFile, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { ASPECTS, normalizeTimeline, type Aspect, type Timeline } from "../shared/timeline.ts";
import { applyTemplate, setStageSize } from "./templates.ts";
import { importVideo, VIDEO_EXT } from "./video.ts";

const run = promisify(execFile);

export interface Ctx { root: string; projectsDir: string }

export function makeCtx(root: string): Ctx {
  return { root, projectsDir: process.env.STUDIO_PROJECTS ? resolve(process.env.STUDIO_PROJECTS) : join(root, "projects") };
}

export const slugify = (s: string) =>
  s.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "film";

export const expandHome = (p: string) => (p === "~" || p.startsWith("~/") ? join(homedir(), p.slice(1)) : p);

// ───────── registry ─────────

interface Registry { projects: { id: string; path: string }[]; lastParent?: string }
const REG_FILE = join(process.env.STUDIO_HOME || join(homedir(), ".shot"), "projects.json");

function readRegistry(): Registry {
  try {
    const r = JSON.parse(readFileSync(REG_FILE, "utf8"));
    return { projects: Array.isArray(r.projects) ? r.projects : [], lastParent: r.lastParent };
  } catch {
    return { projects: [] };
  }
}
function writeRegistry(r: Registry) {
  mkdirSync(dirname(REG_FILE), { recursive: true });
  writeFileSync(REG_FILE, JSON.stringify(r, null, 2) + "\n");
}

const isFilmDir = (dir: string) => existsSync(join(dir, "film.html"));
const insideDefault = (ctx: Ctx, dir: string) => dirname(resolve(dir)) === resolve(ctx.projectsDir);

/** Remember a project folder and return its id. Folders directly under projects/ need no entry. */
export function registerProject(ctx: Ctx, dirIn: string): string {
  const dir = resolve(expandHome(dirIn));
  if (insideDefault(ctx, dir)) return basename(dir);
  const reg = readRegistry();
  const hit = reg.projects.find((p) => resolve(p.path) === dir);
  if (hit) return hit.id;
  // forget folders that were moved or deleted, so a moved project gets its old id back
  reg.projects = reg.projects.filter((p) => isFilmDir(p.path));
  const taken = new Set([...reg.projects.map((p) => p.id), ...(existsSync(ctx.projectsDir) ? readdirSync(ctx.projectsDir) : [])]);
  const base = slugify(basename(dir));
  let id = base, i = 2;
  while (taken.has(id)) id = `${base}-${i++}`;
  reg.projects.push({ id, path: dir });
  writeRegistry(reg);
  return id;
}

export function forgetProject(id: string) {
  const reg = readRegistry();
  reg.projects = reg.projects.filter((p) => p.id !== id);
  writeRegistry(reg);
}

export function newProjectDefaults(ctx: Ctx) {
  const reg = readRegistry();
  const movies = join(homedir(), "Movies");
  const parent = reg.lastParent && existsSync(reg.lastParent) ? reg.lastParent : existsSync(movies) ? movies : homedir();
  return { parent, studioProjects: ctx.projectsDir, home: homedir() };
}

export function projectDir(ctx: Ctx, id: string): string {
  if (!id || id.includes("/") || id.includes("\\") || id.startsWith(".")) throw new Error("bad project id");
  const reg = readRegistry().projects.find((p) => p.id === id);
  if (reg) return resolve(reg.path);
  return resolve(ctx.projectsDir, id);
}

/** Resolve a project-relative path, refusing anything that escapes the project folder, by `..` or by a symlink. */
export function projectFile(ctx: Ctx, id: string, rel: string): string {
  const dir = projectDir(ctx, id);
  const p = resolve(dir, rel);
  const inside = (d: string, f: string) => f === d || f.startsWith(d + sep);
  if (!inside(dir, p) || !inside(realish(dir), realish(p))) throw new Error("path escapes project");
  return p;
}

/** realpath of the longest existing prefix of `p`, plus the rest (for files that don't exist yet). */
function realish(p: string): string {
  let head = p;
  const tail: string[] = [];
  for (;;) {
    try { lstatSync(head); break; } catch { /* not there yet */ }
    if (dirname(head) === head) break;
    tail.unshift(basename(head));
    head = dirname(head);
  }
  try { return join(realpathSync(head), ...tail); } catch { throw new Error("path escapes project"); } // e.g. a dangling symlink
}

export async function listProjects(ctx: Ctx) {
  const dirs: { id: string; dir: string }[] = [];
  if (existsSync(ctx.projectsDir)) {
    for (const e of await readdir(ctx.projectsDir, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith(".")) dirs.push({ id: e.name, dir: join(ctx.projectsDir, e.name) });
    }
  }
  for (const p of readRegistry().projects) dirs.push({ id: p.id, dir: p.path });
  const out = [];
  for (const { id, dir } of dirs) {
    const tlPath = join(dir, "timeline.json");
    let title = basename(dir), film = "film.html", updatedAt: string | null = null;
    if (existsSync(tlPath)) {
      try {
        const tl = JSON.parse(await readFile(tlPath, "utf8"));
        title = tl.name || title; film = tl.film || film; updatedAt = tl.updatedAt || null;
      } catch { /* unreadable timeline: still list it */ }
    }
    if (!existsSync(join(dir, film))) continue;
    out.push({ name: id, title, dir, updatedAt, hasTimeline: existsSync(tlPath) });
  }
  return out.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

// ───────── timeline ─────────

export async function readTimeline(ctx: Ctx, id: string): Promise<Timeline | null> {
  const p = projectFile(ctx, id, "timeline.json");
  if (!existsSync(p)) return null;
  return normalizeTimeline(JSON.parse(await readFile(p, "utf8")));
}

/** Atomic write, plus a rolling history of the last 40 saves in .history/. */
export async function writeTimeline(ctx: Ctx, id: string, tl: Timeline) {
  const p = projectFile(ctx, id, "timeline.json");
  tl.updatedAt = new Date().toISOString();
  const json = JSON.stringify(tl, null, 2) + "\n";
  if (existsSync(p)) {
    const prev = await readFile(p, "utf8");
    if (prev === json) return tl;
    const hist = projectFile(ctx, id, ".history");
    await mkdir(hist, { recursive: true });
    await writeFile(join(hist, `timeline-${Date.now()}.json`), prev);
    const old = (await readdir(hist)).filter((f) => f.startsWith("timeline-")).sort();
    for (const f of old.slice(0, Math.max(0, old.length - 40))) await rm(join(hist, f));
  }
  await writeFile(p + ".tmp", json);
  await rename(p + ".tmp", p);
  return tl;
}

// ───────── scaffolding ─────────

const TEXT_EXT = new Set([".md", ".html", ".js", ".css", ".json", ""]);

async function copyTree(from: string, to: string, fill: (s: string) => string, skip: (rel: string) => boolean, rel = "") {
  await mkdir(to, { recursive: true });
  for (const e of await readdir(from, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (skip(r) || e.isSymbolicLink()) continue; // a design's symlinks could point at anything on disk
    const a = join(from, e.name), b = join(to, e.name);
    if (e.isDirectory()) await copyTree(a, b, fill, skip, r);
    else if (TEXT_EXT.has(extname(e.name))) await writeFile(b, fill(await readFile(a, "utf8")));
    else await copyFile(a, b);
  }
}

/** Find the folder holding film.html inside an unpacked design (zip or folder). */
function findFilmRoot(dir: string, depth = 0): string | null {
  if (isFilmDir(dir)) return dir;
  if (depth > 3) return null;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (!e.startsWith(".") && e !== "__MACOSX" && lstatSync(p).isDirectory()) { const f = findFilmRoot(p, depth + 1); if (f) return f; }
  }
  return null;
}

/** No film.html: take the shallowest .html (largest at that depth), e.g. an older single-file player. */
function findAnyHtml(dir: string): string | null {
  let level = [dir];
  for (let depth = 0; depth < 4 && level.length; depth++) {
    const files: string[] = [], next: string[] = [];
    for (const d of level) for (const e of readdirSync(d)) {
      if (e.startsWith(".") || e === "__MACOSX" || e === "node_modules") continue;
      const p = join(d, e), s = lstatSync(p); // lstat: never follow a design's symlinks
      if (s.isDirectory()) next.push(p);
      else if (s.isFile() && e.toLowerCase().endsWith(".html")) files.push(p);
    }
    if (files.length) return files.sort((a, b) => statSync(b).size - statSync(a).size)[0];
    level = next;
  }
  return null;
}

export interface NewProject {
  name: string; // folder name (slugified)
  title?: string;
  parent?: string; // where to create it; default shot/projects
  from?: string | null; // optional design: a film .html, a .zip, or a folder with film.html
  template?: string | null; // templates/films/<id> to start from when there's no design (default "starter")
  aspect?: Aspect | null; // stage size for a template start (default: the template's own); designs and videos keep theirs
  video?: string | null; // clone a video: placeholder scenes per shot, reference frames and the soundtrack
  threshold?: number; // video: scene-change score that counts as a cut (0..1, default 0.3)
  log?: (s: string) => void;
}

/** Create a project folder with everything an agent or person needs, then register it.
 *  Always from templates/project: AGENTS.md (layout, contract, timeline, commands), CLAUDE.md, brief.md, .gitignore.
 *  Film: the design passed in `from`, placeholders cloned from `video`, or a film template (templates/films/<id>,
 *  default "starter"). Returns { id, dir }. */
export async function scaffoldProject(ctx: Ctx, p: NewProject) {
  const parent = resolve(expandHome(p.parent || ctx.projectsDir));
  const slug = slugify(p.name);
  const dir = join(parent, slug);
  if (existsSync(dir) && readdirSync(dir).filter((f) => !f.startsWith(".")).length) {
    throw new Error(`${dir} already exists and isn't empty. Pick another name or location.`);
  }
  if (!existsSync(dirname(parent))) throw new Error(`${dirname(parent)} does not exist.`);

  if (p.aspect && !(p.aspect in ASPECTS)) throw new Error(`Aspect is one of ${Object.keys(ASPECTS).join(", ")}.`);
  // resolve the design source first so a bad source leaves nothing behind
  let html: string | null = null, designDir: string | null = null, video: string | null = null;
  if (p.video) {
    video = resolve(expandHome(p.video));
    if (!existsSync(video) || !statSync(video).isFile()) throw new Error(`Video not found: ${video}`);
    if (!VIDEO_EXT.has(extname(video).toLowerCase())) throw new Error(`Pick a video file (${[...VIDEO_EXT].join(", ")}).`);
  } else if (p.from) {
    const src = resolve(expandHome(p.from));
    if (!existsSync(src)) throw new Error(`Design not found: ${src}`);
    if (src.toLowerCase().endsWith(".html")) html = readFileSync(src, "utf8");
    else {
      let unpacked = src;
      if (src.toLowerCase().endsWith(".zip")) {
        unpacked = mkdtempSync(join(tmpdir(), "studio-design-"));
        execFileSync("unzip", ["-q", src, "-d", unpacked]);
      }
      designDir = findFilmRoot(unpacked);
      if (!designDir) {
        const one = findAnyHtml(unpacked);
        if (!one) throw new Error(`No film.html (or any .html) in ${src}`);
        html = readFileSync(one, "utf8");
      }
    }
  }

  const title = (p.title || p.name).trim();
  const studioRef = insideDefault(ctx, dir) ? "../.." : ctx.root.replace(/\/+$/, "");
  const fill = (s: string) => s.replaceAll("{{TITLE}}", title).replaceAll("{{NAME}}", slug).replaceAll("{{STUDIO}}", studioRef);
  const existed = existsSync(dir);
  await copyTree(join(ctx.root, "templates", "project"), dir, fill, () => false);
  if (video) {
    const starter = join(ctx.root, "templates", "films", "starter", "film");
    const lib = fill(await readFile(join(starter, "lib.js"), "utf8")), styles = await readFile(join(starter, "styles.css"), "utf8");
    try {
      await importVideo(video, dir, title, { lib, styles }, { threshold: p.threshold, log: p.log });
    } catch (e) {
      if (!existed) await rm(dir, { recursive: true, force: true });
      throw e;
    }
  } else if (!html && !designDir) {
    await applyTemplate(ctx, p.template || "starter", dir, fill, title);
    if (p.aspect) await setStageSize(dir, p.aspect);
  }
  if (designDir) await copyTree(designDir, dir, (s) => s, (r) => ["AGENTS.md", "CLAUDE.md", "timeline.json"].includes(r) || r.startsWith("exports") || r.startsWith(".history"));
  if (html != null) await writeFile(join(dir, "film.html"), html);

  const filmHtml = await readFile(join(dir, "film.html"), "utf8");
  if (/src=["']film\/film-kit\.js["']/.test(filmHtml)) { // always the studio's current runtime (it stays backward compatible)
    await mkdir(join(dir, "film"), { recursive: true });
    await copyFile(join(ctx.root, "film-kit", "film-kit.js"), join(dir, "film", "film-kit.js"));
  }
  if (!existsSync(join(dir, "film"))) {
    const agents = await readFile(join(dir, "AGENTS.md"), "utf8");
    await writeFile(join(dir, "AGENTS.md"), agents.replace(
      "## Layout",
      "> **This film is still a single file.** All scenes live in `film.html`. Before heavy edits, move each `film.scene(...)` call into `film/scenes/<id>.js` and the shared helpers into `film/lib.js`, matching the layout below. The studio works either way.\n\n## Layout",
    ));
  }
  for (const d of ["audio/vo", "audio/music", "audio/sfx", "exports"]) await mkdir(join(dir, d), { recursive: true });

  const id = registerProject(ctx, dir);
  if (!insideDefault(ctx, dir)) { const reg = readRegistry(); reg.lastParent = parent; writeRegistry(reg); }
  return { id, dir };
}

/** Copy a project to a new folder (default: next to it, "<name>-copy") and register it. Keeps the film, the
 *  timeline, audio and reference; leaves out renders, history and stills, which belong to the original. */
export async function duplicateProject(ctx: Ctx, id: string, o: { title?: string; parent?: string } = {}) {
  const src = projectDir(ctx, id);
  if (!isFilmDir(src)) throw new Error(`No project "${id}".`);
  const tl = await readTimeline(ctx, id);
  const oldTitle = tl?.name || basename(src);
  const title = (o.title || `${oldTitle} copy`).trim();
  const parent = resolve(expandHome(o.parent || dirname(src)));
  const dir = join(parent, slugify(title));
  if (existsSync(dir) && readdirSync(dir).filter((f) => !f.startsWith(".")).length) {
    throw new Error(`${dir} already exists and isn't empty. Pick another name.`);
  }
  const skip = new Set(["exports", ".history", ".frames", ".git", "node_modules"]);
  await cp(src, dir, { recursive: true, filter: (from) => { const r = relative(src, from); return !skip.has(r.split(sep)[0]) && basename(from) !== ".DS_Store"; } });
  await mkdir(join(dir, "exports"), { recursive: true });
  if (tl) {
    tl.name = title;
    delete tl.updatedAt;
    await writeFile(join(dir, "timeline.json"), JSON.stringify(tl, null, 2) + "\n");
  }
  // the docs' headings name the film
  for (const f of ["AGENTS.md", "brief.md"]) {
    const p = join(dir, f), head = `# ${oldTitle}:`;
    const text = existsSync(p) ? await readFile(p, "utf8") : "";
    if (text.startsWith(head)) await writeFile(p, `# ${title}:${text.slice(head.length)}`);
  }
  return { id: registerProject(ctx, dir), dir };
}

/** Add an existing project folder (must contain film.html) to the studio. */
export function openProjectFolder(ctx: Ctx, path: string) {
  const dir = resolve(expandHome(path));
  if (!isFilmDir(dir)) throw new Error(`${dir} has no film.html, so it isn't a film project.`);
  return { id: registerProject(ctx, dir), dir };
}

// ───────── versions, media ─────────

export async function fileVersion(p: string): Promise<string> {
  const s = await stat(p);
  return String(Math.round(s.mtimeMs));
}

export async function timelineVersion(ctx: Ctx, id: string): Promise<string | null> {
  const p = projectFile(ctx, id, "timeline.json");
  return existsSync(p) ? fileVersion(p) : null;
}

const NOT_FILM = new Set(["audio", "exports", "node_modules", "reference", "timeline.json"]);

/** Version of everything that can change a frame: newest mtime among the project's film sources
 *  (film.html, scene files, styles, assets), ignoring audio, exports, timeline, dotfiles and docs. */
export async function filmVersion(ctx: Ctx, id: string): Promise<string | null> {
  const dir = projectDir(ctx, id);
  if (!existsSync(dir)) return null;
  let newest = 0;
  const walk = async (d: string, depth: number) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      if (NOT_FILM.has(e.name) || e.name.startsWith(".") || (depth === 0 && e.name.endsWith(".md"))) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) { if (depth < 6) await walk(p, depth + 1); }
      else newest = Math.max(newest, (await stat(p)).mtimeMs);
    }
  };
  await walk(dir, 0);
  return newest ? String(Math.round(newest)) : null;
}

const durCache = new Map<string, { v: string; d: number | null }>();
export async function probeDuration(p: string): Promise<number | null> {
  const v = await fileVersion(p).catch(() => "");
  const hit = durCache.get(p);
  if (hit && hit.v === v) return hit.d;
  let d: number | null = null;
  try {
    const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", p]);
    d = parseFloat(stdout.trim());
    if (!isFinite(d)) d = null;
  } catch { d = null; }
  durCache.set(p, { v, d });
  return d;
}

const AUDIO_EXT = new Set([".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac", ".aif", ".aiff"]);

export async function saveAsset(ctx: Ctx, id: string, kind: string, filename: string, data: Buffer) {
  const sub = ["vo", "music", "sfx"].includes(kind) ? kind : "sfx";
  const ext = extname(filename).toLowerCase() || ".wav";
  if (!AUDIO_EXT.has(ext)) throw new Error(`Unsupported audio type ${ext}`);
  const base = slugify(basename(filename, extname(filename)));
  const dir = projectFile(ctx, id, `audio/${sub}`);
  await mkdir(dir, { recursive: true });
  let file = `${base}${ext}`, i = 2;
  while (existsSync(join(dir, file))) file = `${base}-${i++}${ext}`;
  await writeFile(join(dir, file), data);
  const rel = `audio/${sub}/${file}`;
  return { asset: rel, duration: await probeDuration(join(dir, file)) };
}

export async function listAssets(ctx: Ctx, id: string) {
  const out: { asset: string; kind: string; duration: number | null; size: number }[] = [];
  for (const kind of ["music", "sfx", "vo"]) {
    const dir = projectFile(ctx, id, `audio/${kind}`);
    if (!existsSync(dir)) continue;
    for (const f of (await readdir(dir)).sort()) {
      if (!AUDIO_EXT.has(extname(f).toLowerCase())) continue;
      const p = join(dir, f);
      out.push({ asset: relative(projectDir(ctx, id), p).split(sep).join("/"), kind, duration: await probeDuration(p), size: (await stat(p)).size });
    }
  }
  return out;
}
