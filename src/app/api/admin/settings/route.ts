import { z } from "zod";
import { isErrorResponse, requireAdmin } from "@/lib/admin-api";
import { speedStatus } from "@/lib/speed-status";
import { getGlobalConfig, saveGlobalConfig } from "@/lib/db/app-settings";
import { isDeviceWorld, serverEnv } from "@/lib/server-env";
import { resolveSignupMode, type GlobalConfig } from "@/lib/schemas/global-config";
import { forgetHarnessStatus } from "@/lib/harness/status";
import { rescueStrandedCampaigns, type RescueMove } from "@/lib/image-backend-rescue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Secrets never leave the server. GET replaces them with has* booleans; PATCH
// treats undefined as keep, "" as clear, and any other string as set.
function maskedConfig(config: GlobalConfig) {
  return {
    signupsEnabled: config.signupsEnabled,
    signupMode: resolveSignupMode(config, isDeviceWorld()),
    // True when the mode above is not the stored setting but the device
    // world rule (open to anyone with a live room code), so the panel can
    // say so instead of showing a policy the host cannot change.
    signupModeForced: isDeviceWorld(),
    serverName: config.serverName,
    accountDeletionGraceDays: config.accountDeletionGraceDays,
    abilityRerollBelow: config.abilityRerollBelow,
    publicUrl: config.publicUrl,
    worldRegistryUrl: config.worldRegistryUrl,
    text: {
      provider: config.text.provider,
      localTextModel: config.text.localTextModel,
      customBaseUrl: config.text.customBaseUrl,
      customModel: config.text.customModel,
      hasCustomApiKey: config.text.customApiKey !== "",
      utilityProvider: config.text.utilityProvider,
      utilityModel: config.text.utilityModel,
      utilityBaseUrl: config.text.utilityBaseUrl,
      hasUtilityApiKey: config.text.utilityApiKey !== "",
      speed: config.text.speed,
      utilitySpeed: config.text.utilitySpeed,
    },
    images: {
      defaultBackend: config.images.defaultBackend,
      comfyUrl: config.images.comfyUrl,
      comfyCheckpoint: config.images.comfyCheckpoint,
      comfyWorkflowPreset: config.images.comfyWorkflowPreset,
      fluxWorkerUrl: config.images.fluxWorkerUrl,
      openaiBaseUrl: config.images.openaiBaseUrl,
      openaiModel: config.images.openaiModel,
      hasOpenaiApiKey: config.images.openaiApiKey !== "",
    },
    discord: {
      clientId: config.discord.clientId,
      hasClientSecret: config.discord.clientSecret !== "",
    },
    // No secrets in here: the agent program uses its own sign-in.
    harness: config.harness,
    sharedHost: config.sharedHost,
  };
}

// Read-only hints so the admin UI can show what a cleared field falls back to.
function envDefaults() {
  return {
    customBaseUrl: serverEnv("OPENAI_COMPAT_BASE_URL"),
    customModel: serverEnv("OPENAI_COMPAT_MODEL"),
    hasCustomApiKey: serverEnv("OPENAI_COMPAT_API_KEY") !== "" || serverEnv("OPENROUTER_API_KEY") !== "",
    comfyUrl: serverEnv("COMFYUI_URL", "http://127.0.0.1:8188"),
    fluxWorkerUrl: serverEnv("FLUX_WORKER_URL", "http://127.0.0.1:7869"),
    imageBackend: serverEnv("DEFAULT_IMAGE_BACKEND"),
    hasOpenaiImageApiKey:
      serverEnv("OPENAI_IMAGE_API_KEY") !== "" || serverEnv("OPENAI_API_KEY") !== "",
    discordClientId: serverEnv("DISCORD_CLIENT_ID"),
    hasDiscordClientSecret: serverEnv("DISCORD_CLIENT_SECRET") !== "",
    publicUrl: serverEnv("APP_PUBLIC_URL"),
    worldRegistryUrl: serverEnv("WORLD_REGISTRY_URL"),
  };
}

// Set by the client shells for the world they host on the device. The panel
// hides what the shell owns (address, sign-ups, Discord)
// and keeps only the AI settings the player can meaningfully change.
function deviceWorld(): boolean {
  return isDeviceWorld();
}

export async function GET() {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) {
    return admin;
  }
  return Response.json({
    config: maskedConfig(getGlobalConfig()),
    envDefaults: envDefaults(),
    deviceWorld: deviceWorld(),
    // What the last Fast calls actually ran at (issue 255).
    speedStatus: speedStatus(),
  });
}

