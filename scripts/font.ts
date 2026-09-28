// npm run font -- <p> "Instrument Serif:ital@0;1" "Inter Tight:wght@100..900"
// Bundles Google Fonts into a film: downloads the Latin woff2 files into film/assets/fonts/ and writes their
// @font-face rules at the top of film/styles.css (replacing earlier rules for the same families). Families use
// the Google Fonts css2 syntax; a plain name ("Anton") gets the default weight. Films must not load fonts
// from the network at render time, so this is how a style's fonts get into a project.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { projectDir } from "../server/projects.ts";
import { ctx, die, parseArgs, requireProject } from "./_lib.ts";

const usage = 'npm run font -- <p> "Family[:axes]" …   e.g. "Inter Tight:wght@100..900" "Instrument Serif:ital@0;1"';
const args = parseArgs();
const project = requireProject(args._[0], usage);
const families = args._.slice(1);
if (!families.length) die(`usage: ${usage}`);

const dir = projectDir(ctx, project);
const cssPath = join(dir, "film", "styles.css");
if (!existsSync(cssPath)) die("No film/styles.css. Split the single-file film into film/ first (see AGENTS.md).");

// a current browser's user agent, so the API answers with woff2
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const url = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}`).join("&")}&display=block`;
const res = await fetch(url, { headers: { "User-Agent": UA } });
if (!res.ok) die(`Google Fonts said ${res.status} for ${families.join(", ")}. Check the names and axes at fonts.google.com.`);
const css = await res.text();

// only the "/* latin */" subset: enough for English copy, a fraction of the size
const faces = [...css.matchAll(/\/\* latin \*\/\s*@font-face\s*\{([^}]*)\}/g)].map((m) => {
  const get = (k: string) => new RegExp(`${k}:\\s*([^;]+);`).exec(m[1])?.[1].trim() || "";
  return { family: get("font-family").replace(/['"]/g, ""), style: get("font-style"), weight: get("font-weight"), stretch: get("font-stretch"), src: /url\(([^)]+)\)/.exec(m[1])?.[1] || "" };
});
if (!faces.length) die(`No Latin fonts in the response for ${families.join(", ")}.`);

await mkdir(join(dir, "film", "assets", "fonts"), { recursive: true });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const rules: string[] = [];
for (const f of faces) {
  const file = `${slug(f.family)}-${f.style}-${slug(f.weight)}.woff2`;
  const r = await fetch(f.src);
  if (!r.ok) die(`Download failed (${r.status}): ${f.src}`);
  await writeFile(join(dir, "film", "assets", "fonts", file), Buffer.from(await r.arrayBuffer()));
  rules.push(`@font-face { font-family: "${f.family}"; font-style: ${f.style}; font-weight: ${f.weight};${f.stretch ? ` font-stretch: ${f.stretch};` : ""} font-display: block; src: url(assets/fonts/${file}) format("woff2"); }`);
  console.log(`film/assets/fonts/${file}  ${f.family} ${f.style} ${f.weight}`);
}

// drop earlier rules for these families, then put the new ones after the file's opening comment
const names = new Set(faces.map((f) => f.family));
let text = (await readFile(cssPath, "utf8")).replace(/@font-face\s*\{[^}]*\}\n?/g, (rule) => {
  const fam = /font-family:\s*["']?([^"';]+)/.exec(rule)?.[1].trim();
  return fam && names.has(fam) ? "" : rule;
});
const head = /^\/\*[\s\S]*?\*\/\n/.exec(text)?.[0] || "";
text = head + rules.join("\n") + "\n" + text.slice(head.length);
await writeFile(cssPath, text);
console.log(`\nWrote ${rules.length} @font-face rule(s) to film/styles.css. Use them with font-family: ${[...names].map((n) => `"${n}"`).join(", ")}.
film.before() in film/lib.js must load them before scenes measure text (the starter's loads every @font-face).
Google Fonts are OFL or Apache licensed, so bundling them in a film is fine.`);
