from rest_framework import serializers
from apps.clients.models import ClientAccount, ClientLocation

class ClientAccountSerializer(serializers.ModelSerializer):
    user_count = serializers.IntegerField(source='users.count', read_only=True)
    admin_email = serializers.EmailField(write_only=True, required=False)
    admin_first_name = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    admin_last_name = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    admin_phone = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    
    storage_used_mb = serializers.SerializerMethodField()
    subscription_status = serializers.CharField(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = ClientAccount
        fields = [
            'id', 'name', 'is_active', 'geofencing_enabled',
            'max_users', 'storage_quota_mb', 'plan', 'trial_days',
            'subscription_start', 'valid_until',
            'created_at', 'user_count', 'admin_email',
            'admin_first_name', 'admin_last_name', 'admin_phone', 'storage_used_mb',
            'subscription_status', 'days_remaining'
        ]
        read_only_fields = ['id', 'created_at']

    def get_storage_used_mb(self, obj):
        from apps.leads.models import LeadBatch
        total_bytes = 0
        try:
            for batch in LeadBatch.objects.filter(client=obj):
                if batch.file and hasattr(batch.file, 'size'):
                    try:
                        total_bytes += batch.file.size
                    except FileNotFoundError:
                        pass
        except Exception:
            pass
            
        if total_bytes > 0:
            return round(total_bytes / (1024 * 1024), 2)
        return 0.1 # Minimum usage to show up on charts

    def create(self, validated_data):
        # Remove write-only admin fields before saving to DB
        validated_data.pop('admin_email', None)
        validated_data.pop('admin_first_name', None)
        validated_data.pop('admin_last_name', None)
        validated_data.pop('admin_phone', None)
        return super().create(validated_data)

class ClientLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientLocation
        fields = ['id', 'name', 'geofence_type', 'latitude', 'longitude', 'radius_meters', 'polygon_coords', 'created_at']
        read_only_fields = ['id', 'created_at']
