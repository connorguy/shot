// Local HTTP API for the studio, mounted as Vite middleware. Keys and file writes stay server-side.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join } from "node:path";
import type { Provider, Timeline } from "../shared/timeline.ts";
import { thumbnail } from "./chrome.ts";
import { cancelJob, getJob, hasFfmpeg, startExport } from "./export.ts";
import { elevenAvailable, listVoices } from "./elevenlabs.ts";
import { authStatus, designVoice } from "./gemini.ts";
import { makeMusic, makeTake, stretched } from "./media.ts";
import { listTemplates, saveTemplate, templateDir } from "./templates.ts";
import {
  duplicateProject, filmVersion, forgetProject, listAssets, listProjects, newProjectDefaults, openProjectFolder, projectDir, projectFile,
  scaffoldProject, timelineVersion, readTimeline, saveAsset, slugify, writeTimeline,
  type Ctx,
} from "./projects.ts";
import { sayAvailable } from "./say.ts";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".json": "application/json", ".js": "text/javascript", ".css": "text/css",
  ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg", ".flac": "audio/flac",
  ".aif": "audio/aiff", ".aiff": "audio/aiff", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".woff2": "font/woff2",
};

/** Native file/folder dialog via AppleScript (macOS). Resolves null when cancelled or unavailable. */
function pick(kind: string, start?: string): Promise<string | null> {
  if (process.platform !== "darwin") return Promise.resolve(null);
  const loc = start && existsSync(start) ? ` default location (POSIX file ${JSON.stringify(start)})` : "";
  const script =
    kind === "video"
      ? `choose file with prompt "Pick a video to clone"${loc} of type {"public.movie"}`
      : kind === "design"
        ? `choose file with prompt "Pick a design from Claude: a zip, a film.html, or cancel and type a folder path"${loc} of type {"public.zip-archive", "public.html", "com.pkware.zip-archive"}`
        : kind === "project"
          ? `choose folder with prompt "Pick a video project folder (the one with film.html)"${loc}`
          : `choose folder with prompt "Where should the new video project folder go?"${loc}`;
  return new Promise((resolve) => {
    execFile("osascript", ["-e", "activate", "-e", `POSIX path of (${script})`], { timeout: 10 * 60 * 1000 }, (err, stdout) => {
      resolve(err ? null : stdout.trim().replace(/\/$/, "") || null);
    });
  });
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((res, rej) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => res(Buffer.concat(chunks)));
    req.on("error", rej);
  });
}
const readJson = async (req: IncomingMessage) => JSON.parse((await readBody(req)).toString("utf8") || "{}");

function send(res: ServerResponse, code: number, body: unknown, type = "application/json") {
  res.statusCode = code;
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "no-store");
  res.end(type === "application/json" ? JSON.stringify(body) : (body as any));
}

