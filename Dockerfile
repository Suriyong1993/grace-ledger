# ============================================================================
# Grace Ledger v2 — Production Dockerfile
# ============================================================================
# Multi-stage build: compile native modules, then slim runtime.
#
# Build:  docker build -t grace-ledger:latest .
# Run:    docker run -p 3000:3000 --env-file .env grace-ledger:latest

# ---- Stage 1: Build --------------------------------------------------------
FROM node:22-alpine AS builder

# argon2 needs these native build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies (cache layer)
COPY package.json package-lock.json bun.lock bunfig.toml ./
RUN npm ci

# Copy source
COPY . .

# Build for production
RUN npm run build

# ---- Stage 2: Runtime ------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app

# Copy package files and install production deps (drizzle-kit moved to deps)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built output from builder (TanStack/Nitro outputs to .output/)
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy startup script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Non-root user
RUN addgroup -g 1001 -S app && adduser -u 1001 -S app -G app
RUN mkdir -p /tmp/app && chown -R app:app /tmp/app
RUN chown -R app:app /app
USER app

ENV HOME=/tmp/app

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

ENTRYPOINT ["docker-entrypoint.sh"]
