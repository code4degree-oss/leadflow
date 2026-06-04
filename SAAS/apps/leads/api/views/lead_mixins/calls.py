from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
import datetime
import threading
from apps.leads.api.serializers import CallLogSerializer
from apps.accounts.models import User, RoleChoices
from apps.leads.models import LeadStatus, ActivityTimeline, ActivityType, FollowUpReminder, Project, Notification, NotificationType
from apps.audits.services import AuditService

class LeadCallsMixin:
    @action(detail=True, methods=['post'], url_path='log-call')
    def log_call(self, request, pk=None):
        lead = self.get_object()
        serializer = CallLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data.get('notes'):
            lead.notes = data['notes']
        if data.get('budget') is not None:
            lead.budget = data['budget']
        if data.get('interested_flat'):
            lead.interested_flat = data['interested_flat']
        if data.get('area'):
            lead.area = data['area']

        project_id = data.get('project_id')
        if project_id:
            try:
                lead.project = Project.objects.get(id=project_id, client=lead.client)
            except Project.DoesNotExist:
                pass

        field_agent_id = data.get('field_agent_id')
        if field_agent_id:
            try:
                agent = User.objects.get(id=field_agent_id, client=lead.client, role=RoleChoices.FIELD_AGENT, is_active=True)
                lead.field_agent = agent
            except User.DoesNotExist:
                pass

        lead.last_interaction_at = timezone.now()
        outcome = data['outcome']

        next_call_at = data.get('next_call_at')
        if next_call_at:
            lead.next_call_at = next_call_at

        if outcome == 'INTERESTED':
            old_status = lead.status
            lead.status = LeadStatus.INTERESTED
            lead.save()
            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.CALL_LOGGED,
                title=f"Call logged \u2014 marked Interested (next: {lead.next_call_at.strftime('%d %b') if lead.next_call_at else 'N/A'})",
                metadata={'outcome': outcome, 'old_status': old_status, 'new_status': lead.status, 'next_call_at': str(lead.next_call_at)}
            )
            return Response({"detail": "Lead marked as interested.", "status": lead.status})

        elif outcome == 'CALLED':
            old_status = lead.status
            lead.status = LeadStatus.CALLED
            lead.save()
            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.CALL_LOGGED,
                title=f"Call logged \u2014 general call (next: {lead.next_call_at.strftime('%d %b') if lead.next_call_at else 'N/A'})",
                metadata={'outcome': outcome, 'old_status': old_status, 'new_status': lead.status}
            )
            return Response({"detail": "Call logged.", "status": lead.status})

        elif outcome == 'NOT_ANSWERED':
            old_status = lead.status
            lead.status = LeadStatus.NOT_ANSWERED
            
            # Smart 4-hour retry: if within working hours (9AM-7PM), retry in 4h
            # Otherwise, schedule for next business day 9AM
            now = timezone.now()
            four_hours_later = now + datetime.timedelta(hours=4)
            
            # Check if 4 hours later falls within working hours (9AM-7PM) on a weekday
            if four_hours_later.hour >= 9 and four_hours_later.hour < 19 and four_hours_later.weekday() < 5:
                lead.next_call_at = four_hours_later
                retry_label = f"{four_hours_later.strftime('%I:%M %p')} today"
            else:
                # Next business day at 9 AM
                tomorrow = now + datetime.timedelta(days=1)
                while tomorrow.weekday() in (5, 6):
                    tomorrow += datetime.timedelta(days=1)
                lead.next_call_at = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
                retry_label = f"{lead.next_call_at.strftime('%d %b, %I:%M %p')}"
            
            lead.save()
            
            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.CALL_LOGGED,
                title=f"Call attempted — not answered (auto-retry: {retry_label})",
                metadata={'outcome': outcome, 'old_status': old_status, 'auto_retry': str(lead.next_call_at)}
            )
            
            # Auto-create a FollowUpReminder so the reminder engine notifies the agent
            FollowUpReminder.objects.create(
                client=lead.client, lead=lead, created_by=request.user,
                scheduled_at=lead.next_call_at,
                note=f"Auto-scheduled: Not answered at {now.strftime('%I:%M %p')}"
            )
            
            return Response({
                "detail": f"Not answered. Auto-scheduled retry for {retry_label}.",
                "status": lead.status,
                "next_call_at": str(lead.next_call_at)
            })

        elif outcome == 'CALLBACK':
            old_status = lead.status
            lead.status = LeadStatus.CALLED
            lead.save()
            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.CALL_LOGGED,
                title=f"Call logged \u2014 callback requested",
                metadata={'outcome': outcome, 'old_status': old_status}
            )
            follow_up_at = data.get('follow_up_at')
            if follow_up_at:
                FollowUpReminder.objects.create(
                    client=lead.client, lead=lead, created_by=request.user,
                    scheduled_at=follow_up_at,
                    note=data.get('follow_up_note', '')
                )
                ActivityTimeline.objects.create(
                    client=lead.client, lead=lead, performed_by=request.user,
                    activity_type=ActivityType.FOLLOW_UP_SET,
                    title=f"Follow-up scheduled for {follow_up_at.strftime('%d %b %Y, %I:%M %p')}",
                    metadata={'outcome': outcome, 'follow_up_at': str(follow_up_at), 'old_status': old_status}
                )
            return Response({"detail": "Callback scheduled.", "status": lead.status})

        elif outcome == 'WON':
            old_status = lead.status
            lead.status = LeadStatus.WON
            lead.last_interaction_at = timezone.now()
            lead.next_call_at = None
            lead.save()
            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.CALL_LOGGED,
                title=f"🎉 Lead marked as WON by {request.user.first_name} {request.user.last_name}",
                metadata={'outcome': outcome, 'old_status': old_status, 'new_status': 'WON',
                          'telecaller': request.user.email,
                          'field_agent': lead.field_agent.email if lead.field_agent else None}
            )
            AuditService.record_action(
                user=request.user,
                action="LEAD_WON",
                resource_type="Lead",
                resource_id=lead.id,
                changes={'old_status': old_status, 'telecaller': request.user.email,
                         'field_agent': lead.field_agent.email if lead.field_agent else None}
            )
            lead_name = f"{lead.first_name} {lead.last_name}".strip()
            tc_name = f"{request.user.first_name} {request.user.last_name}".strip()
            admins = User.objects.filter(client=lead.client, role=RoleChoices.CLIENT_ADMIN, is_active=True)
            
            from apps.leads.tasks import send_push_notification_task
            for admin in admins:
                notif = Notification.objects.create(
                    client=lead.client, user=admin,
                    title=f"🎉 Lead {lead_name} won!",
                    message=f"Converted by {tc_name}",
                    notif_type=NotificationType.WON, lead=lead,
                )
                send_push_notification_task.delay(notif.id)

            return Response({"detail": "🎉 Lead marked as WON!", "status": lead.status})

        elif outcome == 'LOST':
            lead.next_call_at = None
            return self._handle_lost(lead, request)

        elif outcome == 'INVALID_NUMBER':
            old_status = lead.status
            lead.status = LeadStatus.INVALID_NUMBER
            lead.lost_count = 4
            lead.next_call_at = None
            lead.save()
            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.CALL_LOGGED,
                title="Call logged \u2014 marked Invalid Number (dead number)",
                metadata={'outcome': 'INVALID_NUMBER', 'old_status': old_status}
            )
            return Response({"detail": "Lead marked as Invalid Number.", "status": lead.status})

        lead.save()
        return Response({"detail": "Call logged.", "status": lead.status})
