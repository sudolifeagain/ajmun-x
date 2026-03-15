#!/bin/bash
set -euo pipefail

REMOTE="oci"
APP_DIR="/home/ubuntu/ajmun37"
SERVICE_NAME="ajmun37"

echo "==> Syncing files..."
# NOTE: .env の DATABASE_URL は file:/app/data/prod.db に設定すること
ssh "$REMOTE" "mkdir -p '${APP_DIR}/build' '${APP_DIR}/data' && chmod 777 '${APP_DIR}/data'"
tar czf - --exclude='node_modules' --exclude='.next' --exclude='prisma/prod.db' --exclude='*.exe' . | \
  ssh "$REMOTE" "tar xzf - -C '${APP_DIR}/build/'"

echo "==> Building and restarting container..."
ssh "$REMOTE" "cd '${APP_DIR}/build' && docker build -t '${SERVICE_NAME}' . && \
  (docker stop '${SERVICE_NAME}' 2>/dev/null || true) && \
  (docker rm '${SERVICE_NAME}' 2>/dev/null || true) && \
  docker run -d \
    --name '${SERVICE_NAME}' \
    --restart unless-stopped \
    --read-only \
    --security-opt no-new-privileges:true \
    --cap-drop ALL \
    --memory 512m \
    --memory-swap 512m \
    --cpus 1.0 \
    --pids-limit 128 \
    --tmpfs /tmp:rw,noexec,nosuid,size=50m \
    --network tui-net \
    -p 127.0.0.1:3000:3000 \
    --env-file '${APP_DIR}/.env' \
    -v '${APP_DIR}/data:/app/data' \
    --log-opt max-size=10m \
    --log-opt max-file=3 \
    '${SERVICE_NAME}'"

echo "==> Deployed! https://ajmun37.re4lity.com"
