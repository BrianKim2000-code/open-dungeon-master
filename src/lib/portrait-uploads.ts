import { listSheetsForLibraryCharacter, patchSheet } from "@/lib/db/sheets";
import { publishPersisted } from "@/lib/events";
import type { SheetAttachment } from "@/lib/schemas/sheet";

// Uploaded portraits (the only kind there is now that the renderers are
// gone) leave the builder's crop dialog and land on the library character;
// this copies one onto every campaign sheet that character plays in, so chat
// and party views show the same face the player picked.
export function mirrorToCampaignSheets(
  libraryCharacterId: string,
  portrait: SheetAttachment | null,
  { overwrite = false }: { overwrite?: boolean } = {},
) {
  for (const sheet of listSheetsForLibraryCharacter(libraryCharacterId)) {
    if (!overwrite && sheet.portrait) {
      continue;
    }
    const updated = patchSheet(sheet.id, { portrait });
    if (updated) {
      publishPersisted(sheet.campaignId, "sheet_updated", { sheet: updated });
    }
  }
}
