#!/usr/bin/env python3
"""Mohaseb Pro — packaged-service launcher.

This is the entry point of the ``MohasebPro`` Windows service (run by
WinSW with the bundled embedded Python). It also runs unchanged on any
OS for testing. Responsibilities, in order:

1. Read ``config.ini`` from the data directory (``MOHASEB_HOME`` env var,
   default ``%ProgramData%\\MohasebPro``).
2. Translate the config into the ``DJANGO_*`` / ``DATABASE_URL``
   environment the Django settings module expects.
3. Wait for PostgreSQL to accept connections (postgres mode only) —
   the database service may still be running initdb on first boot.
4. Apply migrations.
5. On the very first run, create the initial admin account from the
   credentials the installer collected, then scrub the password from
   ``config.ini``.
6. Serve the app with Daphne, in-process, so the service manager
   controls the whole lifecycle.

Nothing here is Windows-specific except the default data-dir location.
"""

from __future__ import annotations

import configparser
import os
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent  # {app}
BACKEND_DIR = APP_DIR / "backend"


def data_dir() -> Path:
    home = os.environ.get("MOHASEB_HOME")
    if home:
        return Path(home)
    if os.name == "nt":
        return Path(os.environ.get("ProgramData", r"C:\ProgramData")) / "MohasebPro"
    return Path.home() / ".mohaseb-pro"


def log(message: str) -> None:
    print(f"[launcher] {message}", flush=True)


def load_config(path: Path) -> configparser.ConfigParser:
    cfg = configparser.ConfigParser()
    cfg["app"] = {"port": "4173", "allowed_hosts": "*"}
    cfg["database"] = {"mode": "sqlite"}
    if path.exists():
        cfg.read(path, encoding="utf-8")
    return cfg


def apply_environment(cfg: configparser.ConfigParser, home: Path) -> None:
    port = cfg.get("app", "port", fallback="4173")
    os.environ["DJANGO_DEBUG"] = "false"
    os.environ["DJANGO_SERVE_FRONTEND"] = "true"
    os.environ["DJANGO_FRONTEND_DIST"] = str(APP_DIR / "frontend" / "dist")
    os.environ["DJANGO_MEDIA_ROOT"] = str(home / "media")
    os.environ["DJANGO_ALLOWED_HOSTS"] = cfg.get("app", "allowed_hosts", fallback="*")
    secret = cfg.get("app", "secret_key", fallback="").strip()
    if secret:
        # Must stay stable across restarts: the cloud-backup secrets in
        # the database are encrypted with a key derived from it.
        os.environ["DJANGO_SECRET_KEY"] = secret
    mode = cfg.get("database", "mode", fallback="sqlite").strip().lower()
    if mode == "postgres":
        url = cfg.get("database", "url", fallback="").strip()
        if url:
            os.environ["DATABASE_URL"] = url
            os.environ.pop("DJANGO_DB_PATH", None)
    else:
        os.environ.pop("DATABASE_URL", None)
        os.environ["DJANGO_DB_PATH"] = str(home / "db.sqlite3")
    os.environ["MOHASEB_PORT"] = port


def wait_for_postgres(url: str, timeout_s: int = 120) -> bool:
    """Poll the database until it accepts a connection (or time out)."""
    import psycopg

    deadline = time.monotonic() + timeout_s
    attempt = 0
    while time.monotonic() < deadline:
        attempt += 1
        try:
            with psycopg.connect(url, connect_timeout=3) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
            log("PostgreSQL is ready.")
            return True
        except Exception:
            time.sleep(2)
    log(f"PostgreSQL not reachable after {timeout_s}s (url host: "
        f"{urllib.parse.urlparse(url).hostname}).")
    return False


def run_manage(args: list[str]) -> None:
    cmd = [sys.executable, str(BACKEND_DIR / "manage.py"), *args]
    log("Running: " + " ".join(args))
    subprocess.run(cmd, cwd=str(BACKEND_DIR), env=os.environ.copy(), check=True)


def ensure_admin(cfg: configparser.ConfigParser, config_path: Path) -> None:
    """Create the initial superuser once; scrub its password afterwards."""
    username = cfg.get("firstrun", "admin_user", fallback="").strip()
    password = cfg.get("firstrun", "admin_password", fallback="")
    if not username or not password:
        return
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    sys.path.insert(0, str(BACKEND_DIR))
    import django

    django.setup()
    from django.contrib.auth import get_user_model

    user_model = get_user_model()
    if user_model.objects.exists():
        log("Users already exist; skipping first-run admin creation.")
    else:
        user_model.objects.create_superuser(username=username, password=password)
        log(f"Initial admin account '{username}' created.")
    # The password has served its purpose — remove it from the config so
    # it is not kept on disk in plain text.
    cfg.remove_option("firstrun", "admin_password")
    with open(config_path, "w", encoding="utf-8") as fh:
        cfg.write(fh)


def serve(port: str) -> None:
    os.chdir(BACKEND_DIR)
    sys.path.insert(0, str(BACKEND_DIR))
    sys.argv = ["daphne", "-b", "0.0.0.0", "-p", str(port), "core.asgi:application"]
    from daphne.cli import CommandLineInterface

    log(f"Serving Mohaseb Pro on 0.0.0.0:{port}")
    CommandLineInterface().entrypoint()


def main() -> int:
    home = data_dir()
    home.mkdir(parents=True, exist_ok=True)
    (home / "media").mkdir(parents=True, exist_ok=True)
    (home / "logs").mkdir(parents=True, exist_ok=True)
    config_path = home / "config.ini"
    cfg = load_config(config_path)
    apply_environment(cfg, home)

    mode = cfg.get("database", "mode", fallback="sqlite").strip().lower()
    if mode == "postgres":
        url = cfg.get("database", "url", fallback="").strip()
        if url and not wait_for_postgres(url):
            # Exit non-zero: the service manager restarts us, which is
            # the right retry loop while PostgreSQL finishes starting.
            return 1

    run_manage(["migrate", "--noinput"])
    ensure_admin(cfg, config_path)
    serve(cfg.get("app", "port", fallback="4173"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
