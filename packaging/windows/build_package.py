#!/usr/bin/env python3
"""Mohaseb Pro — Windows installer payload builder.

Assembles ``dist-stage/`` (the exact tree installer.iss packs) from:

* the Django backend source and the built frontend (``frontend/dist``),
* a bundled embedded CPython 3.12 (no system Python needed),
* every backend dependency resolved to Windows wheels at build time
  and pre-installed into the embedded Python's site-packages
  (the end user's machine needs no internet and no pip),
* a bundled portable PostgreSQL 18 (from the ``postgresql-binaries``
  PyPI wheel, so the version is pinned by PyPI, not a web download),
* WinSW, the Windows service wrapper.

Run directly (any OS — downloads are platform-targeted) or through
build_package.ps1 on Windows, which also compiles the final
``MohasebPro-Setup-<VERSION>.exe`` with Inno Setup.

Nothing in the repository's requirements.txt is modified: dependency
versions resolve inside their declared ranges, exactly like the
project's own ensure_venv flow does on a fresh machine.
"""

from __future__ import annotations

import argparse
import io
import shutil
import subprocess
import sys
import tarfile
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent

PYTHON_EMBED_URL = (
    "https://www.python.org/ftp/python/3.12.7/python-3.12.7-embed-amd64.zip"
)
WINSW_URL = (
    "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe"
)
PG_PIP_PACKAGE = "postgresql-binaries==18.6.0"
PY_PLATFORM = ["--platform", "win_amd64", "--python-version", "3.12"]

BACKEND_EXCLUDES = {
    ".venv", "__pycache__", "media", "staticfiles", ".env",
    "db.sqlite3", "db.sqlite3-wal", "db.sqlite3-shm",
}


