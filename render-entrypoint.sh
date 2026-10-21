#!/bin/sh
# Render entrypoint: prepare storage, migrate, create first admin, serve.
set -e

# On the free plan the filesystem is ephemeral: the database and uploads
# reset when the service spins down or redeploys. A paid plan can mount
# a persistent disk at /var/data — set DATA_DIR=/var/data there.
DATA_DIR="${DATA_DIR:-/app/data}"
export DJANGO_DB_PATH="${DJANGO_DB_PATH:-$DATA_DIR/db.sqlite3}"
export DJANGO_MEDIA_ROOT="${DJANGO_MEDIA_ROOT:-$DATA_DIR/media}"
mkdir -p "$DJANGO_MEDIA_ROOT"

cd /app/backend
python manage.py migrate --noinput
# Creates the first admin (username "admin") only when none exists; the
# random initial password is printed to the Render logs exactly once.
python manage.py ensure_admin || true

exec daphne -b 0.0.0.0 -p "${PORT:-10000}" core.asgi:application
