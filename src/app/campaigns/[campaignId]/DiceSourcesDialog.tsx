"use client";

import { Dices } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import {
  DIE_SIDES,
  type DieSides,
  useDiceSources,
} from "@/lib/dice/dice-sources";

// Lets a player say, per die shape, where its number comes from during a
// physical roll: a tabletop die they type or a digital roll. Opens from the
// party panel's physical-dice controls.
export function DiceSourcesButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Choose where each of your dice is rolled: typed or digital."
        className={cn(
          "flex w-full items-center justify-center gap-1 rounded border border-stone-700 py-1 text-xs text-stone-400 hover:bg-stone-900",
          className,
        )}
      >
        <Dices className="size-3" />
        Dice sources
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Your dice sources"
        icon={<Dices className="size-5 text-amber-300" />}
      >
        <DiceSourcesPanel />
      </Dialog>
    </>
  );
}

const SOURCE_MANUAL = "manual";
const SOURCE_DIGITAL = "digital";

export function DiceSourcesPanel() {
  const [sources, setSource] = useDiceSources();

  return (
    <div className="space-y-4 text-sm">
      <div>
        <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-stone-400">
          Roll each die with
        </span>
        <div className="stagger space-y-1.5">
          {DIE_SIDES.map((sides) => (
            <SourceRow
              key={sides}
              sides={sides}
              value={sources[sides] ?? SOURCE_MANUAL}
              onChange={(source) => setSource(sides, source)}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Assigned dice only apply while your physical-dice toggle is on.
        </p>
      </div>
    </div>
  );
}

function SourceRow({
  sides,
  value,
  onChange,
}: {
  sides: DieSides;
  value: string;
  onChange: (source: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="w-10 font-mono text-xs text-amber-200/90">d{sides}</span>
      <Select
        value={value === SOURCE_DIGITAL ? SOURCE_DIGITAL : SOURCE_MANUAL}
        onChange={onChange}
        label={`Where the d${sides} comes from`}
        size="sm"
        className="min-w-0 flex-1"
        options={[
          { value: SOURCE_MANUAL as string, label: "Type it (tabletop die)" },
          { value: SOURCE_DIGITAL as string, label: "Digital roll" },
        ]}
      />
    </label>
  );
}
