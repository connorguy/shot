// Hooks for `npm run render`: the CLI opens the studio in headless Chrome and exports through the
// same path as the Export button, so the CLI's audio mix is identical to what you hear in the studio.
import { renderMix } from "../audio/engine.ts";
import { api } from "./api.ts";
import { getState, saveNow } from "./store.ts";

(window as any).__studio = {
  ready: () => {
    const s = getState();
    return !!(s.project && s.timeline && s.manifest && s.timeline.clips.length);
  },
  async exportVideo(draft: boolean, silent = false): Promise<string> {
    await saveNow();
    const s = getState();
    const mix = silent ? null : await renderMix(s.project!, s.timeline!);
    const job = await api.export(s.project!, mix, draft);
    return job.id;
  },
};
