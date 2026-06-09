# ============================================
# PrepTalk — Multi-stage Dockerfile
# ============================================

# ── Stage 1: Build Frontend ──
FROM node:22-alpine AS frontend-builder

WORKDIR /build

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY apps/web/ ./apps/web/
COPY packages/shared/ ./packages/shared/

RUN cd /build/apps/web && npx vite build

# ── Stage 2: Build API with esbuild ──
FROM node:22-alpine AS api-builder

WORKDIR /build

COPY api/ ./api/
COPY packages/shared/ ./packages/shared/

RUN cd /build/api && npm install && \
    npx esbuild src/server.ts \
      --bundle \
      --platform=node \
      --target=node22 \
      --format=esm \
      --outfile=dist/server.js \
      --external:express \
      --external:cors \
      --external:zod \
      --external:node:crypto \
      --external:node:fs \
      --external:node:path \
      --external:node:url \
      --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"

# ── Stage 3: Production ──
FROM node:22-alpine AS api

WORKDIR /app

# Copy bundled API
COPY --from=api-builder /build/api/dist ./dist
COPY --from=api-builder /build/api/node_modules ./node_modules

# Copy built frontend
COPY --from=frontend-builder /build/apps/web/dist ./webapp/dist

# Create non-root user
RUN addgroup -g 1001 -S preptalk && \
    adduser -S preptalk -u 1001 -G preptalk
USER preptalk

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/api/health || exit 1

CMD ["node", "dist/server.js"]
