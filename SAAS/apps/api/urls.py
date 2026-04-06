from django.urls import path
from apps.core.views import ForceLogoutAwareTokenRefreshView
from apps.api.views.auth import CustomTokenObtainPairView, UserMeView, ChangePasswordView

app_name = "api"

urlpatterns = [
    # Authentication endpoints
    path("auth/login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", ForceLogoutAwareTokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", UserMeView.as_view(), name="auth_me"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change_password"),
]
