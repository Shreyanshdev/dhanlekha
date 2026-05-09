# ─── Stage 1: Build ───
FROM node:20-alpine AS builder
WORKDIR /app

# Install build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy workspace root files
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Install dependencies
RUN npm ci --workspace=apps/backend --workspace=packages/shared

# Copy source
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Build shared package first, then backend
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/backend

# ─── Stage 2: Production ───
FROM node:20-alpine AS production
WORKDIR /app

# Install runtime deps for better-sqlite3
RUN apk add --no-cache python3 make g++

# Security: run as non-root user
RUN addgroup -g 1001 -S dhanlekha && \
    adduser -S dhanlekha -u 1001 -G dhanlekha

# Copy only production artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R dhanlekha:dhanlekha /app

USER dhanlekha

# Health check — used by Docker/K8s to verify the container is ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/health/ready || exit 1

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "apps/backend/dist/server.js"]
