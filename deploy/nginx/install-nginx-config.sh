#!/bin/sh
# Install the repo-managed nginx assets for ajmun37 and reload nginx safely.
#
# Installs:
#   - deploy/nginx/cloudflare-origin-pull-ca.pem -> /etc/nginx/ssl/ (for AOP)
#   - deploy/nginx/ajmun.conf                    -> /etc/nginx/conf.d/
#
# Runs as host root (invoked from deploy.yml via a privileged container that
# enters the host namespaces with nsenter, because the deploy user has no
# passwordless sudo for nginx but is in the docker group).
#
# Behavior:
#   - no-op if both files already match what is installed
#   - otherwise: back up current config -> copy new -> `nginx -t` -> reload
#   - if `nginx -t` fails, restore the backup and exit non-zero (fails deploy)
set -eu

SRC_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SRC_CONF="$SRC_DIR/ajmun.conf"
SRC_CA="$SRC_DIR/cloudflare-origin-pull-ca.pem"
DST_CONF=/etc/nginx/conf.d/ajmun.conf
DST_CA=/etc/nginx/ssl/cloudflare-origin-pull-ca.pem

if [ ! -f "$SRC_CONF" ]; then
    echo "ERROR: source config not found: $SRC_CONF" >&2
    exit 1
fi

changed=0

# Cloudflare Origin Pull CA (public cert; used by Authenticated Origin Pulls)
if [ -f "$SRC_CA" ] && { [ ! -f "$DST_CA" ] || ! cmp -s "$SRC_CA" "$DST_CA"; }; then
    mkdir -p /etc/nginx/ssl
    cp "$SRC_CA" "$DST_CA"
    chmod 644 "$DST_CA"
    echo "installed CA: $DST_CA"
    changed=1
fi

# Site config
BAK=""
if [ ! -f "$DST_CONF" ] || ! cmp -s "$SRC_CONF" "$DST_CONF"; then
    if [ -f "$DST_CONF" ]; then
        BAK="$DST_CONF.bak.$(date +%F-%H%M%S)"
        cp "$DST_CONF" "$BAK"
        echo "backup created: $BAK"
    fi
    cp "$SRC_CONF" "$DST_CONF"
    echo "installed config: $DST_CONF"
    changed=1
fi

if [ "$changed" -eq 0 ]; then
    echo "nginx assets unchanged — nothing to do"
    exit 0
fi

if nginx -t; then
    nginx -s reload
    echo "RESULT: nginx reloaded"
else
    echo "RESULT: nginx -t FAILED — rolling back" >&2
    if [ -n "$BAK" ]; then
        cp "$BAK" "$DST_CONF"
        echo "restored config from $BAK" >&2
    fi
    nginx -t >/dev/null 2>&1 && nginx -s reload || true
    exit 1
fi
