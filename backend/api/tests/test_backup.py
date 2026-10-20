"""Backup integrity tests: checksum validation must catch tampered files."""

import copy
import json

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APITestCase

from api.backup_utils import (
    build_backup, decrypt_backup, encrypt_backup, is_encrypted_backup, validate_backup,
)
from api.models import Customer


class BackupTests(TestCase):
    def setUp(self):
        User.objects.create_user(username='backup-user', password='test-pass-123')
        Customer.objects.create(name='مشتری بکاپ', phone='09120000000')

    def test_built_backup_passes_validation(self):
        payload = build_backup()
        self.assertEqual(payload['format'], 'mohaseb-backup-v1')
        counts = validate_backup(payload)
        self.assertGreaterEqual(counts['api.customer'], 1)

    def test_tampered_backup_fails_checksum(self):
        payload = build_backup()
        tampered = copy.deepcopy(payload)
        tampered['fixtures'] = tampered['fixtures'] + tampered['fixtures'][:1]
        with self.assertRaises(ValueError):
            validate_backup(tampered)

    def test_backup_with_wrong_format_is_rejected(self):
        with self.assertRaises(ValueError):
            validate_backup({'format': 'something-else', 'fixtures': []})


class BackupEncryptionTests(TestCase):
    def test_encrypt_decrypt_roundtrip_preserves_valid_backup(self):
        plain = json.dumps(build_backup(), ensure_ascii=False)
        envelope = encrypt_backup(plain, 'strong-passphrase-1')
        self.assertTrue(is_encrypted_backup(envelope))
        self.assertNotIn('fixtures', envelope)
        restored = decrypt_backup(envelope, 'strong-passphrase-1')
        validate_backup(restored)

    def test_wrong_passphrase_is_rejected(self):
        envelope = encrypt_backup('{"format": "mohaseb-backup-v1"}', 'correct-passphrase')
        with self.assertRaises(ValueError):
            decrypt_backup(envelope, 'wrong-passphrase')

    def test_short_passphrase_is_rejected(self):
        with self.assertRaises(ValueError):
            encrypt_backup('{}', 'short')

    def test_encrypted_payload_does_not_leak_plaintext(self):
        envelope = encrypt_backup('{"secret_customer": "mohaseb"}', 'strong-passphrase-1')
        self.assertNotIn('secret_customer', json.dumps(envelope))


class EncryptedBackupApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='backup-admin', password='test-pass-123')
        Customer.objects.create(name='مشتری رمزنگاری')
        token = self.client.post('/api/token/', {'username': 'backup-admin', 'password': 'test-pass-123'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.data['access']}")

    def test_download_with_passphrase_returns_encrypted_envelope(self):
        response = self.client.post('/api/backup/download/', {'passphrase': 'strong-passphrase-1'}, format='json')
        self.assertEqual(response.status_code, 200)
        envelope = json.loads(response.content)
        self.assertTrue(is_encrypted_backup(envelope))

    def test_restore_encrypted_backup_needs_and_accepts_passphrase(self):
        download = self.client.post('/api/backup/download/', {'passphrase': 'strong-passphrase-1'}, format='json')
        raw = download.content.decode('utf-8')
        without = self.client.post('/api/backup/restore/', {'backup_json': raw, 'confirm_replace': False}, format='json')
        self.assertEqual(without.status_code, 400)
        checked = self.client.post(
            '/api/backup/restore/',
            {'backup_json': raw, 'confirm_replace': False, 'passphrase': 'strong-passphrase-1'},
            format='json',
        )
        self.assertEqual(checked.status_code, 200, checked.content)
        self.assertTrue(checked.data['valid'])
        self.assertGreaterEqual(checked.data['counts']['api.customer'], 1)
