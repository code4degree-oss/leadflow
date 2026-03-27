from rest_framework.routers import DefaultRouter
from apps.accounts.api.views import UserViewSet, ClientLocationViewSet

app_name = "accounts_api"

router = DefaultRouter()
router.register(r'employees', UserViewSet, basename='employee')
router.register(r'locations', ClientLocationViewSet, basename='location')

urlpatterns = router.urls
