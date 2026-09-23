// MP4 export: headless Chrome renders every frame of the timeline (parallel pages), ffmpeg encodes + muxes the mix.
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import { join } from "node:path";
import { frameCount, layersAt, totalDuration, type Timeline } from "../shared/timeline.ts";
import { openFilm, renderLayers, type FilmPage } from "./chrome.ts";
import { projectFile, type Ctx } from "./projects.ts";

export interface Job {
  id: string;
  project: string;
  draft: boolean;
  status: "running" | "done" | "error" | "cancelled";
  phase: string;
  done: number;
  total: number;
  output?: string; // project-relative
  path?: string; // absolute
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

const jobs = new Map<string, Job>();
const cancelled = new Set<string>();

export const getJob = (id: string) => jobs.get(id) || null;
export const cancelJob = (id: string) => { cancelled.add(id); };

const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

export function startExport(ctx: Ctx, project: string, tl: Timeline, mix: Buffer | null, opts: { draft: boolean; onLog?: (s: string) => void }): Job {
  const job: Job = { id: Math.random().toString(36).slice(2, 10), project, draft: opts.draft, status: "running", phase: "starting", done: 0, total: frameCount(tl), startedAt: Date.now() };
  jobs.set(job.id, job);
  runExport(ctx, job, tl, mix, opts.onLog || (() => {})).catch((e) => {
    job.status = cancelled.has(job.id) ? "cancelled" : "error";
    job.error = String(e?.message || e);
    job.finishedAt = Date.now();
  });
  return job;
}

async function runExport(ctx: Ctx, job: Job, tl: Timeline, mix: Buffer | null, log: (s: string) => void) {
  const filmPath = projectFile(ctx, job.project, tl.film);
  const work = join(ctx.root, ".cache", "render", job.id);
  await mkdir(work, { recursive: true });
  const scale = job.draft ? 0.5 : 1;
  const workers = Math.max(1, Math.min(4, Math.floor(cpus().length / 3)));
  job.phase = "opening film";
  const pages: FilmPage[] = await Promise.all(Array.from({ length: workers }, () => openFilm(filmPath, scale, { width: tl.width, height: tl.height })));
  try {
    job.phase = "rendering frames";
    let next = 0;
    const N = job.total;
    await Promise.all(pages.map(async ({ page }) => {
      for (;;) {
        if (cancelled.has(job.id)) throw new Error("cancelled");
        const f = next++;
        if (f >= N) return;
        await renderLayers(page, layersAt(tl, f / tl.fps));
        const jpg = await page.screenshot({ type: "jpeg", quality: job.draft ? 85 : 94 });
        await writeFile(join(work, `f${String(f).padStart(5, "0")}.jpg`), jpg);
        job.done++;
      }
    }));
  } finally {
    await Promise.all(pages.map((p) => p.close().catch(() => {})));
  }

  job.phase = "encoding";
  const outDir = projectFile(ctx, job.project, "exports");
  await mkdir(outDir, { recursive: true });
  const file = `${job.project}-${stamp()}${job.draft ? "-draft" : ""}.mp4`;
  const out = join(outDir, file);
  const dur = totalDuration(tl).toFixed(4);
  const args = ["-y", "-v", "error", "-framerate", String(tl.fps), "-i", join(work, "f%05d.jpg")];
  if (mix) {
    await writeFile(join(work, "mix.wav"), mix);
    args.push("-i", join(work, "mix.wav"), "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k");
  }
  args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", job.draft ? "23" : "17", "-preset", job.draft ? "veryfast" : "medium", "-t", dur, "-movflags", "+faststart", out);
  await ffmpeg(args, log);
  if (mix) await writeFile(out.replace(/\.mp4$/, ".wav"), mix);
  await rm(work, { recursive: true, force: true });
  job.output = `exports/${file}`;
  job.path = out;
  job.phase = "done";
  job.status = "done";
  job.finishedAt = Date.now();
}

function ffmpeg(args: string[], log: (s: string) => void): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn("ffmpeg", args);
    let err = "";
    p.stderr.on("data", (d) => { err += d; log(String(d)); });
    p.on("error", (e) => rej(new Error(`ffmpeg failed to start: ${e.message}. Install it with \`brew install ffmpeg\`.`)));
    p.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}: ${err.slice(-600)}`))));
  });
}

export const hasFfmpeg = () =>
  new Promise<boolean>((res) => {
    const p = spawn("ffmpeg", ["-version"]);
    p.on("error", () => res(false));
    p.on("close", (c) => res(c === 0));
  });
