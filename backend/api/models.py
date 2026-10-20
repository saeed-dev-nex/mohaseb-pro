from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Customer(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=255, verbose_name='نام')
    phone = models.CharField(max_length=50, blank=True, null=True, verbose_name='تلفن')
    email = models.EmailField(blank=True, null=True, verbose_name='ایمیل')
    address = models.TextField(blank=True, null=True, verbose_name='آدرس')
    national_id = models.CharField(max_length=20, blank=True, null=True, verbose_name='کد ملی / شناسه')
    notes = models.TextField(blank=True, null=True, verbose_name='یادداشت')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'مشتری'
        verbose_name_plural = 'مشتریان'

    def __str__(self):
        return self.name

    @property
    def total_invoices(self):
        return self.invoice_set.count()

    @property
    def total_paid(self):
        total = 0
        for invoice in self.invoice_set.all().prefetch_related('payments'):
            payments = list(invoice.payments.all())
            if payments:
                total += sum(payment.amount for payment in payments)
            elif invoice.status == 'paid':
                total += invoice.final_amount
        return total


class Service(models.Model):
    title = models.CharField(max_length=255, verbose_name='عنوان')
    description = models.TextField(blank=True, null=True, verbose_name='توضیحات')
    has_extra = models.BooleanField(default=False, verbose_name='دارای خدمت اضافه')
    extra_label = models.CharField(max_length=255, blank=True, null=True, verbose_name='برچسب خدمت اضافه')
    default_main_price = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name='قیمت پایه')
    default_extra_price = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name='قیمت اضافه')
    default_commission = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name='کارمزد پیش‌فرض')
    commission_label = models.CharField(max_length=100, default='کارمزد', blank=True, verbose_name='برچسب کارمزد')
    is_active = models.BooleanField(default=True, verbose_name='فعال')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['title']
        verbose_name = 'خدمت'
        verbose_name_plural = 'خدمات'

    def __str__(self):
        return self.title


class Invoice(models.Model):
    STATUS_CHOICES = [
        ('draft', 'پیش‌نویس'),
        ('pending', 'پرداخت نشده'),
        ('paid', 'پرداخت شده'),
        ('cancelled', 'لغو شده'),
    ]

    PAPER_SIZE_CHOICES = [
        ('a5', 'A5'),
        ('a4', 'A4'),
        ('a6', 'A6'),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='مشتری')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='issued_invoices', verbose_name='صادرکننده')
    paid_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='paid_invoices', verbose_name='پرداخت‌کننده')
    card_payment_source = models.CharField(
        max_length=20,
        choices=[('customer', 'کارت مشتری'), ('office', 'کارت دفتر')],
        default='customer',
        verbose_name='کارت پرداخت',
    )
    date = models.DateTimeField(default=timezone.now, verbose_name='تاریخ')
    due_date = models.DateField(null=True, blank=True, verbose_name='سررسید')
    description = models.TextField(blank=True, null=True, verbose_name='توضیحات')
    total_amount = models.DecimalField(max_digits=15, decimal_places=0, default=0, verbose_name='مبلغ کل')
    commission_total = models.DecimalField(max_digits=15, decimal_places=0, default=0, verbose_name='جمع کارمزد')
    commission_paid = models.BooleanField(default=False, verbose_name='کارمزد پرداخت شده')
    discount = models.DecimalField(max_digits=15, decimal_places=0, default=0, verbose_name='تخفیف')
    tax = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name='مالیات (%)')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='وضعیت')
    invoice_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name='شماره فاکتور')
    paper_size = models.CharField(max_length=10, choices=PAPER_SIZE_CHOICES, default='a5', verbose_name='سایز کاغذ')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Vehicle / Custom fields
    vehicle_plate = models.CharField(max_length=100, blank=True, null=True, verbose_name='شماره پلاک')
    vehicle_vin = models.CharField(max_length=50, blank=True, null=True, verbose_name='شماره VIN')
    vehicle_model = models.CharField(max_length=100, blank=True, null=True, verbose_name='مدل خودرو')
    vehicle_type = models.CharField(max_length=100, blank=True, null=True, verbose_name='نوع خودرو')
    vehicle_year = models.CharField(max_length=10, blank=True, null=True, verbose_name='سال ساخت')
    green_card_owner_name = models.CharField(max_length=255, blank=True, default='', verbose_name='نام صاحب برگ سبز')
    green_card_owner_national_id = models.CharField(max_length=20, blank=True, default='', verbose_name='کد ملی صاحب برگ سبز')
    custom_fields = models.JSONField(default=dict, blank=True, verbose_name='فیلدهای دلخواه')
    tags = models.JSONField(default=list, blank=True, verbose_name='برچسب‌ها')


    class Meta:
        ordering = ['-date']
        verbose_name = 'فاکتور'
        verbose_name_plural = 'فاکتورها'

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            last = Invoice.objects.order_by('-id').first()
            next_id = (last.id + 1) if last else 1
            self.invoice_number = f'INV-{next_id:05d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.invoice_number} - {self.customer}"

    @property
    def final_amount(self):
        tax_amount = (self.total_amount * self.tax) / 100
        return self.total_amount + tax_amount - self.discount + self.commission_total

    @property
    def net_commission(self):
        return self.commission_total


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, related_name='items', on_delete=models.CASCADE)
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='خدمت')
    service_title_snapshot = models.CharField(max_length=255, blank=True, verbose_name='عنوان خدمت')
    quantity = models.IntegerField(default=1, verbose_name='تعداد')
    main_price = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name='مبلغ پرداختی')
    extra_price = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name='مبلغ استعلام')
    commission = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name='کارمزد')
    notes = models.CharField(max_length=500, blank=True, null=True, verbose_name='یادداشت')
    staff = models.ForeignKey('Staff', on_delete=models.SET_NULL, null=True, blank=True, verbose_name='تکنسین')
    is_office_card_fee = models.BooleanField(default=False, verbose_name='ردیف واریزی کارت دفتر')

    class Meta:
        ordering = ['id']
        verbose_name = 'آیتم فاکتور'
        verbose_name_plural = 'آیتم‌های فاکتور'

    def save(self, *args, **kwargs):
        if self.service and not self.service_title_snapshot:
            self.service_title_snapshot = self.service.title
        super().save(*args, **kwargs)

    @property
    def service_title(self):
        return self.service_title_snapshot or (self.service.title if self.service else '---')

    @property
    def line_total(self):
        return (self.main_price + self.extra_price) * self.quantity

    @property
    def line_commission(self):
        return self.commission * self.quantity


class InvoiceEditRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'در انتظار بررسی'),
        ('approved', 'تأیید شده'),
        ('rejected', 'رد شده'),
        ('used', 'مصرف شده'),
    ]

    invoice = models.ForeignKey(Invoice, related_name='edit_requests', on_delete=models.CASCADE)
    requested_by = models.ForeignKey(User, related_name='invoice_edit_requests', on_delete=models.CASCADE)
    reviewed_by = models.ForeignKey(User, related_name='reviewed_invoice_edit_requests', on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Edit request for {self.invoice_id} by {self.requested_by_id} ({self.status})"


class InvoicePayment(models.Model):
    METHOD_CHOICES = [
        ('cash', 'نقدی'),
        ('card', 'کارت‌خوان'),
        ('transfer', 'کارت‌به‌کارت / حواله'),
        ('other', 'سایر'),
    ]

    invoice = models.ForeignKey(Invoice, related_name='payments', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=15, decimal_places=0)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='cash')
    reference = models.CharField(max_length=120, blank=True)
    note = models.CharField(max_length=500, blank=True)
    paid_at = models.DateTimeField(default=timezone.now)
    created_by = models.ForeignKey(User, related_name='invoice_payments', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-paid_at', '-id']

    def __str__(self):
        return f"{self.invoice.invoice_number}: {self.amount}"


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('create', 'ایجاد'),
        ('update', 'ویرایش'),
        ('delete', 'حذف'),
        ('payment', 'ثبت پرداخت'),
        ('approval', 'بررسی درخواست'),
    ]
    user = models.ForeignKey(User, related_name='audit_events', on_delete=models.SET_NULL, null=True, blank=True)
    object_type = models.CharField(max_length=40)
    object_id = models.CharField(max_length=64)
    object_label = models.CharField(max_length=255, blank=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    changes = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['object_type', 'object_id', '-created_at'], name='idx_audit_object_created')]

    def __str__(self):
        return f"{self.object_type} {self.object_id}: {self.action}"


class Document(models.Model):
    customer = models.ForeignKey(Customer, related_name='documents', on_delete=models.CASCADE)
    invoice = models.ForeignKey(Invoice, related_name='documents', on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=255, verbose_name='عنوان')
    file = models.FileField(upload_to='customer_docs/', verbose_name='فایل')
    description = models.TextField(blank=True, null=True, verbose_name='توضیحات')
    tags = models.JSONField(default=list, blank=True, verbose_name='تگ‌ها')
    file_path = models.CharField(max_length=1000, blank=True, null=True, verbose_name='مسیر فیزیکی فایل')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = 'سند'
        verbose_name_plural = 'اسناد'

    def __str__(self):
        return f"{self.title} - {self.customer.name}"


