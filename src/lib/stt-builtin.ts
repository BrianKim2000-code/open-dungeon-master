// Simplified: built-in Whisper removed to avoid @huggingface/transformers.
// An external STT service is still usable; this module reports no built-in.

import path from "node:path";
import { serverEnv } from "./server-env.ts";

export const BUILTIN_STT_MODEL = serverEnv("STT_BUILTIN_MODEL", "onnx-community/whisper-base").trim();
export const BUILTIN_STT_DOWNLOAD_MB = 76;

export function speechCacheDir(): string {
  return path.join(process.cwd(), "models", "speech");
}

export function builtinSpeechInstalled(): boolean {
  return false;
}

export type BuiltinSpeechStatus = {
  model: string;
  downloadMb: number;
  installed: boolean;
  status: "idle" | "installing" | "ready" | "error";
  progress: number;
  error: string;
};

export function builtinSpeechStatus(): BuiltinSpeechStatus {
  return { model: BUILTIN_STT_MODEL, downloadMb: BUILTIN_STT_DOWNLOAD_MB, installed: false, status: "idle", progress: 0, error: "" };
}

export function installBuiltinSpeech(): BuiltinSpeechStatus {
  return builtinSpeechStatus();
}

export async function transcribeBuiltin(_samples: Float32Array): Promise<string> {
  throw new Error("Built-in speech not available in simplified build.");
}
