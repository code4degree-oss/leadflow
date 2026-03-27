from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.clients.api.views import ClientViewSet

router = DefaultRouter()
router.register(r'clients', ClientViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
