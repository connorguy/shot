// Runs inside a film's window (studio iframe or headless page). Guarantees window.__film exists.
// Films built on film-kit already provide it; older films that only expose __renderAt/__DUR
// (e.g. an older one-piece player) are wrapped as a single scene called "main".
// Must stay self-contained: Playwright serializes it into the page.
export function ensureFilmApi(w: any): boolean {
  if (w.__film && typeof w.__film.renderFrame === "function") return true;
  if (typeof w.__renderAt === "function" && typeof w.__DUR === "number") {
    const dur = w.__DUR;
    w.__film = {
      version: 0,
      manifest: () => ({
        version: 1, title: w.document.title, width: 1920, height: 1080, fps: 30,
        scenes: [{ id: "main", label: "Film", section: null, start: 0, end: dur, beats: [] }],
        edit: null,
      }),
      renderFrame: (layers: { scene: string; t: number }[]) => {
        const top = layers[layers.length - 1];
        if (top) w.__renderAt(top.t);
      },
      renderAt: (t: number) => w.__renderAt(t),
      duration: dur,
    };
    return true;
  }
  return false;
}
