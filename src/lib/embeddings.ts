// Simplified embeddings: transformer runtime removed to avoid native build.
// All embeddings fall back to keyword search; the app stays functional
// without semantic recall.

import { serverEnv } from "./server-env.ts";

export const EMBEDDING_DIM = 384;

export function resolveEmbeddingDtype(raw: string): string {
  const value = raw.trim().toLowerCase();
  return value || "fp32";
}

export const MODEL_ID = serverEnv("EMBEDDING_MODEL", "Xenova/all-MiniLM-L6-v2").trim();
export const EMBEDDING_KEY = `${MODEL_ID}@fp32`;
export const LEGACY_EMBEDDING_KEY = "Xenova/all-MiniLM-L6-v2@fp32";

export function embeddingIndexStale(stored: string | null, current = EMBEDDING_KEY): boolean {
  return (stored ?? LEGACY_EMBEDDING_KEY) !== current;
}

export function checkEmbeddingDim(_modelId: string, _size: number): void {}

export function embedLoadRetryDelay(failures: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, failures - 1), 30 * 60_000);
}

export function isPermanentEmbedLoadFailure(_error: unknown): boolean {
  return true;
}

export async function embed(_texts: string[], _options: { background?: boolean } = {}): Promise<Float32Array[]> {
  // Return empty to signal no embedding; callers fall back to keyword.
  throw new Error("Embeddings disabled in simplified build (transformers removed).");
}

export function cosine(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let index = 0; index < length; index += 1) sum += a[index] * b[index];
  return sum;
}

export function similarityOf(_queryVector: Float32Array | null, _embedding: Buffer | null): number | null {
  return null;
}

export function vectorToBuffer(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

export function bufferToVector(buffer: Buffer | null | undefined): Float32Array | null {
  if (!buffer || buffer.length !== EMBEDDING_DIM * 4) return null;
  return new Float32Array(buffer.buffer, buffer.byteOffset, EMBEDDING_DIM).slice();
}
