#!/bin/sh
set -e

# On Linux hosts, Docker creates the bind-mount directory owned by root.
# The app runs as uid 1001 (nextjs) and needs write access to /app/data.
# This runs as root first, fixes ownership, then drops privileges.
chown -R nextjs:nodejs /app/data 2>/dev/null || true

exec su-exec nextjs "$@"
