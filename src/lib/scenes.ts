// A place's kind of scene: what move_party, update_location and the map
// tools offer as the ground the party stands on. The battle map drawn there
// takes its terrain and light from it (src/lib/battlemap), and the encounter
// tools tag a fight with the ground it happens on. Nothing reads a place's
// name or description, so a place named in any language maps the same.
//
// Pure by design: no imports, no I/O. The ids are stable storage values
// (locations, prepared maps, workshop bundles); the labels are what a
// console select shows.

export type SceneKind = { id: string; label: string };

const SCENE_KINDS: SceneKind[] = [
  { id: "dungeon", label: "Dungeon" },
  { id: "cave", label: "Cave" },
  { id: "crypt", label: "Crypt" },
  { id: "sewer", label: "Sewer" },
  { id: "mine", label: "Mine" },
  { id: "ruins", label: "Ruins" },
  { id: "temple", label: "Temple" },
  { id: "forest", label: "Forest" },
  { id: "deep_forest", label: "Night forest" },
  { id: "jungle", label: "Jungle" },
  { id: "swamp", label: "Swamp" },
  { id: "desert", label: "Desert" },
  { id: "mountain", label: "Mountains" },
  { id: "tundra", label: "Frozen waste" },
  { id: "plains", label: "Open country" },
  { id: "river", label: "River" },
  { id: "waterfall", label: "Waterfall" },
  { id: "coast", label: "Coast" },
  { id: "ship", label: "Aboard ship" },
  { id: "underwater", label: "Underwater" },
  { id: "town", label: "Village" },
  { id: "city", label: "City street" },
  { id: "market", label: "Market" },
  { id: "crowd", label: "Crowd" },
  { id: "tavern", label: "Tavern" },
  { id: "camp", label: "Camp" },
  { id: "keep", label: "Great hall" },
  { id: "library", label: "Library" },
  { id: "forge", label: "Forge" },
  { id: "graveyard", label: "Graveyard" },
  { id: "arcane", label: "Arcane" },
];

// Ids only, for a zod enum or a tool's `enum` list.
export function sceneIds(): string[] {
  return SCENE_KINDS.map((scene) => scene.id);
}

// `{ value, label }` options for a console select. The empty option is the
// caller's business ("open ground" for a map, "leave it alone" for a tool).
export function sceneOptions(): Array<{ value: string; label: string }> {
  return SCENE_KINDS.map((scene) => ({ value: scene.id, label: scene.label }));
}
