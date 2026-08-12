# OptimaGodown — multi-stage production image
# Serves Express API + Vite SPA from one process.

ARG NODE_VERSION=22

# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION=11.20.0
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/billing-app/package.json artifacts/billing-app/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/db/package.json lib/db/
COPY scripts/package.json scripts/
COPY scripts/fix-esbuild-perms.cjs scripts/
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.json tsconfig.base.json ./
COPY artifacts ./artifacts
COPY lib ./lib
COPY scripts ./scripts
# Emit composite lib .d.ts (project references), then bundle apps.
# Full `pnpm run build` typecheck is skipped here — esbuild/vite do not need it,
# and Docker CI was failing on TS6305 when artifact typecheck ran before lib emit settled.
ENV NODE_ENV=production
RUN pnpm run build:docker

# -----------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8080
# Hostinger / containers must bind all interfaces
ENV HOST=0.0.0.0

WORKDIR /app

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/artifacts ./artifacts
COPY --from=build /app/lib ./lib
COPY --from=build /app/scripts ./scripts

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "artifacts/api-server/dist/index.mjs"]
