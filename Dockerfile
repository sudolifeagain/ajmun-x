FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN adduser -D -u 1000 appuser

# Next.js standalone output をコピー
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma

# Bot 用ファイル
COPY --from=builder /app/bot ./bot
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# エントリポイント
COPY --from=builder /app/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER appuser
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
