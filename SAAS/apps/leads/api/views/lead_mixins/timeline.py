from rest_framework.decorators import action
from rest_framework.response import Response
from apps.leads.api.serializers import ActivityTimelineSerializer, FollowUpReminderSerializer
from apps.leads.models import ActivityTimeline, FollowUpReminder

class LeadTimelineMixin:
    @action(detail=True, methods=['get'], url_path='timeline')
    def timeline(self, request, pk=None):
        lead = self.get_object()
        events = ActivityTimeline.objects.filter(
            lead=lead
        ).select_related('performed_by').order_by('-created_at')[:50]
        serializer = ActivityTimelineSerializer(events, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='follow-ups')
    def follow_ups(self, request, pk=None):
        lead = self.get_object()
        reminders = FollowUpReminder.objects.filter(
            lead=lead
        ).select_related('created_by').order_by('-scheduled_at')
        serializer = FollowUpReminderSerializer(reminders, many=True)
        return Response(serializer.data)
