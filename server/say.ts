// Offline draft voice via macOS `say`: free, instant, good enough to block out VO timing before spending API calls.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export const sayAvailable = () => process.platform === "darwin";

/** wpm: speaking rate in words per minute (say's -r); omit for the system default (~175). */
export async function sayToWav(text: string, wpm?: number): Promise<Buffer> {
  if (!sayAvailable()) throw new Error("Draft voice uses macOS `say`, which is not available here.");
  const spoken = text
    .replace(/<short pause>/g, " [[slnc 300]] ")
    .replace(/<long pause>/g, " [[slnc 800]] ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\|[^|]*\|/g, " ");
  const dir = await mkdtemp(join(tmpdir(), "studio-say-"));
  try {
    const aiff = join(dir, "say.aiff"), wav = join(dir, "say.wav");
    await run("say", [...(wpm ? ["-r", String(Math.round(wpm))] : []), "-o", aiff, "--", spoken]);
    await run("ffmpeg", ["-y", "-v", "error", "-i", aiff, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
    return await readFile(wav);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
