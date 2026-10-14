#!/bin/bash
set -euo pipefail

APP_DIR=${1:?app directory required}
SERVICE_NAME=${2:?service name required}
IMAGE=${3:?image required}
[[ "$APP_DIR" =~ ^/[a-zA-Z0-9/_.-]+$ && "$APP_DIR" != / ]] || exit 1
[[ "$SERVICE_NAME" =~ ^[a-zA-Z0-9_.-]+$ ]] || exit 1

docker run -d \
  --user "$(id -u):$(id -g)" \
  --name "$SERVICE_NAME" \
  --restart unless-stopped \
  --read-only \
  --security-opt no-new-privileges:true \
  --cap-drop ALL \
  --memory 512m --memory-swap 512m --cpus 1.0 --pids-limit 128 \
  --tmpfs /tmp:rw,noexec,nosuid,size=50m \
  --network tui-net \
  -p 127.0.0.1:3000:3000 \
  --env-file "$APP_DIR/.env" \
  -v "$APP_DIR/data:/app/data" \
  --log-opt max-size=10m --log-opt max-file=3 \
  "$IMAGE"
