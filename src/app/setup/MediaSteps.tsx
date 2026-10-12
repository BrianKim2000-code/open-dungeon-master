"use client";

import { useEffect, useState } from "react";
import { zImageMissing } from "@/lib/setup/discovery-logic";
import { ui } from "@/lib/ui";
import { Select } from "@/components/ui/Select";
import { fetchComfyModels } from "@/app/admin/AdminImagesSection";
import { HarnessPictureTest } from "@/app/admin/HarnessPictureTest";
import { comfyFromScan, type Draft } from "@/app/setup/draft";
import { ChoiceCard, ChoiceCards, type ScanResult } from "@/app/setup/SetupParts";

// Pictures: optional, so the step offers "none" as a real answer, and
// prefers what the scan found on this computer (free) over anything
// billed to a key.

type Update = (change: (draft: Draft) => Draft) => void;

const MEDIA_GUIDE = "https://github.com/Lebbitheplow/open-dungeon-master/blob/main/docs/media-setup.md";
// Z-Image Turbo in the model picker; no checkpoint file is named like this.
const Z_TURBO = "preset:z_turbo";
type SetupComfyModels = NonNullable<ScanResult["comfyui"]> & { error: string | null };

const sameComfyAddress = (left: string, right: string) => left.replace(/\/+$/, "") === right.replace(/\/+$/, "");

export async function loadSetupComfyModels(
  url: string,
  scanned: ScanResult["comfyui"],
  signal: AbortSignal,
): Promise<SetupComfyModels | null> {
  const address = url.trim();
  if (!address) return null;
  if (scanned && sameComfyAddress(address, scanned.url)) return { ...scanned, url: address, error: null };
  const found = await fetchComfyModels(address, signal);
  return {
    url: address,
    checkpoints: found.checkpoints,
    zImage: Boolean(found.zImage && zImageMissing(found.zImage).length === 0),
    error: found.error,
  };
}

