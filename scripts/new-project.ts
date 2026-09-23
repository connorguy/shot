// npm run new -- <name> [--dir <parent folder>] [--title "Launch film"] [--template <id> | --from film.html | design.zip | folder]
// Creates <parent>/<name>/ from templates/project: AGENTS.md (how everything works), CLAUDE.md, brief.md,
// .gitignore, and the starter film (or the design passed with --from), then registers it with the studio.
// Without --dir the project goes in shot/projects/.
import { resolve } from "node:path";
import { expandHome, scaffoldProject } from "../server/projects.ts";
import { ctx, die, parseArgs } from "./_lib.ts";

const args = parseArgs();
const name = args._[0] || die('usage: npm run new -- <name> [--dir <parent>] [--title "Title"] [--template <id>] [--from film.html|design.zip|folder]\nTemplates: npm run template -- list');
const here = process.env.INIT_CWD || process.cwd();
const at = (p: string | true | undefined) => (typeof p === "string" ? resolve(here, expandHome(p)) : undefined);

try {
  const { id, dir } = await scaffoldProject(ctx, {
    name,
    title: typeof args.flags.title === "string" ? args.flags.title : undefined,
    parent: at(args.flags.dir),
    from: at(args.flags.from) || null,
    template: typeof args.flags.template === "string" ? args.flags.template : null,
  });
  console.log(`Created ${dir}  (studio id: ${id})

  AGENTS.md    how the project works: layout, scene contract, timeline.json, commands
  brief.md     fill this in first
  film.html + film/scenes/*.js

Next:
  npm run dev                        then pick "${id}" in the studio
  npm run inspect -- "${dir}"
  npm run frame -- "${dir}" --sheet`);
} catch (e: any) {
  die(e.message);
}
