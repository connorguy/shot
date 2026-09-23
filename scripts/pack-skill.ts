// npm run pack-skill
// Builds dist/film-design/ (SKILL.md + references/film-kit.js + references/project-template/) and zips it,
// ready to add as a skill in a Claude design session (claude.ai / Cowork).
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./_lib.ts";

const out = join(ROOT, "dist", "film-design");
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "references"), { recursive: true });
cpSync(join(ROOT, "skills", "film-design", "SKILL.md"), join(out, "SKILL.md"));
cpSync(join(ROOT, "film-kit", "film-kit.js"), join(out, "references", "film-kit.js"));
cpSync(join(ROOT, "film-kit", "README.md"), join(out, "references", "film-kit.md"));
cpSync(join(ROOT, "templates", "project"), join(out, "references", "project-template"), { recursive: true });
// the starter film (film.html + film/) from the film templates, minus template metadata
for (const f of ["film.html", "film"]) cpSync(join(ROOT, "templates", "films", "starter", f), join(out, "references", "project-template", f), { recursive: true });
cpSync(join(ROOT, "film-kit", "film-kit.js"), join(out, "references", "project-template", "film", "film-kit.js"));
const zip = join(ROOT, "dist", "film-design-skill.zip");
rmSync(zip, { force: true });
execFileSync("zip", ["-qr", zip, "film-design"], { cwd: join(ROOT, "dist") });
console.log(`${out}\n${zip}`);