function KeyField({ label, value, onChange, saved, hint }: { label: string; value: string; onChange: (value: string) => void; saved: boolean; hint: string }) {
  return (
    <label className="reveal block">
      <span className="mb-1 block text-xs font-medium text-stone-400">{label}</span>
      <input
        type="password"
        className={ui.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={saved ? "•••••••• (saved, leave blank to keep it)" : "sk-..."}
        autoComplete="off"
      />
      <span className="mt-1 block text-[11px] text-stone-500">{hint}</span>
    </label>
  );
}

export function PicturesStep({
  draft,
  update,
  scan,
  scanning,
  storyIsOpenAi,
  agentPaints,
  agentVerified,
  agentLabel,
  onAgentVerified,
  openaiKeySaved,
}: {
  draft: Draft;
  update: Update;
  scan: ScanResult | null;
  scanning: boolean;
  storyIsOpenAi: boolean;
  // The storyteller chosen on the last step has an image tool of its own.
  agentPaints: boolean;
  // A test picture has come back from it on this server.
  agentVerified: boolean;
  agentLabel: string;
  onAgentVerified: () => void;
  openaiKeySaved: boolean;
}) {
  const scannedComfy = scan?.comfyui ?? null;
  const address = draft.comfy.url.trim();
  const scanMatches = Boolean(scannedComfy && sameComfyAddress(address, scannedComfy.url));
  const [checkedComfy, setCheckedComfy] = useState<SetupComfyModels | null>(null);

  useEffect(() => {
    if (draft.pictures !== "comfyui" || !address || scanMatches) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadSetupComfyModels(address, scannedComfy, controller.signal)
        .then((found) => {
          if (!controller.signal.aborted) setCheckedComfy(found);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setCheckedComfy({ url: address, checkpoints: [], zImage: false, error: "Could not check ComfyUI. Check its address." });
          }
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address, draft.pictures, scannedComfy, scanMatches]);

  const comfy = scanMatches && scannedComfy
    ? { ...scannedComfy, url: address, error: null }
    : checkedComfy?.url === address ? checkedComfy : null;
  const checkingComfy = Boolean(address && draft.pictures === "comfyui" && !comfy);
  const pick = (pictures: Draft["pictures"]) =>
    update((current) => ({
      ...current,
      pictures,
      comfy: pictures === "comfyui" && !current.comfy.url && scannedComfy ? comfyFromScan(current.comfy, scannedComfy) : current.comfy,
    }));
  const setComfy = (patch: Partial<Draft["comfy"]>) => update((current) => ({ ...current, comfy: { ...current.comfy, ...patch } }));

  return (
    <div className="space-y-4">
      <ChoiceCards label="Pictures">
        <ChoiceCard
          picked={draft.pictures === "comfyui"}
          onPick={() => pick("comfyui")}
          glyph="ui-paint"
          title="ComfyUI on this computer"
          sub="Portraits, scene art and battle maps, painted on your own GPU. Free to run."
          badge={scanning || checkingComfy ? { text: "Looking…", tone: "off" } : comfy && !comfy.error ? { text: "Found", tone: "ready" } : { text: "Not found", tone: "off" }}
        />
        <ChoiceCard
          picked={draft.pictures === "openai"}
          onPick={() => pick("openai")}
          glyph="tab-admin"
          title="OpenAI's image model"
          sub={storyIsOpenAi ? "On the key from the last step. Each picture is billed to it." : "Billed to an OpenAI key, per picture. No GPU needed."}
        />
        {agentPaints ? (
          <ChoiceCard
            picked={draft.pictures === "agent"}
            onPick={() => pick("agent")}
            glyph="system-share"
            title={`${agentLabel} paints`}
            sub={
              agentVerified
                ? `${agentLabel}'s own image tool, on its own plan. It painted a test map here already.`
                : `${agentLabel}'s own image tool, on its own plan. One test map first, painted the way a table asks for one.`
            }
            badge={agentVerified ? { text: "Tested", tone: "ready" } : null}
          />
        ) : null}
        <ChoiceCard
          picked={draft.pictures === "none"}
          onPick={() => pick("none")}
          glyph="tab-handout"
          title="No pictures for now"
          sub="Painted placeholders stand in. A ComfyUI started later on this computer is picked up on its own."
        />
      </ChoiceCards>

      {draft.pictures === "comfyui" ? (
        <div key="comfy" className="reveal-height space-y-3">
          {!address && !scanning ? (
            <p className="su-note">
              Nothing answered at ComfyUI&apos;s usual address. Start ComfyUI (its default port is 8188), or type where it runs.{" "}
              <a href={MEDIA_GUIDE} target="_blank" rel="noreferrer" className="text-amber-200 underline">
                Installing ComfyUI, step by step
              </a>
              .
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-stone-400">ComfyUI address</span>
              <input className={ui.input} value={draft.comfy.url} onChange={(event) => { setCheckedComfy(null); setComfy({ url: event.target.value }); }} placeholder="http://127.0.0.1:8188" />
            </label>
            {checkingComfy ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-stone-400">Model file (checkpoint)</span>
                <input className={ui.input} disabled placeholder="Checking installed models…" />
              </label>
            ) : comfy?.checkpoints.length || comfy?.zImage || (comfy && draft.comfy.preset === "z_turbo") ? (
              <div role="group" aria-label="Model file" className="block">
                <span className="mb-1 block text-xs font-medium text-stone-400">Model file (checkpoint)</span>
                <Select
                  value={draft.comfy.preset === "z_turbo" ? Z_TURBO : draft.comfy.checkpoint}
                  onChange={(value) => setComfy(value === Z_TURBO ? { preset: "z_turbo" } : { checkpoint: value, preset: "checkpoint" })}
                  options={[
                    ...comfy.checkpoints.map((name) => ({ value: name, label: name })),
                    ...(draft.comfy.checkpoint && !comfy.checkpoints.includes(draft.comfy.checkpoint)
                      ? [{ value: draft.comfy.checkpoint, label: draft.comfy.checkpoint, hint: "Saved selection; not reported by this ComfyUI." }]
                      : []),
                    // Offered once its three files are found (src/lib/setup/discovery.ts),
                    // and kept in the list while it is the saved choice.
                    ...(comfy.zImage || draft.comfy.preset === "z_turbo"
                      ? [{ value: Z_TURBO, label: "Z-Image Turbo", hint: comfy.zImage ? "Diffusion model, Qwen 3 4B encoder and VAE found" : "Its files were not all found on this ComfyUI" }]
                      : []),
                  ]}
                  label="Model file (checkpoint)"
                  className="w-full"
                />
              </div>
            ) : (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-stone-400">Model file (checkpoint)</span>
                <input className={ui.input} value={draft.comfy.checkpoint} onChange={(event) => setComfy({ checkpoint: event.target.value, preset: "checkpoint" })} placeholder="Any SDXL checkpoint in ComfyUI/models/checkpoints" />
              </label>
            )}
          </div>
          {comfy?.error ? <p role="alert" className="text-xs text-red-300">{comfy.error}</p> : checkingComfy ? <p role="status" className="text-xs text-stone-500">Checking models at this address…</p> : null}
          <p className="text-[11px] text-stone-500">
            {draft.comfy.preset === "z_turbo"
              ? "Z-Image Turbo runs without a negative prompt, so a table's boundary cannot keep anything out of its pictures."
              : "Any checkpoint works; the campaign's genre supplies the art style."}
          </p>
        </div>
      ) : draft.pictures === "agent" ? (
        <div key="agent" className="reveal-height">
          <HarnessPictureTest
            saved
            picturesVerified={agentVerified}
            picturesForTables={false}
            offerAdopt={false}
            onVerified={onAgentVerified}
          />
        </div>
      ) : draft.pictures === "openai" ? (
        <div key="openai" className="reveal-height space-y-3">
          {storyIsOpenAi ? (
            <p className="su-note">Pictures go to OpenAI on the storyteller&apos;s key. Nothing more to paste.</p>
          ) : (
            <KeyField
              label="OpenAI API key"
              value={draft.picturesKey}
              onChange={(picturesKey) => update((current) => ({ ...current, picturesKey }))}
              saved={openaiKeySaved}
              hint="Used only for pictures. Each portrait, scene and map is billed to it."
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
