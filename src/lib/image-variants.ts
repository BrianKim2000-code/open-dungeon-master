// Simplified: image variant generation removed. The original image is served
// directly; no WebP resizing or WASM codecs are needed.

import type { VariantWidth } from "@/lib/image-format";

export type VariantResult = {
  written: string[];
  skipped: string[];
  error?: string;
};

export async function writeImageVariants(_source: string, _widths?: readonly VariantWidth[]): Promise<VariantResult> {
  return { written: [], skipped: [] };
}

export function scheduleImageVariants(_source: string): void {}

export async function imageVariantsSettled(): Promise<void> {}

export async function servedSegments(
  _rootDir: string,
  segments: string[],
  _width: VariantWidth,
  _waitMs = 4000,
): Promise<string[]> {
  return segments;
}
