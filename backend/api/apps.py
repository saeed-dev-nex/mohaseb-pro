import os
import sys
from pathlib import PurePosixPath

from django.apps import AppConfig
from django.conf import settings


def should_start_backup_scheduler():
    """Only serving processes may start a worker; management commands never do."""
    if not getattr(settings, 'BACKUP_SCHEDULER_ENABLED', True):
        return False
    if os.environ.get('DJANGO_BACKUP_SCHEDULER_ENABLED', 'true').strip().lower() in {
        '0', 'false', 'no', 'off',
    }:
        return False
    argv = sys.argv
    if not argv:
        return False
    executable = PurePosixPath(argv[0].replace('\\', '/').lower())
    if executable.name in {'manage.py', 'django-admin', 'django-admin.exe'}:
        if len(argv) < 2 or argv[1] != 'runserver':
            return False
        return os.environ.get('RUN_MAIN', '').lower() == 'true' or '--noreload' in argv
    # Covers the console script and `python -m daphne` used by our launchers.
    return executable.name in {'daphne', 'daphne.exe', 'daphne-script.py'} or (
        executable.name == '__main__.py' and executable.parent.name == 'daphne'
    )


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        if not should_start_backup_scheduler():
            return
        from .scheduler import start_backup_scheduler

        start_backup_scheduler()
