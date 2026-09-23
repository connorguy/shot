// Gemini calls: speech (Gemini 3.8 TTS), voice design, music (Lyria).
//
// Auth, in order:
//   1. GEMINI_API_KEY (or GOOGLE_API_KEY): Gemini Developer API, x-goog-api-key.
//   2. Application Default Credentials (`gcloud auth application-default login`): OAuth bearer token +
//      x-goog-user-project, for orgs that disallow API keys. Two backends:
//      - "developer": the same Developer API (generativelanguage.googleapis.com) with the ADC token.
//        This is the only place Gemini 3.8 TTS, voice design and Lyria 3.5 exist today.
//      - "agent-platform": Gemini Enterprise Agent Platform (aiplatform.googleapis.com, the Vertex AI successor).
//        TTS uses gemini-3.1-flash-tts-preview via :generateContent, and music uses lyria-3-pro-preview /
//        lyria-3-clip-preview via Interactions. There is no voice design there yet.
//      GEMINI_BACKEND=auto (default) tries "developer" first and falls back to "agent-platform" when the
//      Developer API refuses the token (401/403, e.g. the API isn't enabled or org policy blocks it).
// Docs: ai.google.dev/gemini-api/docs/{speech-generation,voice-design,music-generation,oauth}
//       docs.cloud.google.com/text-to-speech/docs/gemini-tts, …/gemini-enterprise-agent-platform/models/lyria/lyria-3
import { GoogleAuth } from "google-auth-library";
import { pcmToWav } from "./wav.ts";

const DEV = "https://generativelanguage.googleapis.com/v1beta";
const AP_LOCATION = () => process.env.GOOGLE_CLOUD_LOCATION || "global";
const AP = (project: string) => {
  const loc = AP_LOCATION();
  const host = loc === "global" ? "aiplatform.googleapis.com" : `${loc}-aiplatform.googleapis.com`;
  return `https://${host}/v1beta1/projects/${project}/locations/${loc}`;
};
const AP_TTS_MODEL = () => process.env.AP_TTS_MODEL || "gemini-3.1-flash-tts-preview";
const AP_MUSIC: Record<string, string> = { "lyria-3.5": "lyria-3-pro-preview", "lyria-3-clip-preview": "lyria-3-clip-preview" };

export const geminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

// ───────── ADC ─────────

let gauth: GoogleAuth | null = null;
let adcCache: { token: string; project: string | null; exp: number } | null = null;
let adcError: string | null = null;
let adcFailedAt = 0;

async function adc(): Promise<{ token: string; project: string | null } | null> {
  if (adcCache && adcCache.exp > Date.now() + 60_000) return adcCache;
  if (adcError && Date.now() - adcFailedAt < 15_000) return null; // don't hammer the token endpoint while polling status
  adcFailedAt = Date.now();
  try {
    gauth ||= new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/generative-language.retriever"] });
    const client: any = await gauth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("ADC returned no access token");
    const project = process.env.GOOGLE_CLOUD_PROJECT || client.quotaProjectId || (await gauth.getProjectId().catch(() => null));
    const exp = client.credentials?.expiry_date || Date.now() + 45 * 60_000;
    adcCache = { token, project, exp };
    adcError = null;
    return adcCache;
  } catch (e: any) {
    const msg = String(e?.message || e);
    adcError = /invalid_rapt|invalid_grant|reauth/i.test(msg)
      ? "ADC login expired (your org requires periodic re-authentication). Run: gcloud auth application-default login"
      : /Could not load the default credentials/i.test(msg)
        ? "No ADC found. Run: gcloud auth application-default login"
        : msg.split("\n")[0];
    return null;
  }
}

type Backend = "developer" | "agent-platform";
let adcBackend: Backend | null = (process.env.GEMINI_BACKEND === "developer" || process.env.GEMINI_BACKEND === "agent-platform") ? process.env.GEMINI_BACKEND : null;

export interface AuthStatus { mode: "key" | "adc" | "none"; project: string | null; backend: Backend | "auto" | null; error: string | null }

/** What the studio can use right now (shown in the UI). */
export async function authStatus(): Promise<AuthStatus> {
  if (geminiKey()) return { mode: "key", project: null, backend: "developer", error: null };
  const a = await adc();
  if (a) return { mode: "adc", project: a.project, backend: adcBackend || "auto", error: null };
  return { mode: "none", project: null, backend: null, error: adcError };
}

// ───────── HTTP ─────────

class HttpError extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

async function post(url: string, body: unknown, headers: Record<string, string>): Promise<any> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep text for the error */ }
  if (!res.ok) throw new HttpError(res.status, `${res.status}: ${json?.error?.message || text.slice(0, 400)}`);
  return json;
}

async function bearer() {
  const a = await adc();
  if (!a) throw new Error(`No Gemini credentials. Either add GEMINI_API_KEY to shot/.env, or run \`gcloud auth application-default login\` (ADC)${adcError ? ` — ADC said: ${adcError}` : ""}.`);
  const h: Record<string, string> = { Authorization: `Bearer ${a.token}` };
  if (a.project) h["x-goog-user-project"] = a.project;
  return { headers: h, project: a.project };
}

