// npm run duplicate -- <project> ["New title"] [--dir <parent folder>]
// Copies a project (film, timeline.json, audio, reference) to a new folder, next to it by default, and registers
// it with the studio. Renders, history and stills stay with the original.
import { resolve } from "node:path";
import { duplicateProject, expandHome } from "../server/projects.ts";
import { ctx, die, parseArgs, requireProject } from "./_lib.ts";

const args = parseArgs();
const project = requireProject(args._[0], 'npm run duplicate -- <project> ["New title"] [--dir <parent>]');
const here = process.env.INIT_CWD || process.cwd();
try {
  const { id, dir } = await duplicateProject(ctx, project, {
    title: args._[1],
    parent: typeof args.flags.dir === "string" ? resolve(here, expandHome(args.flags.dir)) : undefined,
  });
  console.log(`Copied to ${dir}  (studio id: ${id})`);
} catch (e: any) {
  die(e.message);
}
