// Simplified: voice removed. Stub keeps the import surface so routes compile,
// but no real-time audio is established.

import { closeRoomIfEmpty, getRoom, getOrCreateRoom, TABLE_CHANNEL_ID, type VoicePeer, type VoiceRoom } from "@/lib/voice/room";
import type { VoiceRosterEntry } from "@/lib/voice/types";
import { publishEphemeral } from "@/lib/events";

globalThis.__odmVoiceEventHook = () => {};

export function roster(room: VoiceRoom | null): VoiceRosterEntry[] {
  if (!room) return [];
  return [...room.peers.values()]
    .map((peer) => ({
      userId: peer.userId,
      username: peer.username,
      channelId: peer.channelId,
      muted: peer.muted,
      forceMuted: peer.forceMuted,
      handRaisedAt: peer.handRaisedAt,
      sayRange: peer.sayRange as unknown as VoiceRosterEntry["sayRange"],
      producing: false,
      joinedAt: peer.joinedAt,
    }))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
}

export function publishRoster(campaignId: string) {
  publishEphemeral(campaignId, "voice_roster", { peers: roster(getRoom(campaignId)) });
}

export type TransportParams = {
  id: string;
  iceParameters: unknown;
  iceCandidates: unknown;
  dtlsParameters: unknown;
};

export async function joinRoom(
  campaignId: string,
  userId: string,
  username: string,
): Promise<{ peer: VoicePeer; send: TransportParams; recv: TransportParams }> {
  const room = await getOrCreateRoom(campaignId);
  const existing = room.peers.get(userId);
  if (existing) {
    room.peers.delete(userId);
  }
  const peer: VoicePeer = {
    userId,
    username,
    joinedAt: new Date().toISOString(),
    channelId: TABLE_CHANNEL_ID,
    muted: false,
    forceMuted: false,
    handRaisedAt: null,
    sayRange: "normal",
    sendTransport: null,
    recvTransport: null,
    producer: null,
    consumers: new Map(),
  };
  room.peers.set(userId, peer);
  const dummy: TransportParams = { id: "dummy", iceParameters: {}, iceCandidates: [], dtlsParameters: {} };
  return { peer, send: dummy, recv: dummy };
}

export function findPeer(campaignId: string, userId: string): VoicePeer | null {
  return getRoom(campaignId)?.peers.get(userId) ?? null;
}

export async function connectTransport(_peer: VoicePeer, _transportId: string, _dtlsParameters: unknown): Promise<boolean> {
  return true;
}

export async function restartIce(_peer: VoicePeer, _transportId: string) {
  return null;
}

export async function produceAudio(_campaignId: string, _peer: VoicePeer, _transportId: string, _rtpParameters: unknown): Promise<string | null> {
  return null;
}

export type ConsumerParams = {
  id: string;
  producerId: string;
  producerUserId: string;
  kind: string;
  rtpParameters: unknown;
};

export async function consumeOthers(_campaignId: string, _peer: VoicePeer, _rtpCapabilities: unknown): Promise<ConsumerParams[]> {
  return [];
}

export async function resumeConsumers(_campaignId: string, _peer: VoicePeer, _consumerIds: string[]) {}

export function transmitting(_peer: VoicePeer): boolean {
  return false;
}

export async function syncProducer(_peer: VoicePeer) {}

export async function setMuted(peer: VoicePeer, muted: boolean) {
  peer.muted = muted;
}

export function setHandRaised(peer: VoicePeer, raised: boolean) {
  peer.handRaisedAt = raised ? (peer.handRaisedAt ?? new Date().toISOString()) : null;
}

export function setSayRange(peer: VoicePeer, sayRange: string) {
  peer.sayRange = sayRange as VoicePeer["sayRange"];
}

export function setChannel(peer: VoicePeer, channelId: string) {
  peer.channelId = channelId;
}

export function leaveRoom(campaignId: string, userId: string): boolean {
  const room = getRoom(campaignId);
  const peer = room?.peers.get(userId);
  if (!room || !peer) return false;
  room.peers.delete(userId);
  closeRoomIfEmpty(campaignId);
  return true;
}
