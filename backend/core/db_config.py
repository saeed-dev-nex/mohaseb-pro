"""Environment-driven database / channel-layer configuration.

Defaults preserve the historical single-machine setup exactly: a local
SQLite file and the in-memory channel layer. Larger shops that run
several operators against one server can opt into PostgreSQL and Redis
purely through environment variables, with no code change:

- ``DATABASE_URL``  e.g. ``postgres://user:pass@db-host:5432/mohaseb``
- ``REDIS_URL``     e.g. ``redis://127.0.0.1:6379/0``

Kept as pure functions of an environ mapping so they can be unit-tested
without reloading Django settings.
"""
import os
from pathlib import Path


def databases_from_env(environ=None, base_dir=None):
    """Return the Django ``DATABASES`` dict for the given environment."""
    environ = os.environ if environ is None else environ
    url = (environ.get('DATABASE_URL') or '').strip()
    if url:
        import dj_database_url

        return {
            'default': dj_database_url.parse(
                url, conn_max_age=60, conn_health_checks=True
            )
        }
    base_dir = Path(base_dir) if base_dir is not None else Path(__file__).resolve().parent.parent
    return {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            # Overridable so containers can put the database on a mounted
            # volume (see docker-compose.yml) without touching the code.
            'NAME': environ.get('DJANGO_DB_PATH', base_dir / 'db.sqlite3'),
            # Wait up to 30s for a locked database before erroring (the
            # per-connection PRAGMA busy_timeout in api/apps.py does the
            # same for connections opened outside this configuration).
            'OPTIONS': {'timeout': 30},
        }
    }


def channel_layers_from_env(environ=None):
    """Return the Django ``CHANNEL_LAYERS`` dict for the given environment."""
    environ = os.environ if environ is None else environ
    redis_url = (environ.get('REDIS_URL') or '').strip()
    if redis_url:
        return {
            'default': {
                'BACKEND': 'channels_redis.core.RedisChannelLayer',
                'CONFIG': {'hosts': [redis_url]},
            }
        }
    return {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        }
    }
