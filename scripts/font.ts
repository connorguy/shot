// npm run font -- <p> "Instrument Serif:ital@0;1" "Inter Tight:wght@100..900"
// Bundles Google Fonts into a film: downloads the Latin woff2 files into film/assets/fonts/ and writes their
// @font-face rules at the top of film/styles.css (replacing earlier rules for the same families). Families use
// the Google Fonts css2 syntax; a plain name ("Anton") gets the default weight. Films must not load fonts
// from the network at render time, so this is how a style's fonts get into a project.
// --text auto (every character in film.html and film/**/*.js) or --text "…" bundles just those characters in any
// script: use it for Japanese, Chinese or Korean, and run it again when the copy changes.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bundleFonts } from "../server/fonts.ts";
import { projectDir } from "../server/projects.ts";
import { ctx, die, parseArgs, requireProject } from "./_lib.ts";

const usage = 'npm run font -- <p> "Family[:axes]" … [--text auto|"…"]   e.g. "Inter Tight:wght@100..900" "Instrument Serif:ital@0;1"';
const args = parseArgs();
const project = requireProject(args._[0], usage);
const families = args._.slice(1);
if (!families.length) die(`usage: ${usage}`);

const dir = projectDir(ctx, project);
/** Every character the film's code contains: its copy, and some code, which costs a few glyphs. */
function filmText(): string {
  const files = [join(dir, "film.html")];
  const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory() && e.name !== "assets") walk(p); else if (e.name.endsWith(".js") && e.name !== "film-kit.js") files.push(p); } };
  if (existsSync(join(dir, "film"))) walk(join(dir, "film"));
  return files.filter((f) => existsSync(f)).map((f) => readFileSync(f, "utf8")).join("").replace(/\s/g, "") + " ";
}
const text = args.flags.text === "auto" ? filmText() : typeof args.flags.text === "string" ? args.flags.text : undefined;

try {
  const faces = await bundleFonts(join(dir, "film"), families, text);
  for (const f of faces) console.log(`film/${f.file}  ${f.family} ${f.style} ${f.weight}`);
  const names = [...new Set(faces.map((f) => `"${f.family}"`))];
  console.log(`\nWrote ${faces.length} @font-face rule(s) to film/styles.css. Use them with font-family: ${names.join(", ")}.
film.before() in film/lib.js must load them before scenes measure text (the starter's loads every @font-face).
${text ? `Only the ${new Set(text).size} characters asked for are bundled: run this again with --text when the copy changes.` : "Only the Latin subset is bundled: symbols such as → may fall back to another font. --text bundles any script."}
Google Fonts are OFL or Apache licensed, so bundling them in a film is fine.`);
} catch (e: any) {
  die(e.message);
}
