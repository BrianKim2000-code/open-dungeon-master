import type { PaletteCommand } from "@/components/CommandPalette";
import { WORKSHOP_SYSTEMS, type SystemId } from "@/app/workshop/[workshopId]/systems";

// The workshop's command palette, derived from the systems the hub lists:
// one "jump" per system, and one "create" for every system whose panel can
// open its own editor when asked.
//
// Asking is the page's own prepare broadcast: the page
// knows nothing about a panel's editor, the panel does, and it already
// answers these names for the guided tours. The palette is a second caller of
// the same names, so it can never open something the panel's own "New"
// button does not.

const GLYPH: Record<SystemId, string> = {
  world: "system-world",
  storyboard: "system-storyboard",
  party: "system-party",
  maps: "system-maps",
  region: "system-region",
  encounters: "system-encounters",
  cast: "system-cast",
  factions: "system-factions",
  bestiary: "system-bestiary",
  homebrew: "system-homebrew",
  lore: "system-lore",
  tables: "system-tables",
  rules: "system-rules",
  plugin: "system-plugin",
  share: "system-share",
};

export function workshopCommands({
  current,
  phrase,
  onJump,
  onHub,
}: {
  // The system on screen, or null on the hub.
  current: SystemId | null;
  // Each system's live count phrase, for the quiet line under its name.
  phrase: (id: SystemId) => string;
  onJump: (id: SystemId) => void;
  onHub: () => void;
}): PaletteCommand[] {
  const jumps: PaletteCommand[] = WORKSHOP_SYSTEMS.filter((system) => system.id !== current).map((system) => ({
    id: `go-${system.id}`,
    label: `Go to ${system.label}`,
    hint: `${system.blurb} · ${phrase(system.id)}`,
    group: "Jump to a system",
    glyph: GLYPH[system.id],
    keywords: ["open", "jump", system.id],
    onSelect: () => onJump(system.id),
  }));
  const here: PaletteCommand[] = [
    ...(current
      ? [{ id: "hub", label: "Back to the hub", hint: "Every system at a glance", group: "This workshop", glyph: "tab-campaigns", keywords: ["home", "cards"], onSelect: onHub }]
      : []),
  ];
  return [...jumps, ...here];
}
