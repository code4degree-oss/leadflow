from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db.models import Count, Q, Avg, F
import datetime

from apps.api.permissions import IsManagerOrHigher, IsClientAdmin
from apps.accounts.models import User, RoleChoices
from apps.leads.models import Lead, LeadStatus, ActivityTimeline, ActivityType, FollowUpReminder


class TeamLeadMixin:
    """
    Team Lead / Manager dashboard endpoints.
    Provides per-telecaller stats, lead health monitoring, and team reassignment.
    """

    @action(detail=False, methods=['get'], url_path='team-overview', permission_classes=[IsManagerOrHigher])
    def team_overview(self, request):
        """
        Comprehensive per-telecaller stats for the Team Lead dashboard.
        Returns detailed metrics for each telecaller in the organization.
        """
        client = request.user.client
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + datetime.timedelta(days=1)
        week_ago = today_start - datetime.timedelta(days=7)
        stale_threshold = timezone.now() - datetime.timedelta(hours=48)

        telecallers = User.objects.filter(
            client=client,
            role__in=[RoleChoices.TELECALLER, RoleChoices.FIELD_AGENT],
            is_active=True
        ).order_by('first_name')

        # Aggregate lead stats per telecaller in one query
        lead_stats = Lead.objects.filter(
            client=client,
            assigned_to__in=telecallers,
            is_archived=False
        ).values('assigned_to_id').annotate(
            total_leads=Count('id'),
            new_leads=Count('id', filter=Q(status=LeadStatus.NEW)),
            in_progress=Count('id', filter=Q(status__in=[
                LeadStatus.CALLED, LeadStatus.NOT_ANSWERED,
                LeadStatus.INTERESTED, LeadStatus.FOLLOW_UP,
                LeadStatus.HIGH_PROSPECT
            ])),
            won_leads=Count('id', filter=Q(status=LeadStatus.WON)),
            lost_leads=Count('id', filter=Q(status=LeadStatus.LOST)),
            hot_leads=Count('id', filter=Q(is_hot=True)),
            site_visits=Count('id', filter=Q(status__in=[LeadStatus.SITE_VISIT, LeadStatus.VISITED])),
            stale_leads=Count('id', filter=Q(
                last_interaction_at__lt=stale_threshold,
                status__in=[LeadStatus.NEW, LeadStatus.CALLED, LeadStatus.NOT_ANSWERED,
                            LeadStatus.INTERESTED, LeadStatus.FOLLOW_UP]
            )),
        )
        lead_stats_map = {s['assigned_to_id']: s for s in lead_stats}

        # Calls today per telecaller
        calls_today = ActivityTimeline.objects.filter(
            client=client,
            activity_type=ActivityType.CALL_LOGGED,
            created_at__gte=today_start,
            created_at__lt=today_end,
        ).values('performed_by_id').annotate(
            calls=Count('lead_id', distinct=True)
        )
        calls_map = {c['performed_by_id']: c['calls'] for c in calls_today}

        # Calls this week per telecaller
        calls_week = ActivityTimeline.objects.filter(
            client=client,
            activity_type=ActivityType.CALL_LOGGED,
            created_at__gte=week_ago,
        ).values('performed_by_id').annotate(
            calls=Count('lead_id', distinct=True)
        )
        calls_week_map = {c['performed_by_id']: c['calls'] for c in calls_week}

        # Overdue follow-ups per telecaller
        overdue_followups = FollowUpReminder.objects.filter(
            client=client,
            is_completed=False,
            scheduled_at__lt=timezone.now(),
        ).values('created_by_id').annotate(
            overdue=Count('id')
        )
        overdue_map = {f['created_by_id']: f['overdue'] for f in overdue_followups}

        team_data = []
        total_leads = 0
        total_won = 0
        total_hot = 0
        total_stale = 0

        for tc in telecallers:
            stats = lead_stats_map.get(tc.id, {})
            tc_total = stats.get('total_leads', 0)
            tc_won = stats.get('won_leads', 0)
            tc_stale = stats.get('stale_leads', 0)
            tc_hot = stats.get('hot_leads', 0)

            total_leads += tc_total
            total_won += tc_won
            total_hot += tc_hot
            total_stale += tc_stale

            conversion_rate = round((tc_won / tc_total * 100), 1) if tc_total > 0 else 0

            team_data.append({
                'id': str(tc.id),
                'name': f"{tc.first_name} {tc.last_name}".strip() or tc.email,
                'email': tc.email,
                'role': tc.role,
                'last_login': tc.last_login.isoformat() if tc.last_login else None,

                # Lead counts
                'total_leads': tc_total,
                'new_leads': stats.get('new_leads', 0),
                'in_progress': stats.get('in_progress', 0),
                'won_leads': tc_won,
                'lost_leads': stats.get('lost_leads', 0),
                'hot_leads': tc_hot,
                'site_visits': stats.get('site_visits', 0),
                'stale_leads': tc_stale,

                # Activity
                'calls_today': calls_map.get(tc.id, 0),
                'calls_this_week': calls_week_map.get(tc.id, 0),
                'overdue_followups': overdue_map.get(tc.id, 0),

                # Metrics
                'conversion_rate': conversion_rate,
                'daily_target': client.daily_telecaller_target if tc.role == RoleChoices.TELECALLER else client.daily_field_agent_target,
            })

        # Sort by calls today descending
        team_data.sort(key=lambda x: x['calls_today'], reverse=True)

        team_conversion = round((total_won / total_leads * 100), 1) if total_leads > 0 else 0

        return Response({
            'summary': {
                'total_telecallers': len(team_data),
                'total_leads': total_leads,
                'total_won': total_won,
                'total_hot': total_hot,
                'total_stale': total_stale,
                'team_conversion_rate': team_conversion,
                'total_calls_today': sum(t['calls_today'] for t in team_data),
                'total_overdue_followups': sum(t['overdue_followups'] for t in team_data),
            },
            'team': team_data,
        })

    @action(detail=False, methods=['post'], url_path='manager-reassign', permission_classes=[IsManagerOrHigher])
    def manager_reassign(self, request):
        """
        Allow managers to reassign specific leads between telecallers.
        Expects: { lead_ids: [...], to_user_id: str }
        """
        lead_ids = request.data.get('lead_ids', [])
        to_user_id = request.data.get('to_user_id')

        if not lead_ids or not to_user_id:
            return Response(
                {"error": "lead_ids and to_user_id are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        client = request.user.client

        try:
            to_user = User.objects.get(id=to_user_id, client=client, is_active=True)
        except User.DoesNotExist:
            return Response({"error": "Target user not found."}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction
        from apps.leads.models import LeadAssignmentHistory

        reassigned_count = 0
        with transaction.atomic():
            leads = Lead.objects.filter(
                id__in=lead_ids,
                client=client,
                is_archived=False
            ).select_for_update()

            activities = []
            histories = []

            for lead in leads:
                old_assignee = lead.assigned_to
                lead.assigned_to = to_user
                lead.save(update_fields=['assigned_to', 'updated_at'])

                activities.append(
                    ActivityTimeline(
                        client=client,
                        lead=lead,
                        performed_by=request.user,
                        activity_type=ActivityType.REASSIGNED,
                        title=f"Lead reassigned to {to_user.first_name} {to_user.last_name}".strip(),
                        metadata={
                            'from_user': old_assignee.email if old_assignee else None,
                            'to_user': to_user.email,
                            'reason': 'manager_reassignment',
                        }
                    )
                )
                histories.append(
                    LeadAssignmentHistory(
                        client=client,
                        lead=lead,
                        from_user=old_assignee,
                        to_user=to_user,
                        changed_by=request.user,
                        reason='manager_reassignment',
                    )
                )
                reassigned_count += 1

            if activities:
                ActivityTimeline.objects.bulk_create(activities)
            if histories:
                LeadAssignmentHistory.objects.bulk_create(histories)

        return Response({
            'detail': f'Successfully reassigned {reassigned_count} leads to {to_user.first_name} {to_user.last_name}.',
            'reassigned_count': reassigned_count,
        })
