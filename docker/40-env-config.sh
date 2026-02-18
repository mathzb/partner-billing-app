#!/bin/sh
set -eu

TEMPLATE_PATH="/usr/share/nginx/html/env-config.template.js"
OUTPUT_PATH="/usr/share/nginx/html/env-config.js"

if [ -f "$TEMPLATE_PATH" ]; then
  envsubst '${VITE_ACCESS_TOKEN} ${VITE_REFRESH_TOKEN}' < "$TEMPLATE_PATH" > "$OUTPUT_PATH"
fi
