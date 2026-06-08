# ============================================
# PrepTalk — Multi-stage Dockerfile
# ============================================

# ── Stage 1: Build Frontend ──
FROM node:22-alpine AS frontend-builder

WORKDIR /build

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY api/package.json ./api/

RUN npm ci --ignore-scripts

COPY apps/web/ ./apps/web/
COPY packages/shared/ ./packages/shared/
COPY api/ ./api/

RUN npm run build -w @preptalk/web

# ── Stage 2: API Server ──
FROM node:22-alpine AS api

WORKDIR /app

RUN npm install -g tsx

COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

COPY api/src/ ./api/src/

# Copy built frontend static files
COPY --from=frontend-builder /build/apps/web/dist ./webapp/dist

RUN addgroup -g 1001 -S preptalk && \
    adduser -S preptalk -u 1001 -G preptalk
USER preptalk

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["tsx", "api/src/server.ts"]
