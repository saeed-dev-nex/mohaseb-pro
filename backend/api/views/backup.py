"""Backup configuration, download and restore endpoints."""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Sum, Count, Q, OuterRef, Subquery, DecimalField, Value, Case, When, F, ExpressionWrapper
from django.db.models.functions import Coalesce
from django.db import transaction, connection
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from datetime import timedelta, date
from django.http import JsonResponse, HttpResponse
from django.http import FileResponse
from django.core.paginator import Paginator, EmptyPage
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import json, calendar, os, shutil
from zoneinfo import ZoneInfo

from ..models import (
    Customer, Service, Invoice, InvoiceEditRequest, InvoicePayment, AuditLog, Document,
    BusinessProfile, ExpenseCategory, Expense, Staff, VehicleType, BackupConfig,
    Cheque, InvoiceSettings, ChatMessage, ChatNotification, ChatPresence,
    WelcomeSettings, UserWelcomeMessage, WelcomeMessageShown, SocialNetwork
)
from ..serializers import (
    CustomerListSerializer, CustomerDetailSerializer,
    ServiceSerializer, InvoiceSerializer, DocumentSerializer,
    BusinessProfileSerializer, ExpenseCategorySerializer,
    ExpenseSerializer, StaffSerializer, VehicleTypeSerializer,
    UserSerializer, BackupConfigSerializer, InvoiceSettingsSerializer, ChequeSerializer, InvoicePaymentSerializer, AuditLogSerializer, ChatMessageSerializer, SocialNetworkSerializer
)
from ..audit import snapshot, record_audit, is_invoice_content_version
from .common import IsSuperuser




