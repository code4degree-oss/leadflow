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


class NotificationViewSet(viewsets.GenericViewSet):
    """
    API endpoint for users to view their in-app notifications.
    Uses Notification model from leads app.
    """
    from rest_framework.permissions import IsAuthenticated
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        from apps.leads.api.serializers import NotificationSerializer
        return NotificationSerializer

    def get_queryset(self):
        from apps.leads.models import Notification
        return Notification.objects.filter(user=self.request.user, client=self.request.user.client)

    def list(self, request):
        qs = self.get_queryset()[:30]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        from apps.leads.models import Notification
        try:
            notif = Notification.objects.get(id=pk, user=request.user)
            notif.is_read = True
            notif.save(update_fields=['is_read'])
        except Notification.DoesNotExist:
            pass
        return Response({'status': 'ok'})

    @action(detail=False, methods=['post'], url_path='read-all')
    def read_all(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'status': 'ok'})

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count})

    @action(detail=False, methods=['post'], url_path='check-reminders')
    def check_reminders(self, request):
        """Generate reminder notifications for upcoming calls (within 5 min)."""
        from apps.leads.models import FollowUpReminder, Notification, NotificationType
        from django.utils import timezone
        import datetime

        now = timezone.now()
        window = now + datetime.timedelta(minutes=5)

        upcoming = FollowUpReminder.objects.filter(
            client=request.user.client,
            scheduled_at__gte=now,
            scheduled_at__lte=window,
            is_completed=False
        ).select_related('lead', 'created_by')

        created = 0
        for reminder in upcoming:
            if not reminder.created_by:
                continue
            exists = Notification.objects.filter(
                user=reminder.created_by,
                lead=reminder.lead,
                notif_type=NotificationType.REMINDER,
                created_at__gte=now - datetime.timedelta(minutes=10)
            ).exists()
            if not exists:
                lead_name = f"{reminder.lead.first_name} {reminder.lead.last_name}".strip()
                mins = max(1, int((reminder.scheduled_at - now).total_seconds() // 60))
                Notification.objects.create(
                    client=request.user.client,
                    user=reminder.created_by,
                    title=f"📞 Call {lead_name} in {mins} min",
                    message=reminder.note or f"Scheduled follow-up with {lead_name}",
                    notif_type=NotificationType.REMINDER,
                    lead=reminder.lead,
                )
                created += 1

        return Response({'created': created})


class FCMDeviceViewSet(viewsets.ViewSet):
    """
    Registers a Firebase Cloud Messaging device token for push notifications.
    """
    from rest_framework.permissions import IsAuthenticated
    permission_classes = [IsAuthenticated]

    def create(self, request):
        from apps.accounts.models import FCMDevice
        token = request.data.get('token')
        device_type = request.data.get('device_type', 'web')

        if not token:
            return Response({"error": "Token is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Update or create
        device, created = FCMDevice.objects.update_or_create(
            registration_id=token,
            defaults={
                'user': request.user,
                'device_type': device_type,
                'is_active': True
            }
        )

        return Response({"message": "Device token accepted", "created": created})
