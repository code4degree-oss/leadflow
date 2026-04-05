from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.clients.api.views import ClientViewSet, BroadcastNotificationView

router = DefaultRouter()
router.register(r'clients', ClientViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('broadcast/', BroadcastNotificationView.as_view(), name='broadcast-notification'),
]
