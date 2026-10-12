"use client";

import type { VoiceRosterEntry } from "@/lib/voice/types";

export type VoiceStatus = "idle" | "connecting" | "connected" | "error" | "reconnecting";
export type MicMode = "open" | "ptt";
export const PTT_KEY = "Space";

// Simplified: voice removed. Hook remains so UI compiles, but always reports unavailable.

export function useVoiceRoom(
  _campaignId: string,
  _rosterFromStream: VoiceRosterEntry[] | null,
  _mePeerId = "",
  _audibilityVersion = 0,
  _meshSignal: { to: string; version: number } | null = null,
  _options: { transcribe?: boolean } = {},
) {
  return {
    status: "idle" as VoiceStatus,
    error: "Voice has been removed in this simplified build.",
    muted: false,
    handRaised: false,
    toggleHand: async (..._args: unknown[]) => {},
    sayRange: "normal" as const,
    setSayRange: async (..._args: unknown[]) => {},
    micDevices: [] as Array<{ deviceId: string; label: string }>,
    micId: "",
    selectMic: (..._args: unknown[]) => {},
    micMode: "open" as MicMode,
    selectMicMode: (..._args: unknown[]) => {},
    talking: false,
    setTalking: (..._args: unknown[]) => {},
    reconnecting: false,
    peers: [] as VoiceRosterEntry[],
    available: false,
    unavailableReason: "Voice has been removed.",
    join: async (..._args: unknown[]) => {},
    leave: async (..._args: unknown[]) => {},
    toggleMute: async (..._args: unknown[]) => {},
    connected: false,
    peerVolume: (_userId: string) => ({ volume: 1, muted: false }) as unknown as import("@/lib/voice/volume").PeerVolume,
    setPeerVolume: (_userId: string, _value: number) => {},
    togglePeerMute: (_userId: string) => {},
    resetPeerVolume: (_userId: string) => {},
    masterVolume: 1,
    setMasterVolume: (..._args: unknown[]) => {},
    deafened: false,
    toggleDeafen: (..._args: unknown[]) => {},
  };
}
