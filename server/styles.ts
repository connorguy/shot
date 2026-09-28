// Style presets: styles/<id>.md. A preset is art direction in words and tokens (references, palette, type,
// layout, motion, what to avoid), not code. A new project can take one; it lands in the project as style.md,
// which its AGENTS.md tells agents to follow. Scenes stay the agent's to write.
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Ctx } from "./projects.ts";

export interface StyleInfo { id: string; name: string; description: string }

const stylesDir = (ctx: Ctx) => join(ctx.root, "styles");

/** "---\nname: Swiss\ndescription: …\n---" at the top of a preset. */
function frontmatter(text: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  const out: Record<string, string> = {};
  for (const line of m ? m[1].split("\n") : []) {
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

export async function listStyles(ctx: Ctx): Promise<StyleInfo[]> {
  const dir = stylesDir(ctx);
  if (!existsSync(dir)) return [];
  const out: StyleInfo[] = [];
  for (const f of (await readdir(dir)).sort()) {
    if (!f.endsWith(".md") || f === "README.md") continue;
    const fm = frontmatter(await readFile(join(dir, f), "utf8"));
    out.push({ id: f.slice(0, -3), name: fm.name || f.slice(0, -3), description: fm.description || "" });
  }
  return out;
}

/** The preset's text, ready to write as a project's style.md. */
export async function readStyle(ctx: Ctx, id: string): Promise<string> {
  const p = join(stylesDir(ctx), `${id}.md`);
  if (!/^[a-z0-9-]+$/.test(id) || !existsSync(p)) {
    const ids = (await listStyles(ctx)).map((s) => s.id);
    throw new Error(`No style "${id}". Styles: ${ids.join(", ") || "none"}.`);
  }
  return readFile(p, "utf8");
}
