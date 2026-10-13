"use client";

// Per-user, per-die-shape choice of how a physical roll gets fulfilled. This
// is the "unfulfilled rolls" idea from Foundry VTT: a player might own a
// physical d20 but no physical d6, so their d20 is typed while their d6 rolls
// digitally, all within one parked roll.
//
// The choice is a device-local preference (a die you own lives on the device in
// front of you), so it persists to localStorage rather than the server. On the
// wire, PendingRollCard submits typed faces as plain numbers and a digital face
// as the literal "digital", which the server rolls itself: a browser-invented
// number would be the player's to predict.

import { useCallback, useSyncExternalStore } from "react";

// The die shapes a dice expression can contain.
export const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export type DieSides = (typeof DIE_SIDES)[number];

// A source is one of:
//   "manual"        - the player types the number from a tabletop die
//   "digital"       - the server rolls it (an unfulfilled die falls back here)
export type DiceSourceMap = Record<number, string>;

const STORAGE_KEY = "odm.diceSources.v1";

export function defaultDiceSources(): DiceSourceMap {
  const map: DiceSourceMap = {};
  for (const sides of DIE_SIDES) {
    map[sides] = "manual";
  }
  return map;
}

// Shared reference returned whenever nothing is stored, so the client snapshot
// matches the server snapshot during hydration (no all-manual flicker).
const SERVER_SNAPSHOT = defaultDiceSources();

// Cache keyed on the raw stored string so getSnapshot returns a stable
// reference between reads (useSyncExternalStore requires this to avoid loops).
let cachedRaw = "";
let cachedMap: DiceSourceMap = SERVER_SNAPSHOT;

// Exported for scripts/test-dice-sources.mjs; the app reads it through
// useDiceSources.
export function parseStored(raw: string): DiceSourceMap {
  if (!raw) {
    return SERVER_SNAPSHOT;
  }
  const map = defaultDiceSources();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const sides of DIE_SIDES) {
      const value = parsed[String(sides)];
      if (value === "digital" || value === "manual") {
        map[sides] = value;
      }
    }
  } catch {
    return SERVER_SNAPSHOT;
  }
  return map;
}

function getSnapshot(): DiceSourceMap {
  const raw =
    (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY)) || "";
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedMap = parseStored(raw);
  }
  return cachedMap;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("odm-dice-sources", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("odm-dice-sources", onChange);
  };
}

function writeStored(map: DiceSourceMap) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    // The native storage event only reaches other tabs; a custom event carries
    // the change to this tab's own subscribers.
    window.dispatchEvent(new Event("odm-dice-sources"));
  } catch {
    // Ignore write failures (private mode, quota).
  }
}

// How a single die face gets its value in a parked roll, resolved from the
// player's per-shape preference.
export type FaceSource =
  | { kind: "manual" }
  | { kind: "digital" };

export function resolveFaceSource(
  preference: string | undefined,
): FaceSource {
  if (preference === "digital") {
    return { kind: "digital" };
  }
  return { kind: "manual" };
}

// The stored preference as an external store, synced across tabs and hook
// instances. Returns the map and a per-shape setter.
export function useDiceSources(): [
  DiceSourceMap,
  (sides: DieSides, source: string) => void,
] {
  const sources = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  const setSource = useCallback((sides: DieSides, source: string) => {
    writeStored({ ...getSnapshot(), [sides]: source === "digital" ? "digital" : "manual" });
  }, []);

  return [sources, setSource];
}
