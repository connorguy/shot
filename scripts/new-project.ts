// npm run new -- <name> [--dir <parent folder>] [--title "Launch film"] [--template <id> [--aspect portrait] | --from film.html | design.zip | folder | --video clip.mp4]
// Creates <parent>/<name>/ from templates/project: AGENTS.md (how everything works), CLAUDE.md, brief.md,
// .gitignore, and the starter film (or the design passed with --from), then registers it with the studio.
// --aspect landscape | portrait | square sets a template start's stage (1920×1080, 1080×1920, 1080×1080).
// --video clones a video: one placeholder scene per shot, reference frames and the soundtrack (--threshold 0.3
// sets how big a picture change counts as a cut). Without --dir the project goes in shot/projects/.
import { resolve } from "node:path";
import { expandHome, scaffoldProject } from "../server/projects.ts";
import { ctx, die, done, parseArgs } from "./_lib.ts";
import type { Aspect } from "../shared/timeline.ts";

const args = parseArgs();
const name = args._[0] || die('usage: npm run new -- <name> [--dir <parent>] [--title "Title"] [--template <id> [--aspect landscape|portrait|square]] [--from film.html|design.zip|folder] [--video clip.mp4 [--threshold 0.3]]\nTemplates: npm run template -- list');
const here = process.env.INIT_CWD || process.cwd();
const threshold = args.flags.threshold != null ? Number(args.flags.threshold) : undefined;
if (threshold !== undefined && !(threshold > 0 && threshold < 1)) die("--threshold is a scene-change score between 0 and 1 (default 0.3).");
const at = (p: string | true | undefined) => (typeof p === "string" ? resolve(here, expandHome(p)) : undefined);

try {
  const { id, dir } = await scaffoldProject(ctx, {
    name,
    title: typeof args.flags.title === "string" ? args.flags.title : undefined,
    parent: at(args.flags.dir),
    from: at(args.flags.from) || null,
    template: typeof args.flags.template === "string" ? args.flags.template : null,
    video: at(args.flags.video) || null,
    aspect: typeof args.flags.aspect === "string" ? (args.flags.aspect as Aspect) : null,
    threshold,
    log: (s) => console.log(s),
  });
  console.log(args.flags.video ? `Created ${dir}  (studio id: ${id})

  AGENTS.md    how the project works, and how to rebuild the reference video
  reference/   the video, its shots (shots.json), contact sheets and frames
  film/scenes/shot-*.js   one placeholder per shot, at the original timing

Next:
  npm run dev                        then pick "${id}" in the studio
  open reference/sheet.jpg, then ask an agent in ${dir} to rebuild the shots
  npm run compare -- "${dir}" --sheet` : `Created ${dir}  (studio id: ${id})

  AGENTS.md    how the project works: layout, scene contract, timeline.json, commands
  brief.md     fill this in first
  film.html + film/scenes/*.js

Next:
  npm run dev                        then pick "${id}" in the studio
  npm run inspect -- "${dir}"
  npm run frame -- "${dir}" --sheet`);
  await done();
} catch (e: any) {
  die(e.message);
}