def run(cmd: list[str], **kw) -> None:
    print("+", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run(cmd, check=True, **kw)


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        print(f"cached: {dest.name}")
        return
    print(f"downloading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "mohaseb-builder"})
    with urllib.request.urlopen(req) as resp, open(dest, "wb") as fh:
        shutil.copyfileobj(resp, fh)


def pip(*args: str) -> None:
    run([sys.executable, "-m", "pip", *args])


def build_frontend(stage: Path) -> None:
    npm = shutil.which("npm")
    if not npm:
        raise SystemExit("Node.js (npm) not found on the build machine.")
    frontend = REPO / "frontend"
    if not (frontend / "node_modules").exists():
        run([npm, "ci"], cwd=frontend)
    run([npm, "run", "build"], cwd=frontend)
    dest = stage / "frontend" / "dist"
    shutil.copytree(frontend / "dist", dest)
    print(f"frontend dist -> {dest}")


def copy_backend(stage: Path) -> None:
    def ignore(_dir: str, names: list[str]) -> list[str]:
        return [n for n in names if n in BACKEND_EXCLUDES or n.endswith(".pyc")]

    dest = stage / "backend"
    shutil.copytree(REPO / "backend", dest, ignore=ignore)
    print(f"backend -> {dest}")


def build_python(cache: Path, stage: Path) -> None:
    embed = cache / "python-3.12.7-embed-amd64.zip"
    download(PYTHON_EMBED_URL, embed)
    py_dir = stage / "runtime" / "python"
    py_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(embed) as zf:
        zf.extractall(py_dir)

    # Make the embedded interpreter see the pre-installed site-packages.
    pth = py_dir / "python312._pth"
    lines = [
        ln for ln in pth.read_text(encoding="utf-8").splitlines()
        if ln.strip() and not ln.strip().startswith("#")
    ]
    for extra in (r"Lib\site-packages", "import site"):
        if extra not in lines:
            lines.append(extra)
    pth.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # Resolve + download the full Windows wheel closure, then install
    # it into the staged site-packages. Versions stay inside the ranges
    # declared by backend/requirements.txt.
    wheelhouse = cache / "wheelhouse"
    wheelhouse.mkdir(parents=True, exist_ok=True)
    pip("download", "-r", str(REPO / "backend" / "requirements.txt"),
        *PY_PLATFORM, "--only-binary=:all:", "-d", str(wheelhouse))
    site_packages = py_dir / "Lib" / "site-packages"
    pip("install", "--no-index", "--find-links", str(wheelhouse),
        "--target", str(site_packages),
        *PY_PLATFORM, "--implementation", "cp", "--abi", "cp312",
        "--only-binary=:all:", "-r", str(REPO / "backend" / "requirements.txt"))
    # Put the app's backend dir on sys.path for EVERY process using
    # this interpreter (the launcher inserts it for itself, but its
    # `manage.py migrate` subprocess cannot import `core` otherwise:
    # the embedded interpreter's ._pth path setup does not add the
    # script's directory). A .pth line is resolved relative to the
    # site-packages folder: ...\runtime\python\Lib\site-packages
    # -> up 3 -> {app} -> backend.
    (site_packages / "mohaseb-backend.pth").write_text(
        "..\\..\\..\\backend\n", encoding="ascii")
    wheels = sorted(p.name for p in wheelhouse.glob("*.whl"))
    print(f"site-packages populated from {len(wheels)} wheels")
    (stage / "BUILD-WHEELS.txt").write_text("\n".join(wheels) + "\n", encoding="utf-8")


def build_postgres(cache: Path, stage: Path) -> None:
    pg_dl = cache / "pgwheel"
    pg_dl.mkdir(parents=True, exist_ok=True)
    pip("download", PG_PIP_PACKAGE, "--no-deps", *PY_PLATFORM,
        "--only-binary=:all:", "-d", str(pg_dl))
    wheel = next(pg_dl.glob("postgresql_binaries-*.whl"))
    with zipfile.ZipFile(wheel) as zf:
        inner = [n for n in zf.namelist() if n.endswith(".tar.gz")]
        assert len(inner) == 1, inner
        raw = zf.read(inner[0])
    dest = stage / "pgsql"
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as tf:
        members = tf.getmembers()
        top = members[0].name.split("/")[0]
        for m in members:
            parts = Path(m.name).parts
            if len(parts) > 1:
                m.name = str(Path(*parts[1:]))
                tf.extract(m, dest)
    assert (dest / "bin" / "postgres.exe").exists()
    assert (dest / "bin" / "initdb.exe").exists()
    print(f"PostgreSQL tree -> {dest} (from {top})")


def build_tools(cache: Path, stage: Path) -> None:
    winsw = cache / "WinSW-x64.exe"
    download(WINSW_URL, winsw)
    tools = stage / "tools"
    tools.mkdir(parents=True, exist_ok=True)
    shutil.copy2(winsw, tools / "WinSW-x64.exe")
    print("WinSW -> tools/")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--skip-frontend", action="store_true",
                    help="reuse the existing frontend/dist without rebuilding")
    ap.add_argument("--clean", action="store_true",
                    help="wipe dist-stage before assembling")
    args = ap.parse_args()

    cache = HERE / ".cache"
    cache.mkdir(parents=True, exist_ok=True)
    stage = HERE / "dist-stage"
    if args.clean and stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True, exist_ok=True)

    version = (REPO / "VERSION").read_text(encoding="utf-8").strip()
    print(f"Building Mohaseb Pro {version} installer payload...")

    runtime_src = HERE / "runtime"
    shutil.copytree(runtime_src, stage / "runtime",
                    ignore=shutil.ignore_patterns("python"))
    copy_backend(stage)
    if args.skip_frontend:
        dest = stage / "frontend" / "dist"
        shutil.copytree(REPO / "frontend" / "dist", dest)
        print(f"frontend dist (reused) -> {dest}")
    else:
        build_frontend(stage)
    build_python(cache, stage)
    build_postgres(cache, stage)
    build_tools(cache, stage)

    (stage / "VERSION").write_text(version + "\n", encoding="utf-8")
    total = sum(p.stat().st_size for p in stage.rglob("*") if p.is_file())
    print(f"\nStage ready: {stage}  ({total / 1e6:.0f} MB, version {version})")
    print("Next (Windows): run build_package.ps1 to compile the installer.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
