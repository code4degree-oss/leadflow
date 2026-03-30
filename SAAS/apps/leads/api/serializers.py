from rest_framework import serializers
from apps.leads.models import Lead, LeadStatus, LeadBatch, SiteVisit, FollowUpReminder, ActivityTimeline, ActivityType, Project
from apps.accounts.models import RoleChoices

class LeadSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    assigned_user_name = serializers.SerializerMethodField()
    masked_phone = serializers.SerializerMethodField()
    masked_email = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.name', read_only=True, default=None)
    field_agent_name = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            'id', 
            'client',
            'client_name',
            'first_name', 
            'last_name', 
            'email', 
            'phone',
            'masked_phone',
            'masked_email',
            'status', 
            'source', 
            'assigned_to', 
            'assigned_user_name',
            'next_call_at',
            'last_interaction_at',
            'lost_count',
            'budget',
            'interested_flat',
            'area',
            'notes',
            'is_hot',
            'field_agent',
            'field_agent_name',
            'project',
            'project_name',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['client', 'created_at', 'updated_at', 'last_interaction_at', 'lost_count']

    def get_assigned_user_name(self, obj):
        if obj.assigned_to:
            name = f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip()
            return name if name else obj.assigned_to.email
        return None

    def get_field_agent_name(self, obj):
        if obj.field_agent:
            name = f"{obj.field_agent.first_name} {obj.field_agent.last_name}".strip()
            return name if name else obj.field_agent.email
        return None

    def get_masked_phone(self, obj):
        """Mask phone for telecaller role: show last 4 digits only"""
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.role == RoleChoices.TELECALLER:
            if obj.phone and len(obj.phone) > 4:
                return '*' * (len(obj.phone) - 4) + obj.phone[-4:]
        return obj.phone

    def get_masked_email(self, obj):
        """Mask email for telecaller role"""
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.role == RoleChoices.TELECALLER:
            if obj.email and '@' in obj.email:
                local, domain = obj.email.split('@', 1)
                if len(local) > 2:
                    return local[0] + '*' * (len(local) - 2) + local[-1] + '@' + domain
        return obj.email

    def validate(self, attrs):
        if self.instance and 'status' in attrs:
            old_status = self.instance.status
            new_status = attrs['status']
            
            if old_status == LeadStatus.NEW and new_status in [LeadStatus.WON, LeadStatus.SITE_VISIT]:
                raise serializers.ValidationError({"status": "A new lead must be called before a site visit or win."})
                
        return attrs


class LeadBatchSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = LeadBatch
        fields = [
            'id',
            'client',
            'uploaded_by',
            'uploaded_by_name',
            'file',
            'status',
            'total_rows',
            'imported_count',
            'failed_count',
            'error_log',
            'created_at',
            'updated_at'
        ]
        read_only_fields = [
            'client', 'uploaded_by', 'status', 'total_rows', 
            'imported_count', 'failed_count', 'error_log', 
            'created_at', 'updated_at'
        ]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.email
        return None

class SiteVisitSerializer(serializers.ModelSerializer):
    lead_name = serializers.CharField(source='lead.first_name', read_only=True)
    agent_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = SiteVisit
        fields = [
            'id', 'client', 'lead', 'lead_name', 'agent', 'agent_name',
            'scheduled_at', 'completed_at', 'status', 'outcome', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['client', 'agent', 'created_at', 'updated_at']

    def get_agent_name(self, obj):
        if obj.agent:
            return f"{obj.agent.first_name} {obj.agent.last_name}".strip() or obj.agent.email
        return None


class FollowUpReminderSerializer(serializers.ModelSerializer):
    lead_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = FollowUpReminder
        fields = [
            'id', 'lead', 'lead_name', 'created_by',
            'scheduled_at', 'note', 'is_completed', 'email_sent',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'email_sent', 'created_at', 'updated_at']

    def get_lead_name(self, obj):
        return f"{obj.lead.first_name} {obj.lead.last_name}".strip()


class CallLogSerializer(serializers.Serializer):
    """Input serializer for the log_call action"""
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    budget = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    interested_flat = serializers.CharField(required=False, allow_blank=True, default='')
    area = serializers.CharField(required=False, allow_blank=True, default='')
    outcome = serializers.ChoiceField(choices=['INTERESTED', 'CALLBACK', 'LOST', 'CALLED', 'NOT_ANSWERED', 'WON'], required=True)
    next_call_at = serializers.DateTimeField(required=False, allow_null=True)
    follow_up_at = serializers.DateTimeField(required=False, allow_null=True)
    follow_up_note = serializers.CharField(required=False, allow_blank=True, default='')
    project_id = serializers.UUIDField(required=False, allow_null=True)
    field_agent_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, data):
        outcome = data.get('outcome')
        # Mandatory next-call for all outcomes except LOST
        if outcome not in ('LOST', 'WON') and not data.get('next_call_at'):
            # NOT_ANSWERED is auto-set by the view, so allow it through
            if outcome != 'NOT_ANSWERED':
                raise serializers.ValidationError({
                    'next_call_at': 'Next call date is required for this outcome.'
                })
        return data


class ProjectSerializer(serializers.ModelSerializer):
    lead_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Project
        fields = ['id', 'name', 'is_active', 'lead_count', 'created_at']
        read_only_fields = ['created_at']

    def get_lead_count(self, obj):
        return obj.leads.count()


class ActivityTimelineSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ActivityTimeline
        fields = [
            'id', 'activity_type', 'title', 'metadata',
            'performed_by', 'performed_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'activity_type', 'title', 'metadata', 'performed_by', 'created_at']

    def get_performed_by_name(self, obj):
        if obj.performed_by:
            name = f"{obj.performed_by.first_name} {obj.performed_by.last_name}".strip()
            return name if name else obj.performed_by.email
        return 'System'

