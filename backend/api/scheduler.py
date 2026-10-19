"""In-process scheduled database backups for the single-server deployment."""

import json
import logging
import os
import threading
from pathlib import Path

from django.utils import timezone

logger = logging.getLogger(__name__)
_backup_lock = threading.Lock()


def run_due_backup():
    """Create one scheduled backup when the configured local-time window is due."""
    from .backup_utils import build_backup
    from .models import BackupConfig

    with _backup_lock:
        config = BackupConfig.load()
        if not config.auto_backup or not config.backup_path:
            return {'ran': False, 'reason': 'auto backup disabled or path not set'}
        if config.backup_frequency == 'manual':
            return {'ran': False, 'reason': 'manual backup frequency'}

        now = timezone.localtime()
        if now.hour < config.backup_hour:
            return {'ran': False, 'reason': f'waiting for backup hour ({config.backup_hour})'}
        if config.backup_frequency == 'weekly' and now.weekday() != 0:
            return {'ran': False, 'reason': 'weekly backup runs on Monday'}
        if not os.path.isdir(config.backup_path):
            return {'ran': False, 'reason': 'backup path does not exist'}

        if config.last_backup_at:
            last_local = timezone.localtime(config.last_backup_at)
            if config.backup_frequency == 'weekly':
                if last_local.isocalendar()[:2] == now.isocalendar()[:2]:
                    return {'ran': False, 'reason': 'already backed up this week'}
            elif last_local.date() == now.date():
                return {'ran': False, 'reason': 'already backed up today'}

        filename = f"mohaseb_backup_{now.strftime('%Y%m%d_%H%M%S')}.json"
        destination = os.path.join(config.backup_path, filename)
        temporary = destination + f'.{os.getpid()}.tmp'
        try:
            payload = json.dumps(build_backup(), ensure_ascii=False, indent=2, default=str)
            with open(temporary, 'w', encoding='utf-8') as backup_file:
                backup_file.write(payload)
                backup_file.flush()
                os.fsync(backup_file.fileno())
            os.replace(temporary, destination)
        except OSError as error:
            try:
                Path(temporary).unlink(missing_ok=True)
            except OSError:
                pass
            logger.exception('Scheduled Mohaseb backup could not be saved')
            return {'ran': False, 'reason': f'backup write failed: {error}'}

        config.last_backup_at = timezone.now()
        config.last_backup_path = destination
        config.save(update_fields=['last_backup_at', 'last_backup_path'])
        logger.info('Scheduled Mohaseb backup saved to %s', destination)
        return {'ran': True, 'saved': True, 'path': destination, 'filename': filename}


def backup_scheduler_loop():
    """Run in the backend process so scheduled backups do not depend on a browser."""
    from django.db import close_old_connections

    while True:
        try:
            close_old_connections()
            run_due_backup()
        except Exception:
            logger.exception('Scheduled Mohaseb backup check failed')
        finally:
            close_old_connections()
        threading.Event().wait(30)
