from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from apps.api.mixins import TenantQuerySetMixin
from apps.api.permissions import IsClientAdmin
from apps.accounts.models import User
from apps.accounts.api.serializers import UserSerializer
from apps.clients.models import ClientLocation
from apps.clients.api.serializers import ClientLocationSerializer
import string
import random


class UserViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """
    API endpoint for Client Admins to manage their employees.
    Uses TenantQuerySetMixin to ensure data isolation.
    """
    serializer_class = UserSerializer
    permission_classes = [IsClientAdmin]
    queryset = User.objects.all()

    def create(self, request, *args, **kwargs):
        client = request.user.client
        if not client:
            return Response(
                {"detail": "You are not associated with any client account."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enforce max_users limit
        current_count = User.objects.filter(client=client).count()
        if current_count >= client.max_users:
            return Response(
                {"detail": f"User limit reached. Your plan allows a maximum of "
                           f"{client.max_users} users. You currently have {current_count}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate random 12-char password
        chars = string.ascii_letters + string.digits + "!@#$%^&*"
        generated_password = ''.join(random.choice(chars) for _ in range(12))

        # Override password in request data
        data = request.data.copy()
        data['password'] = generated_password

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save(client=client)

        # Return response with generated credentials
        response_data = serializer.data
        response_data['generated_password'] = generated_password
        response_data['email'] = user.email

        return Response(response_data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        # Fallback for any other creation path
        client = self.request.user.client
        serializer.save(client=client)

    @action(detail=True, methods=['post'], url_path='reset-password', permission_classes=[IsClientAdmin])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get('password')
        if not new_password:
            return Response({"error": "A new password is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        user.set_password(new_password)
        user.must_change_password = True
        user.save()
        return Response({"detail": f"Password for {user.email} has been successfully reset."})

class ClientLocationViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """
    API endpoint for Client Admins to manage their authorized Geolocation bounds.
    """
    serializer_class = ClientLocationSerializer
    permission_classes = [IsClientAdmin]
    queryset = ClientLocation.objects.all()

    def perform_create(self, serializer):
        serializer.save(client=self.request.user.client)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for users to view their in-app notifications.
    """
    from rest_framework.permissions import IsAuthenticated
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        from rest_framework import serializers as drf_serializers
        from apps.accounts.models import Notification

        class NotificationSerializer(drf_serializers.ModelSerializer):
            class Meta:
                model = Notification
                fields = ['id', 'type', 'title', 'message', 'is_read', 'created_at']
                read_only_fields = fields

        return NotificationSerializer

    def get_queryset(self):
        from apps.accounts.models import Notification
        return Notification.objects.filter(user=self.request.user)

    @action(detail=False, methods=['post'], url_path='mark-read')
    def mark_read(self, request):
        """Mark all notifications as read, or specific IDs if provided."""
        from apps.accounts.models import Notification
        ids = request.data.get('ids', None)
        qs = Notification.objects.filter(user=request.user, is_read=False)
        if ids:
            qs = qs.filter(id__in=ids)
        count = qs.update(is_read=True)
        return Response({"detail": f"{count} notifications marked as read."})

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        from apps.accounts.models import Notification
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"unread_count": count})

