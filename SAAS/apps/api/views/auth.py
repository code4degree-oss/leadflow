from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.api.serializers import CustomTokenObtainPairSerializer, UserMeSerializer
from apps.accounts.models import RoleChoices
from apps.core.geo import GeoService
import math
import logging

logger = logging.getLogger(__name__)


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Login endpoint that returns JWT Access and Refresh tokens.
    Uses our CustomTokenObtainPairSerializer to include role and client info.
    Enforces geofencing checks in the view layer for reliable blocking.
    """
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        email = request.data.get('email', '').strip()
        from ipware import get_client_ip
        ip, _ = get_client_ip(request)
        if not ip:
            ip = '127.0.0.1'

        from django.utils import timezone
        from datetime import timedelta
        from apps.accounts.models import LoginAttempt
        
        if email:
            # Check lockout
            recent_fails = LoginAttempt.objects.filter(
                email=email,
                success=False,
                attempted_at__gte=timezone.now() - timedelta(minutes=15)
            ).count()
            
            if recent_fails >= 5:
                return Response(
                    {"detail": "Account temporarily locked due to multiple failed login attempts. Please try again in 15 minutes."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )

        try:
            # First, let SimpleJWT authenticate and generate tokens normally
            response = super().post(request, *args, **kwargs)
        except Exception as e:
            if email:
                LoginAttempt.objects.create(email=email, ip_address=ip, success=False)
            raise e

        # If authentication failed, return as-is (401/400)
        if response.status_code != 200:
            if email:
                LoginAttempt.objects.create(email=email, ip_address=ip, success=False)
            return response

        # Auth succeeded
        if email:
            LoginAttempt.objects.create(email=email, ip_address=ip, success=True)
            # Reset failed attempts to prevent lockout logic if user finally logs in
            LoginAttempt.objects.filter(email=email, success=False).delete()

        # Authentication succeeded
        try:
            # We need to look up the user from the validated data
            email = request.data.get('email', '').strip()
            from apps.accounts.models import User
            try:
                user = User.objects.select_related('client').get(email=email)
            except User.DoesNotExist:
                return response  # Shouldn't happen if auth passed

            client = user.client

            # --- Record Login History for ALL users ---
            # Django's user_logged_in signal does NOT fire with JWT auth,
            # so we must create LoginHistory directly here.
            if client:
                req_lat = request.data.get('latitude')
                req_lng = request.data.get('longitude')
                
                from ipware import get_client_ip
                ip, _ = get_client_ip(request)
                if not ip:
                    ip = '127.0.0.1'
                
                try:
                    from apps.audits.tasks import record_login_history_task
                    record_login_history_task.delay(
                        user_id=str(user.id),
                        client_id=str(client.id) if client else None,
                        ip=ip,
                        req_lat=req_lat,
                        req_lng=req_lng
                    )
                except Exception as e:
                    logger.error(f"Failed to queue record_login_history_task: {e}")

            # --- Send Login Alert to Client Admin ---
            if client and user.role != RoleChoices.CLIENT_ADMIN:
                try:
                    from apps.audits.tasks import notify_admin_login_task
                    notify_admin_login_task.delay(
                        user_id=str(user.id),
                        client_id=str(client.id)
                    )
                except Exception as e:
                    logger.error(f"Failed to queue notify_admin_login_task: {e}")

            # --- Geofencing Check ---
            if not client:
                logger.info(f"[GEOFENCE] SKIP {email} — no client (super admin)")
                return response  # Super admin, no client

            # Only enforce geofencing for standard employees
            exempt_roles = [RoleChoices.SUPER_ADMIN, RoleChoices.CLIENT_ADMIN, RoleChoices.MANAGER]
            
            logger.warning(f"[GEOFENCE] === CHECK START === User={email}, Role={user.role}, "
                        f"geofencing_enabled={client.geofencing_enabled}, "
                        f"geofencing_exempt={user.geofencing_exempt}, "
                        f"role_exempt={user.role in exempt_roles}")
            
            if not client.geofencing_enabled:
                logger.warning(f"[GEOFENCE] SKIP {email} — geofencing_enabled=False for client '{client.name}'")
                return response
            if user.geofencing_exempt:
                logger.warning(f"[GEOFENCE] SKIP {email} — user is geofencing_exempt")
                return response
            if user.role in exempt_roles:
                logger.warning(f"[GEOFENCE] SKIP {email} — role '{user.role}' is exempt")
                return response

            # ── Geofencing is ACTIVE for this user ──
            lat = request.data.get('latitude')
            lng = request.data.get('longitude')

            logger.warning(f"[GEOFENCE] User={email}, Role={user.role}, lat={lat}, lng={lng}")

            authorized, reason = GeoService.check_geofence(user, lat, lng)
            
            if not authorized:
                logger.warning(f"[GEOFENCE] BLOCKED {email} — {reason}")
                msg = "Login Blocked: You are outside your organization's authorized geofenced working area."
                if "required" in reason.lower():
                    msg = "Location coordinates are required for login. Please enable GPS/location services in your browser."
                elif "invalid" in reason.lower():
                    msg = "Invalid GPS coordinates format."
                    
                return Response(
                    {"detail": msg},
                    status=status.HTTP_403_FORBIDDEN
                )

            logger.info(f"[GEOFENCE] ALLOWED {email} — {reason}")

        except Exception as e:
            # Catch-all: never let geofencing crash the entire login with an HTML 500 page
            logger.exception(f"[GEOFENCE] Unexpected error during geofence check: {e}")
            return Response(
                {"detail": "An error occurred while verifying your location. Please try again or contact your administrator."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        return response


class UserMeView(APIView):
    """
    Returns the profile information of the currently authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserMeSerializer(request.user)
        data = serializer.data
        data['must_change_password'] = request.user.must_change_password
        return Response(data)


class ChangePasswordView(APIView):
    """
    Allows an authenticated user to change their password.
    Also clears the must_change_password flag.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError
        from django.contrib.auth.hashers import check_password, make_password
        from apps.accounts.models import PasswordHistory

        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        if not old_password or not new_password:
            return Response(
                {"detail": "Both old_password and new_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user

        if not user.check_password(old_password):
            return Response(
                {"detail": "Old password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Validate password strength
        try:
            validate_password(new_password, user)
        except ValidationError as e:
            return Response(
                {"detail": " ".join(e.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Check against password history
        history = PasswordHistory.objects.filter(user=user).order_by('-created_at')[:5]
        for past_pass in history:
            if check_password(new_password, past_pass.password_hash):
                return Response(
                    {"detail": "You cannot reuse your recent passwords. Please choose a new one."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # 3. Update password and history
        user.set_password(new_password)
        user.must_change_password = False
        user.save()

        # Save to history
        PasswordHistory.objects.create(
            user=user,
            password_hash=make_password(new_password)
        )

        return Response({"detail": "Password changed successfully."})
