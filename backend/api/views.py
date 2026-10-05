from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Sum, Count, Q
from django.db import transaction
from django.utils import timezone
from datetime import timedelta, date
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
import json, calendar, os, shutil

from .models import (
    Customer, Service, Invoice, InvoiceEditRequest, InvoicePayment, AuditLog, Document,
    BusinessProfile, ExpenseCategory, Expense, Staff, VehicleType, BackupConfig,
    Cheque
)
from .serializers import (
    CustomerListSerializer, CustomerDetailSerializer,
    ServiceSerializer, InvoiceSerializer, DocumentSerializer,
    BusinessProfileSerializer, ExpenseCategorySerializer,
    ExpenseSerializer, StaffSerializer, VehicleTypeSerializer,
    UserSerializer, BackupConfigSerializer, ChequeSerializer, InvoicePaymentSerializer, AuditLogSerializer
)
from .audit import snapshot, record_audit


class IsSuperuser(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class CustomerViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Customer.objects.all()
        search = self.request.query_params.get('search', '')
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(phone__icontains=search) |
                Q(email__icontains=search) |
                Q(national_id__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        customer = serializer.save()
        record_audit(user=self.request.user, instance=customer, action='create', after=snapshot(customer))

    def perform_update(self, serializer):
        before = snapshot(serializer.instance)
        customer = serializer.save()
        record_audit(user=self.request.user, instance=customer, action='update', before=before, after=snapshot(customer))

    def perform_destroy(self, instance):
        before = snapshot(instance)
        record_audit(user=self.request.user, instance=instance, action='delete', before=before)
        instance.delete()

    def get_serializer_class(self):
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return CustomerDetailSerializer
        return CustomerListSerializer

    @action(detail=True, methods=['get'])
    def invoices(self, request, pk=None):
        customer = self.get_object()
        invoices = Invoice.objects.filter(customer=customer).order_by('-date')
        serializer = InvoiceSerializer(invoices, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def search_by_vehicle(self, request):
        """Find customers by vehicle info"""
        plate = request.query_params.get('plate', '')
        vin = request.query_params.get('vin', '')
        qs = Invoice.objects.none()
        if plate:
            qs = Invoice.objects.filter(vehicle_plate__icontains=plate).select_related('customer')
        elif vin:
            qs = Invoice.objects.filter(vehicle_vin__icontains=vin).select_related('customer')

        results = []
        seen = set()
        for inv in qs:
            if inv.customer_id and inv.customer_id not in seen:
                seen.add(inv.customer_id)
                results.append({
                    'id': inv.customer.id,
                    'name': inv.customer.name,
                    'phone': inv.customer.phone,
                    'vehicle_plate': inv.vehicle_plate,
                    'vehicle_vin': inv.vehicle_vin,
                    'vehicle_model': inv.vehicle_model,
                })
        return Response(results)


class ServiceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ServiceSerializer

    def get_queryset(self):
        qs = Service.objects.all()
        active_only = self.request.query_params.get('active', None)
        if active_only == 'true':
            qs = qs.filter(is_active=True)
        return qs


class InvoiceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer

    def destroy(self, request, *args, **kwargs):
        invoice = self.get_object()
        if invoice.status == 'paid' and not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {'detail': 'حذف فاکتور پرداخت‌شده فقط برای مدیر مجاز است.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @transaction.atomic
    def perform_update(self, serializer):
        invoice = Invoice.objects.select_for_update().get(pk=serializer.instance.pk)
        serializer.instance = invoice
        edit_request = None
        if invoice.status == 'paid' and not (self.request.user.is_staff or self.request.user.is_superuser):
            edit_request = InvoiceEditRequest.objects.select_for_update().filter(
                invoice=invoice, requested_by=self.request.user, status='approved'
            ).first()
            if not edit_request:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('ویرایش فاکتور پرداخت‌شده نیاز به تأیید درخواست ویرایش توسط مدیر دارد.')
        before = snapshot(invoice)
        serializer.save()
        if edit_request:
            edit_request.status = 'used'
            edit_request.used_at = timezone.now()
            edit_request.save(update_fields=['status', 'used_at'])
        record_audit(user=self.request.user, instance=invoice, action='update', before=before, after=snapshot(invoice))

    def perform_create(self, serializer):
        invoice = serializer.save(created_by=self.request.user)
        record_audit(user=self.request.user, instance=invoice, action='create', after=snapshot(invoice))

    def perform_destroy(self, instance):
        before = snapshot(instance)
        record_audit(user=self.request.user, instance=instance, action='delete', before=before)
        instance.delete()

    def get_queryset(self):
        qs = Invoice.objects.select_related('customer', 'created_by').prefetch_related('items__service', 'payments', 'edit_requests')
        status_filter = self.request.query_params.get('status', '')
        customer_id = self.request.query_params.get('customer', '')
        search = self.request.query_params.get('search', '')
        date_from = self.request.query_params.get('date_from', '')
        date_to = self.request.query_params.get('date_to', '')
        overdue_only = self.request.query_params.get('overdue', '')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        if search:
            qs = qs.filter(
                Q(invoice_number__icontains=search) |
                Q(customer__name__icontains=search) |
                Q(vehicle_plate__icontains=search) |
                Q(vehicle_vin__icontains=search)
            )
        if date_from:
            qs = qs.filter(date__date__gte=date_from)
        if date_to:
            qs = qs.filter(date__date__lte=date_to)
        if overdue_only == 'true':
            today = date.today()
            qs = qs.filter(status='pending', due_date__lt=today)
        return qs.order_by('-created_at', '-id')

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def mark_paid(self, request, pk=None):
        invoice = Invoice.objects.select_for_update().get(pk=self.get_object().pk)
        before = snapshot(invoice)
        amount_paid = invoice.payments.aggregate(total=Sum('amount'))['total']
        already_paid = amount_paid if amount_paid is not None else (invoice.final_amount if invoice.status == 'paid' else 0)
        balance = max(0, int(invoice.final_amount - already_paid))
        payment = None
        if balance:
            payment = InvoicePayment.objects.create(invoice=invoice, amount=balance, method='other', note='ثبت پرداخت کامل از صفحه فاکتورها', created_by=request.user)
        invoice.status = 'paid'
        invoice.save()
        record_audit(user=request.user, instance=invoice, action='payment', before=before, after={**snapshot(invoice), 'payment': InvoicePaymentSerializer(payment).data if payment else None})
        return Response({'status': 'paid', 'message': 'فاکتور به عنوان پرداخت شده ثبت شد'})

    @action(detail=True, methods=['get', 'post'])
    def payments(self, request, pk=None):
        invoice = self.get_object()
        if request.method == 'GET':
            return Response(InvoicePaymentSerializer(invoice.payments.all(), many=True).data)
        if invoice.status == 'paid' and not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': 'اپراتور اجازهٔ تغییر پرداخت‌های فاکتور پرداخت‌شده را ندارد.'}, status=status.HTTP_403_FORBIDDEN)

        amount = request.data.get('amount')
        try:
            amount = int(amount)
        except (TypeError, ValueError):
            return Response({'amount': 'مبلغ پرداخت باید عدد مثبت باشد.'}, status=400)
        if amount <= 0:
            return Response({'amount': 'مبلغ پرداخت باید بیشتر از صفر باشد.'}, status=400)
        if invoice.status in ['cancelled', 'draft']:
            return Response({'detail': 'برای این وضعیت فاکتور امکان ثبت پرداخت وجود ندارد.'}, status=400)

        with transaction.atomic():
            invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
            before = snapshot(invoice)
            recorded = invoice.payments.aggregate(total=Sum('amount'))['total']
            already_paid = recorded if recorded is not None else (invoice.final_amount if invoice.status == 'paid' else 0)
            remaining = max(0, int(invoice.final_amount - already_paid))
            if amount > remaining:
                return Response({'amount': f'مبلغ پرداخت از ماندهٔ فاکتور ({remaining}) بیشتر است.'}, status=400)
            serializer = InvoicePaymentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            payment = serializer.save(invoice=invoice, created_by=request.user)
            new_paid_total = int(already_paid) + amount
            if new_paid_total >= invoice.final_amount:
                invoice.status = 'paid'
                invoice.save(update_fields=['status', 'updated_at'])
            record_audit(user=request.user, instance=invoice, action='payment', before=before, after={**snapshot(invoice), 'payment': InvoicePaymentSerializer(payment).data})
        return Response(InvoicePaymentSerializer(payment).data, status=201)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'payments/(?P<payment_id>[^/.]+)')
    def payment_detail(self, request, pk=None, payment_id=None):
        with transaction.atomic():
            invoice = Invoice.objects.select_for_update().get(pk=self.get_object().pk)
            if invoice.status == 'paid' and not (request.user.is_staff or request.user.is_superuser):
                return Response({'detail': 'اپراتور اجازهٔ تغییر پرداخت‌های فاکتور پرداخت‌شده را ندارد.'}, status=status.HTTP_403_FORBIDDEN)
            payment = get_object_or_404(InvoicePayment.objects.select_for_update(), pk=payment_id, invoice=invoice)
            before_invoice = snapshot(invoice)
            before_payment = InvoicePaymentSerializer(payment).data

            if request.method == 'DELETE':
                payment.delete()
                operation = 'deleted'
                after_payment = None
            else:
                serializer = InvoicePaymentSerializer(payment, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                new_amount = serializer.validated_data.get('amount', payment.amount)
                if new_amount <= 0:
                    return Response({'amount': 'مبلغ پرداخت باید بیشتر از صفر باشد.'}, status=400)
                other_payments = invoice.payments.exclude(pk=payment.pk).aggregate(total=Sum('amount'))['total'] or 0
                if other_payments + new_amount > invoice.final_amount:
                    balance_limit = max(0, int(invoice.final_amount - other_payments))
                    return Response({'amount': f'مبلغ از ماندهٔ قابل ثبت ({balance_limit}) بیشتر است.'}, status=400)
                payment = serializer.save()
                operation = 'updated'
                after_payment = InvoicePaymentSerializer(payment).data

            if invoice.status not in ['cancelled', 'draft']:
                total_paid = invoice.payments.aggregate(total=Sum('amount'))['total'] or 0
                invoice.status = 'paid' if total_paid >= invoice.final_amount else 'pending'
                invoice.save(update_fields=['status', 'updated_at'])

            record_audit(
                user=request.user,
                instance=invoice,
                action='payment',
                before={**before_invoice, 'payment': before_payment},
                after={**snapshot(invoice), 'payment': after_payment, 'payment_operation': operation,
                       'removed_payment': before_payment if operation == 'deleted' else None},
            )

        if request.method == 'DELETE':
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(InvoicePaymentSerializer(payment).data)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        invoice = self.get_object()
        logs = AuditLog.objects.filter(object_type='invoice', object_id=str(invoice.pk))
        return Response(AuditLogSerializer(logs, many=True).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status == 'paid' and not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': 'لغو فاکتور پرداخت‌شده فقط برای مدیر مجاز است.'}, status=status.HTTP_403_FORBIDDEN)
        before = snapshot(invoice)
        invoice.status = 'cancelled'
        invoice.save()
        record_audit(user=request.user, instance=invoice, action='update', before=before, after=snapshot(invoice))
        return Response({'status': 'cancelled', 'message': 'فاکتور لغو شد'})

    @action(detail=True, methods=['patch'])
    def change_status(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status == 'paid' and not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': 'تغییر وضعیت فاکتور پرداخت‌شده فقط برای مدیر مجاز است.'}, status=status.HTTP_403_FORBIDDEN)
        new_status = request.data.get('status')
        valid = [s[0] for s in Invoice.STATUS_CHOICES]
        if new_status not in valid:
            return Response({'error': 'وضعیت نامعتبر'}, status=400)
        before = snapshot(invoice)
        invoice.status = new_status
        invoice.save()
        record_audit(user=request.user, instance=invoice, action='update', before=before, after=snapshot(invoice))
        serializer = self.get_serializer(invoice)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='request-edit')
    def request_edit(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status != 'paid':
            return Response({'detail': 'درخواست مجوز فقط برای فاکتور پرداخت‌شده لازم است.'}, status=400)
        if request.user.is_staff or request.user.is_superuser:
            return Response({'detail': 'مدیران برای ویرایش این فاکتور نیازی به درخواست ندارند.'}, status=400)
        existing = invoice.edit_requests.filter(requested_by=request.user, status__in=['pending', 'approved']).first()
        if existing:
            edit_request = existing
            created = False
        else:
            edit_request = InvoiceEditRequest.objects.create(invoice=invoice, requested_by=request.user)
            created = True
            record_audit(user=request.user, instance=invoice, action='approval', after={'event': 'edit_requested', 'request_id': edit_request.id, 'requested_by': request.user.username})
        return Response({'id': edit_request.id, 'status': edit_request.status, 'created_at': edit_request.created_at}, status=201 if created else 200)

    @action(detail=False, methods=['get'], url_path='edit-requests')
    def edit_requests(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': 'فقط مدیران می‌توانند درخواست‌ها را بررسی کنند.'}, status=403)
        requests = InvoiceEditRequest.objects.filter(status='pending').select_related('invoice', 'invoice__customer', 'requested_by').order_by('created_at')
        return Response([{
            'id': item.id,
            'invoice_id': item.invoice_id,
            'invoice_number': item.invoice.invoice_number,
            'customer_name': item.invoice.customer.name if item.invoice.customer else '',
            'requested_by': item.requested_by.get_full_name() or item.requested_by.username,
            'created_at': item.created_at,
        } for item in requests])

    @action(detail=True, methods=['post'], url_path='review-edit-request')
    def review_edit_request(self, request, pk=None):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': 'فقط مدیران می‌توانند درخواست را بررسی کنند.'}, status=403)
        invoice = self.get_object()
        if invoice.status != 'paid':
            return Response({'detail': 'این فاکتور دیگر در وضعیت پرداخت‌شده نیست.'}, status=400)
        edit_request = InvoiceEditRequest.objects.filter(pk=request.data.get('request_id'), invoice=invoice, status='pending').first()
        if not edit_request:
            return Response({'detail': 'درخواست در انتظار بررسی برای این فاکتور یافت نشد.'}, status=404)
        decision = request.data.get('decision')
        if decision not in ['approve', 'reject']:
            return Response({'detail': 'تصمیم باید approve یا reject باشد.'}, status=400)
        edit_request.status = 'approved' if decision == 'approve' else 'rejected'
        edit_request.reviewed_by = request.user
        edit_request.reviewed_at = timezone.now()
        edit_request.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])
        record_audit(user=request.user, instance=invoice, action='approval', before={'request_id': edit_request.id, 'status': 'pending'}, after={'request_id': edit_request.id, 'status': edit_request.status, 'reviewed_by': request.user.username})
        return Response({'id': edit_request.id, 'status': edit_request.status})

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Return overdue invoices"""
        today = date.today()
        qs = Invoice.objects.filter(
            status='pending', due_date__lt=today
        ).select_related('customer').order_by('due_date')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def report(self, request):
        """Financial report with date filtering"""
        date_from = request.query_params.get('date_from', '')
        date_to = request.query_params.get('date_to', '')
        qs = Invoice.objects.all()
        if date_from:
            qs = qs.filter(date__date__gte=date_from)
        if date_to:
            qs = qs.filter(date__date__lte=date_to)

        total_revenue = 0
        total_commission = 0
        for invoice in qs.prefetch_related('payments'):
            paid_total = sum(int(payment.amount) for payment in invoice.payments.all())
            if paid_total:
                total_revenue += paid_total
            elif invoice.status == 'paid':
                # Legacy paid invoices predate individual payment records.
                total_revenue += int(invoice.final_amount)
            if invoice.status == 'paid':
                total_commission += int(invoice.commission_total)
        pending_amount = 0
        for invoice in qs.filter(status='pending').prefetch_related('payments'):
            paid_total = sum(int(payment.amount) for payment in invoice.payments.all())
            pending_amount += max(0, int(invoice.final_amount) - paid_total)

        by_status = {}
        for s, label in Invoice.STATUS_CHOICES:
            status_invoices = qs.filter(status=s).prefetch_related('payments')
            count = status_invoices.count()
            if s == 'pending':
                amount = sum(max(0, int(inv.final_amount) - sum(int(payment.amount) for payment in inv.payments.all())) for inv in status_invoices)
            else:
                amount = sum(int(inv.final_amount) for inv in status_invoices)
            by_status[s] = {'label': label, 'count': count, 'amount': int(amount)}

        invoices = self.get_serializer(qs.order_by('-date')[:100], many=True).data

        return Response({
            'total_revenue': int(total_revenue),
            'total_commission': int(total_commission),
            'pending_amount': int(pending_amount),
            'total_count': qs.count(),
            'by_status': by_status,
            'invoices': invoices,
        })

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """Export invoices as CSV"""
        import csv
        from django.http import HttpResponse
        qs = Invoice.objects.select_related('customer').all().order_by('-date')
        date_from = request.query_params.get('date_from', '')
        date_to = request.query_params.get('date_to', '')
        if date_from:
            qs = qs.filter(date__date__gte=date_from)
        if date_to:
            qs = qs.filter(date__date__lte=date_to)

        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = 'attachment; filename="invoices.csv"'
        # BOM for Excel UTF-8
        response.write('\ufeff')
        writer = csv.writer(response)
        writer.writerow(['شماره فاکتور', 'مشتری', 'تاریخ', 'مبلغ کل', 'کارمزد', 'تخفیف', 'مالیات', 'وضعیت'])
        for inv in qs:
            writer.writerow([
                inv.invoice_number,
                inv.customer.name if inv.customer else '',
                inv.date.strftime('%Y-%m-%d') if inv.date else '',
                int(inv.total_amount),
                int(inv.commission_total),
                int(inv.discount),
                float(inv.tax),
                inv.get_status_display(),
            ])
        return response

    @action(detail=False, methods=['post'])
    def quick_create(self, request):
        """
        Quick invoice creation with auto-customer.
        Accepts customer_name (string) — finds or creates the customer.
        Body: {
            customer_name: str,
            customer_phone: str (optional),
            status: str (default: 'pending'),
            items: [{ service_title_snapshot, quantity, main_price, extra_price, notes }],
            discount, tax, commission_total, description, vehicle_plate, ...
        }
        """
        data = request.data
        customer_name = (data.get('customer_name') or '').strip()
        customer_phone = (data.get('customer_phone') or '').strip()

        if not customer_name:
            return Response({'error': 'نام مشتری الزامی است'}, status=400)

        items_data = data.get('items', [])
        if not items_data:
            return Response({'error': 'حداقل یک ردیف خدمات لازم است'}, status=400)

        # Find or create customer
        customer = None
        if customer_phone:
            customer = Customer.objects.filter(phone=customer_phone).first()
        if not customer:
            customer = Customer.objects.filter(name__iexact=customer_name).first()
        if not customer:
            customer = Customer.objects.create(
                name=customer_name,
                phone=customer_phone or '',
            )

        # Calculate total
        total = 0
        for item in items_data:
            qty = int(item.get('quantity', 1))
            mp = int(item.get('main_price', 0))
            ep = int(item.get('extra_price', 0))
            total += (mp + ep) * qty

        # Create invoice
        invoice = Invoice.objects.create(
            customer=customer,
            created_by=request.user,
            status=data.get('status', 'pending'),
            description=data.get('description', ''),
            discount=int(data.get('discount', 0)),
            tax=float(data.get('tax', 0)),
            commission_total=int(data.get('commission_total', 0)),
            total_amount=total,
            paper_size=data.get('paper_size', 'a5'),
            vehicle_plate=data.get('vehicle_plate', ''),
            vehicle_vin=data.get('vehicle_vin', ''),
            vehicle_model=data.get('vehicle_model', ''),
            vehicle_type=data.get('vehicle_type', ''),
            tags=data.get('tags', []),
        )

        # Create items
        from .models import InvoiceItem as II
        for item in items_data:
            svc_id = item.get('service')
            svc = None
            svc_title = item.get('service_title_snapshot', '')
            if svc_id:
                try:
                    svc = Service.objects.get(id=svc_id)
                    if not svc_title:
                        svc_title = svc.title
                except Service.DoesNotExist:
                    pass

            II.objects.create(
                invoice=invoice,
                service=svc,
                service_title_snapshot=svc_title,
                quantity=int(item.get('quantity', 1)),
                main_price=int(item.get('main_price', 0)),
                extra_price=int(item.get('extra_price', 0)),
                commission=int(item.get('commission', 0)),
                notes=item.get('notes', ''),
            )

        record_audit(user=request.user, instance=invoice, action='create', after=snapshot(invoice))
        serializer = self.get_serializer(invoice)
        return Response({
            'invoice': serializer.data,
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'phone': customer.phone,
                'is_new': customer.created_at.date() == date.today(),
            },
            'message': f'فاکتور {invoice.invoice_number} با موفقیت صادر شد',
        }, status=201)



class DocumentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = DocumentSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        qs = Document.objects.all().order_by('-uploaded_at')
        customer_id = self.request.query_params.get('customer', '')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def perform_create(self, serializer):
        """Save file and also copy to customer folder if path configured"""
        doc = serializer.save()
        self._sync_to_customer_folder(doc)
        record_audit(user=self.request.user, instance=doc, action='create', after={'customer_id': doc.customer_id, 'filename': os.path.basename(doc.file.name) if doc.file else ''})

    def perform_update(self, serializer):
        before = {'customer_id': serializer.instance.customer_id, 'filename': os.path.basename(serializer.instance.file.name) if serializer.instance.file else ''}
        doc = serializer.save()
        self._sync_to_customer_folder(doc)
        record_audit(user=self.request.user, instance=doc, action='update', before=before, after={'customer_id': doc.customer_id, 'filename': os.path.basename(doc.file.name) if doc.file else ''})

    def perform_destroy(self, instance):
        record_audit(user=self.request.user, instance=instance, action='delete', before={'customer_id': instance.customer_id, 'filename': os.path.basename(instance.file.name) if instance.file else ''})
        instance.delete()

    def _sync_to_customer_folder(self, doc):
        """Copy file to customer-specific folder on disk if configured"""
        try:
            profile = BusinessProfile.load()
            base_path = profile.customer_documents_path
            if not base_path or not os.path.isdir(base_path):
                return
            customer = doc.customer
            # folder name: {id}_{name}
            folder_name = f"{customer.id}_{customer.name}".replace('/', '_').replace('\\', '_')
            folder_path = os.path.join(base_path, folder_name)
            os.makedirs(folder_path, exist_ok=True)
            if doc.file and hasattr(doc.file, 'path') and os.path.exists(doc.file.path):
                dest = os.path.join(folder_path, os.path.basename(doc.file.name))
                if not os.path.exists(dest):
                    shutil.copy2(doc.file.path, dest)
                doc.file_path = dest
                Document.objects.filter(pk=doc.pk).update(file_path=dest)
        except Exception:
            pass

    @action(detail=False, methods=['get'])
    def customer_folder_files(self, request):
        """List files in customer's physical folder"""
        customer_id = request.query_params.get('customer', '')
        if not customer_id:
            return Response({'error': 'customer param required'}, status=400)
        try:
            customer = Customer.objects.get(pk=customer_id)
            profile = BusinessProfile.load()
            base_path = profile.customer_documents_path
            if not base_path:
                return Response({'files': [], 'folder': ''})
            folder_name = f"{customer.id}_{customer.name}".replace('/', '_').replace('\\', '_')
            folder_path = os.path.join(base_path, folder_name)
            if not os.path.isdir(folder_path):
                return Response({'files': [], 'folder': folder_path})
            files = []
            for f in os.listdir(folder_path):
                fp = os.path.join(folder_path, f)
                if os.path.isfile(fp):
                    files.append({
                        'name': f,
                        'path': fp,
                        'size': os.path.getsize(fp),
                        'modified': os.path.getmtime(fp),
                    })
            return Response({'files': files, 'folder': folder_path})
        except Customer.DoesNotExist:
            return Response({'error': 'customer not found'}, status=404)


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
        """Save to an explicit server path or return a downloadable backup."""
        cfg = BackupConfig.load()
        backup_path = (request.data.get('path') or '').strip()
        from .backup_utils import build_backup
        json_str = json.dumps(build_backup(), ensure_ascii=False, indent=2, default=str)
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

    @action(detail=False, methods=['get'])
    def check_auto(self, request):
        """Check if auto backup is due and run it"""
        if not request.user.is_superuser:
            return Response({'ran': False, 'reason': 'admin only'}, status=403)
        cfg = BackupConfig.load()
        if not cfg.auto_backup or not cfg.backup_path:
            return Response({'ran': False, 'reason': 'auto backup disabled or path not set'})

        now = timezone.localtime()
        if now.hour < cfg.backup_hour:
            return Response({'ran': False, 'reason': f'waiting for backup hour ({cfg.backup_hour})'})
        if cfg.backup_frequency == 'weekly' and now.weekday() != 0:
            return Response({'ran': False, 'reason': 'weekly backup runs on Monday'})
        if not os.path.isdir(cfg.backup_path):
            # A scheduled check is a status poll. A missing destination means
            # no backup ran, but it is not a malformed API request.
            return Response({'ran': False, 'reason': 'backup path does not exist'})

        # Check if already backed up today
        if cfg.last_backup_at:
            last_local = timezone.localtime(cfg.last_backup_at)
            if cfg.backup_frequency == 'weekly':
                same_week = last_local.isocalendar()[:2] == now.isocalendar()[:2]
                if same_week:
                    return Response({'ran': False, 'reason': 'already backed up this week'})
            elif last_local.date() == now.date():
                return Response({'ran': False, 'reason': 'already backed up today'})

        # Run backup
        from .backup_utils import build_backup
        json_str = json.dumps(build_backup(), ensure_ascii=False, indent=2, default=str)
        filename = f"mohaseb_backup_{timezone.now().strftime('%Y%m%d_%H%M%S')}.json"
        return self._save_backup_to_path(cfg, cfg.backup_path, filename, json_str)


class BusinessProfileViewSet(viewsets.ViewSet):
    """Singleton business profile / branding settings"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def list(self, request):
        profile = BusinessProfile.load()
        serializer = BusinessProfileSerializer(profile, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['put', 'patch'])
    def update_profile(self, request):
        profile = BusinessProfile.load()
        serializer = BusinessProfileSerializer(
            profile, data=request.data, partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ExpenseCategorySerializer
    queryset = ExpenseCategory.objects.all()


class ExpenseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ExpenseSerializer

    def perform_create(self, serializer):
        expense = serializer.save()
        record_audit(user=self.request.user, instance=expense, action='create', after=snapshot(expense))

    def perform_update(self, serializer):
        before = snapshot(serializer.instance)
        expense = serializer.save()
        record_audit(user=self.request.user, instance=expense, action='update', before=before, after=snapshot(expense))

    def perform_destroy(self, instance):
        before = snapshot(instance)
        record_audit(user=self.request.user, instance=instance, action='delete', before=before)
        instance.delete()

    def get_queryset(self):
        qs = Expense.objects.select_related('category').all()
        cat = self.request.query_params.get('category', '')
        date_from = self.request.query_params.get('date_from', '')
        date_to = self.request.query_params.get('date_to', '')
        if cat:
            qs = qs.filter(category_id=cat)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Monthly expense summary"""
        date_from = request.query_params.get('date_from', '')
        date_to = request.query_params.get('date_to', '')
        qs = Expense.objects.all()
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        total = qs.aggregate(t=Sum('amount'))['t'] or 0
        by_category = list(
            qs.values('category__name', 'category__icon', 'category__color')
            .annotate(total=Sum('amount'), count=Count('id'))
            .order_by('-total')
        )
        return Response({
            'total': int(total),
            'by_category': by_category,
        })


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
        from .models import InvoiceItem
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


class BackupViewSet(viewsets.ViewSet):
    """Backup and restore all data"""
    permission_classes = [IsSuperuser]

    @action(detail=False, methods=['get'])
    def download(self, request):
        """Download full backup as JSON"""
        from .backup_utils import build_backup
        from django.http import HttpResponse
        json_str = json.dumps(build_backup(), ensure_ascii=False, indent=2, default=str)
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
            from .backup_utils import restore_backup, validate_backup
            counts = validate_backup(backup)
            if request.data.get('confirm_replace') is not True:
                return Response({'valid': True, 'counts': counts, 'requires_confirmation': True})
            restore_backup(backup, fallback_user_id=request.user.pk)
            return Response({'valid': True, 'restored': True, 'counts': counts})
        except Exception as error:
            return Response({'detail': str(error) or 'بازیابی نسخهٔ پشتیبان انجام نشد.'}, status=400)


class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        now = timezone.now()
        today = date.today()

        total_customers = Customer.objects.count()
        total_invoices = Invoice.objects.count()
        total_revenue = Invoice.objects.filter(status='paid').aggregate(
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
            month_date = now - timedelta(days=30 * i)
            month_start = month_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if month_date.month == 12:
                month_end = month_date.replace(year=month_date.year + 1, month=1, day=1)
            else:
                month_end = month_date.replace(month=month_date.month + 1, day=1)

            revenue = Invoice.objects.filter(
                status='paid',
                date__gte=month_start,
                date__lt=month_end
            ).aggregate(total=Sum('commission_total'))['total'] or 0

            expense = Expense.objects.filter(
                date__gte=month_start.date(),
                date__lt=month_end.date()
            ).aggregate(total=Sum('amount'))['total'] or 0

            monthly_revenue.append({
                'month': month_date.strftime('%Y-%m'),
                'label': f'{month_date.month}/{month_date.year}',
                'revenue': int(revenue),
                'expense': int(expense),
                'profit': int(revenue) - int(expense),
            })

        # Top services
        from .models import InvoiceItem
        top_services = list(
            InvoiceItem.objects.values('service_title_snapshot')
            .annotate(count=Count('id'), total=Sum('main_price'))
            .order_by('-count')[:5]
        )

        # Top customers
        top_customers = list(
            Invoice.objects.filter(status='paid')
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


class VehicleTypeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = VehicleTypeSerializer
    queryset = VehicleType.objects.all()


class ChequeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ChequeSerializer

    def get_queryset(self):
        qs = Cheque.objects.select_related('customer').all()
        status_filter = self.request.query_params.get('status', '')
        type_filter = self.request.query_params.get('type', '')
        search = self.request.query_params.get('search', '')
        date_from = self.request.query_params.get('date_from', '')
        date_to = self.request.query_params.get('date_to', '')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if type_filter:
            qs = qs.filter(type=type_filter)
        if search:
            qs = qs.filter(
                Q(cheque_number__icontains=search) |
                Q(bank_name__icontains=search) |
                Q(customer__name__icontains=search)
            )
        if date_from:
            qs = qs.filter(due_date__gte=date_from)
        if date_to:
            qs = qs.filter(due_date__lte=date_to)
        
        return qs


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
