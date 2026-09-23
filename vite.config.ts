import react from "@vitejs/plugin-react";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { createApi } from "./server/api.ts";
import { closeBrowser } from "./server/chrome.ts";
import { makeCtx } from "./server/projects.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

function studioApi(): Plugin {
  return {
    name: "studio-api",
    configureServer(server) {
      server.middlewares.use(createApi(makeCtx(root)));
      server.httpServer?.on("close", () => { closeBrowser(); });
    },
  };
}

export default defineConfig(({ mode }) => {
  // shot/.env (GEMINI_API_KEY, CHROME_PATH, STUDIO_PROJECTS) -> server-side process.env only
  for (const [k, v] of Object.entries(loadEnv(mode, root, ""))) if (process.env[k] === undefined) process.env[k] = v;
  // ~/.shot/.env too, for installs where the app folder isn't yours to edit (Homebrew)
  const home = process.env.STUDIO_HOME || join(homedir(), ".shot");
  for (const [k, v] of Object.entries(loadEnv(mode, home, ""))) if (process.env[k] === undefined) process.env[k] = v;
  return {
    root,
    plugins: [react(), studioApi()],
    server: { port: 5178, strictPort: false, watch: { ignored: ["**/projects/**", "**/.cache/**", "**/dist/**"] } },
    build: { outDir: "dist/app" }, // dist/film-design* is the packed skill
  };
});
