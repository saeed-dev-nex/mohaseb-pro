#!/bin/sh
# Hugging Face Spaces entrypoint: prepare storage, migrate, serve.
set -e

APP_HOME="${APP_HOME:-/app}"

# Persistent Storage (paid add-on) is mounted at /data and survives
# restarts and sleeps. Without it the container filesystem is used and
# the database + media reset whenever the Space restarts — in that case
# take regular encrypted backups from inside the app and download them.
if [ -d /data ] && [ -w /data ]; then
  DATA_DIR=/data
else
  DATA_DIR="$APP_HOME/data"
fi
export DJANGO_DB_PATH="$DATA_DIR/db.sqlite3"
export DJANGO_MEDIA_ROOT="$DATA_DIR/media"
mkdir -p "$DJANGO_MEDIA_ROOT"

# Secret key: prefer the DJANGO_SECRET_KEY Space secret. When it is not
# set, generate one and keep it in the data dir (stable only while that
# dir persists — same behaviour as the Windows production setup).
if [ -z "$DJANGO_SECRET_KEY" ]; then
  KEY_FILE="$DATA_DIR/.django_secret_key"
  if [ ! -f "$KEY_FILE" ]; then
    python3 -c "import secrets; print(secrets.token_urlsafe(50))" > "$KEY_FILE"
    chmod 600 "$KEY_FILE" 2>/dev/null || true
  fi
  DJANGO_SECRET_KEY="$(cat "$KEY_FILE")"
  export DJANGO_SECRET_KEY
fi

cd "$APP_HOME/backend"
python manage.py migrate --noinput
# Creates the first admin (username "admin") only when none exists; the
# random initial password is printed to the Space logs exactly once.
python manage.py ensure_admin || true

exec daphne -b 0.0.0.0 -p "${PORT:-7860}" core.asgi:application
