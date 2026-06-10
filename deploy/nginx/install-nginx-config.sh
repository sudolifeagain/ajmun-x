#!/bin/sh
# Install deploy/nginx/ajmun.conf into the host nginx and reload safely.
#
# Runs as host root (invoked from deploy.yml via a privileged container that
# enters the host namespaces with nsenter, because the deploy user has no
# passwordless sudo for nginx but is in the docker group).
#
# Behavior:
#   - no-op if the live config already matches the repo copy
#   - otherwise: back up current -> copy new -> `nginx -t` -> reload
#   - if `nginx -t` fails, restore the backup and exit non-zero (fails deploy)
set -eu

SRC_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SRC="$SRC_DIR/ajmun.conf"
DST=/etc/nginx/conf.d/ajmun.conf

if [ ! -f "$SRC" ]; then
    echo "ERROR: source config not found: $SRC" >&2
    exit 1
fi

if [ -f "$DST" ] && cmp -s "$SRC" "$DST"; then
    echo "nginx config unchanged — nothing to do"
    exit 0
fi

BAK=""
if [ -f "$DST" ]; then
    BAK="$DST.bak.$(date +%F-%H%M%S)"
    cp "$DST" "$BAK"
    echo "backup created: $BAK"
fi

cp "$SRC" "$DST"
echo "installed: $SRC -> $DST"

if nginx -t; then
    nginx -s reload
    echo "RESULT: nginx reloaded"
else
    echo "RESULT: nginx -t FAILED — rolling back" >&2
    if [ -n "$BAK" ]; then
        cp "$BAK" "$DST"
        echo "restored from $BAK" >&2
    else
        rm -f "$DST"
        echo "removed invalid config" >&2
    fi
    # best-effort reload of the known-good config
    nginx -t >/dev/null 2>&1 && nginx -s reload || true
    exit 1
fi
