// Headless Chrome for frame-accurate thumbnails and MP4 frames. Prefers the installed Google Chrome.
import { chromium, type Browser, type Page } from "playwright-core";
import { pathToFileURL } from "node:url";
import { ensureFilmApi } from "../shared/filmShim.ts";
import type { FilmManifest, Layer } from "../shared/timeline.ts";

let browserP: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH });
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    try {
      return await chromium.launch();
    } catch {
      throw new Error("Could not start Chrome. Install Google Chrome, set CHROME_PATH, or run `npx playwright install chromium`.");
    }
  }
}

export function browser(): Promise<Browser> {
  if (!browserP) browserP = launch().catch((e) => { browserP = null; throw e; });
  return browserP;
}

export async function closeBrowser() {
  if (!browserP) return;
  const b = await browserP.catch(() => null);
  browserP = null;
  await b?.close();
}

export interface FilmPage { page: Page; manifest: FilmManifest; close: () => Promise<void> }

/** Open a film with ?render at native size × scale and wait for it to be ready. */
export async function openFilm(filmPath: string, scale = 1, size = { width: 1920, height: 1080 }): Promise<FilmPage> {
  const b = await browser();
  const ctx = await b.newContext({ viewport: size, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(pathToFileURL(filmPath).href + "?render");
  try {
    await page.waitForFunction("window.__ready===true || !!window.__film", null, { timeout: 30000 });
  } catch {
    await ctx.close();
    throw new Error(`Film never became ready (${filmPath}). ${errors.join("; ")}`);
  }
  const ok = await page.evaluate(`(${ensureFilmApi.toString()})(window)`);
  if (!ok) {
    await ctx.close();
    throw new Error(`Film exposes neither window.__film (film-kit) nor __renderAt/__DUR: ${filmPath}`);
  }
  const manifest = (await page.evaluate("window.__film.manifest()")) as FilmManifest;
  if (manifest.width !== size.width || manifest.height !== size.height) {
    await page.setViewportSize({ width: manifest.width, height: manifest.height });
  }
  return { page, manifest, close: () => ctx.close() };
}

export async function renderLayers(p: Page, layers: Layer[]) {
  await p.evaluate((l) => (window as any).__film.renderFrame(l), layers);
}

// ───────── thumbnails: one warm page per film version, requests serialized ─────────
const thumbPages = new Map<string, Promise<FilmPage>>();
let queue: Promise<unknown> = Promise.resolve();

export function thumbnail(filmPath: string, version: string, scene: string, t: number, width = 240): Promise<Buffer> {
  const key = `${filmPath}@${version}@${width}`;
  const run = async () => {
    for (const [k, fp] of thumbPages) {
      if (k.startsWith(filmPath + "@") && k !== key) { thumbPages.delete(k); fp.then((f) => f.close()).catch(() => {}); }
    }
    if (!thumbPages.has(key)) {
      const p = openFilm(filmPath, width / 1920);
      p.catch(() => thumbPages.delete(key));
      thumbPages.set(key, p);
    }
    const fp = await thumbPages.get(key)!;
    await renderLayers(fp.page, [{ scene, t, opacity: 1 }]);
    return fp.page.screenshot({ type: "jpeg", quality: 72 });
  };
  const r = queue.then(run, run);
  queue = r.catch(() => {});
  return r;
}
