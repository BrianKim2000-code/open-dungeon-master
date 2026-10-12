// Simplified: TTS narration removed. These exports remain so older
// campaign code still compiles, but no audio is ever generated.

import path from "node:path";
import type { Speaker, SpokenLine } from "@/lib/dm/speech";
import type { RosterEntry } from "@/lib/tts-roster";

export function narrationAudioPath(campaignId: string, messageId: string): string {
  return path.join(process.cwd(), "public", "generated-audio", campaignId, `${messageId}.mp3`);
}

export function narrationAudioUrl(campaignId: string, messageId: string, version: number): string {
  return `/generated-audio/${campaignId}/${messageId}.mp3?v=${Math.floor(version)}`;
}

export type NarrationSettings = { ttsVoice: string; ttsSpeed?: number; ttsAutoCast?: boolean };

export function castVoices(_campaignId: string): unknown[] {
  return [];
}

export function unvoicedSpeakers(
  _lines: readonly SpokenLine[],
  _roster: RosterEntry[],
  _speaker: Speaker | null,
): Set<string> {
  return new Set();
}

export function enqueueNarrationAudio(
  _campaignId: string,
  _messageId: string,
  _text: string,
  _lines: readonly SpokenLine[],
  _narration: NarrationSettings | string,
  _speaker: Speaker | null = null,
): Promise<void> {
  return Promise.resolve();
}

export function takeNarrationFailure(_messageId: string): string | null {
  return null;
}

export function narrationAudioFor(_campaignId: string, _messageIds: string[]): Record<string, string> {
  return {};
}

export function listNarrationAudio(_campaignId: string): Record<string, string> {
  return {};
}

export const PREVIEW_LINE = "";

export function isPreviewableVoice(_voice: string): boolean {
  return false;
}

export function voicePreviewName(_voice: string, _backend: unknown): string {
  return "";
}

export function voicePreviewPath(name: string): string {
  return path.join(process.cwd(), "public", "generated-audio", "previews", name);
}

export function voicePreviewCached(_voice: string): boolean {
  return false;
}

export function renderVoicePreview(_voice: string): Promise<string> {
  return Promise.reject(new Error("Voice preview disabled in simplified build."));
}
