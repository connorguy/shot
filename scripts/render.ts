// npm run render -- <project> [--draft] [--silent]
// Full MP4 export without opening the studio: starts the studio server in-process, loads the project in
// headless Chrome, and runs the same export as the Export button (audio mix included). Output in exports/.
import { createServer } from "vite";
import { join } from "node:path";
import { browser } from "../server/chrome.ts";
import { ROOT, done, parseArgs, requireProject } from "./_lib.ts";

const args = parseArgs();
const project = requireProject(args._[0], "npm run render -- <project> [--draft] [--silent]");
const draft = !!args.flags.draft, silent = !!args.flags.silent;

const server = await createServer({ configFile: join(ROOT, "vite.config.ts"), logLevel: "error", server: { port: 0, host: "127.0.0.1", strictPort: false } });
await server.listen();
const base = server.resolvedUrls?.local[0] || "http://127.0.0.1:5178/";
const b = await browser();
const page = await b.newPage();
page.on("pageerror", (e) => console.error("[studio]", e.message));
try {
  await page.goto(`${base}?project=${encodeURIComponent(project)}`);
  await page.waitForFunction("window.__studio && window.__studio.ready()", null, { timeout: 90000 });
  const id = (await page.evaluate(([d, s]) => (window as any).__studio.exportVideo(d, s), [draft, silent])) as string;
  let job: any;
  for (;;) {
    job = await fetch(`${base}api/jobs/${id}`).then((r) => r.json());
    process.stdout.write(`\r${job.phase.padEnd(16)} ${job.done}/${job.total} frames`);
    if (job.status !== "running") break;
    await new Promise((r) => setTimeout(r, 500));
  }
  process.stdout.write("\n");
  if (job.status !== "done") throw new Error(job.error || job.status);
  console.log(`${job.path}\n${((job.finishedAt - job.startedAt) / 1000).toFixed(1)}s · ${draft ? "draft 960×540" : "final"}${silent ? " · silent" : ""}`);
} catch (e: any) {
  console.error(`Render failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await page.close();
  await server.close();
}
await done(Number(process.exitCode || 0));
