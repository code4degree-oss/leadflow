from rest_framework import serializers
from apps.audits.models import AuditLog, LoginHistory


class AuditLogSerializer(serializers.ModelSerializer):
    """Read-only serializer for immutable audit logs."""
    user_email = serializers.CharField(source='user.email', read_only=True, default='System')

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_email', 'action', 'resource_type',
            'resource_id', 'changes', 'ip_address', 'created_at',
        ]
        read_only_fields = fields  # Entirely read-only


class LoginHistorySerializer(serializers.ModelSerializer):
    """Read-only serializer for login tracking records."""
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = LoginHistory
        fields = [
            'id', 'user', 'user_email', 'ip_address', 'city', 'country',
            'latitude', 'longitude', 'is_suspicious', 'suspicious_reason',
            'created_at',
        ]
        read_only_fields = fields
