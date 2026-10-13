"use client";

// Stubbed Bluetooth dice support: removed @systemic-games/pixels-web-connect
// to simplify the repo and avoid Web Bluetooth / native-adjacent code.
// All APIs remain so callers do not need a rename, but they report no dice.

export type ConnectedPixel = {
  systemId: string;
  pixelId: number;
  name: string;
  faceCount: number;
};

export type PixelRoll = {
  systemId: string;
  faceCount: number;
  value: number;
};

const EMPTY: ConnectedPixel[] = [];

export function isWebBluetoothAvailable(): boolean {
  return false;
}

export function getConnectedPixels(): ConnectedPixel[] {
  return EMPTY;
}

export function getConnectedPixelsServer(): ConnectedPixel[] {
  return EMPTY;
}

export async function connectNewPixel(): Promise<ConnectedPixel> {
  throw new Error("Bluetooth dice support has been removed.");
}

export async function reconnectPixel(_systemId: string): Promise<ConnectedPixel | null> {
  return null;
}

export async function disconnectPixel(_systemId: string): Promise<void> {}

export async function identifyPixel(_systemId: string): Promise<void> {}

export function onPixelRoll(_listener: (roll: PixelRoll) => void): () => void {
  return () => {};
}

export function onPixelsChanged(_listener: () => void): () => void {
  return () => {};
}
