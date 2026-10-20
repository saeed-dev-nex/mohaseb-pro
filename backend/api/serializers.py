from rest_framework import serializers
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from .models import (
    Customer, Service, Invoice, InvoiceItem, InvoicePayment, AuditLog, Document,
    BusinessProfile, ExpenseCategory, Expense, Staff, VehicleType, BackupConfig,
    Cheque, InvoiceSettings, ChatMessage, SocialNetwork
)


class SafeTokenRefreshSerializer(TokenRefreshSerializer):
    """Treat refresh tokens for deleted users as invalid instead of a 500."""

    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except ObjectDoesNotExist:
            # SimpleJWT looks up the token's user after validating its signature.
            # A user may have been removed since the token was issued.
            raise InvalidToken("Token is invalid or expired")


class UserSerializer(serializers.ModelSerializer):
    """Serializer for operator user management (admin-only)"""
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email',
                  'is_active', 'is_staff', 'is_superuser', 'role', 'password', 'date_joined']
        read_only_fields = ['date_joined']

    def get_role(self, obj):
        if obj.is_superuser:
            return 'admin'
        elif obj.is_staff:
            return 'manager'
        return 'operator'

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class DocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = ['id', 'customer', 'invoice', 'title', 'file', 'file_url', 'description', 'tags', 'file_path', 'uploaded_at', 'updated_at']
        read_only_fields = ['uploaded_at', 'updated_at', 'file_url']

    def get_file_url(self, obj):
        if obj.file and hasattr(obj.file, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class BackupConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = BackupConfig
        fields = ['backup_path', 'auto_backup', 'backup_frequency', 'backup_hour', 'last_backup_at', 'last_backup_path']
        read_only_fields = ['last_backup_at', 'last_backup_path']


class InvoiceSettingsSerializer(serializers.ModelSerializer):
    office_card_fee_threshold = serializers.DecimalField(max_digits=15, decimal_places=0, min_value=0)

    class Meta:
        model = InvoiceSettings
        fields = ['office_card_fee_threshold', 'show_discount_field', 'show_tax_field']


class ChatMessageSerializer(serializers.ModelSerializer):
    sender = serializers.IntegerField(source='sender_id', read_only=True)
    sender_name = serializers.SerializerMethodField()
    recipient = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True), required=False, allow_null=True)
    recipient_name = serializers.SerializerMethodField()
    file = serializers.FileField(write_only=True, required=False, allow_null=True)
    file_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = ['id', 'sender', 'sender_name', 'recipient', 'recipient_name', 'text', 'file', 'file_name', 'file_url', 'created_at']
        read_only_fields = ['id', 'sender', 'sender_name', 'file_name', 'file_url', 'created_at']

    def get_sender_name(self, obj):
        return obj.sender.get_full_name().strip() or obj.sender.username

    def get_recipient_name(self, obj):
        if not obj.recipient:
            return 'همهٔ کاربران'
        return obj.recipient.get_full_name().strip() or obj.recipient.username

    def get_file_name(self, obj):
        return obj.file.name.rsplit('/', 1)[-1] if obj.file else ''

    def get_file_url(self, obj):
        if not obj.file:
            return ''
        request = self.context.get('request')
        if not request:
            return ''
        from rest_framework.reverse import reverse
        return reverse('chat-download', args=[obj.pk], request=request)

    def validate_file(self, value):
        if value and value.size > 20 * 1024 * 1024:
            raise serializers.ValidationError('حداکثر حجم فایل پیوست ۲۰ مگابایت است.')
        return value

    def validate_text(self, value):
        if len(value) > 5000:
            raise serializers.ValidationError('حداکثر طول پیام ۵۰۰۰ نویسه است.')
        return value

    def validate(self, attrs):
        if not (attrs.get('text') or '').strip() and not attrs.get('file'):
            raise serializers.ValidationError('متن پیام یا یک فایل پیوست کنید.')
        return attrs


class CustomerListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views (also handles create/update)"""
    total_invoices = serializers.SerializerMethodField(read_only=True)
    total_paid = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone', 'email', 'national_id',
            'address', 'notes', 'created_at',
            'total_invoices', 'total_paid',
        ]
        read_only_fields = ['created_at', 'total_invoices', 'total_paid']

    def get_total_invoices(self, obj):
        return obj.invoice_set.count()

    def get_total_paid(self, obj):
        total = 0
        for invoice in obj.invoice_set.all().prefetch_related('payments'):
            payments = list(invoice.payments.all())
            if payments:
                total += sum(int(payment.amount) for payment in payments)
            elif invoice.status == 'paid':
                total += int(invoice.final_amount)
        return total

    def validate_national_id(self, value):
        """Convert empty string to None to avoid duplicate-empty-string issues"""
        if value == '':
            return None
        return value

    def validate_phone(self, value):
        """Convert empty string to None"""
        if value == '':
            return None
        return value

    def validate_email(self, value):
        """Convert empty string to None"""
        if value == '':
            return None
        return value


class CustomerDetailSerializer(serializers.ModelSerializer):
    """Full serializer with documents for detail view (also used for create/update)"""
    documents = DocumentSerializer(many=True, read_only=True)
    total_invoices = serializers.SerializerMethodField(read_only=True)
    total_paid = serializers.SerializerMethodField(read_only=True)
    total_pending = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone', 'email', 'address',
            'national_id', 'notes', 'created_at', 'updated_at',
            'documents', 'total_invoices', 'total_paid', 'total_pending'
        ]
        read_only_fields = ['created_at', 'updated_at', 'documents', 'total_invoices', 'total_paid', 'total_pending']

    def get_total_invoices(self, obj):
        return obj.invoice_set.count()

    def get_total_paid(self, obj):
        total = 0
        for invoice in obj.invoice_set.all().prefetch_related('payments'):
            payments = list(invoice.payments.all())
            if payments:
                total += sum(int(payment.amount) for payment in payments)
            elif invoice.status == 'paid':
                total += int(invoice.final_amount)
        return total

    def get_total_pending(self, obj):
        total = 0
        for invoice in obj.invoice_set.filter(status='pending').all().prefetch_related('payments'):
            recorded = sum(int(payment.amount) for payment in invoice.payments.all())
            total += max(0, int(invoice.final_amount) - recorded)
        return total

    def validate_national_id(self, value):
        if value == '':
            return None
        return value

    def validate_phone(self, value):
        if value == '':
            return None
        return value

    def validate_email(self, value):
        if value == '':
            return None
        return value


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = [
            'id', 'title', 'description', 'has_extra', 'extra_label',
            'default_main_price', 'default_extra_price',
            'default_commission', 'commission_label',
            'is_active', 'created_at'
        ]
        read_only_fields = ['created_at']


class InvoiceItemSerializer(serializers.ModelSerializer):
    service_title = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()
    line_commission = serializers.SerializerMethodField()
    # Explicitly mark service as optional + nullable so manually-typed rows
    # (where the user types a title but doesn't pick from the service list)
    # don't cause a 400 validation error.
    service = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = InvoiceItem
        fields = [
            'id', 'service', 'service_title', 'service_title_snapshot',
            'quantity', 'main_price', 'extra_price', 'commission',
            'notes', 'line_total', 'line_commission', 'is_office_card_fee'
        ]
        read_only_fields = ['is_office_card_fee']

    def get_service_title(self, obj):
        return obj.service_title_snapshot or (obj.service.title if obj.service else '---')

    def get_line_total(self, obj):
        return int((obj.main_price + obj.extra_price) * obj.quantity)

    def get_line_commission(self, obj):
        return int(obj.commission * obj.quantity)


class InvoicePaymentSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = InvoicePayment
        fields = ['id', 'amount', 'method', 'method_display', 'reference', 'note', 'paid_at', 'created_by_name']

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ''
        return obj.created_by.get_full_name() or obj.created_by.username


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'object_type', 'object_id', 'object_label', 'action', 'action_display', 'changes', 'created_at', 'user_name']

    def get_user_name(self, obj):
        if not obj.user:
            return 'کاربر حذف‌شده'
        return obj.user.get_full_name() or obj.user.username


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True)
    payments = InvoicePaymentSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    operator_name = serializers.SerializerMethodField()
    paid_by_name = serializers.SerializerMethodField()
    final_amount = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    edit_request_status = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    # Make financial fields optional with defaults so missing fields don't cause 400s
    commission_total = serializers.DecimalField(
        max_digits=15, decimal_places=0, required=False, default=0
    )
    discount = serializers.DecimalField(
        max_digits=15, decimal_places=0, required=False, default=0
    )
    tax = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, default=0
    )

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'customer', 'customer_name', 'operator_name', 'paid_by_name',
            'card_payment_source',
            'date', 'due_date', 'description', 'total_amount',
            'commission_total', 'discount', 'tax', 'status', 'status_display',
            'commission_paid',
            'paper_size', 'final_amount', 'items', 'created_at', 'updated_at',
            'edit_request_status', 'can_edit', 'payments', 'paid_amount', 'remaining_amount',
            # vehicle / custom fields
            'vehicle_plate', 'vehicle_vin', 'vehicle_model', 'vehicle_type',
            'vehicle_year', 'custom_fields', 'created_by',
            'green_card_owner_name', 'green_card_owner_national_id',
        ]
        read_only_fields = ['invoice_number', 'created_at', 'updated_at', 'created_by']


    def get_operator_name(self, obj):
      if not obj.created_by: return ''
      return obj.created_by.get_full_name() or obj.created_by.username

    def get_status_display(self, obj):
      return 'کارمزد پرداخت شده' if obj.commission_paid else obj.get_status_display()

    def get_paid_by_name(self, obj):
      if not obj.paid_by: return ''
      return obj.paid_by.get_full_name() or obj.paid_by.username

    def get_edit_request_status(self, obj):
      request = self.context.get('request')
      if not request or not request.user.is_authenticated:
          return None
      edit_request = obj.edit_requests.filter(requested_by=request.user).order_by('-created_at', '-pk').first()
      return edit_request.status if edit_request else None

    def get_can_edit(self, obj):
      request = self.context.get('request')
      if not request or not request.user.is_authenticated:
          return False
      if obj.status != 'paid' or request.user.is_staff or request.user.is_superuser:
          return True
      return obj.edit_requests.filter(requested_by=request.user, status='approved').exists()

    def get_final_amount(self, obj):
      tax_amount = (obj.total_amount * obj.tax) / 100
      return int(obj.total_amount + tax_amount - obj.discount + obj.commission_total)

    def get_paid_amount(self, obj):
      from django.db.models import Sum
      recorded = obj.payments.aggregate(total=Sum('amount'))['total']
      if recorded is not None:
          return int(recorded)
      return int(obj.final_amount) if obj.status == 'paid' else 0

    def get_remaining_amount(self, obj):
      return max(0, self.get_final_amount(obj) - self.get_paid_amount(obj))

    def _calc_total(self, items_data):
        total = 0
        for item_data in items_data:
            qty = item_data.get('quantity', 1)
            mp = item_data.get('main_price', 0)
            ep = item_data.get('extra_price', 0)
            total += (int(mp) + int(ep)) * int(qty)
        return total

    def _sync_office_card_fee(self, invoice, items_total):
        """Rebuild the generated office-card fee row from trusted invoice data."""
        InvoiceItem.objects.filter(invoice=invoice, is_office_card_fee=True).delete()
        threshold = int(InvoiceSettings.load().office_card_fee_threshold or 0)
        fee = 0
        if invoice.card_payment_source == 'office' and threshold > 0 and items_total > threshold:
            # 10,000 toman for each 1,000,000 toman, prorated to whole toman.
            fee = (int(items_total) * 10_000) // 1_000_000
            if fee:
                InvoiceItem.objects.create(
                    invoice=invoice,
                    service_title_snapshot='واریزی',
                    quantity=1,
                    main_price=fee,
                    extra_price=0,
                    commission=0,
                    is_office_card_fee=True,
                )
        invoice.total_amount = int(items_total) + fee
        invoice.save(update_fields=['total_amount', 'updated_at'])

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        # commission_total comes directly from validated_data (manual input)
        invoice = Invoice.objects.create(**validated_data)
        total = self._calc_total(items_data)
        for item_data in items_data:
            svc = item_data.get('service')
            if svc and not item_data.get('service_title_snapshot'):
                item_data['service_title_snapshot'] = svc.title
            InvoiceItem.objects.create(invoice=invoice, **item_data)
        self._sync_office_card_fee(invoice, total)
        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if items_data is not None:
            instance.items.filter(is_office_card_fee=False).delete()
            for item_data in items_data:
                item_data.pop('is_office_card_fee', None)
                svc = item_data.get('service')
                if svc and not item_data.get('service_title_snapshot'):
                    item_data['service_title_snapshot'] = svc.title
                InvoiceItem.objects.create(invoice=instance, **item_data)
        items_total = self._calc_total([
            {'quantity': item.quantity, 'main_price': item.main_price, 'extra_price': item.extra_price}
            for item in instance.items.filter(is_office_card_fee=False)
        ])
        instance.save()
        self._sync_office_card_fee(instance, items_total)
        return instance


class DashboardStatsSerializer(serializers.Serializer):
    total_customers = serializers.IntegerField()
    total_invoices = serializers.IntegerField()
    total_revenue = serializers.IntegerField()
    pending_invoices = serializers.IntegerField()
    paid_invoices = serializers.IntegerField()
    monthly_revenue = serializers.ListField(child=serializers.DictField())
    recent_invoices = serializers.ListField(child=serializers.DictField())


class SocialNetworkSerializer(serializers.ModelSerializer):
    logo = serializers.ImageField(required=False, allow_null=True)
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = SocialNetwork
        fields = ['id', 'name', 'url', 'logo', 'logo_url']
        read_only_fields = ['id', 'logo_url']

    def get_logo_url(self, obj):
        if not obj.logo:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.logo.url) if request else obj.logo.url


class BusinessProfileSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    social_links = SocialNetworkSerializer(many=True, read_only=True)

    class Meta:
        model = BusinessProfile
        fields = [
            'name', 'subtitle', 'logo', 'logo_url', 'phone', 'mobile',
            'address', 'website', 'instagram', 'telegram',
            'footer_text', 'tax_id', 'customer_documents_path', 'social_links'
        ]

    def get_logo_url(self, obj):
        if obj.logo and hasattr(obj.logo, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ['id', 'name', 'icon', 'color']


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, default='')
    category_icon = serializers.CharField(source='category.icon', read_only=True, default='📁')

    class Meta:
        model = Expense
        fields = [
            'id', 'category', 'category_name', 'category_icon',
            'title', 'amount', 'date', 'description', 'created_at'
        ]
        read_only_fields = ['created_at']


class StaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Staff
        fields = [
            'id', 'name', 'phone', 'specialty',
            'commission_rate', 'is_active', 'created_at'
        ]
        read_only_fields = ['created_at']


class VehicleTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleType
        fields = ['id', 'name']


class ChequeSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = Cheque
        fields = [
            'id', 'customer', 'customer_name', 'cheque_number', 'bank_name', 'branch',
            'amount', 'due_date', 'issue_date', 'status', 'status_display',
            'type', 'type_display', 'description', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
