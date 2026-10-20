from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    CustomerViewSet, ServiceViewSet, InvoiceViewSet,
    DocumentViewSet, DashboardViewSet,
    BusinessProfileViewSet, ExpenseCategoryViewSet,
    ExpenseViewSet, StaffViewSet, BackupViewSet, VehicleTypeViewSet,
    UserViewSet, BackupConfigViewSet, InvoiceSettingsViewSet, ChequeViewSet, AuditLogViewSet, ChatMessageViewSet,
    WelcomeSettingsViewSet
)
from .serializers import SafeTokenRefreshSerializer
from .views import database_revision

router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'services', ServiceViewSet, basename='service')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'documents', DocumentViewSet, basename='document')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'profile', BusinessProfileViewSet, basename='profile')
router.register(r'expense-categories', ExpenseCategoryViewSet, basename='expense-category')
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'staff', StaffViewSet, basename='staff')
router.register(r'backup', BackupViewSet, basename='backup')
router.register(r'backup-config', BackupConfigViewSet, basename='backup-config')
router.register(r'invoice-settings', InvoiceSettingsViewSet, basename='invoice-settings')
router.register(r'vehicle-types', VehicleTypeViewSet, basename='vehicle-type')
router.register(r'users', UserViewSet, basename='user')
router.register(r'cheques', ChequeViewSet, basename='cheque')
router.register(r'audit', AuditLogViewSet, basename='audit')
router.register(r'chat', ChatMessageViewSet, basename='chat')
router.register(r'welcome-settings', WelcomeSettingsViewSet, basename='welcome-settings')


urlpatterns = [
    path('changes/', database_revision, name='database_revision'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path(
        'token/refresh/',
        TokenRefreshView.as_view(serializer_class=SafeTokenRefreshSerializer),
        name='token_refresh',
    ),
    path('', include(router.urls)),
]
