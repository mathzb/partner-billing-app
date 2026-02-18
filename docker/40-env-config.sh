#!/bin/sh
set -eu

TEMPLATE_PATH="/usr/share/nginx/html/env-config.template.js"
OUTPUT_PATH="/usr/share/nginx/html/env-config.js"

if [ -f "$TEMPLATE_PATH" ]; then
  export VITE_ACCESS_TOKEN="${VITE_ACCESS_TOKEN-${ACCESS_TOKEN-${ACCESSTOKEN-}}}"
  export VITE_REFRESH_TOKEN="${VITE_REFRESH_TOKEN-${REFRESH_TOKEN-${REFRESHTOKEN-}}}"

  if [ -z "${VITE_ACCESS_TOKEN}" ] && [ -z "${VITE_REFRESH_TOKEN}" ]; then
    echo "40-env-config.sh: warning: no token env vars found (expected one of VITE_ACCESS_TOKEN/ACCESS_TOKEN/ACCESSTOKEN and VITE_REFRESH_TOKEN/REFRESH_TOKEN/REFRESHTOKEN)" >&2
  fi

  envsubst '${VITE_ACCESS_TOKEN} ${VITE_REFRESH_TOKEN}' < "$TEMPLATE_PATH" > "$OUTPUT_PATH"
fi
