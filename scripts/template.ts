// Film templates (templates/films/<id>): a film's scenes, styles, assets and cut, without audio.
//   npm run template -- list
//   npm run template -- save <project> --name "Bold launch" [--description "…"] [--at 12.5] [--no-cut] [--force]
//   npm run template -- preview <id> [--at 12.5]      re-render the cover image
// New project from one: npm run new -- <name> --template <id>   (or pick it under New in the studio)
import { listTemplates, renderPreview, saveTemplate } from "../server/templates.ts";
import { ctx, die, done, parseArgs, requireProject } from "./_lib.ts";

const args = parseArgs();
const [cmd, arg] = args._;
const at = args.flags.at != null ? Number(args.flags.at) : null;

if (cmd === "list" || !cmd) {
  const ts = await listTemplates(ctx);
  if (!ts.length) console.log("No templates in templates/films.");
  for (const t of ts) {
    console.log(`${t.id.padEnd(22)} ${t.name}${t.duration ? ` · ${t.duration}s` : ""}${t.scenes ? ` · ${t.scenes} scenes` : ""}${t.hasPreview ? "" : " · no cover"}`);
    if (t.description) console.log(`${"".padEnd(23)}${t.description}`);
  }
} else if (cmd === "save") {
  const project = requireProject(arg, 'npm run template -- save <project> --name "Name"');
  const name = typeof args.flags.name === "string" ? args.flags.name : die('Give it a name: --name "Bold launch"');
  try {
    const r = await saveTemplate(ctx, project, {
      name, description: typeof args.flags.description === "string" ? args.flags.description : "",
      at, includeCut: !args.flags["no-cut"], overwrite: !!args.flags.force,
    });
    console.log(`Saved template "${r.id}" in ${r.dir} (no audio). Use it: npm run new -- <name> --template ${r.id}`);
  } catch (e: any) { die(e.message); }
} else if (cmd === "preview") {
  if (!arg) die("usage: npm run template -- preview <id> [--at 12.5]");
  await renderPreview(ctx, arg, at);
  console.log(`Rendered templates/films/${arg}/preview.jpg`);
} else die(`Unknown command "${cmd}". Use list, save or preview.`);
await done();
