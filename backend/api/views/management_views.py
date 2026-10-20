"""Dashboard, staff, users and audit-log endpoints."""

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




class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def reminders(self, request):
        """Due-date digest: overdue + due-soon invoices and cheques (stage 4)."""
        from ..services.reminders import build_reminders

        try:
            within_days = min(90, max(1, int(request.query_params.get('days', 7))))
        except (TypeError, ValueError):
            within_days = 7
        return Response(build_reminders(within_days=within_days))

    @action(detail=False, methods=['get'])
    def stats(self, request):
        now = timezone.now()
        today = date.today()

        total_customers = Customer.objects.count()
        total_invoices = Invoice.objects.count()
        total_revenue = Invoice.objects.filter(Q(status='paid') | Q(commission_paid=True)).aggregate(
            total=Sum('commission_total')
        )['total'] or 0
        total_commission = total_revenue
        pending_count = Invoice.objects.filter(status='pending').count()
        paid_count = Invoice.objects.filter(status='paid').count()
        overdue_queryset = Invoice.objects.filter(status='pending', due_date__lt=today).select_related('customer').prefetch_related('payments').order_by('due_date')
        overdue_count = overdue_queryset.count()
        overdue_amount = 0
        overdue_items = []
        for inv in overdue_queryset:
            received = sum(int(payment.amount) for payment in inv.payments.all())
            remaining = max(0, int(inv.final_amount) - received)
            overdue_amount += remaining
            if len(overdue_items) < 8:
                overdue_items.append({
                    'id': inv.id,
                    'invoice_number': inv.invoice_number,
                    'customer_name': inv.customer.name if inv.customer else '---',
                    'due_date': inv.due_date.isoformat(),
                    'remaining_amount': remaining,
                })

        # Total expenses
        total_expenses = Expense.objects.aggregate(t=Sum('amount'))['t'] or 0

        # Monthly revenue (last 6 months)
        monthly_revenue = []
        for i in range(5, -1, -1):
            absolute_month = now.year * 12 + now.month - 1 - i
            month_year, month_zero_indexed = divmod(absolute_month, 12)
            month_number = month_zero_indexed + 1
            month_start = now.replace(year=month_year, month=month_number, day=1, hour=0, minute=0, second=0, microsecond=0)
            next_absolute_month = absolute_month + 1
            next_year, next_zero_indexed = divmod(next_absolute_month, 12)
            month_end = month_start.replace(year=next_year, month=next_zero_indexed + 1)

            revenue = Invoice.objects.filter(
                Q(status='paid') | Q(commission_paid=True),
                date__gte=month_start,
                date__lt=month_end
            ).aggregate(total=Sum('commission_total'))['total'] or 0

            expense = Expense.objects.filter(
                date__gte=month_start.date(),
                date__lt=month_end.date()
            ).aggregate(total=Sum('amount'))['total'] or 0

            monthly_revenue.append({
                'month': f'{month_year:04d}-{month_number:02d}',
                'label': f'{month_number}/{month_year}',
                'revenue': int(revenue),
                'expense': int(expense),
                'profit': int(revenue) - int(expense),
            })

        # Top services
        from ..models import InvoiceItem
        top_services = list(
            InvoiceItem.objects.values('service_title_snapshot')
            .annotate(count=Count('id'), total=Sum('main_price'))
            .order_by('-count')[:5]
        )

        # Top customers
        top_customers = list(
            Invoice.objects.filter(Q(status='paid') | Q(commission_paid=True))
            .values('customer__name')
            .annotate(total=Sum('total_amount'), count=Count('id'))
            .order_by('-total')[:5]
        )

        # Recent invoices
        recent = Invoice.objects.select_related('customer').order_by('-date')[:8]
        recent_invoices = []
        for inv in recent:
            recent_invoices.append({
                'id': inv.id,
                'invoice_number': inv.invoice_number,
                'customer_name': inv.customer.name if inv.customer else '---',
                'total_amount': int(inv.total_amount),
                'status': inv.status,
                'status_display': inv.get_status_display(),
                'date': inv.date.isoformat(),
            })

        # Cheque stats
        upcoming_cheques = Cheque.objects.filter(
            status='pending',
            due_date__gte=today,
            due_date__lte=today + timedelta(days=10)
        ).select_related('customer').order_by('due_date')
        
        upcoming_cheques_data = []
        for chq in upcoming_cheques:
            upcoming_cheques_data.append({
                'id': chq.id,
                'cheque_number': chq.cheque_number,
                'bank_name': chq.bank_name,
                'amount': int(chq.amount),
                'due_date': chq.due_date.isoformat(),
                'type': chq.type,
                'customer_name': chq.customer.name if chq.customer else '---',
            })
            
        pending_incoming_cheques_amount = Cheque.objects.filter(
            type='incoming', status='pending'
        ).aggregate(t=Sum('amount'))['t'] or 0
        
        pending_outgoing_cheques_amount = Cheque.objects.filter(
            type='outgoing', status='pending'
        ).aggregate(t=Sum('amount'))['t'] or 0

        return Response({
            'total_customers': total_customers,
            'total_invoices': total_invoices,
            'total_revenue': int(total_revenue),
            'total_commission': int(total_commission),
            'total_expenses': int(total_expenses),
            'net_profit': int(total_revenue) - int(total_expenses),
            'pending_invoices': pending_count,
            'paid_invoices': paid_count,
            'overdue_invoices': overdue_count,
            'overdue_amount': overdue_amount,
            'overdue_items': overdue_items,
            'monthly_revenue': monthly_revenue,
            'top_services': top_services,
            'top_customers': top_customers,
            'recent_invoices': recent_invoices,
            'upcoming_cheques': upcoming_cheques_data,
            'pending_incoming_cheques_amount': int(pending_incoming_cheques_amount),
            'pending_outgoing_cheques_amount': int(pending_outgoing_cheques_amount),
        })

class StaffViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = StaffSerializer

    def get_queryset(self):
        qs = Staff.objects.all()
        active = self.request.query_params.get('active', '')
        if active == 'true':
            qs = qs.filter(is_active=True)
        return qs

    @action(detail=True, methods=['get'])
    def performance(self, request, pk=None):
        """Staff performance: how many items, total revenue"""
        staff = self.get_object()
        from ..models import InvoiceItem
        items = InvoiceItem.objects.filter(staff=staff).select_related('invoice')
        date_from = request.query_params.get('date_from', '')
        date_to = request.query_params.get('date_to', '')
        if date_from:
            items = items.filter(invoice__date__date__gte=date_from)
        if date_to:
            items = items.filter(invoice__date__date__lte=date_to)

        total_items = items.count()
        total_revenue = sum(
            (it.main_price + it.extra_price) * it.quantity for it in items
        )
        commission_earned = int(total_revenue * staff.commission_rate / 100)
        return Response({
            'staff_id': staff.id,
            'staff_name': staff.name,
            'total_items': total_items,
            'total_revenue': int(total_revenue),
            'commission_rate': float(staff.commission_rate),
            'commission_earned': commission_earned,
        })

class UserViewSet(viewsets.ModelViewSet):
    """
    Admin-only: manage operator/manager user accounts.
    GET    /api/users/         -> list all users
    POST   /api/users/         -> create new user
    PATCH  /api/users/{id}/    -> update user (name, password, role, active)
    DELETE /api/users/{id}/    -> delete user (cannot delete yourself)
    GET    /api/users/me/      -> current user info + role
    """
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return User.objects.all().order_by('id')

    def get_permissions(self):
        # Only superusers/admins can create/delete/list users
        # Everyone can read /me/
        if self.action == 'me':
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user == request.user:
            return Response(
                {'error': 'نمی‌توانید حساب خود را حذف کنید'},
                status=status.HTTP_400_BAD_REQUEST
            )
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Return current logged-in user info with role"""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    def set_role(self, request):
        """
        Quick role assignment.
        Body: { user_id, role: 'admin' | 'manager' | 'operator' }
        """
        user_id = request.data.get('user_id')
        role = request.data.get('role')
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'کاربر یافت نشد'}, status=404)

        if role == 'admin':
            user.is_superuser = True
            user.is_staff = True
        elif role == 'manager':
            user.is_superuser = False
            user.is_staff = True
        else:  # operator
            user.is_superuser = False
            user.is_staff = False
        user.save()
        return Response(UserSerializer(user).data)

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        qs = AuditLog.objects.select_related('user').all()
        object_type = self.request.query_params.get('object_type', '')
        object_id = self.request.query_params.get('object_id', '')
        if not (self.request.user.is_staff or self.request.user.is_superuser) and not (object_type and object_id):
            return AuditLog.objects.none()
        if object_type:
            qs = qs.filter(object_type=object_type)
        if object_id:
            qs = qs.filter(object_id=object_id)
        return qs[:500]