class ChatMessage(models.Model):
    sender = models.ForeignKey(User, related_name='chat_messages', on_delete=models.CASCADE)
    recipient = models.ForeignKey(
        User, related_name='received_chat_messages', on_delete=models.CASCADE,
        blank=True, null=True,
        help_text='خالی بودن این فیلد به‌معنای پیام برای همهٔ کاربران است.',
    )
    text = models.TextField(blank=True, default='')
    file = models.FileField(upload_to='chat_files/%Y/%m/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        recipient = self.recipient.username if self.recipient else 'همه'
        return f'{self.sender.username} → {recipient}: {self.text[:50]}'


class ChatPresence(models.Model):
    """آخرین زمان اتصال WebSocket هر کاربر برای نمایش وضعیت آنلاین."""
    user = models.OneToOneField(User, related_name='chat_presence', on_delete=models.CASCADE)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)

    def __str__(self):
        return f'{self.user.username}: {self.last_seen}'


class ChatNotification(models.Model):
    recipient = models.ForeignKey(User, related_name='chat_notifications', on_delete=models.CASCADE)
    message = models.ForeignKey(ChatMessage, related_name='notifications', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [models.UniqueConstraint(fields=['recipient', 'message'], name='unique_chat_notification_recipient')]

    def __str__(self):
        return f'{self.recipient.username} ← {self.message.sender.username}'


class BackupConfig(models.Model):
    """Singleton model for backup configuration"""
    FREQ_CHOICES = [
        ('daily', 'روزانه'),
        ('weekly', 'هفتگی'),
        ('manual', 'دستی'),
    ]
    backup_path = models.CharField(max_length=1000, blank=True, default='', verbose_name='مسیر ذخیره بکاپ')
    auto_backup = models.BooleanField(default=False, verbose_name='بکاپ خودکار')
    backup_frequency = models.CharField(max_length=20, choices=FREQ_CHOICES, default='daily', verbose_name='فرکانس بکاپ')
    backup_hour = models.IntegerField(default=13, verbose_name='ساعت بکاپ خودکار (0-23)')
    last_backup_at = models.DateTimeField(null=True, blank=True, verbose_name='آخرین بکاپ')
    last_backup_path = models.CharField(max_length=1000, blank=True, verbose_name='مسیر آخرین بکاپ')

    class Meta:
        verbose_name = 'تنظیمات بکاپ'
        verbose_name_plural = 'تنظیمات بکاپ'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'پیکربندی بکاپ'


class InvoiceSettings(models.Model):
    """Singleton settings used for office-card deposit fees on invoices."""
    office_card_fee_threshold = models.DecimalField(
        max_digits=15, decimal_places=0, default=0,
        verbose_name='حداقل مبلغ واریزی کارت دفتر (تومان)',
    )
    show_discount_field = models.BooleanField(default=True, verbose_name='نمایش فیلد تخفیف در فاکتور')
    show_tax_field = models.BooleanField(default=True, verbose_name='نمایش فیلد مالیات در فاکتور')

    class Meta:
        verbose_name = 'تنظیمات فاکتور'
        verbose_name_plural = 'تنظیمات فاکتور'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class WelcomeSettings(models.Model):
    enabled = models.BooleanField(default=False, verbose_name='نمایش پیام خوش‌آمدگویی')
    global_message = models.TextField(blank=True, default='', verbose_name='پیام خوش‌آمدگویی عمومی')

    class Meta:
        verbose_name = 'تنظیمات پیام خوش‌آمدگویی'
        verbose_name_plural = 'تنظیمات پیام خوش‌آمدگویی'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class UserWelcomeMessage(models.Model):
    user = models.OneToOneField(User, related_name='welcome_message', on_delete=models.CASCADE)
    message = models.TextField(verbose_name='پیام شخصی خوش‌آمدگویی')

    def __str__(self):
        return f'پیام خوش‌آمدگویی برای {self.user.username}'


class WelcomeMessageShown(models.Model):
    user = models.ForeignKey(User, related_name='welcome_messages_shown', on_delete=models.CASCADE)
    date = models.DateField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'date'], name='unique_welcome_shown_per_user_day')]


