from rest_framework.routers import DefaultRouter
from apps.audits.api.views import AuditLogViewSet, LoginHistoryViewSet

app_name = "audits_api"

router = DefaultRouter()
router.register(r'audit-logs', AuditLogViewSet, basename='auditlog')
router.register(r'login-history', LoginHistoryViewSet, basename='loginhistory')

urlpatterns = router.urls
