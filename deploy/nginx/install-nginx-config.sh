#!/bin/sh
# Install the repo-managed nginx assets and reload nginx safely.
#
# Installs:
#   - deploy/nginx/aop-origin-ca.pem -> /etc/nginx/ssl/ (AOP client-cert verification)
#   - deploy/nginx/*.conf (see CONFS)  -> /etc/nginx/conf.d/
#
# Runs as host root (invoked from deploy.yml via a privileged container that
# enters the host namespaces with nsenter, because the deploy user has no
# passwordless sudo for nginx but is in the docker group).
#
# Behavior:
#   - no-op if every managed file already matches what is installed
#   - otherwise: back up current -> copy new -> `nginx -t` -> reload
#   - if `nginx -t` fails, restore the backups and exit non-zero (fails deploy)
set -eu

SRC_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DST_SSL=/etc/nginx/ssl
DST_CONF_DIR=/etc/nginx/conf.d

SRC_CA="$SRC_DIR/aop-origin-ca.pem"
DST_CA="$DST_SSL/aop-origin-ca.pem"

# nginx vhosts managed from the repo. Only Cloudflare-proxied vhosts that
# enforce AOP belong here; ssh.re4lity.com is DNS-only and must NOT be managed
# with AOP, so it is intentionally excluded.
CONFS="ajmun.conf prisma-studio.conf"

changed=0
backups=""

# AOP origin CA (public cert; verifies the client cert Cloudflare presents)
if [ -f "$SRC_CA" ] && { [ ! -f "$DST_CA" ] || ! cmp -s "$SRC_CA" "$DST_CA"; }; then
    mkdir -p "$DST_SSL"
    cp "$SRC_CA" "$DST_CA"
    chmod 644 "$DST_CA"
    echo "installed CA: $DST_CA"
    changed=1
fi

# Site configs
for c in $CONFS; do
    src="$SRC_DIR/$c"
    dst="$DST_CONF_DIR/$c"
    if [ ! -f "$src" ]; then
        echo "ERROR: source config not found: $src" >&2
        exit 1
    fi
    if [ ! -f "$dst" ] || ! cmp -s "$src" "$dst"; then
        if [ -f "$dst" ]; then
            b="$dst.bak.$(date +%F-%H%M%S)"
            cp "$dst" "$b"
            backups="$backups $b"
            echo "backup created: $b"
        fi
        cp "$src" "$dst"
        echo "installed config: $dst"
        changed=1
    fi
done

if [ "$changed" -eq 0 ]; then
    echo "nginx assets unchanged — nothing to do"
    exit 0
fi

if nginx -t; then
    nginx -s reload
    echo "RESULT: nginx reloaded"
else
    echo "RESULT: nginx -t FAILED — rolling back" >&2
    for b in $backups; do
        orig=$(echo "$b" | sed 's/\.bak\.[0-9-]*$//')
        cp "$b" "$orig"
        echo "restored $orig" >&2
    done
    nginx -t >/dev/null 2>&1 && nginx -s reload || true
    exit 1
fi