class BackupConfigViewSet(viewsets.ViewSet):
    """Backup configuration and on-demand backup execution"""
    permission_classes = [IsSuperuser]

    def list(self, request):
        cfg = BackupConfig.load()
        return Response(BackupConfigSerializer(cfg).data)

    @action(detail=False, methods=['put', 'patch'])
    def update_config(self, request):
        cfg = BackupConfig.load()
        serializer = BackupConfigSerializer(cfg, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def browse_folders(self, request):
        """List server folders for the superuser backup destination picker."""
        requested_path = request.query_params.get('path', '').strip()
        if os.name == 'nt':
            if requested_path:
                current_path = os.path.abspath(requested_path)
                if not os.path.isdir(current_path):
                    return Response({'detail': 'پوشهٔ سرور پیدا نشد.'}, status=status.HTTP_400_BAD_REQUEST)
                roots = [os.path.splitdrive(current_path)[0] + os.sep]
            else:
                roots = [f'{letter}:\\' for letter in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' if os.path.isdir(f'{letter}:\\')]
                current_path = ''
        else:
            current_path = os.path.abspath(requested_path or os.sep)
            if not os.path.isdir(current_path):
                return Response({'detail': 'پوشهٔ سرور پیدا نشد.'}, status=status.HTTP_400_BAD_REQUEST)
            roots = [os.sep]

        if not current_path:
            return Response({'path': '', 'parent': None, 'roots': roots, 'folders': []})

        folders = []
        try:
            with os.scandir(current_path) as entries:
                for entry in entries:
                    try:
                        if entry.is_dir():
                            folders.append({'name': entry.name, 'path': entry.path})
                    except OSError:
                        continue
        except OSError:
            return Response({'detail': 'امکان خواندن این پوشه وجود ندارد.'}, status=status.HTTP_400_BAD_REQUEST)

        folders.sort(key=lambda folder: folder['name'].casefold())
        parent_path = os.path.dirname(os.path.normpath(current_path))
        if parent_path == current_path or (os.name == 'nt' and parent_path == os.path.splitdrive(current_path)[0]):
            parent_path = None
        return Response({'path': current_path, 'parent': parent_path, 'roots': roots, 'folders': folders})

    @action(detail=False, methods=['post'])
    def run_backup(self, request):
        """Save to an explicit server path or return a downloadable backup.

        An optional ``passphrase`` encrypts the backup (AES-256-GCM) both for
        download and for server-path saves; scheduled backups stay plain and
        rely on the secrecy of the server path.
        """
        cfg = BackupConfig.load()
        backup_path = (request.data.get('path') or '').strip()
        from ..backup_utils import build_backup, encrypt_backup
        json_str = json.dumps(build_backup(), ensure_ascii=False, indent=2, default=str)
        passphrase = (request.data.get('passphrase') or '').strip()
        if passphrase:
            try:
                json_str = json.dumps(encrypt_backup(json_str, passphrase), ensure_ascii=False, indent=2)
            except ValueError as error:
                return Response({'detail': str(error)}, status=status.HTTP_400_BAD_REQUEST)
        filename = f"mohaseb_backup_{timezone.now().strftime('%Y%m%d_%H%M%S')}.json"

        if backup_path:
            if not os.path.isdir(backup_path):
                return Response(
                    {'detail': 'پوشهٔ انتخاب‌شده روی سرور وجود ندارد.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return self._save_backup_to_path(cfg, backup_path, filename, json_str)

        # Otherwise return as downloadable JSON
        from django.http import HttpResponse
        response = HttpResponse(json_str, content_type='application/json; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    def _save_backup_to_path(self, cfg, backup_path, filename, json_str):
        dest = os.path.join(backup_path, filename)
        temp_dest = dest + '.tmp'
        try:
            with open(temp_dest, 'w', encoding='utf-8') as backup_file:
                backup_file.write(json_str)
                backup_file.flush()
                os.fsync(backup_file.fileno())
            os.replace(temp_dest, dest)
        except OSError as error:
            return Response(
                {'detail': f'ذخیرهٔ بکاپ در مسیر سرور انجام نشد: {error}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cfg.last_backup_at = timezone.now()
        cfg.last_backup_path = dest
        cfg.save()
        return Response({'saved': True, 'path': dest, 'filename': filename})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def check_auto(self, request):
        """Run a due backup as a browser-side fallback to the server worker."""
        from ..scheduler import run_due_backup
        return Response(run_due_backup())

class BackupViewSet(viewsets.ViewSet):
    """Backup and restore all data"""
    permission_classes = [IsSuperuser]

    @action(detail=False, methods=['get', 'post'])
    def download(self, request):
        """Download full backup as JSON; POST with ``passphrase`` encrypts it."""
        from ..backup_utils import build_backup, encrypt_backup
        from django.http import HttpResponse
        json_str = json.dumps(build_backup(), ensure_ascii=False, indent=2, default=str)
        passphrase = (request.data.get('passphrase') or '').strip() if request.method == 'POST' else ''
        if passphrase:
            try:
                envelope = encrypt_backup(json_str, passphrase)
            except ValueError as error:
                return Response({'detail': str(error)}, status=400)
            json_str = json.dumps(envelope, ensure_ascii=False, indent=2)
        response = HttpResponse(
            json_str,
            content_type='application/json; charset=utf-8'
        )
        response['Content-Disposition'] = f'attachment; filename="mohaseb_backup_{timezone.now().strftime("%Y%m%d_%H%M%S")}.json"'
        return response

    @action(detail=False, methods=['post'])
    def restore(self, request):
        if not request.user.is_superuser:
            return Response({'detail': 'بازیابی نسخهٔ پشتیبان فقط برای مدیر ارشد مجاز است.'}, status=403)
        backup = request.data.get('backup')
        try:
            if request.data.get('backup_json'):
                backup = json.loads(request.data['backup_json'])
            from ..backup_utils import decrypt_backup, is_encrypted_backup, restore_backup, validate_backup
            if is_encrypted_backup(backup):
                backup = decrypt_backup(backup, (request.data.get('passphrase') or '').strip())
            counts = validate_backup(backup)
            if request.data.get('confirm_replace') is not True:
                return Response({'valid': True, 'counts': counts, 'requires_confirmation': True})
            restore_backup(backup, fallback_user_id=request.user.pk)
            return Response({'valid': True, 'restored': True, 'counts': counts})
        except Exception as error:
            return Response({'detail': str(error) or 'بازیابی نسخهٔ پشتیبان انجام نشد.'}, status=400)
