import type { DesignedVoice, Take, Timeline } from "../../shared/timeline.ts";

async function req<T>(method: string, url: string, body?: BodyInit | object, headers: Record<string, string> = {}): Promise<T> {
  const isRaw = body instanceof Blob || body instanceof ArrayBuffer || typeof body === "string";
  const res = await fetch(url, {
    method,
    // the server refuses writes without X-Shot (cross-site request guard)
    headers: { ...(body && !isRaw ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" ? { "X-Shot": "1" } : {}), ...headers },
    body: body == null ? undefined : isRaw ? (body as BodyInit) : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `${res.status} ${res.statusText}`);
  return json as T;
}

export interface Status {
  gemini: boolean;
  auth: { mode: "key" | "adc" | "none"; project: string | null; backend: string | null; error: string | null };
  say: boolean; ffmpeg: boolean; projectsDir: string; studioRoot: string;
}
export interface ProjectInfo { name: string; title: string; dir: string; updatedAt: string | null; hasTimeline: boolean }
export interface TemplateInfo {
  id: string; name: string; description: string; tags: string[]; scenes: number | null; duration: number | null;
  from: string | null; createdAt: string | null; hasPreview: boolean;
}
export interface Asset { asset: string; kind: string; duration: number | null; size: number }
export interface Job {
  id: string; project: string; draft: boolean; status: "running" | "done" | "error" | "cancelled"; phase: string;
  done: number; total: number; output?: string; path?: string; error?: string; startedAt: number; finishedAt?: number;
}

const P = (p: string) => `/api/projects/${encodeURIComponent(p)}`;
export const fileUrl = (project: string, rel: string) => `/files/${encodeURIComponent(project)}/${rel.split("/").map(encodeURIComponent).join("/")}`;
/** Audio for a clip: the file itself, or a pitch-preserved time-stretch of it when rate ≠ 1 (built and cached by the server). */
export const audioUrl = (project: string, rel: string, rate = 1) =>
  Math.abs(rate - 1) < 0.0005 ? fileUrl(project, rel) : `/api/projects/${encodeURIComponent(project)}/stretch?asset=${encodeURIComponent(rel)}&rate=${rate.toFixed(3)}`;

export const api = {
  status: () => req<Status>("GET", "/api/status"),
  projects: () => req<ProjectInfo[]>("GET", "/api/projects"),
  newDefaults: () => req<{ parent: string; studioProjects: string; home: string }>("GET", "/api/new-defaults"),
  createProject: (body: { name: string; title?: string; parent?: string; from?: string | null; template?: string | null }) => req<{ id: string; dir: string }>("POST", "/api/projects", body),
  templates: () => req<TemplateInfo[]>("GET", "/api/templates"),
  templatePreview: (id: string, v = 0) => `/api/templates/${encodeURIComponent(id)}/preview?v=${v}`,
  saveTemplate: (p: string, body: { name: string; description: string; at: number; includeCut: boolean; overwrite: boolean }) =>
    req<{ id: string; dir: string }>("POST", `${P(p)}/template`, body),
  openFolder: (path: string) => req<{ id: string; dir: string }>("POST", "/api/projects/open", { path }),
  forgetProject: (p: string) => req("POST", `${P(p)}/forget`),
  revealProject: (p: string) => req("POST", `${P(p)}/reveal`),
  pick: (kind: "folder" | "design" | "project", start?: string) => req<{ path: string | null }>("POST", "/api/pick", { kind, start }),
  timeline: (p: string) => req<{ timeline: Timeline | null; filmVersion: string | null; timelineVersion: string | null }>("GET", `${P(p)}/timeline`),
  saveTimeline: (p: string, tl: Timeline) => req<{ ok: true; updatedAt: string; timelineVersion: string | null }>("PUT", `${P(p)}/timeline`, tl),
  versions: (p: string) => req<{ film: string | null; timeline: string | null }>("GET", `${P(p)}/versions`),
  assets: (p: string) => req<Asset[]>("GET", `${P(p)}/assets`),
  upload: (p: string, kind: string, file: File) =>
    req<{ asset: string; duration: number | null }>("POST", `${P(p)}/upload?kind=${kind}&filename=${encodeURIComponent(file.name)}`, file),
  tts: (p: string, body: { clipId: string; text: string; voice: string; style: string; model: string; provider: string; target: number | null }) =>
    req<{ take: Take }>("POST", `${P(p)}/tts`, body),
  designVoice: (p: string, body: { name: string; description: string; model: string; gender?: string; language_code?: string }) =>
    req<{ voice: DesignedVoice }>("POST", `${P(p)}/voices`, body),
  music: (p: string, body: { prompt: string; model: string; name: string }) =>
    req<{ asset: string; duration: number | null; text: string }>("POST", `${P(p)}/music`, body),
  export: (p: string, mix: Blob | null, draft: boolean) => req<Job>("POST", `${P(p)}/export?draft=${draft ? 1 : 0}`, mix || new Blob([])),
  job: (id: string) => req<Job>("GET", `/api/jobs/${id}`),
  cancelJob: (id: string) => req("POST", `/api/jobs/${id}/cancel`),
  reveal: (project: string, path: string) => req("POST", "/api/reveal", { project, path }),
  thumbUrl: (p: string, film: string, version: string | null, scene: string, t: number, w = 240) =>
    `${P(p)}/thumb?film=${encodeURIComponent(film)}&scene=${encodeURIComponent(scene)}&t=${t.toFixed(3)}&w=${w}&v=${version || 0}`,
};
