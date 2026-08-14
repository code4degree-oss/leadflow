from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.utils import timezone

from apps.api.permissions import IsClientAdmin, IsManagerOrHigher
from apps.accounts.models import RoleChoices
from apps.leads.models import Lead, LeadStatus, ActivityTimeline, ActivityType, Project
from apps.leads.services import WhatsAppLeadExtractor


class WhatsAppExtractionMixin:
    """
    Two-step WhatsApp lead extraction flow:
    1. POST /leads/extract-whatsapp/  → parse raw text, return preview JSON
    2. POST /leads/import-whatsapp/   → accept reviewed leads, create in DB
    """

    @action(detail=False, methods=['post'], url_path='extract-whatsapp', permission_classes=[IsManagerOrHigher])
    def extract_whatsapp(self, request):
        """
        Parse raw WhatsApp forwarded text and return structured lead previews.
        Does NOT create any database records — purely a preview step.
        """
        raw_text = request.data.get('raw_text', '')
        if not raw_text or not raw_text.strip():
            return Response(
                {"error": "raw_text is required. Paste WhatsApp forwarded messages."},
                status=status.HTTP_400_BAD_REQUEST
            )

        extracted = WhatsAppLeadExtractor.extract_multiple(raw_text)

        if not extracted:
            return Response(
                {"error": "No valid leads found. Make sure messages contain name and phone fields."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enrich with duplicate detection against existing leads in this client
        client = request.user.client
        existing_phones = set(
            Lead.objects.filter(client=client)
            .values_list('phone', flat=True)
        )

        # Try to auto-match suggested projects
        active_projects = {
            p.name.lower(): {'id': str(p.id), 'name': p.name}
            for p in Project.objects.filter(client=client, is_active=True)
        }

        previews = []
        for i, lead_data in enumerate(extracted):
            phone = lead_data.get('phone', '')
            is_duplicate = phone in existing_phones if phone else False

            # Try to match suggested project
            matched_project = None
            suggested = lead_data.get('suggested_project', '').lower()
            if suggested:
                for proj_name, proj_info in active_projects.items():
                    if proj_name in suggested or suggested in proj_name:
                        matched_project = proj_info
                        break

            previews.append({
                'index': i,
                'first_name': lead_data.get('first_name', ''),
                'last_name': lead_data.get('last_name', ''),
                'phone': phone,
                'bhk_preference': lead_data.get('bhk_preference', ''),
                'location': lead_data.get('location', ''),
                'budget': lead_data.get('budget', ''),
                'source_detail': lead_data.get('source_detail', ''),
                'channel_partner': lead_data.get('channel_partner', ''),
                'suggested_project': lead_data.get('suggested_project', ''),
                'notes': lead_data.get('notes', ''),
                'raw_message': lead_data.get('raw_message', ''),
                'is_duplicate': is_duplicate,
                'matched_project': matched_project,
                'is_valid': bool(phone and lead_data.get('first_name')),
            })

        return Response({
            'total_extracted': len(previews),
            'valid_count': sum(1 for p in previews if p['is_valid']),
            'duplicate_count': sum(1 for p in previews if p['is_duplicate']),
            'leads': previews,
        })

    @action(detail=False, methods=['post'], url_path='import-whatsapp', permission_classes=[IsManagerOrHigher])
    def import_whatsapp(self, request):
        """
        Create leads from reviewed WhatsApp extraction data.
        Expects: { leads: [...], project_id?: str, assign_to?: str, skip_duplicates?: bool }
        """
        leads_data = request.data.get('leads', [])
        project_id = request.data.get('project_id')
        assign_to_id = request.data.get('assign_to')
        skip_duplicates = request.data.get('skip_duplicates', True)

        if not leads_data:
            return Response(
                {"error": "No leads provided."},
                status=status.HTTP_400_BAD_REQUEST
            )

        client = request.user.client

        # Resolve optional project
        project = None
        if project_id:
            try:
                project = Project.objects.get(id=project_id, client=client, is_active=True)
            except Project.DoesNotExist:
                return Response(
                    {"error": "Project not found or inactive."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Resolve optional assignee
        assign_to = None
        if assign_to_id:
            from apps.accounts.models import User
            try:
                assign_to = User.objects.get(id=assign_to_id, client=client, is_active=True)
            except User.DoesNotExist:
                return Response(
                    {"error": "Assigned user not found."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Get existing phones for duplicate check
        existing_phones = set(
            Lead.objects.filter(client=client).values_list('phone', flat=True)
        )

        created_leads = []
        skipped_count = 0
        error_log = []

        with transaction.atomic():
            for i, ld in enumerate(leads_data):
                phone = ld.get('phone', '').strip()
                first_name = ld.get('first_name', '').strip()

                # Validation
                if not phone or not first_name:
                    error_log.append({
                        'index': i,
                        'error': 'Missing phone or first name'
                    })
                    continue

                # Duplicate check
                if skip_duplicates and phone in existing_phones:
                    skipped_count += 1
                    continue

                # Parse budget to decimal
                budget_val = None
                budget_str = ld.get('budget', '')
                if budget_str:
                    try:
                        budget_val = int(budget_str)
                    except (ValueError, TypeError):
                        budget_val = None

                lead = Lead(
                    client=client,
                    first_name=first_name,
                    last_name=ld.get('last_name', '').strip(),
                    phone=phone,
                    status=LeadStatus.NEW,
                    source='WHATSAPP',
                    budget=budget_val,
                    area=ld.get('location', '').strip(),
                    interested_flat=ld.get('bhk_preference', '').strip(),
                    notes=ld.get('notes', '').strip(),
                    project=project,
                    assigned_to=assign_to,
                )
                lead.save()

                # Track for duplicate detection within the same batch
                existing_phones.add(phone)
                created_leads.append(lead)

            # Bulk create activity timeline entries
            activities = []
            for lead in created_leads:
                activities.append(
                    ActivityTimeline(
                        client=client,
                        lead=lead,
                        performed_by=request.user,
                        activity_type=ActivityType.IMPORTED,
                        title="Lead imported from WhatsApp paste",
                        metadata={
                            'source': 'WHATSAPP',
                            'project': project.name if project else None,
                            'assigned_to': assign_to.email if assign_to else None,
                        }
                    )
                )
            if activities:
                ActivityTimeline.objects.bulk_create(activities)

        return Response({
            'imported_count': len(created_leads),
            'skipped_duplicates': skipped_count,
            'errors': error_log,
            'total_submitted': len(leads_data),
        }, status=status.HTTP_201_CREATED)
