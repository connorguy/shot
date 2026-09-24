// ElevenLabs text-to-speech, optional: set ELEVENLABS_API_KEY in shot/.env (or ~/.shot/.env). The key stays here,
// server-side. Reads come back as 24 kHz PCM and are wrapped as WAV like Gemini's.
import { pcmToWav } from "./wav.ts";

const BASE = "https://api.elevenlabs.io";
const key = () => process.env.ELEVENLABS_API_KEY?.trim() || "";
export const elevenAvailable = () => !!key();

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  if (!key()) throw new Error("No ElevenLabs key. Add ELEVENLABS_API_KEY to shot/.env, then restart.");
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "xi-api-key": key(), ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text.slice(0, 400);
    try {
      const d = JSON.parse(text)?.detail;
      msg = typeof d === "string" ? d : d?.message || d?.status || msg;
    } catch { /* not JSON */ }
    throw new Error(`ElevenLabs ${res.status}: ${msg}`);
  }
  return res;
}

export interface ElevenVoice { id: string; name: string; category: string; description: string | null; labels: Record<string, string>; preview: string | null }

let voiceCache: { at: number; voices: ElevenVoice[] } | null = null;

/** Every voice the key can use (premade, cloned, designed, saved from the library). Cached for 5 minutes. */
export async function listVoices(fresh = false): Promise<ElevenVoice[]> {
  if (!fresh && voiceCache && Date.now() - voiceCache.at < 5 * 60_000) return voiceCache.voices;
  const voices: ElevenVoice[] = [];
  let token: string | null = null;
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({ page_size: "100", include_total_count: "false" });
    if (token) q.set("next_page_token", token);
    const j: any = await (await call(`/v2/voices?${q}`)).json();
    for (const v of j.voices || []) {
      voices.push({ id: v.voice_id, name: v.name, category: v.category || "other", description: v.description ?? null, labels: v.labels || {}, preview: v.preview_url ?? null });
    }
    if (!j.has_more || !j.next_page_token) break;
    token = j.next_page_token;
  }
  voiceCache = { at: Date.now(), voices };
  return voices;
}

export const voiceName = async (id: string) => (await listVoices().catch(() => [] as ElevenVoice[])).find((v) => v.id === id)?.name;

// A voice's stored settings, so a request that only changes speed keeps its stability, similarity and style.
const stored = new Map<string, Record<string, unknown>>();
async function storedSettings(voice: string) {
  if (!stored.has(voice)) {
    const s = await call(`/v1/voices/${encodeURIComponent(voice)}/settings`).then((r) => r.json()).catch(() => null);
    stored.set(voice, s && typeof s === "object" ? s : {});
  }
  return { ...stored.get(voice)! };
}

/** ElevenLabs' pace control. Outside this range the voice degrades. */
export const SPEED_MIN = 0.7, SPEED_MAX = 1.2;

export interface ElevenRequest { text: string; voice: string; model: string; speed?: number }

export async function synthesizeEleven(r: ElevenRequest): Promise<{ wav: Buffer; model: string }> {
  const settings = await storedSettings(r.voice);
  if (r.speed && Math.abs(r.speed - 1) > 0.005) settings.speed = +r.speed.toFixed(3);
  // v3 takes three stability steps (creative 0, natural 0.5, robust 1)
  if (r.model === "eleven_v3" && typeof settings.stability === "number") settings.stability = Math.round(settings.stability * 2) / 2;
  const res = await call(`/v1/text-to-speech/${encodeURIComponent(r.voice)}?output_format=pcm_24000`, {
    method: "POST",
    body: JSON.stringify({ text: r.text, model_id: r.model, ...(Object.keys(settings).length ? { voice_settings: settings } : {}) }),
  });
  return { wav: pcmToWav(Buffer.from(await res.arrayBuffer()), 24000, 1, 16), model: r.model };
}

/** Eleven v3 takes direction as audio tags, so a style becomes a leading tag: "calm, warm" → "[calm, warm] …".
 *  Older models have no equivalent and read the text as written. */
export function elevenText(text: string, style: string, model: string) {
  const s = style.replace(/[[\]]/g, "").trim();
  return s && model === "eleven_v3" ? `[${s}] ${text}` : text;
}
