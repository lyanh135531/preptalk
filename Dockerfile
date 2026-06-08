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

# ── Stage 2: API Server (production) ──
FROM node:22-alpine AS api

WORKDIR /app

RUN npm install -g tsx

# Copy API as standalone (NOT workspace) to avoid Express 5 from root lock
COPY api/ ./api/
COPY packages/shared/ ./packages/shared/

# Copy built frontend
COPY --from=frontend-builder /build/apps/web/dist ./webapp/dist

# Install deps for api and shared separately (respects their package.json)
RUN cd /app/api && npm install --production --ignore-scripts && \
    cd /app/packages/shared && npm install --production --ignore-scripts 2>/dev/null || true && \
    npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S preptalk && \
    adduser -S preptalk -u 1001 -G preptalk
USER preptalk

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["tsx", "api/src/server.ts"]
