"use client";

import { useCapabilities } from "@/lib/use-capabilities";
import type { ImageBackend } from "@/lib/types";

// Where a campaign's pictures are actually made (issue 89). The campaign
// only switches them on and picks a backend; the address, the model and the
// key belong to the server and are set by an admin, so a table could not
// tell what its switch would do: was the text going to the cloud, to some
// model's server, nowhere? These lines say it, from what the server reports
// about itself (/api/capabilities), and say so when the thing behind the
// switch is not there (issue 88).

const noteClass = "reveal text-[11px] leading-4 text-stone-500";

const PAINTERS: Record<ImageBackend, string> = {
  comfyui: "the ComfyUI install this server is set up with",
  "mflux-hs": "the FLUX worker (mflux) on this server",
  "sdnq-hs": "the FLUX worker (sdnq) on this server",
  openai: "an OpenAI-compatible images API",
  harness: "the server's agent program",
};

export function ImagesNote({ backend }: { backend: ImageBackend }) {
  const capabilities = useCapabilities();
  if (!capabilities) {
    return null;
  }
  const place = capabilities.images.openaiPlace;
  const where = backend !== "openai" || !place ? "" : place === "local" ? " on this server's own network" : ` at ${place}`;
  return (
    <p className={noteClass}>
      Pictures are painted by {PAINTERS[backend]}
      {where}. Its address, model and key are the server&apos;s, set in Admin &gt; Image generation, so every
      campaign here shares them.
    </p>
  );
}
