#!/bin/sh
set -e

# Apply database migrations
npx prisma db push --skip-generate 2>/dev/null || true

# Start Discord bot in background
node --import tsx bot/index.ts &
BOT_PID=$!

# Start Next.js
node server.js &
WEB_PID=$!

# Wait for either process to exit
wait -n $BOT_PID $WEB_PID
EXIT_CODE=$?

# If either exits, kill the other
kill $BOT_PID $WEB_PID 2>/dev/null || true
exit $EXIT_CODE
