# ── Stage 1: Build ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install contracts first (cached layer)
COPY contracts/package.json contracts/tsconfig.json /app/contracts/
COPY contracts/src/ /app/contracts/src/
RUN cd /app/contracts && npm install --production=false

# Install backend dependencies
COPY src/api/package.json src/api/tsconfig.json /app/api/
RUN cd /app/api && npm install --production=false

# Copy source and build
COPY src/api/src/ /app/api/src/
COPY src/api/tests/ /app/api/tests/
COPY src/api/migrations/ /app/api/migrations/
COPY src/api/vitest.config.ts /app/api/
RUN cd /app/api && npx tsc

# ── Stage 2: Runtime ──────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy contracts
COPY --from=builder /app/contracts/ /app/contracts/

# Copy backend (source + built)
COPY --from=builder /app/api/package.json /app/api/
COPY --from=builder /app/api/node_modules/ /app/api/node_modules/
COPY --from=builder /app/api/src/ /app/api/src/
COPY --from=builder /app/api/dist/ /app/api/dist/
COPY --from=builder /app/api/migrations/ /app/api/migrations/

# Production dependencies only
RUN cd /app/api && npm prune --production

ENV NODE_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0

EXPOSE 8000

WORKDIR /app/api
CMD ["node", "dist/server.js"]
