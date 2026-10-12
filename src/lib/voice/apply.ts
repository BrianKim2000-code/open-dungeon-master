import { getRoom } from "@/lib/voice/room";
import type { AudibilitySeat } from "@/lib/voice/audibility";

export type SeatPeer = {
  userId: string;
  channelId: string;
  sayRange: "whisper" | "normal" | "shout";
};

export function buildSeats(_campaignId: string, _peers: SeatPeer[]): { seats: AudibilitySeat[]; blocked?: (ax: number, ay: number, bx: number, by: number) => boolean } {
  return { seats: [] };
}

export async function applyAudibility(_campaignId: string): Promise<void> {}

export function gainsFor(_campaignId: string, _userId: string): Record<string, number> {
  return {};
}

export function mayHear(_campaignId: string, _listenerId: string, _speakerId: string): boolean {
  return true;
}
