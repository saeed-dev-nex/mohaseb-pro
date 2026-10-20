import hashlib
import json
import base64
import os
from pathlib import Path, PurePosixPath

from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.serializers import deserialize, serialize
from django.utils import timezone


USER_MODEL_LABEL = 'auth.user'
MODEL_ORDER = [
    'api.expensecategory', 'api.service', 'api.staff', 'api.vehicletype',
    'api.customer', 'api.invoice', 'api.invoiceitem', 'api.invoicepayment',
    'api.invoiceeditrequest', 'api.expense', 'api.document', 'api.cheque',
    'api.businessprofile', 'api.backupconfig', 'api.invoicesettings', 'api.auditlog',
]
MODEL_MAP = {label: apps.get_model(label) for label in MODEL_ORDER}
USER_FOREIGN_KEYS = {
    'api.invoice': {'created_by': True, 'paid_by': True},
    'api.invoiceeditrequest': {'requested_by': False, 'reviewed_by': True},
    'api.invoicepayment': {'created_by': True},
    'api.auditlog': {'user': True},
}


def _checksum(payload):
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',', ':'), default=str)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


def _safe_media_parts(relative_path):
    path = PurePosixPath(relative_path)
    return bool(relative_path) and not path.is_absolute() and all(part not in ('', '.', '..') for part in path.parts)


def build_backup():
    user_model = get_user_model()
    user_fields = [
        field.name for field in user_model._meta.concrete_fields
        if not field.primary_key
    ]
    user_fixtures = json.loads(serialize(
        'json', user_model.objects.all().order_by('pk'), fields=user_fields
    ))
    fixtures = user_fixtures
    for label in MODEL_ORDER:
        model = MODEL_MAP[label]
        fixtures.extend(json.loads(serialize('json', model.objects.all().order_by('pk'))))
    media_files = {}
    for document in MODEL_MAP['api.document'].objects.exclude(file='').iterator():
        relative_path = document.file.name.replace('\\', '/')
        if not _safe_media_parts(relative_path):
            raise ValueError(f'مسیر فایل سند امن نیست: {relative_path}')
        try:
            with document.file.open('rb') as source_file:
                media_files[relative_path] = base64.b64encode(source_file.read()).decode('ascii')
        except OSError as error:
            raise ValueError(f'خواندن فایل سند برای بکاپ ممکن نشد: {relative_path}') from error
    payload = {
        'format': 'mohaseb-backup-v1',
        'created_at': timezone.now().isoformat(),
        # Keep usernames beside the records so user references can be remapped
        # when a backup is restored into a database with different user IDs.
        'users': {
            str(user.pk): user.get_username()
            for user in get_user_model().objects.order_by('pk')
        },
        'fixtures': fixtures,
        'media_files': media_files,
    }
    payload['sha256'] = _checksum(payload)
    return payload


def validate_backup(backup):
    if not isinstance(backup, dict) or backup.get('format') != 'mohaseb-backup-v1':
        raise ValueError('قالب فایل پشتیبان پشتیبانی نمی‌شود؛ یک نسخهٔ جدید تهیه کنید.')
    fixtures = backup.get('fixtures')
    if not isinstance(fixtures, list) or len(fixtures) > 500000:
        raise ValueError('ساختار یا تعداد رکوردهای فایل پشتیبان معتبر نیست.')
    checksum = backup.get('sha256')
    payload = {key: value for key, value in backup.items() if key != 'sha256'}
    if not checksum or checksum != _checksum(payload):
        raise ValueError('اعتبارسنجی صحت فایل پشتیبان ناموفق بود؛ فایل تغییر کرده یا ناقص است.')
    media_files = backup.get('media_files', {})
    if not isinstance(media_files, dict) or len(media_files) > 100000:
        raise ValueError('ساختار فایل‌های پیوست در پشتیبان معتبر نیست.')
    try:
        for relative_path, encoded_file in media_files.items():
            if not isinstance(relative_path, str) or not _safe_media_parts(relative_path) or not isinstance(encoded_file, str):
                raise ValueError('مسیر یا محتوای فایل پیوست در پشتیبان معتبر نیست.')
            base64.b64decode(encoded_file, validate=True)
    except (ValueError, TypeError) as error:
        raise ValueError('محتوای فایل‌های پیوست در پشتیبان معتبر نیست.') from error
    allowed = set(MODEL_ORDER) | {USER_MODEL_LABEL}
    counts = {label: 0 for label in MODEL_ORDER}
    counts[USER_MODEL_LABEL] = 0
    try:
        for item in fixtures:
            if not isinstance(item, dict):
                raise ValueError('فایل پشتیبان شامل رکورد نامعتبر است.')
            label = item.get('model')
            if label not in allowed or not isinstance(item.get('fields'), dict):
                raise ValueError('فایل پشتیبان شامل مدل یا رکورد ناشناخته است.')
            list(deserialize('json', json.dumps([item], ensure_ascii=False)))[0]
            counts[label] += 1
    except (KeyError, TypeError, json.JSONDecodeError) as error:
        raise ValueError('ساختار رکوردهای فایل پشتیبان معتبر نیست.') from error
    return counts


