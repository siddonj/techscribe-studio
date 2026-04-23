# syntax=docker/dockerfile:1.7
# ── Deps stage: install production + dev deps needed to compile native modules ─
FROM node:20.19.0-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# better-sqlite3 is a native module and needs python3/make/g++ at build time.
# apt cache is mounted so repeated local builds don't re-download packages.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy only the lock files first — this layer is cached until they change.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# ── Builder stage: compile TypeScript and produce Next.js standalone output ────
FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

# ── Runner stage: minimal production image ────────────────────────────────────
# Pin to the same bookworm-slim variant as the build stages; update the patch
# version here when Node 20.x releases security fixes.
FROM node:20.19.0-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8989 \
    HOSTNAME=0.0.0.0

LABEL org.opencontainers.image.title="TechScribe Studio" \
      org.opencontainers.image.description="AI-powered technical writing studio" \
      org.opencontainers.image.source="https://github.com/siddonj/techscribe-studio" \
      org.opencontainers.image.licenses="UNLICENSED"

# gosu: minimal setuid helper so the entrypoint can fix bind-mount
# ownership as root then drop to nextjs before exec-ing the server.
RUN apt-get update && apt-get install -y --no-install-recommends gosu \
 && rm -rf /var/lib/apt/lists/*

# Create a non-root system user/group before copying any files.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nextjs

# Standalone output is a self-contained Node server; copy only what it needs.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

# Entrypoint: fixes /app/data ownership then drops to nextjs user.
COPY --chmod=755 scripts/docker-entrypoint.sh /usr/local/bin/entrypoint.sh

# Pre-create mount points so Docker can overlay them at startup.
RUN mkdir -p /app/data /app/.next/cache \
 && chown nextjs:nodejs /app/data /app/.next/cache

# Runs as root so entrypoint can chown the bind-mount dir; drops to nextjs inside entrypoint.
EXPOSE 8989

# Inline health check avoids a curl/wget dependency in the minimal image.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "\
    const req = require('http').get( \
      {path:'/api/healthz',port:8989,timeout:8000}, \
      (r) => process.exit(r.statusCode === 200 ? 0 : 1) \
    ); \
    req.on('timeout', () => { req.destroy(); process.exit(1); }); \
    req.on('error',   () => process.exit(1));"
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
