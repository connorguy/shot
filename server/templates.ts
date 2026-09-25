// Film templates: templates/films/<id>/{template.json, preview.jpg, film.html, film/…, timeline.json?}
// A template is a film's look and structure (scenes, styles, assets, the cut, voice settings) without any
// audio. New projects copy it; "Save as template" makes one from a project.
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { ASPECTS, layersAt, normalizeTimeline, templateTimeline, totalDuration, type Aspect, type Timeline } from "../shared/timeline.ts";
import { openFilm, renderLayers } from "./chrome.ts";
import { projectDir, readTimeline, slugify, type Ctx } from "./projects.ts";

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  tags: string[];
  scenes: number | null;
  duration: number | null;
  from: string | null;
  createdAt: string | null;
  hasPreview: boolean;
  width: number; height: number; // the film's stage
}

/** Built-in templates ship in the app; when the app folder is a package install (Homebrew), templates
 *  you save go to ~/.shot/templates so upgrades don't wipe them. Both are listed. */
const packaged = (ctx: Ctx) => /\/Cellar\//.test(ctx.root) || !!process.env.SHOT_PACKAGED;
const userTemplatesDir = () => join(process.env.STUDIO_HOME || join(homedir(), ".shot"), "templates");
export const templatesDir = (ctx: Ctx) => (packaged(ctx) ? userTemplatesDir() : join(ctx.root, "templates", "films"));
const templateRoots = (ctx: Ctx) => [...new Set([join(ctx.root, "templates", "films"), userTemplatesDir()])];

export function templateDir(ctx: Ctx, id: string) {
  if (!id || /[/\\]/.test(id) || id.startsWith(".")) throw new Error("bad template id");
  for (const root of templateRoots(ctx)) {
    const dir = join(root, id);
    if (existsSync(join(dir, "template.json"))) return dir;
  }
  throw new Error(`No template "${id}". List them with: shot template list`);
}

export async function listTemplates(ctx: Ctx): Promise<TemplateInfo[]> {
  const out: TemplateInfo[] = [];
  const seen = new Set<string>();
  for (const root of templateRoots(ctx)) {
  if (!existsSync(root)) continue;
  for (const e of await readdir(root, { withFileTypes: true })) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    const meta = join(root, e.name, "template.json");
    if (!e.isDirectory() || !existsSync(meta)) continue;
    try {
      const t = JSON.parse(await readFile(meta, "utf8"));
      const size = await stageSize(join(root, e.name));
      out.push({
        id: e.name, name: t.name || e.name, description: t.description || "", tags: t.tags || [],
        scenes: t.scenes ?? null, duration: t.duration ?? null, from: t.from ?? null, createdAt: t.createdAt ?? null,
        hasPreview: existsSync(join(root, e.name, "preview.jpg")), ...size,
      });
    } catch { /* skip unreadable template.json */ }
  }
  }
  // the starter first, then newest
  return out.sort((a, b) => (a.id === "starter" ? -1 : b.id === "starter" ? 1 : (b.createdAt || "").localeCompare(a.createdAt || "")));
}

/** A film folder's stage size: its timeline.json, else the FilmKit.create(...) call in film/lib.js. */
async function stageSize(dir: string): Promise<{ width: number; height: number }> {
  try {
    const tl = JSON.parse(await readFile(join(dir, "timeline.json"), "utf8"));
    if (tl.width && tl.height) return { width: tl.width, height: tl.height };
  } catch { /* no cut saved with the template */ }
  const lib = await readFile(join(dir, "film", "lib.js"), "utf8").catch(() => "");
  const call = /FilmKit\.create\(\{[^}]*\}\)/.exec(lib)?.[0] || "";
  return { width: Number(/width:\s*(\d+)/.exec(call)?.[1]) || 1920, height: Number(/height:\s*(\d+)/.exec(call)?.[1]) || 1080 };
}

/** Change a new project's stage size: the FilmKit.create(...) call in film/lib.js, timeline.json and the brief. */
export async function setStageSize(dir: string, aspect: Aspect) {
  const { width, height, ratio } = ASPECTS[aspect];
  const lib = join(dir, "film", "lib.js");
  if (existsSync(lib)) {
    const s = await readFile(lib, "utf8");
    await writeFile(lib, s.replace(/FilmKit\.create\(\{[^}]*\}\)/, (call) => call.replace(/width:\s*\d+/, `width: ${width}`).replace(/height:\s*\d+/, `height: ${height}`)));
  }
  const tlPath = join(dir, "timeline.json");
  if (existsSync(tlPath)) {
    const tl = JSON.parse(await readFile(tlPath, "utf8"));
    tl.width = width; tl.height = height;
    await writeFile(tlPath, JSON.stringify(tl, null, 2) + "\n");
  }
  const brief = join(dir, "brief.md");
  if (existsSync(brief)) await writeFile(brief, (await readFile(brief, "utf8")).replace(/^- Aspect: .*$/m, `- Aspect: ${width}×${height} (${ratio})`));
}

