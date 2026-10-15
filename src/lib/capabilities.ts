import { getGlobalConfig } from "@/lib/app-config";
import { configuredDefaultStorySettings } from "@/lib/runtime-defaults";
import { endpointKind } from "@/lib/dm/sampling-logic";
import { serverEnv } from "@/lib/server-env";
import { harnessConfig, probeHarness } from "@/lib/harness/status";
import { isHarnessId } from "@/lib/harness/types";
import type { StorySettings } from "@/lib/types";

// What this server can actually do, derived from the same resolution the DM
// path uses (configuredDefaultStorySettings, admin settings, env), not from
// env vars alone. /api/capabilities serves this to any logged-in user so the
// campaign creator can stop offering an AI DM that cannot exist.
//
// The decision logic (what counts as configured, cache expiry) lives in the
// exported pure functions below so scripts/test-capabilities.mjs can drive
// them without HTTP. Probe state lives on globalThis to survive dev HMR
// reloads, same pattern as src/lib/login-throttle.ts.

export type Capabilities = {
  // `model` is the storyteller's name for the title screen's status line
  // ("The DM is awake · qwen3.6-35b"); empty when nothing is configured.
  story: { configured: boolean; reachable: boolean; model: string };
  utility: { configured: boolean };
  // openaiPlace: where the OpenAI-kind image backend sends its requests,
  // "local" or the host's name (see `place` below).
  images: { configured: boolean; reachable: boolean; backend: string; openaiPlace: string };
};

export const PROBE_TIMEOUT_MS = 2_500;

// The short name of whatever writes the story: the local tag, the custom
// endpoint's model, or the connected agent's id.
export function storyModelName(
  settings: Pick<StorySettings, "textProvider" | "localTextModel" | "customModel">,
): string {
  const raw =
    settings.textProvider === "local"
      ? settings.localTextModel
      : settings.textProvider === "harness"
        ? settings.textProvider
        : settings.customModel;
  return (raw || "").trim().split("/").pop() || "";
}
// Long enough that a polling UI costs one upstream request per backend per
// half minute, short enough that starting llama-server shows up promptly.
export const PROBE_CACHE_MS = 30_000;

export function probeCacheFresh(probedAt: number, now: number): boolean {
  return now - probedAt < PROBE_CACHE_MS;
}

// "Configured" means the DM path would actually dial something: an explicit
// "none" and a missing URL or model both mean the first turn cannot work.
export function storyConfigured(
  settings: Pick<StorySettings, "textProvider" | "localTextModel" | "customBaseUrl" | "customModel">,
): boolean {
  if (settings.textProvider === "none") {
    return false;
  }
  if (settings.textProvider === "local") {
    return Boolean(settings.localTextModel.trim());
  }
  // The agent program is configured in its own admin section; whether it is
  // installed and signed in is the reachability half (harnessReady).
  if (settings.textProvider === "harness") {
    return true;
  }
  return Boolean(settings.customBaseUrl.trim() && settings.customModel.trim());
}

// An empty utilityModel means "off" by design (everything runs on the story
// model), so the model name is the whole configuration signal.
export function utilityConfigured(settings: Pick<StorySettings, "utilityModel">): boolean {
  return Boolean(settings.utilityModel.trim());
}

// There is no image generator on this server any more: tables bring their
// own pictures (uploads). Every "may I paint?" control therefore answers no,
// which is what turns those controls into upload-only ones.
export function imagesConfigured(): boolean {
  return false;
}

export function imagesProbeUrl(): string {
  return "";
}

// Where a cheap liveness GET goes for the story backend. Ollama has no
// OpenAI-style /models, so the local provider probes its native tag list.
export function storyProbeUrl(
  settings: Pick<StorySettings, "textProvider" | "customBaseUrl">,
  ollamaBaseUrl: string,
): string {
  if (settings.textProvider === "none" || settings.textProvider === "harness") {
    return "";
  }
  if (settings.textProvider === "local") {
    return `${ollamaBaseUrl.replace(/\/+$/, "")}/api/tags`;
  }
  const base = settings.customBaseUrl.trim().replace(/\/+$/, "");
  if (!base) {
    return "";
  }
  // Same URL forgiveness as customChatEndpoint: a bare host, a /v1 base, or
  // anything in between all land on the models listing.
  return /\/v\d+$/.test(base) ? `${base}/models` : `${base}/v1/models`;
}

