#!/bin/sh
# Container entrypoint: make sure the writable directories exist, then hand
# off to the Next.js server.
set -e

mkdir -p /app/data \
         /app/public/uploads \
         /app/public/generated \
         /app/logs

exec "$@"
