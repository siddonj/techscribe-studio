# syntax=docker/dockerfile:1.5
FROM node:20-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Build tools required for native modules (e.g. better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8989
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

# Standalone output: server.js + minimal node_modules + .next/server
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets (_next/static) must be served separately from standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Public assets (favicons, robots.txt, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Persistent data directory for SQLite (mounted as a volume in production)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs
EXPOSE 8989
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "\
    const req = require('http').get({path:'/api/healthz',port:8989,timeout:8000},(r)=>process.exit(r.statusCode===200?0:1));\
    req.on('timeout',()=>{req.destroy();process.exit(1)});\
    req.on('error',()=>process.exit(1));"
CMD ["node", "server.js"]
