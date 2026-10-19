import os
import sys
import threading

from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        # runserver starts a reloader parent and a serving child. Only the child
        # should own the worker; --noreload runs directly without RUN_MAIN.
        if len(sys.argv) < 2 or sys.argv[1] != 'runserver':
            return
        is_reloader_child = os.environ.get('RUN_MAIN', '').lower() == 'true'
        if not is_reloader_child and '--noreload' not in sys.argv:
            return
        from .scheduler import backup_scheduler_loop

        worker = threading.Thread(
            target=backup_scheduler_loop,
            name='mohaseb-auto-backup',
            daemon=True,
        )
        worker.start()
