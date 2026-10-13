# syntax=docker/dockerfile:1

# Open Dungeon Master - simplified build without native modules.
# Uses Node.js built-in sqlite (node:sqlite) and no transformers/voice/blueooth.

# --------------------------------------------------------------- dependencies
FROM node:22.23.2-trixie-slim AS deps
WORKDIR /app

RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY scripts/copy-dice-assets.mjs ./scripts/
RUN npm ci

# --------------------------------------------------------------------- build
FROM deps AS build
WORKDIR /app

COPY . .

RUN node scripts/copy-dice-assets.mjs

# Content pack for rules lookup - baked so container works offline.
RUN node scripts/fetch-content-pack.mjs

ENV NEXT_TELEMETRY_DISABLED=1
ARG ODM_BUILD_COMMIT=
ARG ODM_BUILD_DESCRIBE=
RUN DOCKER_BUILD=1 ODM_BUILD_COMMIT="$ODM_BUILD_COMMIT" ODM_BUILD_DESCRIBE="$ODM_BUILD_DESCRIBE" npm run build

# Trim standalone bundle - remove docs and build artifacts not needed at runtime.
RUN cd .next/standalone \
  && rm -rf data models docs public src package-lock.json tsconfig.tsbuildinfo \
            README.md CLAUDE.md AGENTS.md eslint.config.mjs postcss.config.mjs

# -------------------------------------------------------------------- runner
FROM node:22.23.2-trixie-slim AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ARG AGENT_PROGRAMS=""
RUN if [ -n "$AGENT_PROGRAMS" ]; then npm install -g $AGENT_PROGRAMS && npm cache clean --force; fi

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3005 \
    CONTENT_DB_PATH=/app/content/open5e.sqlite

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# Content pack outside data so volume cannot hide it.
COPY --from=build --chown=node:node /app/data/content/open5e.sqlite ./content/open5e.sqlite

# Source and scripts for maintenance commands.
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/tsconfig.json ./tsconfig.json

RUN mkdir -p data public/uploads public/generated logs \
  && chmod +x scripts/docker-entrypoint.sh \
  && chown node:node data public/uploads public/generated logs

USER node

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3005)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["node", "server.js"]
