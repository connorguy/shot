// Bundle Google Fonts into a film: the Latin woff2 files go to film/assets/fonts/ and their @font-face rules to
// the top of film/styles.css (replacing earlier rules for the same families). Films must not load fonts from the
// network at render time. Used by `npm run font` and the style gallery.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// a current browser's user agent, so the API answers with variable woff2
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** `families` use the Google Fonts css2 syntax ("Inter Tight:wght@100..900"; a plain name gets the default weight).
 *  `filmDir` is the folder holding styles.css. By default only the Latin subset is kept. With `text`, Google
 *  returns one small subset holding exactly those characters: the way to bundle Japanese, Chinese or Korean
 *  (a full CJK font is 5–14 MB). Returns the files written, relative to filmDir. */
export async function bundleFonts(filmDir: string, families: string[], text?: string): Promise<{ file: string; family: string; style: string; weight: string }[]> {
  const cssPath = join(filmDir, "styles.css");
  if (!existsSync(cssPath)) throw new Error("No film/styles.css. Split the single-file film into film/ first (see AGENTS.md).");
  const url = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}`).join("&")}&display=block${text ? `&text=${encodeURIComponent([...new Set(text)].join(""))}` : ""}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Google Fonts said ${res.status} for ${families.join(", ")}. Check the names and axes at fonts.google.com.`);
  const css = await res.text();

  // only the "/* latin */" subset (enough for English copy, a fraction of the size), or the one text subset
  const blocks = text ? css.matchAll(/@font-face\s*\{([^}]*)\}/g) : css.matchAll(/\/\* latin \*\/\s*@font-face\s*\{([^}]*)\}/g);
  const faces = [...blocks].map((m) => {
    const get = (k: string) => new RegExp(`${k}:\\s*([^;]+);`).exec(m[1])?.[1].trim() || "";
    return { family: get("font-family").replace(/['"]/g, ""), style: get("font-style"), weight: get("font-weight"), stretch: get("font-stretch"), src: /url\(([^)]+)\)/.exec(m[1])?.[1] || "" };
  });
  if (!faces.length) throw new Error(`No ${text ? "" : "Latin "}fonts in the response for ${families.join(", ")}.`);

  await mkdir(join(filmDir, "assets", "fonts"), { recursive: true });
  const rules: string[] = [];
  const out = [];
  for (const f of faces) {
    const file = `assets/fonts/${slug(f.family)}-${f.style}-${slug(f.weight)}${text ? "-subset" : ""}.woff2`;
    const r = await fetch(f.src);
    if (!r.ok) throw new Error(`Download failed (${r.status}): ${f.src}`);
    await writeFile(join(filmDir, file), Buffer.from(await r.arrayBuffer()));
    rules.push(`@font-face { font-family: "${f.family}"; font-style: ${f.style}; font-weight: ${f.weight};${f.stretch ? ` font-stretch: ${f.stretch};` : ""} font-display: block; src: url(${file}) format("woff2"); }`);
    out.push({ file, family: f.family, style: f.style, weight: f.weight });
  }

  // drop earlier rules for these families, then put the new ones after the file's opening comment
  const names = new Set(faces.map((f) => f.family));
  let sheet = (await readFile(cssPath, "utf8")).replace(/@font-face\s*\{[^}]*\}\n?/g, (rule) => {
    const fam = /font-family:\s*["']?([^"';]+)/.exec(rule)?.[1].trim();
    return fam && names.has(fam) ? "" : rule;
  });
  const head = /^\/\*[\s\S]*?\*\/\n/.exec(sheet)?.[0] || "";
  sheet = head + rules.join("\n") + "\n" + sheet.slice(head.length);
  await writeFile(cssPath, sheet);
  return out;
}

/** The families a style preset names on its "Fonts:" line (`font -- . "A:…" "B:…" [--text auto]`), alternatives
 *  excluded, and whether it bundles by text (CJK, or glyphs beyond Latin). */
export function styleFonts(md: string): { families: string[]; text: boolean } {
  const line = /^Fonts: `font -- \. ([^`]+)`/m.exec(md)?.[1] || "";
  return { families: [...line.matchAll(/"([^"]+)"/g)].map((m) => m[1]), text: /--text\b/.test(line) };
}
