// npm run open -- <project folder>
// Add a project folder from anywhere on disk to the studio (e.g. one you moved or received), then open it
// in the browser if the studio is running. Same as "Open…" in the studio's top bar.
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { expandHome, openProjectFolder } from "../server/projects.ts";
import { ctx, die, parseArgs } from "./_lib.ts";

const args = parseArgs();
const arg = args._[0] || die("usage: npm run open -- <project folder>   (the folder that has film.html)");
const dir = resolve(process.env.INIT_CWD || process.cwd(), expandHome(arg));
let id: string;
try { id = openProjectFolder(ctx, dir).id; } catch (e: any) { die(e.message); }

const port = Number(args.flags.port) || 5178;
const url = `http://localhost:${port}/?project=${encodeURIComponent(id)}`;
const up = await fetch(`http://localhost:${port}/api/status`).then((r) => r.ok).catch(() => false);
console.log(`Added ${dir} as "${id}".`);
if (up) {
  console.log(`Opening ${url}`);
  if (process.platform === "darwin") execFile("open", [url]);
} else {
  console.log(`Start the studio with \`npm run dev\`, then open ${url} (or pick "${id}" in the project menu).`);
}
