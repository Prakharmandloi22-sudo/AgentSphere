# Multi-stage Dockerfile for Next.js Web Frontend
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/

RUN npm ci --workspace=packages/shared --workspace=apps/web
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node", "apps/web/server.js"]
