"use client";

import { PageSection } from "@/components/PageShell";
import { ui } from "@/lib/ui";
import {
  Field,
  SecretField,
  type EnvDefaults,
  type MaskedConfig,
} from "@/app/admin/AdminSettingsFields";

// The section about how the server is reached from outside: Discord sign-in.
// A world an app hosts owns it itself, so the panel leaves this whole file out
// there.
export function AdminNetworkSections({
  config,
  env,
  setConfig,
  discordSecret,
  setDiscordSecret,
}: {
  config: MaskedConfig;
  env: EnvDefaults;
  setConfig: (next: MaskedConfig) => void;
  discordSecret: string;
  setDiscordSecret: (value: string) => void;
}) {
  return (
    <>
        <PageSection id="admin-discord" heading="Discord sign-in" glyph="system-share">
          <p className="mb-3 text-xs text-stone-500">
            Optional. Create an application at discord.com/developers, add the redirect URI
            {" "}<code className="text-stone-400">&lt;public URL&gt;/api/auth/discord/callback</code>{" "}
            (the exact address players use, e.g. https://your.domain or http://lan-host:3005),
            then paste the client ID and secret. The login button appears once both are set.
            Behind a reverse proxy, also set the Public URL in the Server section above.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Client ID"
              hint={env.discordClientId ? `Env: ${env.discordClientId}` : undefined}
            >
              <input
                className={ui.input}
                value={config.discord.clientId}
                onChange={(event) =>
                  setConfig({ ...config, discord: { ...config.discord, clientId: event.target.value } })
                }
                placeholder={env.discordClientId || "Not set"}
              />
            </Field>
            <SecretField
              label="Client secret"
              isSet={config.discord.hasClientSecret}
              value={discordSecret}
              onChange={setDiscordSecret}
              hint={env.hasDiscordClientSecret ? "An env-var secret is also set." : undefined}
            />
          </div>
        </PageSection>
    </>
  );
}
