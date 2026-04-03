from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from apps.accounts.models import User

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT Serializer that adds `role` and `client_id` directly 
    into the access and refresh tokens.
    """
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['role'] = user.role
        token['client_id'] = str(user.client_id) if user.client_id else None
        token['email'] = user.email
        token['must_change_password'] = user.must_change_password

        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Add extra responses to the payload
        data['role'] = self.user.role
        data['email'] = self.user.email
        data['first_name'] = self.user.first_name
        data['last_name'] = self.user.last_name
        data['must_change_password'] = self.user.must_change_password
        if self.user.client_id:
            data['client_id'] = str(self.user.client_id)

        # Add subscription info
        client = getattr(self.user, 'client', None)
        if client:
            data['subscription_active'] = client.is_active
            data['valid_until'] = str(client.valid_until) if client.valid_until else None
            data['subscription_status'] = client.subscription_status
            data['days_remaining'] = client.days_remaining

            # NOTE: Geofencing enforcement has been moved to the View layer
            # (CustomTokenObtainPairView.post) for reliable HTTP response control.
            
        return data


class UserMeSerializer(serializers.ModelSerializer):
    """
    Serializer for the /auth/me/ endpoint to return logged-in user details.
    """
    client_name = serializers.CharField(source='client.name', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 
            'email', 
            'first_name', 
            'last_name', 
            'role', 
            'client_id',
            'client_name',
            'is_active'
        ]
