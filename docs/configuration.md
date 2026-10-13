# Configuration

Copy `.env.example` to `.env.local` and adjust. Everything is optional; the
defaults run fully local.

Settings precedence, when the same knob exists in several places: campaign
settings (in-game panels) > admin panel (`/admin`, stored in the database) >
environment variables (below) > built-in defaults. A blank admin-panel field
falls through to the env var.

| Variable | Default | Purpose |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Local text server |
| `DEFAULT_TEXT_PROVIDER` | `local` | New-story default: `local` or `custom` |
| `OPENAI_COMPAT_BASE_URL` | — | New-story default URL for Connect a server |
| `OPENAI_COMPAT_MODEL` | — | New-story default model for Connect a server |
| `LOCAL_TEXT_MAX_TOKENS` | `4096` | Max tokens generated per local turn |
| `LOCAL_TEXT_CONTEXT` | model max | Cap on the local context window |
| `LOCAL_TEXT_TIMEOUT_MS` | `360000` | Local turn timeout (idle, resets per streamed chunk) |
| `ARC_TEXT_TIMEOUT_MS` | `480000` | Timeout for story-arc generation/refresh and chapter summaries (non-streaming, whole reply must finish in time) |
| `OPENROUTER_API_KEY` | — | Fallback key for OpenRouter URLs (else set in-app) |
| `OPENAI_COMPAT_API_KEY` | — | Fallback key for other connected servers |
| `FLUX_WORKER_URL` | `http://127.0.0.1:7869` | Image worker |
| `COMFYUI_URL` | `http://127.0.0.1:8188` | Default ComfyUI server for the ComfyUI backend |
| `ULTRA_FAST_IMAGE_GEN_DIR` | `~/ultra-fast-image-gen` | FLUX backends repo |
| `ULTRA_FAST_IMAGE_GEN_PYTHON` | platform venv Python | Python inside the image backend venv |
| `IMAGE_SERVER_DEVICE` | `mps` on macOS, `cuda` elsewhere | `mps`, `cuda`, `cpu`, or `auto` for SDNQ |
| `IMAGE_SERVER_DEFAULT_BACKEND` | `mflux-hs` on macOS, `sdnq-hs` elsewhere | Default image worker backend |
| `OPEN_DUNGEON_ROCM` | auto-detect | `0` disables / `1` forces the AMD ROCm path on Windows |
| `SQLITE_DB_PATH` | `data/local-roleplay.sqlite` | Database location |

## Multiplayer (Open Dungeon Master) variables

