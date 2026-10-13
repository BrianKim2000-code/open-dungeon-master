"use client";

import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { memo, useState, type ReactNode } from "react";
import { HeaderGlyph } from "@/app/campaigns/[campaignId]/SessionGlyph";
import { GameIcon } from "@/components/ui/GameIcon";
import { AccountMenu, AppHomeButton, type AccountMenuUser } from "@/components/AccountMenu";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { headerButtonClass } from "@/app/campaigns/[campaignId]/headerButton";
import { RulebookDialog } from "@/components/rulebook/RulebookDialog";

// The table's header: the campaign title in the display face with the scene
// line under it, and every table-wide control right-aligned after it. The
// account menu is the same one every other page carries, so settings,
// characters, log out and the app's home screen are one tap away from the
// table too.
//
// Memoized: the table re-renders on every stream event, and the header
// changes on almost none of them. SessionView hands it stable callbacks and
// a memoized shake object so the memo holds.
export const SessionHeader = memo(function SessionHeader({
  title,
  scene,
  user,
  onRollDice,
  shake,
  ribbon,
  stage,
}: {
  title: string;
  scene: string;
  user: AccountMenuUser;
  // Opens the dice tray: loose dice, rolled for the table or in secret.
  onRollDice: () => void;
  // Shake to roll, offered only where the device can be shaken.
  shake: { supported: boolean; on: boolean; onToggle: () => void };
  // The initiative ribbon during a fight (CinematicParts.tsx), laid along
  // the middle of the bar from md up; the phone keeps the banner above the
  // composer instead.
  ribbon?: ReactNode;
  // The fight stage switch, shown while a board is on the table: the board
  // in the main column or the story there, with the board in its tab.
  stage?: { on: boolean; onToggle: () => void };
}) {
  const diceItem = "session-menu-row";
  return (
    <header className="glass session-header cine-header z-10 flex items-center gap-2 border-b border-stone-700/40 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:gap-3 sm:px-4">
      <div className="min-w-0 flex-1">
        <h1 className="gold-title session-title font-display">{title}</h1>
        <p key={scene} className="live-in truncate font-serif text-xs italic text-stone-400">
          {scene || "The adventure unfolds"}
        </p>
      </div>
      {ribbon ? <div className="cine-ribbon-slot hidden lg:flex">{ribbon}</div> : null}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        {/* Every table-wide control on one brass plate; the way out and the
            account menu stay beside it as the app's own furniture. */}
        <div className="session-cluster">
        {/* The dice menu: the dice tray (open or secret rolls) first, then
            the 3D animation switch, the player's own dice, and shake to
            roll on a phone. */}
        <DropdownMenu.Root>
          <Tooltip content="Dice" side="bottom">
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Dice"
                data-tour="header-dice"
                className={headerButtonClass(false)}
              >
                <HeaderGlyph glyph="tab-dice" />
              </button>
            </DropdownMenu.Trigger>
          </Tooltip>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={4} className="panel z-50 min-w-52 rounded-lg p-1">
              <DropdownMenu.Item className={diceItem} onSelect={onRollDice}>
                <GameIcon icon={{ kind: "glyph", key: "die-d20" }} size="size-6" />
                <span>
                  Roll dice
                  <span className="session-menu-hint">For the table, or in secret</span>
                </span>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-stone-700/60" />
              {shake.supported ? (
                <DropdownMenu.CheckboxItem
                  checked={shake.on}
                  onCheckedChange={shake.onToggle}
                  className={diceItem}
                >
                  <span className="flex size-4 items-center justify-center">
                    <DropdownMenu.ItemIndicator>
                      <Check className="size-3.5 text-amber-300" />
                    </DropdownMenu.ItemIndicator>
                  </span>
                  Shake to roll
                </DropdownMenu.CheckboxItem>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        {stage ? (
          <Tooltip content={stage.on ? "Show the story here, with the board in its tab" : "Show the board here, with the story beside it"} side="bottom">
            <button
              type="button"
              onClick={stage.onToggle}
              aria-label={stage.on ? "Show the story" : "Show the board"}
              aria-pressed={stage.on}
              data-tour="header-stage"
              className={headerButtonClass(stage.on)}
            >
              <HeaderGlyph glyph={stage.on ? "tab-story" : "tab-battle"} />
            </button>
          </Tooltip>
        ) : null}
        <RulebookButton />
        </div>
        <Tooltip content="All campaigns" side="bottom">
          <Link
            href="/"
            aria-label="All campaigns"
            className={cn(ui.btnSmall, "hidden h-9 gap-1.5 py-0 pl-1 sm:inline-flex")}
          >
            <HeaderGlyph glyph="tab-campaigns" />
            <span className="hidden md:inline">All campaigns</span>
          </Link>
        </Tooltip>
        <AppHomeButton className="hidden sm:block" />
        <AccountMenu user={user} />
      </div>
    </header>
  );
});

// The rulebook, laid open over the table so a rule can be checked without
// leaving the session.
function RulebookButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip content="The rulebook: every rule, spell and monster" side="bottom">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Rulebook"
          data-tour="header-rulebook"
          className={headerButtonClass(open)}
        >
          <HeaderGlyph glyph="system-rules" />
        </button>
      </Tooltip>
      <RulebookDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
