// Simplified: voice SFU removed. This build does not run mediasoup.
// The room registry remains as a stub so imports stay valid, but no worker
// or router is ever created.

export const TABLE_CHANNEL_ID = "table";
export const TABLE_CHANNEL_NAME = "The Table";

export type VoiceChannel = {
  id: string;
  name: string;
};

export type VoicePeer = {
  userId: string;
  username: string;
  joinedAt: string;
  channelId: string;
  muted: boolean;
  forceMuted: boolean;
  handRaisedAt: string | null;
  sayRange: string;
  sendTransport: unknown | null;
  recvTransport: unknown | null;
  producer: unknown | null;
  consumers: Map<string, unknown>;
};

export type VoiceRoom = {
  campaignId: string;
  router: unknown;
  peers: Map<string, VoicePeer>;
  speakerObserver: unknown | null;
  producerOwners: Map<string, string>;
  channels: VoiceChannel[];
  audibility: Map<string, unknown>;
  speakerTimer: ReturnType<typeof setTimeout> | null;
};

type VoiceRegistry = {
  runtime: null;
  starting: null;
  rooms: Map<string, VoiceRoom>;
};

declare global {
  var __odmVoiceRegistry: VoiceRegistry | undefined;
}

function registry(): VoiceRegistry {
  return (globalThis.__odmVoiceRegistry ??= {
    runtime: null,
    starting: null,
    rooms: new Map(),
  });
}

export async function ensureVoiceRuntime(): Promise<null> {
  return null;
}

export async function getOrCreateRoom(_campaignId: string): Promise<VoiceRoom> {
  const reg = registry();
  let room = reg.rooms.get(_campaignId);
  if (room) return room;
  room = {
    campaignId: _campaignId,
    router: null,
    peers: new Map(),
    speakerObserver: null,
    producerOwners: new Map(),
    speakerTimer: null,
    channels: [{ id: TABLE_CHANNEL_ID, name: TABLE_CHANNEL_NAME }],
    audibility: new Map(),
  };
  reg.rooms.set(_campaignId, room);
  return room;
}

export function getRoom(campaignId: string): VoiceRoom | null {
  return registry().rooms.get(campaignId) ?? null;
}

export async function webRtcServerHandle(): Promise<null> {
  return null;
}

export function closeRoomIfEmpty(campaignId: string) {
  const reg = registry();
  const room = reg.rooms.get(campaignId);
  if (!room || room.peers.size > 0) return;
  if (room.speakerTimer) clearTimeout(room.speakerTimer);
  reg.rooms.delete(campaignId);
}
