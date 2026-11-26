# Multi-stage Dockerfile for AgentSphere Core API Backend
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/ packages/
COPY apps/core-api/ apps/core-api/

# Build shared types & core API
RUN npm ci --workspace=packages/shared --workspace=apps/core-api
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/core-api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/core-api/dist ./apps/core-api/dist
COPY --from=builder /app/apps/core-api/package.json ./apps/core-api/package.json

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "apps/core-api/dist/index.js"]
