// npm run bundle -- <project> [--out file.html] [--seed-cut]
// One self-contained HTML of the film: every <script src> and stylesheet inlined, CSS url()s and
// film/assets/* files embedded. Its player plays the current timeline cut (picture only, no audio);
// --seed-cut keeps the film's own default cut from edit.js. Imports back with `npm run new -- x --from`.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { projectDir } from "../server/projects.ts";
import { ctx, done, parseArgs, requireProject, timelineOf } from "./_lib.ts";

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf", ".mp4": "video/mp4", ".json": "application/json",
};
const dataUri = (p: string) => `data:${MIME[extname(p).toLowerCase()] || "application/octet-stream"};base64,${readFileSync(p).toString("base64")}`;

const args = parseArgs();
const project = requireProject(args._[0], "npm run bundle -- <project> [--out file.html]");
const tl = await timelineOf(project);
const dir = projectDir(ctx, project);
const filmPath = join(dir, tl.film);
const base = dirname(filmPath);
let html = readFileSync(filmPath, "utf8");

const inlineCss = (file: string) =>
  readFileSync(file, "utf8").replace(/url\(\s*(['"]?)(?!data:|https?:|#)([^'")]+)\1\s*\)/g, (m, _q, u) => {
    const p = resolve(dirname(file), u);
    return existsSync(p) ? `url(${dataUri(p)})` : m;
  });

html = html.replace(/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/g, (tag) => {
  const href = /href=["']([^"']+)["']/.exec(tag)?.[1];
  if (!href || /^https?:/.test(href)) return tag;
  return `<style>\n${inlineCss(resolve(base, href))}\n</style>`;
});
html = html.replace(/<script\s+src=["']([^"']+)["']\s*><\/script>/g, (tag, src) => {
  if (/^https?:/.test(src)) return tag;
  const js = readFileSync(resolve(base, src), "utf8").replace(/<\/script/gi, "<\\/script");
  return `<script>/* ${src} */\n${js}\n</script>`;
});

// film/assets/*: static references are replaced now; paths built at runtime go through a tiny shim
const assetsDir = join(base, "film", "assets");
const assets: Record<string, string> = {};
const walk = (d: string) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (!/\.(woff2?|ttf|otf)$/i.test(e)) assets[relative(base, p).split("\\").join("/")] = dataUri(p);
  }
};
if (existsSync(assetsDir)) walk(assetsDir);
const keys = Object.keys(assets);
if (keys.length) {
  html = html.replace(/(src|href)=["'](film\/assets\/[^"']+)["']/g, (m, a, p) => (assets[p] ? `${a}="${assets[p]}"` : m));
  const shim = `<script>/* bundled assets: rewrite film/assets/* paths to embedded data */
(function(){var A=${JSON.stringify(assets)};var re=/film\\/assets\\/[^"'\\s)>]+/g;function fix(v){return typeof v==="string"?v.replace(re,function(p){return A[p]||p;}):v;}
var d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src");Object.defineProperty(HTMLImageElement.prototype,"src",{get:d.get,set:function(v){d.set.call(this,fix(v));},configurable:true});
var h=Object.getOwnPropertyDescriptor(Element.prototype,"innerHTML");Object.defineProperty(Element.prototype,"innerHTML",{get:h.get,set:function(v){h.set.call(this,fix(v));},configurable:true});
var sa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){return sa.call(this,n,fix(v));};})();
</script>`;
  html = html.replace(/<body([^>]*)>/, (m) => `${m}\n${shim}`);
}

if (!args.flags["seed-cut"]) {
  const cut = tl.clips.map((c) => ({ scene: c.scene, in: c.in, out: c.out, duration: c.duration, xfade: c.xfade || 0 }));
  html = html.replace(/<body([^>]*)>/, (m) => `${m}\n<script>window.__filmEdit = ${JSON.stringify(cut)};</script>`);
}

const out = String(args.flags.out || join(dir, "exports", `${project}-film.html`));
writeFileSync(out, html);
console.log(`${out}\n${Math.round(statSync(out).size / 1024)} KB · ${keys.length} embedded assets · open it in a browser to play`);
await done();
