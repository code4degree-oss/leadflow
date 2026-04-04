from rest_framework.routers import DefaultRouter
from apps.accounts.api.views import UserViewSet, ClientLocationViewSet, NotificationViewSet, FCMDeviceViewSet

app_name = "accounts_api"

router = DefaultRouter()
router.register(r'employees', UserViewSet, basename='employee')
router.register(r'locations', ClientLocationViewSet, basename='location')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'device-token', FCMDeviceViewSet, basename='device-token')

urlpatterns = router.urls