// The bearer the story probe sends. Key-gated servers (llama.cpp with --api-key,
// OpenRouter, any proxy) answer /models with 401 to an anonymous GET, which
// used to read as "backend down" in the creator while turns worked fine. Same
// precedence as the request-time fallback in model-client.ts, and only ever
// for the server's own configured backend, so the key goes nowhere else.
export function storyProbeHeaders(
  settings: Pick<StorySettings, "textProvider" | "customBaseUrl">,
  keys: { configured: string; openaiCompat: string; openRouter: string },
): Record<string, string> {
  if (settings.textProvider === "none" || settings.textProvider === "local" || settings.textProvider === "harness") {
    return {};
  }
  const isOpenRouter = endpointKind(settings.customBaseUrl) === "openrouter";
  const key = (keys.configured || (isOpenRouter ? keys.openRouter : keys.openaiCompat) || "").trim();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

// "local" for this machine and private networks, else the host's name.
export function backendPlace(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return "local";
  }
  const privateV4 = /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  const privateV6 = host === "::1" || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe80:/.test(host);
  const localName = host === "localhost" || !host.includes(".") || /\.(local|lan|internal|home|localdomain)$/.test(host);
  return privateV4 || privateV6 || localName ? "local" : host;
}

type ProbeEntry = { probedAt: number; reachable: boolean };

declare global {
  var __odmCapabilityProbes: Map<string, ProbeEntry> | undefined;
  var __odmCapabilityProbesInFlight: Map<string, Promise<boolean>> | undefined;
}

// Addresses come from the admin panel and the environment, so the set is
// small, but each edit adds one; past this many the oldest are forgotten.
const PROBE_STORE_MAX = 64;

function probeStore(): Map<string, ProbeEntry> {
  if (!globalThis.__odmCapabilityProbes) {
    globalThis.__odmCapabilityProbes = new Map();
  }
  return globalThis.__odmCapabilityProbes;
}

function probesInFlight(): Map<string, Promise<boolean>> {
  return (globalThis.__odmCapabilityProbesInFlight ??= new Map());
}

function rememberProbe(url: string, entry: ProbeEntry) {
  const store = probeStore();
  store.delete(url);
  store.set(url, entry);
  while (store.size > PROBE_STORE_MAX) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

// A failed probe is an answer, never an error: the UI polls this, and a dead
// backend must cost one timeout per cache window, not one per poll. Callers
// that arrive while the same address is already being asked share that one
// request instead of each dialling a cold backend (several tabs opening the
// admin panel at once).
export async function probeReachable(
  url: string,
  now = Date.now(),
  headers: Record<string, string> = {},
): Promise<boolean> {
  if (!url) {
    return false;
  }
  const cached = probeStore().get(url);
  if (cached && probeCacheFresh(cached.probedAt, now)) {
    return cached.reachable;
  }
  const pending = probesInFlight().get(url);
  if (pending) {
    return pending;
  }
  const probe = (async () => {
    let reachable = false;
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers,
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      reachable = response.ok;
      // Only the status matters; the body is not left to the collector.
      await response.body?.cancel().catch(() => undefined);
    } catch {
      reachable = false;
    }
    rememberProbe(url, { probedAt: now, reachable });
    return reachable;
  })().finally(() => {
    probesInFlight().delete(url);
  });
  probesInFlight().set(url, probe);
  return probe;
}

// The producer-side question every portrait and map enqueue used to ask.
// With the generators gone the answer is always no; kept so callers and the
// capability probe share one name.
export async function imagesAvailable(): Promise<boolean> {
  return false;
}

// Whether the chosen agent program is installed, allowed to run here and
// signed in. Uses the cached probe (five minutes), so a polling UI never
// starts the program itself.
export async function harnessReady(): Promise<boolean> {
  const config = harnessConfig();
  if (!isHarnessId(config.id)) {
    return false;
  }
  try {
    const status = await probeHarness(config.id);
    return status.installed && status.availability === "ok" && status.auth.state !== "signed-out";
  } catch {
    return false;
  }
}

export async function capabilitiesSnapshot(): Promise<Capabilities> {
  const settings = configuredDefaultStorySettings();
  const cfg = getGlobalConfig();
  const configured = storyConfigured(settings);
  const ollamaBase = serverEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434");
  const storyReachable =
    settings.textProvider === "harness"
      ? await harnessReady()
      : configured
        ? await probeReachable(
            storyProbeUrl(settings, ollamaBase),
            Date.now(),
            storyProbeHeaders(settings, {
              configured: cfg.text.customApiKey,
              openaiCompat: serverEnv("OPENAI_COMPAT_API_KEY"),
              openRouter: serverEnv("OPENROUTER_API_KEY"),
            }),
          )
        : false;

  return {
    story: { configured, reachable: storyReachable, model: configured ? storyModelName(settings) : "" },
    utility: { configured: utilityConfigured(settings) },
    images: { configured: false, reachable: false, backend: "", openaiPlace: "" },
  };
}
