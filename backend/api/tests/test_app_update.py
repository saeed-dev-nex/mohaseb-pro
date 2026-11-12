"""In-app update awareness: changelog parsing + real-git status checks."""

import json
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from .. import app_update

User = get_user_model()

CHANGELOG_V1 = """# تغییرات

## [Unreleased]

## [3.5.0] - 2026-11-01

- قابلیت موجود
"""

CHANGELOG_V2 = """# تغییرات

## [Unreleased]

- یک تغییر در راه

## [3.6.0] - 2026-11-10

- **قابلیت مهم:** اعلان بلادرنگ درخواست ویرایش
  که ادامهٔ همان خط است
- پروفایل عملکرد کاربران

## [3.5.0] - 2026-11-01

- قابلیت موجود
"""


class ChangelogParsingTests(SimpleTestCase):
    def test_changes_since_returns_newer_sections_only(self):
        changes = app_update.changes_since(CHANGELOG_V2, '3.5.0')
        versions = [section['version'] for section in changes]
        self.assertEqual(versions, ['Unreleased', '3.6.0'])
        items = changes[1]['items']
        self.assertEqual(len(items), 2)
        self.assertNotIn('**', items[0])
        self.assertIn('ادامهٔ همان خط', items[0])

    def test_changes_since_up_to_date(self):
        self.assertEqual(app_update.changes_since(CHANGELOG_V2, '3.6.0'), [
            {'version': 'Unreleased', 'items': ['یک تغییر در راه']},
        ])


def _git(cwd, *args):
    subprocess.run(
        ['git', '-C', str(cwd), *args],
        check=True, capture_output=True, text=True,
        env={
            'PATH': '/usr/bin:/bin:/usr/local/bin',
            'HOME': str(cwd),
            'GIT_AUTHOR_NAME': 'Test', 'GIT_AUTHOR_EMAIL': 't@example.com',
            'GIT_COMMITTER_NAME': 'Test', 'GIT_COMMITTER_EMAIL': 't@example.com',
        },
    )


class GitUpdateStatusTests(TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        base = Path(self.tmp.name)
        self.remote = base / 'remote.git'
        self.remote.mkdir()
        _git(self.remote, 'init', '--bare', '-b', 'beta')
        publisher = base / 'publisher'
        publisher.mkdir()
        _git(publisher, 'clone', str(self.remote), '.')
        (publisher / 'VERSION').write_text('3.5.0\n', encoding='utf-8')
        (publisher / 'CHANGELOG.md').write_text(CHANGELOG_V1, encoding='utf-8')
        _git(publisher, 'add', '-A')
        _git(publisher, 'commit', '-m', 'v3.5.0')
        _git(publisher, 'push', 'origin', 'beta')
        self.install = base / 'install'
        _git(base, 'clone', '-b', 'beta', str(self.remote), 'install')
        # The publisher ships 3.6.0.
        (publisher / 'VERSION').write_text('3.6.0\n', encoding='utf-8')
        (publisher / 'CHANGELOG.md').write_text(CHANGELOG_V2, encoding='utf-8')
        _git(publisher, 'add', '-A')
        _git(publisher, 'commit', '-m', 'v3.6.0')
        _git(publisher, 'push', 'origin', 'beta')
        root_patch = patch.object(app_update, 'repo_root', return_value=self.install)
        root_patch.start()
        self.addCleanup(root_patch.stop)

    def test_status_reports_the_pending_update(self):
        status = app_update.get_update_status(force=True)
        self.assertTrue(status['available'], status)
        self.assertEqual(status['current_version'], '3.5.0')
        self.assertEqual(status['latest_version'], '3.6.0')
        self.assertEqual(status['behind'], 1)
        versions = [section['version'] for section in status['changes']]
        self.assertIn('3.6.0', versions)

    def test_approve_writes_the_flag(self):
        ok, detail = app_update.approve_update(requested_by='admin')
        self.assertTrue(ok, detail)
        flag = self.install / 'update-approved.flag'
        self.assertTrue(flag.exists())
        data = json.loads(flag.read_text(encoding='utf-8'))
        self.assertEqual(data['latest_version'], '3.6.0')
        self.assertEqual(data['requested_by'], 'admin')


class UpdateStatusFailureTests(SimpleTestCase):
    """Local failures must degrade to a readable status, never a 500.

    Regression: on a Windows install whose server process could not
    see git on PATH, GET /api/app-update/ returned HTTP 500 because
    FileNotFoundError (an OSError) escaped get_update_status.
    """

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        base = Path(self.tmp.name)
        self.cache = base / 'cache.json'
        for target, value in (
            ('repo_root', base),
            ('_cache_path', self.cache),
        ):
            patcher = patch.object(app_update, target, return_value=value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_missing_git_is_a_handled_failure(self):
        with patch.object(
            app_update.subprocess, 'run',
            side_effect=FileNotFoundError(2, 'No such file or directory', 'git'),
        ):
            status = app_update.get_update_status(force=True)
        self.assertFalse(status['available'])
        self.assertIn('بررسی آپدیت انجام نشد', status['reason'])

    def test_naive_cache_timestamp_does_not_crash(self):
        from datetime import datetime

        self.cache.write_text(
            json.dumps({
                'checked_at': datetime.now().isoformat(),  # no timezone
                'available': False,
                'current_version': '3.5.1',
            }),
            encoding='utf-8',
        )
        status = app_update.get_update_status()
        self.assertEqual(status['current_version'], '3.5.1')
        quick = app_update.quick_update_status()
        self.assertEqual(quick['current_version'], '3.5.1')


class AppUpdateApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='upd-admin', password='admin' + '-pass-12345')
        self.operator = User.objects.create_user(username='upd-op', password='op' + '-pass-12345')
        self.client = APIClient()

    def test_superuser_only(self):
        self.client.force_authenticate(self.operator)
        self.assertEqual(self.client.get('/api/app-update/?quick=1').status_code, 403)
        self.assertEqual(self.client.post('/api/app-update/check/', {}, format='json').status_code, 403)

    def test_quick_status_for_superuser(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get('/api/app-update/?quick=1')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn('current_version', response.data)
