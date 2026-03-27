from rest_framework import serializers
from apps.accounts.models import User, RoleChoices


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User/Employee management.
    """
    password = serializers.CharField(write_only=True, required=False, default='DefaultPass123!')

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'phone', 
            'role', 'is_active', 'created_at', 'password', 'geofencing_exempt'
        ]
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        password = validated_data.pop('password', 'DefaultPass123!')
        user = User.objects.create_user(password=password, **validated_data)
        user.must_change_password = True
        user.save(update_fields=['must_change_password'])
        return user


class UserMeSerializer(serializers.ModelSerializer):
    """
    Serializer for the current user's profile.
    """
    client_name = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'client', 'client_name']
        read_only_fields = fields
