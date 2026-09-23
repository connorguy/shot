// Minimal 16-bit PCM WAV helpers for TTS takes (Gemini returns 24 kHz mono s16le).

export interface WavInfo { sampleRate: number; channels: number; bits: number; dataOffset: number; dataLength: number }

export function parseWav(buf: Buffer): WavInfo | null {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;
  let off = 12, fmt: Omit<WavInfo, "dataOffset" | "dataLength"> | null = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    let size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") fmt = { channels: buf.readUInt16LE(off + 10), sampleRate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    if (id === "data") {
      // streaming encoders sometimes write 0 or 0xFFFFFFFF as the data size
      if (size === 0 || size === 0xffffffff || off + 8 + size > buf.length) size = buf.length - off - 8;
      return fmt ? { ...fmt, dataOffset: off + 8, dataLength: size } : null;
    }
    off += 8 + size + (size % 2);
  }
  return null;
}

export function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bits = 16): Buffer {
  const h = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bits) / 8;
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(byteRate, 28); h.writeUInt16LE((channels * bits) / 8, 32); h.writeUInt16LE(bits, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export function wavDuration(buf: Buffer): number | null {
  const w = parseWav(buf);
  return w ? w.dataLength / (w.sampleRate * w.channels * (w.bits / 8)) : null;
}

/** Trim leading/trailing silence (below ~-45 dBFS), keeping a little air. Returns a clean canonical WAV. */
export function trimSilence(buf: Buffer, padSec = 0.04): Buffer {
  const w = parseWav(buf);
  if (!w || w.bits !== 16) return buf;
  const frameBytes = 2 * w.channels;
  const n = Math.floor(w.dataLength / frameBytes);
  const thr = Math.round(32768 * Math.pow(10, -45 / 20));
  const loud = (i: number) => {
    for (let c = 0; c < w.channels; c++) if (Math.abs(buf.readInt16LE(w.dataOffset + i * frameBytes + c * 2)) > thr) return true;
    return false;
  };
  let a = 0, b = n - 1;
  while (a < n && !loud(a)) a++;
  while (b > a && !loud(b)) b--;
  if (a >= b) return pcmToWav(buf.subarray(w.dataOffset, w.dataOffset + w.dataLength), w.sampleRate, w.channels);
  const pad = Math.round(padSec * w.sampleRate);
  a = Math.max(0, a - pad); b = Math.min(n - 1, b + pad);
  return pcmToWav(buf.subarray(w.dataOffset + a * frameBytes, w.dataOffset + (b + 1) * frameBytes), w.sampleRate, w.channels);
}