/** Files that make up a film, skipping audio, renders, history and docs that belong to one project. */
const FILM_SKIP = new Set(["audio", "exports", ".history", ".frames", "reference", "timeline.json", "AGENTS.md", "CLAUDE.md", "brief.md", ".gitignore", "template.json", "preview.jpg"]);

async function copyFilm(from: string, to: string) {
  await mkdir(to, { recursive: true });
  for (const e of await readdir(from, { withFileTypes: true })) {
    if (FILM_SKIP.has(e.name) || e.name === ".DS_Store") continue;
    await cp(join(from, e.name), join(to, e.name), { recursive: true });
  }
}

/** Render a cover still (960×540) for a template folder, at timeline time `at` (default: 35% in). */
export async function renderPreview(ctx: Ctx, id: string, at?: number | null) {
  const dir = templateDir(ctx, id);
  const meta = JSON.parse(await readFile(join(dir, "template.json"), "utf8"));
  // render a filled copy so starter placeholders like {{TITLE}} read as the template name
  const tmp = await mkdtemp(join(tmpdir(), "shot-tpl-"));
  try {
    await cp(dir, tmp, { recursive: true });
    await mkdir(join(tmp, "film"), { recursive: true });
    await cp(join(ctx.root, "film-kit", "film-kit.js"), join(tmp, "film", "film-kit.js")); // templates get the runtime at creation
    for (const f of ["film.html", "film/lib.js", ...(await readdir(join(tmp, "film", "scenes")).catch(() => [] as string[])).map((s) => `film/scenes/${s}`)]) {
      const p = join(tmp, f);
      if (existsSync(p)) await writeFile(p, (await readFile(p, "utf8")).replaceAll("{{TITLE}}", meta.name || id).replaceAll("{{NAME}}", id));
    }
    const tlPath = join(tmp, "timeline.json");
    const tl: Timeline | null = existsSync(tlPath) ? normalizeTimeline(JSON.parse(await readFile(tlPath, "utf8"))) : null;
    const fp = await openFilm(join(tmp, "film.html"), 0.5, { width: tl?.width || 1920, height: tl?.height || 1080 });
    try {
      if (tl && tl.clips.length) await renderLayers(fp.page, layersAt(tl, at ?? totalDuration(tl) * 0.35));
      else await fp.page.evaluate((a) => { const f = (window as any).__film; f.renderAt(a ?? f.duration * 0.35); }, at ?? null);
      await writeFile(join(dir, "preview.jpg"), await fp.page.screenshot({ type: "jpeg", quality: 82 }));
    } finally {
      await fp.close();
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

export interface SaveTemplate { name: string; description?: string; tags?: string[]; at?: number | null; includeCut?: boolean; overwrite?: boolean }

/** Save a project as a template: film sources + (optionally) its cut, never its audio. */
export async function saveTemplate(ctx: Ctx, project: string, o: SaveTemplate) {
  const name = o.name.trim();
  if (!name) throw new Error("Give the template a name.");
  const id = slugify(name);
  const dst = join(templatesDir(ctx), id);
  if (existsSync(dst)) {
    if (!o.overwrite) throw new Error(`A template called "${id}" already exists. Pick another name or choose to replace it.`);
    await rm(dst, { recursive: true, force: true });
  }
  const src = projectDir(ctx, project);
  await copyFilm(src, dst);
  const tl = await readTimeline(ctx, project);
  if (tl && o.includeCut !== false) await writeFile(join(dst, "timeline.json"), JSON.stringify(templateTimeline(tl, name), null, 2) + "\n");
  const scenes = existsSync(join(dst, "film", "scenes")) ? (await readdir(join(dst, "film", "scenes"))).filter((f) => f.endsWith(".js")).length : null;
  await writeFile(join(dst, "template.json"), JSON.stringify({
    name, description: o.description?.trim() || "", tags: o.tags || [],
    from: tl?.name || project, scenes, duration: tl && o.includeCut !== false ? +totalDuration(tl).toFixed(2) : null,
    createdAt: new Date().toISOString(),
  }, null, 2) + "\n");
  await renderPreview(ctx, id, o.includeCut !== false ? o.at : null).catch(() => {});
  return { id, dir: dst };
}

/** Copy a template's film (and cut) into a new project folder. `fill` replaces {{TITLE}}/{{NAME}}. */
export async function applyTemplate(ctx: Ctx, id: string, dir: string, fill: (s: string) => string, title: string) {
  const src = templateDir(ctx, id);
  await copyFilm(src, dir);
  const texts = ["film.html", "film/lib.js", "film/edit.js"];
  if (existsSync(join(dir, "film", "scenes"))) for (const f of await readdir(join(dir, "film", "scenes"))) texts.push(`film/scenes/${f}`);
  for (const f of texts) {
    const p = join(dir, f);
    if (existsSync(p)) await writeFile(p, fill(await readFile(p, "utf8")));
  }
  const tlPath = join(src, "timeline.json");
  if (existsSync(tlPath)) {
    const tl = normalizeTimeline(JSON.parse(await readFile(tlPath, "utf8")));
    tl.name = title;
    tl.seedVo = true;
    await writeFile(join(dir, "timeline.json"), JSON.stringify(tl, null, 2) + "\n");
  }
}