def restore_backup(backup, fallback_user_id=None):
    counts = validate_backup(backup)
    from django.db import transaction

    user_model = get_user_model()
    backup_users = backup.get('users') if isinstance(backup.get('users'), dict) else {}
    fallback_user = user_model.objects.filter(pk=fallback_user_id).first()
    fallback_username = fallback_user.get_username() if fallback_user else None

    def restore_users():
        source_to_target = {}
        for fixture in backup['fixtures']:
            if fixture['model'] != USER_MODEL_LABEL:
                continue
            deserialized = next(deserialize('json', json.dumps([fixture], ensure_ascii=False)))
            user = deserialized.object
            source_id = user.pk
            existing = user_model.objects.filter(
                **{user_model.USERNAME_FIELD: user.get_username()}
            ).first()
            if existing:
                user.pk = existing.pk
            else:
                # Source primary keys can collide with unrelated local users.
                user.pk = None
            if fallback_username and user.get_username() == fallback_username:
                user.is_active = True
                user.is_staff = True
                user.is_superuser = True
            # DeserializedObject.save() also restores its deferred m2m fields.
            deserialized.save()
            source_to_target[str(source_id)] = user.pk
        return source_to_target

    def remap_user_references(fixture, source_to_target):
        user_fields = USER_FOREIGN_KEYS.get(fixture['model'], {})
        if not user_fields:
            return fixture
        fields = fixture['fields']
        for field_name, nullable in user_fields.items():
            source_id = fields.get(field_name)
            if source_id is None:
                continue
            target_id = source_to_target.get(str(source_id))
            username = backup_users.get(str(source_id))
            if target_id is None and username:
                target_id = user_ids_by_name.get(username)
            if target_id is None and source_id in existing_user_ids:
                target_id = source_id
            if target_id is None:
                target_id = None if nullable else fallback_user_id
            fields[field_name] = target_id
        return fixture

    with transaction.atomic():
        source_to_target = restore_users()
        existing_user_ids = set(user_model.objects.values_list('pk', flat=True))
        user_ids_by_name = dict(
            user_model.objects.values_list(user_model.USERNAME_FIELD, 'pk')
        )

        # Delete dependent application records first; restored user accounts stay intact.
        delete_order = list(reversed(MODEL_ORDER))
        for label in delete_order:
            MODEL_MAP[label].objects.all().delete()
        for label in MODEL_ORDER:
            for fixture in backup['fixtures']:
                if fixture['model'] != label:
                    continue
                fixture = remap_user_references(
                    json.loads(json.dumps(fixture)), source_to_target
                )
                deserialized = next(deserialize('json', json.dumps([fixture], ensure_ascii=False)))
                deserialized.save()
        restore_media_files(backup.get('media_files', {}))
    return counts


def restore_media_files(media_files):
    """Restore uploaded customer documents using safe relative MEDIA_ROOT paths."""
    from django.conf import settings

    media_root = Path(settings.MEDIA_ROOT).resolve()
    for relative_path, encoded_file in media_files.items():
        target = media_root.joinpath(*PurePosixPath(relative_path).parts).resolve()
        if media_root not in target.parents:
            raise ValueError('مسیر فایل پیوست از پوشهٔ رسانه خارج می‌شود.')
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(target.name + '.restore.tmp')
        try:
            with temporary.open('wb') as output_file:
                output_file.write(base64.b64decode(encoded_file, validate=True))
                output_file.flush()
                os.fsync(output_file.fileno())
            temporary.replace(target)
        except OSError:
            temporary.unlink(missing_ok=True)
            raise