| Variable | Default | Purpose |
|---|---|---|
| `CONTENT_DB_PATH` | `data/content/open5e.sqlite` | Open5e content pack (built by `node scripts/import-open5e.mjs`) |
| `ODM_UPDATE_CHECK` | on | `off` stops the server asking GitHub whether a newer release exists (one anonymous request every six hours at most; the answer is shown in the account menu's About dialog) |
| `DM_DEBUG` | — | `1` logs DM model content and tool calls |
| `DM_LEAN_TOOLS` | — | `1` removes the stat-mutation tools if the model's tool fidelity suffers |
| `DM_MOMENT_AFTER_HISTORY` | — | `1` sends the turn-to-turn part of GAME STATE (the fight, recent rolls, retrieved lore) after the transcript instead of in the system message, so a server that caches the prompt's start (llama-server) reuses the whole history between turns. Off by default: the default local model then skipped rolls it should have asked for |
| `DM_COMPACT_THRESHOLD` | `120` | Messages before history compaction begins (lower to test) |
| `DM_CHAPTER_MIN` | `16` | Non-system messages (players included) a chapter must hold before beats can close it |
| `DM_CHAPTER_BEATS` | `2` | Finished story-arc beats that close a chapter once it is past the floor |
| `DM_BEAT_SPACING` | `8` | Messages that must separate two beats for both to count toward the chapter; closer ones are the same moment of play |
| `DM_BEAT_JUDGE_EVERY` | `6` | Messages between backstop checks that ask a small model whether the `[NOW]` beat happened |
| `DM_CHAPTER_MAX` | `120` | Hard cap: a chapter this long closes even with no finished beat |
| `ODM_SETUP_CODE` | generated and printed in the server log | The one-time code that creating a fresh server's first (admin) account requires. Unset, the server mints one and prints it at every start until the first account exists. On a device world (`ODM_DEVICE_WORLD=1`) nothing is minted or printed: the app that hosts it sets this itself and sends it with the host's own account, and a device world started without it asks for no code |
| `ODM_PORTAL_SECRET` | unset | Set only by the desktop app for the world it runs: the key its portal cookies are signed with, so that server may forward a player's data calls to the host they are visiting. Unset (every hosted server), portal cookies are ignored and nothing is ever forwarded |
| `TRUST_PROXY_HEADERS` | `1` | Whether the login throttle reads the caller's address from `cf-connecting-ip` or the last `x-forwarded-for` entry. Set `0` on a server reached directly with no proxy in front, so a caller cannot choose their own address; every caller then shares one, and only the per-account limits apply |
| `DISCORD_CLIENT_ID` | — | Discord OAuth application id for "Sign in with Discord" (or set in `/admin`) |
| `DISCORD_CLIENT_SECRET` | — | Discord OAuth client secret. Belongs in `.env.server` (or set in `/admin`) |
| `APP_PUBLIC_URL` | forwarded headers / request origin | Public URL players use (e.g. `https://dungeon.example.org`); needed for OAuth redirect URIs when the reverse proxy doesn't send `X-Forwarded-Host`/`X-Forwarded-Proto` |
| `WORLD_REGISTRY_URL` | the built-in registry | https JSON index of downloadable campaign plugins, browsable under Admin, Campaign plugins (or set there). Set it to `off` to browse none. The packs any registry lists are third-party content this project neither ships nor vets, and nothing installs without an admin doing it. See [worlds.md](worlds.md) |
| `WORLD_PACKS_DIR` | `data/worlds` | Where installed campaign plugins are written. Gitignored, and not covered by the app's MIT license |
| `UPLOAD_DAILY_BYTES` | `524288000` (500 MB) | Bytes one account may add to `public/uploads` in a rolling 24 hours, across uploads, character imports and workshop imports. Admins have no budget. `0` turns it off |
| `UPLOAD_DAILY_FILES` | `200` | Files one account may add to `public/uploads` in the same window. `0` turns it off |
| `UPLOAD_MIN_FREE_BYTES` | `1073741824` (1 GB) | Free space the volume holding `public/uploads` must keep; uploads and imports that would go below it are refused for everyone. The desktop and Android apps set 256 MB for the worlds they host. `0` turns it off |

Secrets (model API keys) belong in `.env.server`, never in code or `.env.local`.

### In a container

Every default above points at `127.0.0.1`, which inside a container means the
container itself. `docker-compose.yml` therefore overrides the service URLs to
`host.docker.internal` (llama.cpp, Ollama, ComfyUI) and sets
`CONTENT_DB_PATH=/app/content/open5e.sqlite`, since the baked content pack has
to live outside the `/app/data` volume. Set anything you want to change in a
`.env` file next to the compose file rather than in `.env.server`: the image has
no `.env.server`, and real environment variables take precedence over it anyway.

## Sharing a server with other people

A server one person runs for friends has two questions the admin panel answers under Accounts (issues #137 and #138):

- **Who may start campaigns and workshops.** "Everyone with an account" is how every server behaved before. "Administrators only" keeps the New campaign door for admins; everyone else joins by room code, and the import, clone and workshop routes refuse the same way. A campaign that cannot be started cannot spend anything, which is the plainest way to keep a paid key for the host's own tables.
- **Paid AI backends.** "Paid" means a text or picture backend on a public host that takes this server's key (OpenAI, OpenRouter, a hosted vLLM) and the agent program, which runs on the admin's plan. "Only campaigns an administrator leads" refuses them, with a plain message at the table, for any campaign whose party lead is not an admin. A backend on this machine or the local network (loopback, 10/8, 172.16/12, 192.168/16, link-local, `.local` and `.lan` names, a bare hostname) is the host's own, keyed or not: llama-server behind a key, Ollama, ComfyUI and the FLUX workers stay open to every table. A player who wants a paid model at their own table brings their own key in the client app, which is what the apps are for. The agent panel's own "only campaigns an administrator leads" says the same thing for the agent alone.

The **Usage** tab shows, per account and per campaign, what has been spent: text and agent tokens in and out, split into paid and local; pictures painted; agent turns; plus campaigns owned, led and joined, characters, DM turns, active days, last activity and the bytes on disk the campaign's or the account's own pictures take. Everything is counted from what each backend reports; no prompt, transcript or picture is kept for it, and an erased account's rows lose their name. Costs are not estimated, since they depend on the model: read the tokens and apply the prices of the backend you pay for. Streaming replies carry their counts only when the backend honours `stream_options.include_usage` (OpenAI, llama-server, vLLM, LM Studio and OpenRouter do); a backend that rejects the field is retried without it and its calls are counted with no tokens.

## Playing from your phone

Run the app on all interfaces:

```bash
npm run dev:lan    # development
npm run start:lan  # production build (run npm run build first)
```

For dev mode, add your phone-facing hostname/IP to `ALLOWED_DEV_ORIGINS` in
`.env.local` (comma-separated), then open `http://<your-machine>:3005` from
the phone. The image worker and Ollama can stay on `127.0.0.1` because
browser requests go through the Next.js server.

### Installing as an app

When the app is reached over HTTPS (for example through a reverse proxy),
the browser offers "Install app" / "Add to Home Screen" and it runs
standalone with its own icon. Plain `http://<host>:3005` cannot install:
browsers require a secure context for web-app installs.

## Physical dice

Nothing to configure server-side: dice sources are a per-player, per-browser
choice that appears once the campaign's dice policy allows real dice and the
player opts in (Party tab, next to the real-dice toggle).

For each die shape (d4 through d20, plus the d100) a player picks one of:

- **Typed**: roll a physical die and enter the number; the DM turn stays
  parked until the table's dice are in.
- **Server-rolled**: the server draws that die with a cryptographic RNG when
  the roll is submitted, so a request mixing your d20 with automatic damage
  dice goes in as one submission.

Choices live in the browser's local storage, per device. Switch phones and
you set them again; they are not on the account. When every die in a request
is covered by the server, the roll submits itself automatically.

## Local data

Stories and messages are stored in SQLite at `data/local-roleplay.sqlite` by
default. Deleting a story removes its messages through SQLite cascade
deletes.

Uploaded images are stored under `public/uploads/`. Generated images are
stored under `public/generated/`, with temporary generation refs under
`public/generated/refs/`. The sidebar's Local Data clear button deletes all
local stories, messages, characters, uploaded photos, generated images, and
temporary refs, then vacuums the SQLite database.

### Deleting an account

Anyone can delete their own account from account settings (and from the
desktop and Android apps, per server). The request signs the account out on
every device and stamps a due date; a background job erases the account once
the server's grace period has passed. The period is set in the admin panel
under Accounts (0 to 90 days, default 14; 0 erases immediately). Signing in
before the due date and choosing "Keep my account" calls the deletion off.
An admin can also call it off, or erase the account at once, from the Users
tab.

The purge removes the account row and everything that hangs off it: owned
campaigns and workshops, campaign seats and character sheets, library
characters and rulesets, homebrew, notes, private threads and whispers,
friendships, notifications, and the avatar and portrait files under
`public/uploads/` that nothing else points at. Messages the person wrote in
other people's campaigns stay in those transcripts with the author link cut,
and campaign tools they made in other people's campaigns (roll tables,
prepared encounters, scheduled sessions) pass to that campaign's owner.

### Backing up and moving to another server

Everything a table has made lives in two places, and a backup needs both:

- `data/local-roleplay.sqlite` (or `SQLITE_DB_PATH`): campaigns, messages,
  characters, NPCs, maps, workshops, accounts.
- `public/uploads/`: every picture the database points at, uploaded or
  painted. Rows store paths like `/uploads/<id>.png`, so a database restored
  without this folder shows empty portraits and blank map backdrops.

Stop the server, copy both (and `data/worlds` if world packs were installed),
start the new server, and the tables come back exactly as they were.
`public/generated*` holds scene art and other regenerable caches that can be
copied too but are not required.

Players and DMs who do not run the server have per-item exports instead:

- A character exports as a `.odm-character.json` from its library page and
  imports on any server through the library's Import button; the portrait
  travels inside the file.
- A workshop exports as a `.odm-workshop.json` bundle from its Share panel
  and imports through the Workshop page's Import button, pictures included.
- A campaign's story exports as HTML, ODT or DOCX from the Story tab. That is
  a reading copy; play state (messages, sheets, floor, clock) has no file
  export and moves only with the database.
