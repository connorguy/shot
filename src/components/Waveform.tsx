import { useEffect, useRef, useState } from "react";
import { PEAK_RATE, getDecoded, loadBuffer, onDecoded, peaks } from "../audio/engine.ts";

/** Peak waveform of [from, from+duration] of an asset, stretched to `width` px. */
export function Waveform({ url, from, duration, width }: { url: string; from: number; duration: number; width: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!getDecoded(url)) loadBuffer(url).catch(() => {});
    return onDecoded(() => bump((n) => n + 1));
  }, [url]);
  const buf = getDecoded(url);
  const w = Math.max(1, Math.min(4000, Math.round(width)));
  useEffect(() => {
    const c = cv.current;
    if (!c || !buf) return;
    const dpr = window.devicePixelRatio || 1;
    const h = c.clientHeight || 36;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);
    g.fillStyle = getComputedStyle(c).color;
    const p = peaks(buf);
    const a = from * PEAK_RATE, span = duration * PEAK_RATE;
    for (let x = 0; x < w; x++) {
      const i0 = Math.floor(a + (x / w) * span), i1 = Math.max(i0 + 1, Math.floor(a + ((x + 1) / w) * span));
      let m = 0;
      for (let i = i0; i < i1 && i < p.length; i++) if (p[i] > m) m = p[i];
      const bh = Math.max(1, Math.pow(m, 0.7) * (h - 4));
      g.fillRect(x, (h - bh) / 2, 1, bh);
    }
  }, [buf, from, duration, w]);
  return <canvas ref={cv} className="wave" style={{ width: w }} />;
}