class BusinessProfile(models.Model):
    """Singleton model for business/brand settings"""
    name = models.CharField(max_length=255, default='محاسب پرو', verbose_name='نام مجموعه')
    subtitle = models.CharField(max_length=255, blank=True, default='سیستم مدیریت مالی', verbose_name='زیرعنوان')
    logo = models.ImageField(upload_to='brand/', blank=True, null=True, verbose_name='لوگو')
    phone = models.CharField(max_length=50, blank=True, verbose_name='تلفن')
    mobile = models.CharField(max_length=50, blank=True, verbose_name='موبایل')
    address = models.TextField(blank=True, verbose_name='آدرس')
    website = models.URLField(blank=True, verbose_name='وب‌سایت')
    instagram = models.CharField(max_length=100, blank=True, verbose_name='اینستاگرام')
    telegram = models.CharField(max_length=100, blank=True, verbose_name='تلگرام')
    footer_text = models.CharField(max_length=500, blank=True, verbose_name='متن پاورقی فاکتور')
    tax_id = models.CharField(max_length=50, blank=True, verbose_name='شناسه مالیاتی')
    customer_documents_path = models.CharField(max_length=500, blank=True, default='', verbose_name='مسیر ذخیره‌سازی مدارک مشتریان')

    class Meta:
        verbose_name = 'پروفایل کسب‌وکار'
        verbose_name_plural = 'پروفایل کسب‌وکار'

    def save(self, *args, **kwargs):
        # Ensure only one instance exists (singleton)
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class SocialNetwork(models.Model):
    profile = models.ForeignKey(BusinessProfile, related_name='social_links', on_delete=models.CASCADE)
    name = models.CharField(max_length=80, verbose_name='نام شبکه اجتماعی')
    url = models.URLField(max_length=500, verbose_name='نشانی شبکه اجتماعی')
    logo = models.ImageField(upload_to='social_networks/', blank=True, null=True, verbose_name='لوگوی شبکه اجتماعی')

    class Meta:
        ordering = ['id']
        verbose_name = 'شبکه اجتماعی'
        verbose_name_plural = 'شبکه‌های اجتماعی'

    def __str__(self):
        return self.name


class ExpenseCategory(models.Model):
    """Categories for expenses (rent, salary, utilities, etc.)"""
    name = models.CharField(max_length=100, verbose_name='نام دسته')
    icon = models.CharField(max_length=10, default='📁', verbose_name='آیکون')
    color = models.CharField(max_length=20, default='#6366f1', verbose_name='رنگ')

    class Meta:
        ordering = ['name']
        verbose_name = 'دسته هزینه'
        verbose_name_plural = 'دسته‌های هزینه'

    def __str__(self):
        return self.name


class Expense(models.Model):
    """Track business expenses for profit/loss calculation"""
    category = models.ForeignKey(ExpenseCategory, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='دسته')
    title = models.CharField(max_length=255, verbose_name='عنوان')
    amount = models.DecimalField(max_digits=15, decimal_places=0, verbose_name='مبلغ')
    date = models.DateField(default=timezone.now, verbose_name='تاریخ')
    description = models.TextField(blank=True, verbose_name='توضیحات')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']
        verbose_name = 'هزینه'
        verbose_name_plural = 'هزینه‌ها'

    def __str__(self):
        return f"{self.title} - {self.amount}"


class Staff(models.Model):
    """Personnel / technicians for commission tracking"""
    name = models.CharField(max_length=255, verbose_name='نام')
    phone = models.CharField(max_length=50, blank=True, verbose_name='تلفن')
    specialty = models.CharField(max_length=255, blank=True, verbose_name='تخصص')
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name='درصد پورسانت')
    is_active = models.BooleanField(default=True, verbose_name='فعال')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'پرسنل'
        verbose_name_plural = 'پرسنل'

    def __str__(self):
        return self.name


class VehicleType(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name='نام خودرو')

    class Meta:
        ordering = ['name']
        verbose_name = 'نوع خودرو'
        verbose_name_plural = 'انواع خودرو'

    def __str__(self):
        return self.name


class Cheque(models.Model):
    STATUS_CHOICES = [
        ('pending', 'در جریان'),
        ('passed', 'پاس شده'),
        ('bounced', 'برگشت خورده'),
        ('returned', 'عودت داده شده'),
    ]

    TYPE_CHOICES = [
        ('incoming', 'دریافتی'),
        ('outgoing', 'پرداختی'),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, verbose_name='مشتری', null=True, blank=True)
    cheque_number = models.CharField(max_length=100, verbose_name='شماره چک')
    bank_name = models.CharField(max_length=255, verbose_name='نام بانک')
    branch = models.CharField(max_length=255, blank=True, null=True, verbose_name='شعبه')
    amount = models.DecimalField(max_digits=15, decimal_places=0, verbose_name='مبلغ چک')
    due_date = models.DateField(verbose_name='تاریخ سررسید')
    issue_date = models.DateField(blank=True, null=True, verbose_name='تاریخ صدور')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='وضعیت')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='incoming', verbose_name='نوع چک')
    description = models.TextField(blank=True, null=True, verbose_name='توضیحات')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date']
        verbose_name = 'چک'
        verbose_name_plural = 'چک‌ها'

    def __str__(self):
        return f"چک {self.cheque_number} - {self.bank_name} ({self.get_type_display()})"
