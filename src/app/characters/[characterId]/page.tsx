"use client";

import { PageSkeleton } from "@/components/PageSkeleton";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AvatarCropDialog } from "@/app/settings/AvatarCropDialog";
import { AppHeader } from "@/components/AppHeader";
import { KebabMenu, type KebabItem } from "@/components/KebabMenu";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { GameIcon } from "@/components/ui/GameIcon";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { cn } from "@/lib/cn";
import { downloadBlob, filenameSlug } from "@/lib/download";
import type { CreateSheetInput } from "@/lib/schemas/sheet";
import { CharacterPortrait, ui } from "@/lib/ui";
import { SheetSections, StorySoFar, type CharacterEvent } from "./SheetSections";
import { navigateTo } from "@/lib/navigation";
import { UseInCampaignDialog } from "./UseInCampaignDialog";

// Where this character is playing; see src/lib/db/characters.ts.
type CharacterAssignment = {
  campaignId: string;
  title: string;
  kind: "campaign" | "workshop";
  status: string;
};

type LibraryCharacter = {
  id: string;
  name: string;
  // A character somebody plays, or an ally the DM plays.
  role?: "pc" | "companion";
  race: string;
  class: string;
  subclass: string;
  background: string;
  level: number;
  xp: number;
  campaigns?: CharacterAssignment[];
  sheet: CreateSheetInput;
  updatedAt: string;
};


