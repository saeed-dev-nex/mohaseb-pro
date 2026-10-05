import hashlib
import json

from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.serializers import deserialize, serialize
from django.utils import timezone


USER_MODEL_LABEL = 'auth.user'
MODEL_ORDER = [
    'api.expensecategory', 'api.service', 'api.staff', 'api.vehicletype',
    'api.customer', 'api.invoice', 'api.invoiceitem', 'api.invoicepayment',
    'api.invoiceeditrequest', 'api.expense', 'api.document', 'api.cheque',
    'api.businessprofile', 'api.backupconfig', 'api.auditlog',
]
MODEL_MAP = {label: apps.get_model(label) for label in MODEL_ORDER}
USER_FOREIGN_KEYS = {
    'api.invoice': {'created_by': True},
    'api.invoiceeditrequest': {'requested_by': False, 'reviewed_by': True},
    'api.invoicepayment': {'created_by': True},
    'api.auditlog': {'user': True},
}


def _checksum(payload):
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',', ':'), default=str)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


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
    allowed = set(MODEL_ORDER) | {USER_MODEL_LABEL}
    counts = {label: 0 for label in MODEL_ORDER}
    counts[USER_MODEL_LABEL] = 0
    try:
        for item in fixtures:
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
    return counts
