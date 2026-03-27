from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.api.serializers import CustomTokenObtainPairSerializer, UserMeSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Login endpoint that returns JWT Access and Refresh tokens.
    Uses our CustomTokenObtainPairSerializer to include role and client info.
    """
    serializer_class = CustomTokenObtainPairSerializer


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

        if len(new_password) < 8:
            return Response(
                {"detail": "New password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.must_change_password = False
        user.save()

        return Response({"detail": "Password changed successfully."})
