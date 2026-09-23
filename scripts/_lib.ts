// Shared plumbing for the CLI scripts (run with Node 22.18+ type stripping: `node scripts/x.ts`).
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedVoFromManifest, timelineFromManifest, type FilmManifest, type Timeline } from "../shared/timeline.ts";
import { closeBrowser, openFilm } from "../server/chrome.ts";
import { expandHome, makeCtx, openProjectFolder, projectDir, projectFile, readTimeline, writeTimeline } from "../server/projects.ts";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// shot/.env and ~/.shot/.env -> process.env (same keys the dev server reads)
for (const envFile of [join(ROOT, ".env"), join(process.env.STUDIO_HOME || join(homedir(), ".shot"), ".env")]) {
  if (!existsSync(envFile)) continue;
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export const ctx = makeCtx(ROOT);

export interface Args { _: string[]; flags: Record<string, string | true> }
export function parseArgs(argv = process.argv.slice(2)): Args {
  const out: Args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) out.flags[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) out.flags[k] = argv[++i];
      else out.flags[k] = true;
    } else out._.push(a);
  }
  return out;
}

export function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

/** A project id (as listed in the studio) or a path to a project folder; `.` works from inside one
 *  (npm sets INIT_CWD to where you ran it). Folders are registered with the studio on first use. */
export function requireProject(arg: string | undefined, usage: string): string {
  if (!arg) die(`usage: ${usage}`);
  const looksLikePath = arg === "." || arg.includes("/") || arg.startsWith("~");
  if (looksLikePath) {
    const dir = resolve(process.env.INIT_CWD || process.cwd(), expandHome(arg));
    try { return openProjectFolder(ctx, dir).id; } catch (e: any) { die(e.message); }
  }
  try {
    if (existsSync(join(projectDir(ctx, arg), "film.html"))) return arg;
  } catch { /* fall through */ }
  die(`No project "${arg}". Pass its folder path, or one of the ids the studio lists.`);
}

export const framesDir = (project: string) => join(projectDir(ctx, project), ".frames");

/** Scene list straight from the film (headless Chrome), including scenes that fail to build. */
export async function manifestOf(project: string, film = "film.html"): Promise<FilmManifest> {
  const fp = await openFilm(projectFile(ctx, project, film), 0.25);
  try { return fp.manifest; } finally { await fp.close(); }
}

/** The project's timeline; seeds (and saves) one from the film's default cut if there is none yet. */
export async function timelineOf(project: string, manifest?: FilmManifest): Promise<Timeline> {
  const tl = await readTimeline(ctx, project);
  if (tl?.seedVo) {
    const seeded = seedVoFromManifest(tl, manifest || (await manifestOf(project)));
    await writeTimeline(ctx, project, seeded);
    return seeded;
  }
  if (tl) return tl;
  const m = manifest || (await manifestOf(project));
  const seeded = timelineFromManifest(m, m.title || project);
  await writeTimeline(ctx, project, seeded);
  return seeded;
}

export async function done(code = 0) {
  await closeBrowser();
  process.exit(code);
}
