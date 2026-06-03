from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db.models import Count, Q
import datetime
from apps.api.permissions import IsManagerOrHigher, IsClientAdmin
from apps.accounts.models import User, RoleChoices
from apps.leads.models import Lead, LeadStatus, ActivityTimeline, ActivityType, FollowUpReminder

class LeadAnalyticsMixin:
    @action(detail=False, methods=['get'], url_path='batch-progress', permission_classes=[IsManagerOrHigher])
    def batch_progress(self, request):
        from django.db.models import Max
        qs = self.get_queryset()
        
        batch_counts = qs.values('batch_id', 'batch__name', 'batch__created_at', 'source').annotate(
            total=Count('id'),
            new_leads=Count('id', filter=Q(status__in=[LeadStatus.NEW, 'IMPORTED'])),
            in_progress=Count('id', filter=Q(status__in=[LeadStatus.CALLED, 'CALLBACK', LeadStatus.INTERESTED, LeadStatus.SITE_VISIT, LeadStatus.NOT_ANSWERED])),
            covered=Count('id', filter=~Q(status__in=[LeadStatus.NEW, 'IMPORTED'])),
            won=Count('id', filter=Q(status=LeadStatus.WON)),
            lost=Count('id', filter=Q(status=LeadStatus.LOST)),
            hot_leads=Count('id', filter=Q(is_hot=True)),
            interested_leads=Count('id', filter=Q(status=LeadStatus.INTERESTED)),
            wrong_leads=Count('id', filter=Q(status__in=[LeadStatus.LOST, 'INVALID_NUMBER'])),
            last_upload=Max('created_at')
        ).order_by('-batch__created_at', '-last_upload')

        results = []
        for b in batch_counts:
            # If batch__name exists, use it. Otherwise fallback to source, then "Unknown/Manual"
            source_name = b['batch__name'] or b['source'] or "Unknown/Manual"
            
            total = b['total']
            covered = b['covered']
            progress_pct = round((covered / total * 100), 1) if total > 0 else 0
            
            created_at = b['batch__created_at'] or b['last_upload']
            
            results.append({
                "source": source_name,
                "batch_id": str(b['batch_id']) if b['batch_id'] else None,
                "total": total,
                "new_leads": b['new_leads'],
                "in_progress": b['in_progress'],
                "covered": covered,
                "won": b['won'],
                "lost": b['lost'],
                "hot_leads": b['hot_leads'],
                "interested_leads": b['interested_leads'],
                "wrong_leads": b['wrong_leads'],
                "created_at": created_at.isoformat() if created_at else None,
                "progress_percentage": progress_pct
            })
            
        return Response(results)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        from apps.leads.api.serializers import LeadSerializer
        queryset = self.get_queryset()
        
        is_admin = request.user.role in [RoleChoices.CLIENT_ADMIN, RoleChoices.SUPER_ADMIN, RoleChoices.MANAGER] or request.user.is_superuser
        if not is_admin:
            if request.user.role == RoleChoices.FIELD_AGENT:
                queryset = queryset.filter(Q(assigned_to=request.user) | Q(field_agent=request.user)).distinct()
            else:
                queryset = queryset.filter(assigned_to=request.user)

        status_counts = queryset.values('status').annotate(count=Count('id'))
        stats_map = {item['status']: item['count'] for item in status_counts}
        lead_statuses = ['NEW', 'CALLED', 'NOT_ANSWERED', 'INTERESTED', 'SITE_VISIT', 'WON', 'LOST', 'INVALID_NUMBER']
        formatted_stats = {s: stats_map.get(s, 0) for s in lead_statuses}
        total_leads = sum(formatted_stats.values())
        
        source_counts = queryset.values('source').annotate(
            total=Count('id'),
            won=Count('id', filter=Q(status='WON'))
        )
        source_performance = [
            {
                "source": item['source'],
                "count": item['total'],
                "conversion_rate": round((item['won'] / item['total'] * 100), 2) if item['total'] > 0 else 0
            } for item in source_counts
        ]

        team_stats = []
        if is_admin:
            team_counts = queryset.values('assigned_to__email', 'assigned_to__first_name').annotate(
                total=Count('id'),
                won=Count('id', filter=Q(status='WON')),
                interested=Count('id', filter=Q(status='INTERESTED'))
            ).filter(assigned_to__isnull=False)
            
            team_stats = [
                {
                    "user": item['assigned_to__first_name'] or item['assigned_to__email'],
                    "total": item['total'],
                    "won": item['won'],
                    "interested": item['interested'],
                    "conversion": round((item['won'] / item['total'] * 100), 2) if item['total'] > 0 else 0
                } for item in team_counts
            ]

        recent_leads = queryset.order_by('-updated_at')[:5]
        recent_data = LeadSerializer(recent_leads, many=True, context={'request': request}).data

        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + datetime.timedelta(days=1)
        
        calls_today = ActivityTimeline.objects.filter(
            client=request.user.client,
            performed_by=request.user,
            activity_type=ActivityType.CALL_LOGGED,
            created_at__gte=today_start,
            created_at__lt=today_end
        ).values('lead_id').distinct().count()

        return Response({
            "status_counts": formatted_stats,
            "total_leads": total_leads,
            "source_performance": source_performance,
            "team_performance": team_stats,
            "recent_activity": recent_data,
            "conversion_rate": round((formatted_stats.get('WON', 0) / total_leads * 100), 2) if total_leads > 0 else 0,
            "calls_today": calls_today,
        })

    @action(detail=False, methods=['get'], url_path='performance-report', permission_classes=[IsManagerOrHigher])
    def performance_report(self, request):
        client = request.user.client
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + datetime.timedelta(days=1)
        month_start = today_start.replace(day=1)
        
        total_calls_today = ActivityTimeline.objects.filter(
            client=client, activity_type=ActivityType.CALL_LOGGED, created_at__gte=today_start, created_at__lt=today_end
        ).count()
        
        leads_won_month = Lead.objects.filter(client=client, status=LeadStatus.WON, updated_at__gte=month_start).count()
        
        site_visits_month = ActivityTimeline.objects.filter(
            client=client, activity_type=ActivityType.SITE_VISIT_SCHEDULED, created_at__gte=month_start
        ).count()
        
        total_leads = Lead.objects.filter(client=client).count()
        total_won = Lead.objects.filter(client=client, status=LeadStatus.WON).count()
        conversion_rate = round((total_won / total_leads * 100), 1) if total_leads > 0 else 0

        # Optimize outcome breakdown with DB aggregation
        outcomes_agg = ActivityTimeline.objects.filter(
            client=client, activity_type=ActivityType.CALL_LOGGED, created_at__gte=today_start, created_at__lt=today_end
        ).values('metadata__outcome').annotate(count=Count('id'))
        
        outcome_breakdown = []
        for agg in outcomes_agg:
            name = agg.get('metadata__outcome') or 'UNKNOWN'
            outcome_breakdown.append({"name": name, "value": agg['count']})

        recent_activities = ActivityTimeline.objects.filter(
            client=client
        ).select_related('performed_by').order_by('-created_at')[:12]
        
        activity_stream = []
        for act in recent_activities:
            activity_stream.append({
                "id": act.id,
                "title": act.title,
                "user": f"{act.performed_by.first_name} {act.performed_by.last_name}" if act.performed_by else "System",
                "time": act.created_at.strftime("%I:%M %p"),
                "type": act.activity_type
            })

        employees = User.objects.filter(
            client=client, 
            role__in=[RoleChoices.TELECALLER, RoleChoices.FIELD_AGENT], 
            is_active=True
        )
        
        user_stats = {emp.id: {
            "id": emp.id,
            "name": f"{emp.first_name} {emp.last_name}",
            "role": emp.role,
            "calls_today": 0,
            "won_today": 0,
            "lost_today": 0,
            "visits_today": 0,
            "target": client.daily_telecaller_target if emp.role == RoleChoices.TELECALLER else client.daily_field_agent_target,
            "last_login": emp.last_login.strftime("%I:%M %p") if emp.last_login else "N/A"
        } for emp in employees}

        # Optimize user_called_leads with DB aggregations
        user_calls_agg = ActivityTimeline.objects.filter(
            client=client, activity_type=ActivityType.CALL_LOGGED, created_at__gte=today_start, created_at__lt=today_end
        ).values('performed_by_id').annotate(calls_today=Count('lead_id', distinct=True))
        
        for agg in user_calls_agg:
            uid = agg['performed_by_id']
            if uid in user_stats:
                user_stats[uid]["calls_today"] = agg['calls_today']

        user_won_agg = ActivityTimeline.objects.filter(
            client=client, activity_type=ActivityType.CALL_LOGGED, created_at__gte=today_start, created_at__lt=today_end, metadata__outcome='WON'
        ).values('performed_by_id').annotate(won_today=Count('id'))
        
        for agg in user_won_agg:
            uid = agg['performed_by_id']
            if uid in user_stats:
                user_stats[uid]["won_today"] = agg['won_today']
                
        user_lost_agg = ActivityTimeline.objects.filter(
            client=client, activity_type=ActivityType.CALL_LOGGED, created_at__gte=today_start, created_at__lt=today_end, metadata__outcome='LOST'
        ).values('performed_by_id').annotate(lost_today=Count('id'))
        
        for agg in user_lost_agg:
            uid = agg['performed_by_id']
            if uid in user_stats:
                user_stats[uid]["lost_today"] = agg['lost_today']

        visits_today = ActivityTimeline.objects.filter(
            client=client, activity_type=ActivityType.SITE_VISIT_SCHEDULED, created_at__gte=today_start, created_at__lt=today_end
        )
        for visit in visits_today:
            uid = visit.performed_by_id
            if uid in user_stats:
                user_stats[uid]["visits_today"] += 1

        team_performance = list(user_stats.values())
        team_performance.sort(key=lambda x: x["calls_today"], reverse=True)

        return Response({
            "kpis": {
                "total_calls_today": total_calls_today,
                "leads_won_month": leads_won_month,
                "site_visits_month": site_visits_month,
                "conversion_rate": conversion_rate
            },
            "outcome_breakdown": outcome_breakdown,
            "activity_stream": activity_stream,
            "team_performance": team_performance,
            "target_telecaller": client.daily_telecaller_target
        })

    @action(detail=False, methods=['get'], url_path='won-leads')
    def won_leads(self, request):
        qs = self.get_queryset().filter(status=LeadStatus.WON).select_related(
            'assigned_to', 'field_agent', 'project'
        ).order_by('-updated_at')
        
        results = []
        for lead in qs:
            tc_name = ''
            fa_name = ''
            if lead.assigned_to:
                tc_name = f"{lead.assigned_to.first_name} {lead.assigned_to.last_name}".strip() or lead.assigned_to.email
            if lead.field_agent:
                fa_name = f"{lead.field_agent.first_name} {lead.field_agent.last_name}".strip() or lead.field_agent.email
            
            results.append({
                'id': str(lead.id),
                'first_name': lead.first_name,
                'last_name': lead.last_name,
                'phone': lead.phone,
                'email': lead.email,
                'project_name': lead.project.name if lead.project else None,
                'budget': str(lead.budget) if lead.budget else None,
                'telecaller_name': tc_name,
                'field_agent_name': fa_name,
                'won_date': lead.updated_at.isoformat() if lead.updated_at else None,
                'source': lead.source,
            })
        
        return Response(results)

    @action(detail=False, methods=['get'], url_path='daily-target')
    def daily_target(self, request):
        client = request.user.client
        if not client:
            return Response({"detail": "No client account."}, status=status.HTTP_400_BAD_REQUEST)
        
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + datetime.timedelta(days=1)
        
        calls_today = ActivityTimeline.objects.filter(
            client=client,
            performed_by=request.user,
            activity_type=ActivityType.CALL_LOGGED,
            created_at__gte=today_start,
            created_at__lt=today_end
        ).values('lead_id').distinct().count()
        
        target = client.daily_telecaller_target if request.user.role == RoleChoices.TELECALLER else client.daily_field_agent_target
        
        pending_followups_qs = FollowUpReminder.objects.filter(
            client=client, created_by=request.user, is_completed=False, scheduled_at__lt=today_end
        )
        pending_followups_count = pending_followups_qs.count()
        pending_followups_lead_ids = list(pending_followups_qs.values_list('lead_id', flat=True))
        
        pending_leads_count = Lead.objects.filter(
            client=client, next_call_at__lt=today_end
        ).exclude(
            status__in=[LeadStatus.WON, 'LOST', 'IMPORTED']
        ).exclude(
            id__in=pending_followups_lead_ids
        ).count()
        
        total_dynamic_target = target + pending_followups_count + pending_leads_count
        
        return Response({
            "target": total_dynamic_target,
            "progress": calls_today,
            "telecaller_target": client.daily_telecaller_target,
            "field_agent_target": client.daily_field_agent_target,
            "base_target": target,
        })

    @action(detail=False, methods=['put'], url_path='set-daily-target', permission_classes=[IsClientAdmin])
    def set_daily_target(self, request):
        client = request.user.client
        if not client:
            return Response({"detail": "No client account."}, status=status.HTTP_400_BAD_REQUEST)
        
        tc_target = request.data.get('telecaller_target')
        fa_target = request.data.get('field_agent_target')
        
        if tc_target is not None:
            client.daily_telecaller_target = int(tc_target)
        if fa_target is not None:
            client.daily_field_agent_target = int(fa_target)
        client.save()
        
        return Response({
            "detail": "Daily targets updated.",
            "telecaller_target": client.daily_telecaller_target,
            "field_agent_target": client.daily_field_agent_target,
        })
