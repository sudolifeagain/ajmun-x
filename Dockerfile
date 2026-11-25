# syntax=docker/dockerfile:1
FROM node:26-alpine@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a AS builder
WORKDIR /app
RUN apk upgrade --no-cache && apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:26-alpine@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a AS deps
WORKDIR /app
RUN apk upgrade --no-cache && apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM node:26-alpine@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a AS runner
WORKDIR /app
# Patch Alpine packages, and remove package managers from the production image.
# Startup uses the already-installed Prisma binary and Node directly.
RUN apk upgrade --no-cache && apk add --no-cache bash openssl \
    && rm -rf /usr/local/lib/node_modules/npm /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Next.js standalone output をコピー
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma

# Bot 用ファイル + 本番依存のみ
COPY --from=builder /app/bot ./bot
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/app/lib ./app/lib
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/scripts/validate-environment.mjs ./scripts/validate-environment.mjs

# エントリポイント
COPY --from=builder /app/docker-entrypoint.sh ./
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