function titleCase(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CharacterDetailPage({
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  const { characterId } = use(params);
  const [character, setCharacter] = useState<LibraryCharacter | null>(null);
  const [events, setEvents] = useState<CharacterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [cropping, setCropping] = useState(false);
  const [seating, setSeating] = useState(false);

  // The whole character as one JSON file, portrait inlined, for carrying to
  // another device or server (see src/lib/character-bundle.ts).
  async function handleExport() {
    if (!character) {
      return;
    }
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch(`/api/characters/${characterId}/export`);
      if (!response.ok) {
        setExportError("Export failed.");
        return;
      }
      downloadBlob(`${filenameSlug(character.name)}.odm-character.json`, await response.blob());
    } catch {
      setExportError("Export failed.");
    } finally {
      setExporting(false);
    }
  }

  // Same portrait-only PATCH the library list uses; a manual upload is
  // authoritative and replaces whatever was painted.
  async function handlePortraitUploaded(portrait: {
    id: string;
    name: string;
    type: string;
    url: string;
  }) {
    setCropping(false);
    const response = await fetch(`/api/characters/${characterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portrait }),
    });
    if (response.ok) {
      setCharacter((current) =>
        current ? { ...current, sheet: { ...current.sheet, portrait } } : current,
      );
    }
  }

  // The third choice beside upload: no picture at all, which shows
  // the stand-in plate for the class or race (src/lib/placeholders.ts).
  async function clearToPlaceholder() {
    const response = await fetch(`/api/characters/${characterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portrait: null }),
    });
    if (response.ok) {
      setCharacter((current) =>
        current ? { ...current, sheet: { ...current.sheet, portrait: null } } : current,
      );
    }
  }

  // A second copy under a numbered name, sheet and portrait verbatim. The
  // roster is where copies live, so that is where this lands; "Duplicate
  // and edit" opens the copy in the build editor instead (issue 229).
  async function handleDuplicate(edit = false) {
    setCloning(true);
    try {
      const response = await fetch(`/api/characters/${characterId}/clone`, { method: "POST" });
      if (!response.ok) {
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { character?: { id: string } };
      navigateTo(edit && data.character ? `/characters/${data.character.id}/edit?copyOf=${characterId}` : "/characters");
    } finally {
      setCloning(false);
    }
  }

  useEffect(() => {
    fetch(`/api/characters/${characterId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.character) {
          setCharacter(data.character);
          setEvents(data.events ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [characterId]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <AppHeader />
        <PageSkeleton kind="sheet" className="px-0 py-2" />
      </main>
    );
  }

  if (!character) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <AppHeader />
        <div className={cn(ui.card, "ornate texture-noise flex flex-col items-center gap-3 px-6 py-8 text-center")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/ui/empty-notice-board.webp" alt="" className="h-24 w-32 object-contain opacity-90" />
          <p className="font-serif text-sm text-stone-300">Character not found.</p>
          <Link href="/characters" className={ui.btnSecondary}>
            Back to your library
          </Link>
        </div>
      </main>
    );
  }

  const sheet = character.sheet;

  // Everything but the primary action, once, for the kebab and for the
  // right-click or long press on the header. Each hint is the sentence the
  // old button carried as its tooltip.
  const actions: KebabItem[] = [
    {
      id: "export",
      label: exporting ? "Exporting..." : "Export",
      hint: "Save this character as a file you can import on another device or server",
      glyph: "system-share",
      disabled: exporting,
      onSelect: () => void handleExport(),
    },
    {
      id: "edit",
      label: "Edit build",
      hint: "Change this character's build choices in the library",
      glyph: "ui-edit",
      onSelect: () => navigateTo(`/characters/${characterId}/edit`),
    },
    {
      id: "duplicate",
      label: cloning ? "Copying..." : "Duplicate",
      hint: "Save a second copy of this character to your library",
      glyph: "ui-duplicate",
      disabled: cloning,
      onSelect: () => void handleDuplicate(),
    },
    {
      id: "duplicate-edit",
      label: "Duplicate and edit",
      hint: "Save a second copy and open it in the build editor; this one stays as it is",
      glyph: "ui-duplicate",
      disabled: cloning,
      onSelect: () => void handleDuplicate(true),
    },
    {
      id: "portrait",
      label: sheet.portrait ? "Replace portrait" : "Upload portrait",
      hint: sheet.portrait ? "Replace the portrait with a photo" : "Upload a portrait",
      glyph: "ui-upload",
      separated: true,
      onSelect: () => setCropping(true),
    },
    ...(sheet.portrait
      ? [
          {
            id: "placeholder",
            label: "Use placeholder",
            hint: "Take the picture away and show the stand-in for this class or race",
            glyph: "ui-placeholder",
            onSelect: () => void clearToPlaceholder(),
          },
        ]
      : []),
  ];
  const working = exporting || cloning;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
      <AppHeader />
      <ContextMenu items={actions} label={character.name} className={cn(ui.card, "ornate texture-noise mb-4 p-4 sm:p-5")}>
        <Link href="/characters" className="-my-1 inline-flex min-h-10 items-center gap-1.5 text-sm text-stone-400 hover:text-amber-200">
          <ArrowLeft className="size-4" /> Back to your characters
        </Link>
        <div className="mt-2 flex items-start gap-4">
          <span className="relative shrink-0">
            {sheet.portrait?.url ? (
              <ImageLightbox
                src={sheet.portrait.url}
                alt={character.name}
                caption={character.name}
                className="size-20 shrink-0 rounded-xl border border-amber-500/30 object-cover shadow-glow-gold sm:size-24"
              />
            ) : (
              <CharacterPortrait
                look={{ race: character.race, class: character.class, gender: sheet.gender }}
                alt={character.name}
                size="size-20 sm:size-24"
                rounded="rounded-xl"
                className="border-amber-500/30 shadow-glow-gold"
              />
            )}
            <GameIcon
              icon={{ kind: "family", key: `class-${character.class}` }}
              size="size-8"
              className="pointer-events-none absolute -bottom-2 -right-2"
            />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="gold-title font-display text-2xl tracking-wide sm:text-3xl">
              {character.name}
            </h1>
            <p className="mt-1 text-sm text-stone-400">
              <span className="mr-1.5 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-400/10 py-0.5 pl-0.5 pr-2 text-[11px] text-amber-200">
                <GameIcon icon={{ kind: "glyph", key: "rest-level-up" }} size="size-5" />
                Level {character.level}
              </span>
              {titleCase(character.race)} {titleCase(character.class)}
              {character.subclass ? ` (${character.subclass})` : ""}
              {character.background ? ` · ${titleCase(character.background)}` : ""}
            </p>
            {/* Each campaign holds its own copy of this sheet, so one library
                entry can be at several tables at once. Naming them is what
                makes "which game is this one in?" answerable. */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {character.campaigns?.length ? (
                character.campaigns.map((assignment) => (
                  <Link
                    key={assignment.campaignId}
                    href={
                      assignment.kind === "workshop"
                        ? `/workshop/${assignment.campaignId}`
                        : `/campaigns/${assignment.campaignId}`
                    }
                    className="motion-press inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border border-stone-600/60 bg-stone-900/60 py-0.5 pl-1 pr-2.5 text-xs text-stone-300 transition-colors hover:border-amber-500/40 hover:text-amber-100"
                  >
                    <GameIcon
                      icon={{ kind: "glyph", key: assignment.kind === "workshop" ? "system-storyboard" : "tab-campaigns" }}
                      size="size-6"
                    />
                    <span className="truncate">{assignment.title}</span>
                  </Link>
                ))
              ) : (
                <span className="text-xs text-stone-500">Not in a campaign yet.</span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-amber-500/15 pt-3">
          <button type="button" onClick={() => setSeating(true)} className={cn(ui.btnPrimary, "min-w-0 flex-1 sm:flex-none")}>
            <GameIcon icon={{ kind: "glyph", key: "tab-campaigns" }} size="size-6" />{" "}
            {character.role === "companion" ? "Bring to a campaign" : "Use in a campaign"}
          </button>
          <Link href={`/characters/${characterId}/edit`} className={cn(ui.btnSecondary, "min-w-0 flex-1 sm:flex-none")}>
            <GameIcon icon={{ kind: "glyph", key: "rest-level-up" }} size="size-6" /> Edit build
          </Link>
          <KebabMenu
            items={actions}
            label={`More actions for ${character.name}`}
            heading={character.name}
            busy={working}
          />
          {working ? (
            <span role="status" className="live-in text-xs text-stone-400">
              {exporting ? "Exporting..." : cloning ? "Copying..." : "Working..."}
            </span>
          ) : null}
        </div>
        {exportError ? <p role="alert" className="motion-shake mt-2 text-sm text-red-400">{exportError}</p> : null}
      </ContextMenu>

      <SheetSections sheet={sheet} level={character.level} />
      <div className="mt-4">
        <StorySoFar events={events} />
      </div>

      {seating ? (
        <UseInCampaignDialog
          characterId={characterId}
          characterName={character.name}
          characterLevel={character.level}
          role={character.role}
          seatedIn={(character.campaigns ?? []).map((assignment) => assignment.campaignId)}
          onClose={() => setSeating(false)}
        />
      ) : null}

      {cropping ? (
        <AvatarCropDialog
          title={`Portrait for ${character.name}`}
          onUploaded={(image) => void handlePortraitUploaded(image)}
          onClose={() => setCropping(false)}
        />
      ) : null}
    </main>
  );
}