/** Run `dev` against the Developer API (key or ADC); with ADC in auto mode, fall back to `ap` on 401/403. */
async function route<T>(dev: (base: string, h: Record<string, string>) => Promise<T>, ap: ((base: string, h: Record<string, string>) => Promise<T>) | null): Promise<T> {
  const key = geminiKey();
  if (key) return dev(DEV, { "x-goog-api-key": key });
  const { headers, project } = await bearer();
  const tryAp = async () => {
    if (!ap) throw new Error("This needs the Gemini Developer API (not on Agent Platform yet). Enable generativelanguage.googleapis.com for your ADC project, or use an API key.");
    if (!project) throw new Error("ADC has no project. Set GOOGLE_CLOUD_PROJECT in shot/.env or run `gcloud config set project <id>`.");
    return ap(AP(project), headers);
  };
  if (adcBackend === "agent-platform") return tryAp();
  try {
    const r = await dev(DEV, headers);
    adcBackend ||= "developer";
    return r;
  } catch (e: any) {
    if (adcBackend === "developer" || !(e instanceof HttpError) || ![401, 403].includes(e.status) || !ap) throw wrap(e);
    const r = await tryAp().catch((e2) => { throw wrap(e2, `Developer API refused ADC (${e.message}); Agent Platform also failed`); });
    adcBackend = "agent-platform";
    return r;
  }
}

const wrap = (e: any, prefix = "Gemini") => new Error(`${prefix}: ${e?.message || e}`);

// ───────── response parsing ─────────

interface Block { type: string; data?: string; text?: string; mime_type?: string }

/** Content blocks from model_output steps; falls back to a deep search (Agent Platform `outputs[]`, `inlineData`). */
function outputBlocks(json: any): Block[] {
  const steps: any[] = Array.isArray(json?.steps) ? json.steps : [];
  const blocks = steps.filter((s) => s?.type === "model_output").flatMap((s) => (Array.isArray(s.content) ? s.content : []));
  if (blocks.length) return blocks;
  const found: Block[] = [];
  (function walk(o: any) {
    if (!o || typeof o !== "object") return;
    if ((o.type === "audio" || o.type === "text") && (typeof o.data === "string" || typeof o.text === "string")) found.push(o);
    else if (o.inlineData?.data) found.push({ type: "audio", data: o.inlineData.data, mime_type: o.inlineData.mimeType });
    else for (const v of Object.values(o)) walk(v);
  })(json);
  return found;
}

function audioFrom(json: any): { data: Buffer; mime: string } {
  const audio = outputBlocks(json).filter((b) => b.type === "audio" && b.data);
  const last = audio[audio.length - 1];
  if (!last) throw new Error("Gemini response had no audio block.");
  return { data: Buffer.from(last.data!, "base64"), mime: last.mime_type || "audio/wav" };
}

const asWav = (data: Buffer, mime: string) => {
  if (data.toString("ascii", 0, 4) === "RIFF") return data;
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1] || 24000);
  return pcmToWav(data, rate, 1, 16); // audio/l16 / raw PCM (24 kHz mono)
};

// ───────── speech ─────────

export interface TtsRequest { text: string; voice: string; style?: string; model: string }

/** Returns { wav, model } where model is what actually spoke (may differ on Agent Platform). */
export async function synthesize(req: TtsRequest): Promise<{ wav: Buffer; model: string }> {
  const style = req.style?.trim() || "";
  return route(
    async (base, h) => {
      const item: any = { type: "text", text: req.text };
      if (style) item.annotations = [{ type: "speech_metadata", style }];
      const json = await post(`${base}/interactions`, {
        model: req.model,
        input: [{ type: "user_input", content: [item] }],
        response_format: { type: "audio", mime_type: "audio/wav" },
        generation_config: { speech_config: [{ voice: req.voice }] },
      }, h);
      const { data, mime } = audioFrom(json);
      return { wav: asWav(data, mime), model: req.model };
    },
    async (base, h) => {
      if (req.voice.startsWith("voice_")) throw new Error("Designed voices (voice_…) need the Developer API. Pick a prebuilt voice for Agent Platform.");
      const model = AP_TTS_MODEL();
      const json = await post(`${base}/publishers/google/models/${model}:generateContent`, {
        contents: [{ role: "user", parts: [{ text: style ? `Say the following, ${style}: ${req.text}` : req.text }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: req.voice } } } },
      }, h);
      const { data, mime } = audioFrom(json);
      return { wav: asWav(data, mime), model };
    },
  );
}

// ───────── voice design ─────────

export interface VoiceDesign { name: string; description: string; model: string; gender?: string; language_code?: string }

export async function designVoice(v: VoiceDesign): Promise<{ id: string; sample: Buffer | null }> {
  return route(async (base, h) => {
    const voice: any = { model: v.model, type: "prompted", display_name: v.name, prompted: { input: v.description } };
    if (v.gender) voice.gender = v.gender;
    if (v.language_code) voice.language_code = v.language_code;
    const json = await post(`${base}/voices`, { store: true, voice }, h);
    const id: string = json?.id || json?.voice?.id || json?.name?.split("/").pop();
    if (!id) throw new Error("Voice design response had no voice id.");
    const s = json?.sample_audio?.data || json?.voice?.sample_audio?.data;
    return { id, sample: s ? Buffer.from(s, "base64") : null };
  }, null);
}

// ───────── music ─────────

export async function generateMusic(prompt: string, model: string): Promise<{ data: Buffer; ext: string; text: string; model: string }> {
  const parse = (json: any, m: string) => {
    const { data, mime } = audioFrom(json);
    const text = outputBlocks(json).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return { data, ext: mime.includes("wav") ? "wav" : mime.includes("aac") ? "aac" : "mp3", text, model: m };
  };
  return route(
    async (base, h) => parse(await post(`${base}/interactions`, { model, input: prompt }, { ...h, "Api-Revision": "2026-05-20" }), model),
    async (base, h) => {
      const m = AP_MUSIC[model] || model;
      const json = await post(`${base}/interactions`, {
        model: m, input: [{ type: "user_input", content: [{ type: "text", text: prompt }] }],
      }, { ...h, "Api-Revision": "2026-05-20" });
      return parse(json, m);
    },
  );
}