const patchSchema = z.object({
  signupsEnabled: z.boolean().optional(),
  signupMode: z.enum(["open", "invite", "closed"]).optional(),
  serverName: z.string().trim().max(100).optional(),
  accountDeletionGraceDays: z.number().int().min(0).max(90).optional(),
  abilityRerollBelow: z.number().int().min(0).max(108).optional(),
  publicUrl: z.string().trim().max(500).optional(),
  worldRegistryUrl: z.string().trim().max(500).optional(),
  text: z
    .object({
      // "none" lets an admin (or the desktop shell) record that this server
      // has no AI DM, so the UI can say so instead of failing a first turn.
      provider: z.enum(["", "local", "custom", "none", "harness"]).optional(),
      localTextModel: z.string().trim().max(200).optional(),
      customBaseUrl: z.string().trim().max(500).optional(),
      customModel: z.string().trim().max(200).optional(),
      customApiKey: z.string().trim().max(400).optional(),
      utilityProvider: z.enum(["", "local", "custom", "harness"]).optional(),
      utilityModel: z.string().trim().max(200).optional(),
      utilityBaseUrl: z.string().trim().max(500).optional(),
      utilityApiKey: z.string().trim().max(400).optional(),
      speed: z.enum(["", "fast"]).optional(),
      utilitySpeed: z.enum(["", "fast"]).optional(),
    })
    .optional(),
  images: z
    .object({
      defaultBackend: z.enum(["", "comfyui", "openai", "mflux-hs", "sdnq-hs", "harness"]).optional(),
      comfyUrl: z.string().trim().max(500).optional(),
      comfyCheckpoint: z.string().trim().max(300).optional(),
      comfyWorkflowPreset: z.enum(["checkpoint", "z_turbo"]).optional(),
      fluxWorkerUrl: z.string().trim().max(500).optional(),
      openaiBaseUrl: z.string().trim().max(500).optional(),
      openaiModel: z.string().trim().max(200).optional(),
      openaiApiKey: z.string().trim().max(400).optional(),
    })
    .optional(),
  discord: z
    .object({
      clientId: z.string().trim().max(100).optional(),
      clientSecret: z.string().trim().max(200).optional(),
    })
    .optional(),
  sharedHost: z
    .object({
      campaignCreation: z.enum(["", "everyone", "admins"]).optional(),
      paidAi: z.enum(["", "everyone", "admins"]).optional(),
    })
    .optional(),
  // imagesVerifiedAt is deliberately absent: only a real test picture
  // (POST /api/admin/harness) may set it.
  harness: z
    .object({
      id: z.enum(["", "claude", "codex", "opencode", "grok"]).optional(),
      binaryPath: z.string().trim().max(500).optional(),
      model: z.string().trim().max(200).optional(),
      utilityModel: z.string().trim().max(200).optional(),
      effort: z.enum(["", "low", "medium", "high", "xhigh", "max"]).optional(),
      speed: z.enum(["", "fast"]).optional(),
      utilitySpeed: z.enum(["", "fast"]).optional(),
      images: z.enum(["off", "native"]).optional(),
      campaigns: z.enum(["all", "admins"]).optional(),
      maxConcurrent: z.number().int().min(1).max(8).optional(),
      turnTimeoutSec: z.number().int().min(60).max(900).optional(),
    })
    .optional(),
});

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) {
    return admin;
  }
  const raw = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid settings." },
      { status: 400 },
    );
  }
  const before = getGlobalConfig().harness;
  const harnessPatch = parsed.data.harness;
  // A different program, or the same one somewhere else, has not painted a
  // test picture yet.
  const moved =
    harnessPatch &&
    ((harnessPatch.id !== undefined && harnessPatch.id !== before.id) ||
      (harnessPatch.binaryPath !== undefined && harnessPatch.binaryPath !== before.binaryPath));
  // A save that names a checkpoint and no workflow means that checkpoint:
  // the desktop app's local AI installer sends only the file it installed,
  // and a Z-Image Turbo choice left standing would paint every picture
  // without it.
  const images =
    parsed.data.images?.comfyCheckpoint !== undefined && parsed.data.images.comfyWorkflowPreset === undefined
      ? { ...parsed.data.images, comfyWorkflowPreset: "checkpoint" as const }
      : parsed.data.images;
  const saved = saveGlobalConfig({
    ...parsed.data,
    ...(images ? { images } : {}),
    ...(harnessPatch ? { harness: { ...harnessPatch, ...(moved ? { imagesVerifiedAt: "", images: "off" as const } : {}) } } : {}),
  });
  if (moved) {
    forgetHarnessStatus();
  }
  // A save that changes where pictures come from moves the campaigns stuck
  // on a backend that cannot paint onto the new default, when it can
  // (src/lib/image-backend-rescue.ts). A device world's shell owns its own.
  const rescued: RescueMove[] =
    (parsed.data.images || parsed.data.harness) && !deviceWorld() ? await rescueStrandedCampaigns() : [];
  return Response.json({
    config: maskedConfig(saved),
    envDefaults: envDefaults(),
    deviceWorld: deviceWorld(),
    rescued,
  });
}
