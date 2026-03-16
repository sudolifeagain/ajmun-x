#!/bin/bash
set -e

# Apply database migrations
npx prisma db push --skip-generate || echo "[entrypoint] WARNING: prisma db push failed" >&2

# Start Discord bot in background
node --import tsx bot/index.ts &
BOT_PID=$!

# Start Next.js
node server.js &
WEB_PID=$!

cleanup() {
  kill $BOT_PID $WEB_PID 2>/dev/null || true
}
trap cleanup EXIT TERM INT

# Wait for either process to exit
wait -n $BOT_PID $WEB_PID
EXIT_CODE=$?

# If either exits, kill the other
kill $BOT_PID $WEB_PID 2>/dev/null || true
exit $EXIT_CODE
