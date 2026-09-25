#!/usr/bin/env node
// shot: command-line entry point (npm link, or what the Homebrew formula installs).
//   shot                 start the studio and open it in your browser  (--no-open to skip, --port 5178)
//   shot <command> ...   new · open · duplicate · inspect · frame · compare · vo · music · render · bundle · template · pack-skill
// Paths you pass are resolved from where you run shot, so `shot inspect .` works inside a project.
import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(realpathSync(fileURLToPath(import.meta.url))), "..");
const COMMANDS = {
  new: "new-project", open: "open", duplicate: "duplicate", inspect: "inspect", frame: "frame", compare: "compare", vo: "vo", music: "music",
  render: "render", bundle: "bundle", template: "template", "pack-skill": "pack-skill",
};
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(`shot needs Node 22.18 or newer (you have ${process.versions.node}).`);
  process.exit(1);
}

const env = { ...process.env, INIT_CWD: process.cwd() };
// installed read-only (e.g. Homebrew): keep projects out of the install folder
if (/\/Cellar\//.test(ROOT) && !env.STUDIO_PROJECTS) env.STUDIO_PROJECTS = join(homedir(), "Shot");

const [cmd, ...rest] = process.argv.slice(2);
const run = (args) => {
  const child = spawn(process.execPath, args, { cwd: ROOT, env, stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
  return child;
};

if (!cmd || cmd === "studio" || cmd === "dev" || cmd.startsWith("--")) {
  let args = cmd && cmd.startsWith("--") ? [cmd, ...rest] : rest;
  // the studio API has no login, so it stays on this machine
  const host = args.findIndex((a) => a === "--host" || a.startsWith("--host="));
  if (host >= 0) {
    console.error("shot: ignoring --host. The studio has no login, so it only listens on localhost.");
    args = args.filter((_, i) => i !== host && !(i === host + 1 && args[host] === "--host" && !args[i].startsWith("--")));
  }
  const noOpen = args.includes("--no-open");
  const portArg = args.indexOf("--port");
  const port = portArg >= 0 ? Number(args[portArg + 1]) : 5178;
  run([join(ROOT, "node_modules", "vite", "bin", "vite.js"), "--port", String(port), ...args.filter((a, i) => a !== "--no-open" && i !== portArg && i !== portArg + 1)]);
  if (!noOpen && process.platform === "darwin") {
    const url = `http://localhost:${port}`;
    const t0 = Date.now();
    const poll = async () => {
      const up = await fetch(`${url}/api/status`).then((r) => r.ok).catch(() => false);
      if (up) spawn("open", [url], { stdio: "ignore", detached: true }).unref();
      else if (Date.now() - t0 < 20000) setTimeout(poll, 300);
    };
    setTimeout(poll, 500);
  }
} else if (COMMANDS[cmd]) {
  run([join(ROOT, "scripts", `${COMMANDS[cmd]}.ts`), ...rest]);
} else {
  console.log(`shot: the video editor where the video is code

  shot                      open the studio (http://localhost:5178)
  shot new <name> [--dir .] [--template starter|hardware-type|…] [--aspect portrait|square] [--from design.zip] [--video clip.mp4]
  shot open <folder>        add a project folder to the studio
  shot duplicate <folder> ["Title"]  copy a project next to it (--dir elsewhere)
  shot inspect <folder>     scenes, cut, audio, warnings
  shot frame <folder> 12.5  render a still (--sheet for a contact sheet)
  shot compare <folder> 12.5  cloned from a video: film next to the reference (--shot <id>, --sheet)
  shot vo <folder>          generate voiceover takes (--draft: free macOS voice)
  shot music <folder> "…"   generate a Lyria track timed to the cut
  shot render <folder>      export an mp4 (--draft for 540p)
  shot bundle <folder>      one self-contained html of the film
  shot template list|save|preview
`);
  if (cmd && cmd !== "help" && cmd !== "--help" && cmd !== "-h") process.exit(1);
}
