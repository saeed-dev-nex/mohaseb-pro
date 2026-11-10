"""In-app update awareness and approval (superuser-driven updates).

Historically the launchers ran update_project.ps1 at every start, so a
new version landed silently whenever the app restarted. Now the
updater only applies an update that carries the approval flag written
here, and this module lets the superuser see — before anything is
installed — that an update exists and what it changes (parsed from the
remote branch's CHANGELOG.md), then approve it at a quiet moment.

All git work is read-only except ``fetch``. Results are cached in a
small JSON file next to the backend (gitignored) so the layout banner
can poll cheaply; a forced check always fetches.
"""

import json
import logging
import os
import re
import subprocess
from datetime import datetime, timedelta, timezone as dt_timezone
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

CACHE_FILENAME = '.update_status_cache.json'
FLAG_FILENAME = 'update-approved.flag'
CACHE_MAX_AGE = timedelta(hours=6)
GIT_TIMEOUT = 30


def repo_root():
    return Path(settings.BASE_DIR).parent


def _run_git(args, timeout=GIT_TIMEOUT):
    completed = subprocess.run(
        ['git', '-C', str(repo_root()), *args],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if completed.returncode != 0:
        raise RuntimeError((completed.stderr or completed.stdout or 'git error').strip())
    return completed.stdout.strip()


def _read_version(root):
    try:
        return (root / 'VERSION').read_text(encoding='utf-8').strip()
    except OSError:
        return ''


def _version_tuple(text):
    match = re.match(r'(\d+)\.(\d+)\.(\d+)', (text or '').strip())
    if not match:
        return None
    return tuple(int(part) for part in match.groups())


def parse_changelog_sections(text):
    """Split CHANGELOG.md into [{version, items}] in file order.

    Items are the top-level ``- `` bullets of each ``## [x.y.z]`` /
    ``## [Unreleased]`` section, with markdown emphasis stripped.
    """
    sections = []
    current = None
    for line in (text or '').splitlines():
        heading = re.match(r'##\s+\[([^\]]+)\]', line)
        if heading:
            current = {'version': heading.group(1).strip(), 'items': []}
            sections.append(current)
            continue
        if current is None:
            continue
        if line.startswith('- '):
            item = line[2:].strip().replace('**', '')
            if item:
                current['items'].append(item)
        elif line.startswith('  ') and line.strip() and current['items']:
            # Wrapped continuation of the previous bullet (the repo's
            # changelog style) — fold it into that item.
            current['items'][-1] += ' ' + line.strip().replace('**', '')
    return [section for section in sections if section['items']]


def changes_since(changelog_text, current_version):
    """Sections newer than ``current_version`` (Unreleased counts as newest)."""
    current_tuple = _version_tuple(current_version)
    newer = []
    for section in parse_changelog_sections(changelog_text):
        if section['version'].lower() == 'unreleased':
            newer.append(section)
            continue
        section_tuple = _version_tuple(section['version'])
        if section_tuple is not None and (current_tuple is None or section_tuple > current_tuple):
            newer.append(section)
    return newer


def _cache_path():
    return Path(settings.BASE_DIR) / CACHE_FILENAME


def _read_cache():
    try:
        data = json.loads(_cache_path().read_text(encoding='utf-8'))
        checked_at = datetime.fromisoformat(data['checked_at'])
        if datetime.now(dt_timezone.utc) - checked_at > CACHE_MAX_AGE:
            return None
        return data
    except (OSError, ValueError, KeyError):
        return None


def _write_cache(status):
    try:
        _cache_path().write_text(json.dumps(status, ensure_ascii=False), encoding='utf-8')
    except OSError:
        logger.exception('Could not write the update status cache')


def get_update_status(force=False):
    """Current vs remote version state; cached unless ``force``."""
    if not force:
        cached = _read_cache()
        if cached is not None:
            return cached
    root = repo_root()
    status = {
        'available': False,
        'reason': '',
        'current_version': _read_version(root),
        'branch': '',
        'current_sha': '',
        'remote_sha': '',
        'behind': 0,
        'latest_version': '',
        'changes': [],
        'checked_at': datetime.now(dt_timezone.utc).isoformat(),
        'approved_pending': (root / FLAG_FILENAME).exists(),
    }
    try:
        status['branch'] = _run_git(['rev-parse', '--abbrev-ref', 'HEAD'])
        status['current_sha'] = _run_git(['rev-parse', 'HEAD'])[:12]
        _run_git(['fetch', 'origin', status['branch']], timeout=60)
        status['remote_sha'] = _run_git(['rev-parse', f"origin/{status['branch']}"])[:12]
        behind = _run_git(['rev-list', '--count', f"HEAD..origin/{status['branch']}"])
        status['behind'] = int(behind or 0)
        status['available'] = True
        if status['behind'] > 0:
            status['latest_version'] = _run_git(['show', f"origin/{status['branch']}:VERSION"]).strip()
            changelog = _run_git(['show', f"origin/{status['branch']}:CHANGELOG.md"])
            status['changes'] = changes_since(changelog, status['current_version'])
    except (RuntimeError, subprocess.SubprocessError, ValueError) as error:
        status['reason'] = f'بررسی آپدیت انجام نشد: {str(error)[:200]}'
        logger.warning('Update check failed: %s', error)
    _write_cache(status)
    return status


def quick_update_status():
    """Cache-only status for cheap polling (never touches the network)."""
    cached = _read_cache()
    if cached is not None:
        return cached
    root = repo_root()
    return {
        'available': False,
        'reason': 'هنوز بررسی نشده است.',
        'current_version': _read_version(root),
        'branch': '',
        'current_sha': '',
        'remote_sha': '',
        'behind': 0,
        'latest_version': '',
        'changes': [],
        'checked_at': '',
        'approved_pending': (root / FLAG_FILENAME).exists(),
    }


def approve_update(requested_by=''):
    """Stage an approved update: write the flag the updater requires.

    On Windows the detached apply helper is spawned too: it stops the
    server, runs the (forced) updater and relaunches the app, so the
    superuser's click is the only manual step. On other platforms the
    flag alone is written and the next launcher start applies it.
    Returns (ok, detail_dict).
    """
    status = get_update_status(force=True)
    if not status['available']:
        return False, {'detail': status['reason'] or 'بررسی آپدیت انجام نشد.'}
    if status['behind'] <= 0:
        return False, {'detail': 'نسخهٔ جدیدی برای نصب وجود ندارد.'}
    root = repo_root()
    flag = {
        'target_sha': status['remote_sha'],
        'latest_version': status['latest_version'],
        'requested_by': requested_by,
        'at': datetime.now(dt_timezone.utc).isoformat(),
    }
    (root / FLAG_FILENAME).write_text(json.dumps(flag, ensure_ascii=False), encoding='utf-8')
    spawned = False
    if os.name == 'nt':
        helper = root / 'apply_update.ps1'
        if helper.exists():
            try:
                subprocess.Popen(
                    [
                        'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass',
                        '-File', str(helper), '-RepoRoot', str(root),
                    ],
                    creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
                    close_fds=True,
                )
                spawned = True
            except OSError:
                logger.exception('Could not spawn apply_update.ps1')
    return True, {
        'staged': True,
        'spawned': spawned,
        'latest_version': status['latest_version'],
        'target_sha': status['remote_sha'],
    }
