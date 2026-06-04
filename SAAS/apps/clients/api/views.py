from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from apps.api.permissions import IsSuperAdmin
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.clients.models import ClientAccount
from apps.clients.api.serializers import ClientAccountSerializer
import random
import string
class ClientViewSet(viewsets.ModelViewSet):
    """
    SuperAdmin API for managing client tenants.
    Only accessible by users with SUPER_ADMIN role.
    """
    queryset = ClientAccount.objects.prefetch_related('users').all()
    serializer_class = ClientAccountSerializer
    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        # Additional safety check for superadmin role if needed
        return super().get_queryset()

    def create(self, request, *args, **kwargs):
        admin_email = request.data.get('admin_email')
        admin_first_name = request.data.get('admin_first_name', '')
        admin_last_name = request.data.get('admin_last_name', '')
        admin_phone = request.data.get('admin_phone', '')
        
        try:
            response = super().create(request, *args, **kwargs)
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if admin_email and response.status_code == status.HTTP_201_CREATED:
            client_id = response.data.get('id')
            client = ClientAccount.objects.get(id=client_id)
            
            # Create the CLIENT_ADMIN user
            from apps.accounts.models import User, RoleChoices
            import string, random
            
            # Generate a random 12-char password
            chars = string.ascii_letters + string.digits + "!@#$%^&*"
            new_password = ''.join(random.choice(chars) for _ in range(12))
            
            user, created = User.objects.get_or_create(
                email=admin_email,
                defaults={
                    'client': client,
                    'role': RoleChoices.CLIENT_ADMIN,
                    'first_name': admin_first_name,
                    'last_name': admin_last_name,
                    'phone': admin_phone,
                    'is_staff': False,
                    'is_superuser': False,
                    'must_change_password': True,
                }
            )
            
            if created:
                user.set_password(new_password)
                user.save()
            
            # Return credentials so the frontend can display them
            response.data['admin_email'] = admin_email
            response.data['admin_password'] = new_password if created else "User already exists"
            
        return response

    @action(detail=True, methods=['get'], url_path='details')
    def details(self, request, pk=None):
        """
        Return comprehensive client details for the superadmin master panel.
        Includes admin contact info and all users.
        """
        from apps.accounts.api.serializers import UserSerializer
        
        client = self.get_object()
        serializer = self.get_serializer(client)
        data = serializer.data
        
        # Find the admin user
        admin_user = client.users.filter(role='CLIENT_ADMIN').first()
        if not admin_user:
            admin_user = client.users.first()
            
        if admin_user:
            data['admin_email'] = admin_user.email
            data['admin_first_name'] = admin_user.first_name
            data['admin_last_name'] = admin_user.last_name
            data['admin_phone'] = admin_user.phone
            
        # Add all users
        users_serializer = UserSerializer(client.users.all(), many=True)
        data['users'] = users_serializer.data
        
        return Response(data)

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        client = self.get_object()
        
        # Find the admin user for this client
        # Usually they have role='CLIENT_ADMIN'
        admin_user = client.users.filter(role='CLIENT_ADMIN').first()
        if not admin_user:
            # Fallback to the first user if no explicitly marked admin exists
            admin_user = client.users.first()
            
        if not admin_user:
            return Response(
                {"detail": "No users found for this client account to reset password."},
                status=status.HTTP_404_NOT_FOUND
            )
            
        # Generate a random 12-char password
        chars = string.ascii_letters + string.digits + "!@#$%^&*"
        new_password = ''.join(random.choice(chars) for _ in range(12))
        
        # Update user password and force change on next login
        admin_user.set_password(new_password)
        admin_user.must_change_password = True
        admin_user.save()
        
        return Response({
            "message": "Password reset successfully.",
            "email": admin_user.email,
            "new_password": new_password
        })

    @action(detail=True, methods=['get'], url_path='export-data')
    def export_data(self, request, pk=None):
        """
        Export data for a specific client.
        Accepts ?type=leads (or full, audit, etc. for future expansion)
        """
        client = self.get_object()
        export_type = request.query_params.get('type', 'leads')
        
        if export_type in ['leads', 'full', 'custom']:
            from apps.leads.models import Lead
            from apps.leads.exporters import LeadExportService
            
            queryset = Lead.objects.filter(client=client).select_related('assigned_to')
            
            # Use the existing CSV export service
            # Modify filename to include client name
            response = LeadExportService.export_to_csv(queryset)
            safe_name = "".join(x for x in client.name if x.isalnum() or x in " -_").replace(" ", "_").lower()
            response['Content-Disposition'] = f'attachment; filename="{safe_name}_{export_type}_export.csv"'
            return response
            
        return Response({"detail": "Export type not supported yet."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='renew')
    def renew_subscription(self, request, pk=None):
        """
        One-click subscription renewal.
        Super Admin picks a new end date and the client is instantly reactivated.
        """
        from django.utils import timezone

        client = self.get_object()
        new_valid_until = request.data.get('valid_until')

        if not new_valid_until:
            return Response(
                {"detail": "valid_until (new end date) is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from datetime import date
            if isinstance(new_valid_until, str):
                new_date = date.fromisoformat(new_valid_until)
            else:
                new_date = new_valid_until
        except (ValueError, TypeError):
            return Response(
                {"detail": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_date <= timezone.now().date():
            return Response(
                {"detail": "End date must be in the future."},
                status=status.HTTP_400_BAD_REQUEST
            )

        client.subscription_start = timezone.now().date()
        client.valid_until = new_date
        client.is_active = True
        client.save(update_fields=['subscription_start', 'valid_until', 'is_active', 'updated_at'])

        serializer = self.get_serializer(client)
        return Response({
            "detail": f"Subscription renewed until {new_date}.",
            "client": serializer.data
        })


class BroadcastNotificationView(APIView):
    """
    Super Admin endpoint to broadcast a custom notification to ALL users
    across ALL tenants (client admins + employees). Creates in-app notifications
    AND sends FCM push to every registered device (mobile app + browser).
    
    POST /api/v1/superadmin/clients/broadcast/
    Body: { "title": "Happy New Year!", "message": "Wishing everyone a prosperous 2026!" }
    """
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        title = request.data.get('title', '').strip()
        message = request.data.get('message', '').strip()

        if not title:
            return Response(
                {"detail": "Title is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not message:
            return Response(
                {"detail": "Message is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.accounts.models import User
        from apps.leads.models import Notification, NotificationType

        # Get ALL active users in the system (every tenant + super admins)
        all_users = User.objects.filter(is_active=True)
        user_count = all_users.count()

        # Create in-app notification for each user
        notifications = []
        for user in all_users:
            notifications.append(Notification(
                client=user.client,  # Will be None for super admins — that's OK
                user=user,
                title=title,
                message=message,
                notif_type=NotificationType.BROADCAST,
            ))
        Notification.objects.bulk_create(notifications)

        # Send push notification to all devices
        from apps.core.firebase import send_broadcast_notification
        push_success, push_failure = send_broadcast_notification(
            title=title,
            body=message,
            data={'notif_type': 'BROADCAST'}
        )

        return Response({
            "detail": f"Broadcast sent to {user_count} users.",
            "users_notified": user_count,
            "push_sent": push_success,
            "push_failed": push_failure,
        })



class SecurityDashboardView(APIView):
    """
    Super Admin endpoint for the Security & Compliance dashboard.
    Returns real-time security metrics from LoginHistory and AuditLog.
    
    GET /api/v1/superadmin/clients/security-dashboard/
    """
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta
        from apps.audits.models import LoginHistory
        from apps.accounts.models import User, LoginAttempt

        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        last_7_days = now - timedelta(days=7)
        last_24h = now - timedelta(hours=24)

        # Suspicious login count (last 7 days)
        suspicious_logins = LoginHistory.objects.filter(
            is_suspicious=True,
            created_at__gte=last_7_days
        ).count()

        # Failed login attempts (last 24 hours)
        failed_attempts = LoginAttempt.objects.filter(
            success=False,
            attempted_at__gte=last_24h
        ).count()

        # Active sessions today (unique users who logged in today)
        active_sessions = LoginHistory.objects.filter(
            created_at__gte=today_start
        ).values('user').distinct().count()

        # Total active users in platform
        total_active_users = User.objects.filter(is_active=True).count()

        # Recent suspicious logins (last 7 days, max 20)
        recent_suspicious = LoginHistory.objects.filter(
            is_suspicious=True,
            created_at__gte=last_7_days
        ).select_related('user', 'client').order_by('-created_at')[:20]

        suspicious_entries = []
        for log in recent_suspicious:
            suspicious_entries.append({
                'id': str(log.id),
                'user_email': log.user.email if log.user else 'Unknown',
                'client_name': log.client.name if log.client else 'N/A',
                'ip_address': log.ip_address,
                'city': log.city,
                'country': log.country,
                'latitude': str(log.latitude) if log.latitude else None,
                'longitude': str(log.longitude) if log.longitude else None,
                'reason': log.suspicious_reason,
                'created_at': log.created_at.isoformat(),
            })

        # Recent login events (last 24h, max 50)
        recent_logins = LoginHistory.objects.filter(
            created_at__gte=last_24h
        ).select_related('user', 'client').order_by('-created_at')[:50]

        login_entries = []
        for log in recent_logins:
            login_entries.append({
                'id': str(log.id),
                'user_email': log.user.email if log.user else 'Unknown',
                'client_name': log.client.name if log.client else 'N/A',
                'ip_address': log.ip_address,
                'city': log.city,
                'country': log.country,
                'is_suspicious': log.is_suspicious,
                'created_at': log.created_at.isoformat(),
            })

        # Failed login details (last 24h, max 20)
        recent_failures = LoginAttempt.objects.filter(
            success=False,
            attempted_at__gte=last_24h
        ).order_by('-attempted_at')[:20]

        failure_entries = []
        for attempt in recent_failures:
            failure_entries.append({
                'email': attempt.email,
                'ip_address': attempt.ip_address,
                'attempted_at': attempt.attempted_at.isoformat(),
            })

        return Response({
            'threats': suspicious_logins + failed_attempts,
            'suspicious_logins_7d': suspicious_logins,
            'failed_attempts_24h': failed_attempts,
            'active_sessions_today': active_sessions,
            'total_active_users': total_active_users,
            'recent_suspicious': suspicious_entries,
            'recent_logins': login_entries,
            'recent_failures': failure_entries,
        })
