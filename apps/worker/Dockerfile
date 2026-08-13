FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/security/package.json packages/security/package.json
RUN npm ci
COPY packages packages
COPY apps/worker apps/worker
RUN npm run build:packages && npm run build --workspace @llmira/worker

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
USER node
CMD ["node", "apps/worker/dist/index.js"]
