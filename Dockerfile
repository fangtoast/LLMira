FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/security/package.json packages/security/package.json
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_TEAM_API_URL=""
ENV NEXT_PUBLIC_TEAM_API_URL=${NEXT_PUBLIC_TEAM_API_URL}
RUN npm run build

FROM caddy:2.10-alpine
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/out /srv
EXPOSE 80 443
HEALTHCHECK --interval=20s --timeout=5s --retries=5 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