type Handler = (m: RegExpMatchArray, req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>;

export function createApi(ctx: Ctx) {
  const routes: [string, RegExp, Handler][] = [];
  const on = (method: string, re: RegExp, h: Handler) => routes.push([method, re, h]);

  on("GET", /^\/api\/status$/, async (_m, _q, res) => {
    const auth = await authStatus();
    send(res, 200, { gemini: auth.mode !== "none", auth, elevenlabs: elevenAvailable(), say: sayAvailable(), ffmpeg: await hasFfmpeg(), projectsDir: ctx.projectsDir, studioRoot: ctx.root.replace(/\/+$/, "") });
  });

  on("GET", /^\/api\/projects$/, async (_m, _q, res) => send(res, 200, await listProjects(ctx)));

  on("GET", /^\/api\/templates$/, async (_m, _q, res) => send(res, 200, await listTemplates(ctx)));

  on("GET", /^\/api\/templates\/([^/]+)\/preview$/, async (m, _q, res) => {
    const p = join(templateDir(ctx, m[1]), "preview.jpg");
    if (!existsSync(p)) return send(res, 404, { error: "no preview" });
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-cache");
    res.end(await readFile(p));
  });

  // save a project as a template: POST /api/projects/:p/template { name, description?, at?, includeCut?, overwrite? }
  on("POST", /^\/api\/projects\/([^/]+)\/template$/, async (m, req, res) => {
    const b = await readJson(req);
    send(res, 200, await saveTemplate(ctx, m[1], { name: String(b.name || ""), description: b.description, at: b.at ?? null, includeCut: b.includeCut !== false, overwrite: !!b.overwrite }));
  });

  on("GET", /^\/api\/new-defaults$/, async (_m, _q, res) => send(res, 200, newProjectDefaults(ctx)));

  // new project: POST /api/projects { name, title?, parent?, from? | video? | template? [aspect?] } -> { id, dir }
  on("POST", /^\/api\/projects$/, async (_m, req, res) => {
    const b = await readJson(req);
    if (!String(b.name || "").trim()) return send(res, 400, { error: "Give the project a name." });
    send(res, 200, await scaffoldProject(ctx, {
      name: b.name, title: b.title, parent: b.parent || undefined, from: b.from || null, template: b.template || null, video: b.video || null, aspect: b.aspect || null,
      log: (s) => console.log(`[studio] ${b.name}: ${s}`),
    }));
  });

  // add an existing project folder: POST /api/projects/open { path }
  on("POST", /^\/api\/projects\/open$/, async (_m, req, res) => {
    const b = await readJson(req);
    send(res, 200, openProjectFolder(ctx, String(b.path || "")));
  });

  // copy a project next to it: POST /api/projects/:p/duplicate { title?, parent? } -> { id, dir }
  on("POST", /^\/api\/projects\/([^/]+)\/duplicate$/, async (m, req, res) => {
    const b = await readJson(req);
    send(res, 200, await duplicateProject(ctx, m[1], { title: b.title || undefined, parent: b.parent || undefined }));
  });

  on("POST", /^\/api\/projects\/([^/]+)\/forget$/, async (m, _q, res) => { forgetProject(m[1]); send(res, 200, { ok: true }); });

  on("POST", /^\/api\/projects\/([^/]+)\/reveal$/, async (m, _q, res) => {
    const dir = projectDir(ctx, m[1]);
    if (process.platform === "darwin") execFile("open", [dir]);
    send(res, 200, { ok: true, dir });
  });

  // native macOS pickers: POST /api/pick { kind: "folder" | "design" | "video" | "project", start? } -> { path | null }
  on("POST", /^\/api\/pick$/, async (_m, req, res) => {
    const b = await readJson(req);
    send(res, 200, { path: await pick(b.kind, b.start) });
  });

  on("GET", /^\/api\/projects\/([^/]+)\/timeline$/, async (m, _q, res) => {
    send(res, 200, { timeline: await readTimeline(ctx, m[1]), filmVersion: await filmVersion(ctx, m[1]), timelineVersion: await timelineVersion(ctx, m[1]) });
  });

  on("PUT", /^\/api\/projects\/([^/]+)\/timeline$/, async (m, req, res) => {
    const tl = (await readJson(req)) as Timeline;
    const saved = await writeTimeline(ctx, m[1], tl);
    send(res, 200, { ok: true, updatedAt: saved.updatedAt, timelineVersion: await timelineVersion(ctx, m[1]) });
  });

  // polled by the studio: film sources and timeline.json changed on disk (agents, editors)?
  on("GET", /^\/api\/projects\/([^/]+)\/versions$/, async (m, _q, res) => {
    send(res, 200, { film: await filmVersion(ctx, m[1]), timeline: await timelineVersion(ctx, m[1]) });
  });

  on("GET", /^\/api\/projects\/([^/]+)\/thumb$/, async (m, _q, res, url) => {
    const film = projectFile(ctx, m[1], url.searchParams.get("film") || "film.html");
    const scene = url.searchParams.get("scene") || "";
    const t = parseFloat(url.searchParams.get("t") || "0");
    const w = Math.min(640, Math.max(80, parseInt(url.searchParams.get("w") || "240")));
    const version = (await filmVersion(ctx, m[1])) || "0";
    const cacheFile = join(ctx.root, ".cache", "thumbs", m[1], version, `${slugify(scene)}-${t.toFixed(3)}-${w}.jpg`);
    let jpg: Buffer;
    if (existsSync(cacheFile)) jpg = await readFile(cacheFile);
    else {
      jpg = await thumbnail(film, version, scene, t, w);
      await mkdir(join(cacheFile, ".."), { recursive: true });
      await writeFile(cacheFile, jpg);
    }
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Type", "image/jpeg");
    res.end(jpg);
  });

  // time-stretched audio for a clip's rate: GET /api/projects/:p/stretch?asset=audio/vo/x.wav&rate=1.12
  on("GET", /^\/api\/projects\/([^/]+)\/stretch$/, async (m, _q, res, url) => {
    const file = await stretched(ctx, m[1], url.searchParams.get("asset") || "", parseFloat(url.searchParams.get("rate") || "1"));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Type", "audio/wav");
    res.end(await readFile(file));
  });

  on("GET", /^\/api\/projects\/([^/]+)\/assets$/, async (m, _q, res) => send(res, 200, await listAssets(ctx, m[1])));

  // upload audio: POST /api/projects/:p/upload?kind=music&filename=track.mp3  (body = file bytes)
  on("POST", /^\/api\/projects\/([^/]+)\/upload$/, async (m, req, res, url) => {
    const data = await readBody(req);
    const r = await saveAsset(ctx, m[1], url.searchParams.get("kind") || "sfx", url.searchParams.get("filename") || "audio.wav", data);
    send(res, 200, r);
  });

  on("POST", /^\/api\/projects\/([^/]+)\/tts$/, async (m, req, res) => {
    const b = await readJson(req);
    const provider: Provider = b.provider === "say" || b.provider === "elevenlabs" ? b.provider : "gemini";
    const take = await makeTake(ctx, m[1], {
      clipId: b.clipId, text: String(b.text || ""), voice: b.voice, style: b.style || "", model: b.model, provider, target: Number(b.target) || null,
    });
    send(res, 200, { take });
  });

  on("GET", /^\/api\/elevenlabs\/voices$/, async (_m, _q, res, url) => send(res, 200, await listVoices(url.searchParams.get("fresh") === "1")));

  on("POST", /^\/api\/projects\/([^/]+)\/voices$/, async (m, req, res) => {
    const b = await readJson(req);
    const v = await designVoice({ name: b.name, description: b.description, model: b.model, gender: b.gender || undefined, language_code: b.language_code || undefined });
    let sample: string | undefined;
    if (v.sample) {
      sample = `audio/vo/voice-${slugify(b.name)}-sample.wav`;
      await writeFile(projectFile(ctx, m[1], sample), v.sample);
    }
    send(res, 200, { voice: { id: v.id, name: b.name, description: b.description, sample } });
  });

  on("POST", /^\/api\/projects\/([^/]+)\/music$/, async (m, req, res) => {
    const b = await readJson(req);
    send(res, 200, await makeMusic(ctx, m[1], String(b.prompt || ""), b.model, b.name || "lyria"));
  });

  // export: POST /api/projects/:p/export?draft=1  (body = mixed WAV, may be empty for silent)
  on("POST", /^\/api\/projects\/([^/]+)\/export$/, async (m, req, res, url) => {
    const mix = await readBody(req);
    const tl = await readTimeline(ctx, m[1]);
    if (!tl) return send(res, 400, { error: "Save a timeline first." });
    const job = startExport(ctx, m[1], tl, mix.length > 44 ? mix : null, { draft: url.searchParams.get("draft") === "1" });
    send(res, 200, job);
  });

  on("GET", /^\/api\/jobs\/([^/]+)$/, async (m, _q, res) => {
    const job = getJob(m[1]);
    job ? send(res, 200, job) : send(res, 404, { error: "no such job" });
  });

  on("POST", /^\/api\/jobs\/([^/]+)\/cancel$/, async (m, _q, res) => { cancelJob(m[1]); send(res, 200, { ok: true }); });

  on("POST", /^\/api\/reveal$/, async (_m, req, res) => {
    const b = await readJson(req);
    const p = projectFile(ctx, b.project, b.path);
    if (process.platform === "darwin") execFile("open", ["-R", p]);
    send(res, 200, { ok: true, path: p });
  });

  // project files: /files/<project>/<path>
  on("GET", /^\/files\/([^/]+)\/(.+)$/, async (m, _q, res) => {
    const p = projectFile(ctx, m[1], decodeURIComponent(m[2]));
    if (!existsSync(p)) return send(res, 404, { error: "not found" });
    send(res, 200, await readFile(p), TYPES[extname(p).toLowerCase()] || "application/octet-stream");
  });

  return async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const url = new URL(req.url || "/", "http://localhost");
    for (const [method, re, h] of routes) {
      const m = url.pathname.match(re);
      if (!m || req.method !== method) continue;
      // Only the studio may call this API: no other site (not even another localhost port) can trigger
      // writes, spend Gemini quota or read project files from a page you happen to have open.
      const site = req.headers["sec-fetch-site"];
      if ((site && site !== "same-origin" && site !== "none") || (method !== "GET" && req.headers["x-shot"] !== "1")) {
        return send(res, 403, { error: "cross-site request refused" });
      }
      try {
        await h(m, req, res, url);
      } catch (e: any) {
        console.error(`[studio] ${req.method} ${url.pathname}:`, e?.message || e);
        if (!res.headersSent) send(res, 500, { error: String(e?.message || e) });
      }
      return;
    }
    next();
  };
}
