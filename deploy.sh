#!/bin/bash
set -euo pipefail

REMOTE="oci"
APP_DIR="/home/ubuntu/ajmun37"
SERVICE_NAME="ajmun37"

# Deploy only reviewed, committed files; keep local credentials and scratch files out.
git diff --quiet && git diff --cached --quiet || { echo "Commit changes before deploying" >&2; exit 1; }
ssh "$REMOTE" "mkdir -p '${APP_DIR}/build' '${APP_DIR}/data' && chmod 750 '${APP_DIR}/data'"
git archive --format=tar HEAD | ssh "$REMOTE" "tar xf - -C '${APP_DIR}/build/'"

ssh "$REMOTE" "cd '${APP_DIR}/build' && docker build --pull -t '${SERVICE_NAME}:candidate' ."
rollback() {
  echo "Restoring the previous image..." >&2
  ssh "$REMOTE" "docker image inspect '${SERVICE_NAME}:prev' >/dev/null && \
    (docker stop '${SERVICE_NAME}' 2>/dev/null || true) && \
    (docker rm '${SERVICE_NAME}' 2>/dev/null || true) && \
    bash '${APP_DIR}/build/deploy/run-container.sh' '${APP_DIR}' '${SERVICE_NAME}' '${SERVICE_NAME}:prev'"
}
trap 'rollback; exit 1' ERR
ssh "$REMOTE" "OLD_IMAGE=\$(docker inspect -f '{{.Image}}' '${SERVICE_NAME}' 2>/dev/null || true); \
  if [ -n \"\$OLD_IMAGE\" ]; then docker tag \"\$OLD_IMAGE\" '${SERVICE_NAME}:prev' || exit 1; fi; \
  docker tag '${SERVICE_NAME}:candidate' '${SERVICE_NAME}' && \
  (docker stop '${SERVICE_NAME}' 2>/dev/null || true) && \
  (docker rm '${SERVICE_NAME}' 2>/dev/null || true) && \
  bash '${APP_DIR}/build/deploy/run-container.sh' '${APP_DIR}' '${SERVICE_NAME}' '${SERVICE_NAME}'"

for attempt in 1 2 3 4 5; do
  status=$(ssh "$REMOTE" "curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/" || true)
  if [[ "$status" =~ ^[23][0-9][0-9]$ ]]; then
    trap - ERR
    echo "Deployed successfully: https://ajmun37.re4lity.com"
    exit 0
  fi
  sleep 6
done

trap - ERR
rollback
echo 'Health check failed; restored the previous image' >&2
exit 1
