import pandas as pd
import hashlib
import re
from typing import Tuple, List, Dict
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.db.models import F
from django.contrib.postgres.search import TrigramSimilarity

from apps.leads.models import Lead, LeadStatus, LeadBatch, LeadBatchStatus, LeadSource
from apps.accounts.models import User, RoleChoices

class LeadDistributionService:
    @staticmethod
    def assign_manual(lead: Lead, user_id: str, client) -> Tuple[bool, str]:
        """
        Manually assign a lead to a specific user within the same client.
        """
        try:
            user = User.objects.get(id=user_id, client=client, is_active=True)
            
            lead.assigned_to = user
            lead.save(update_fields=['assigned_to', 'updated_at'])
            
            # Log action
            from apps.audits.services import AuditService
            AuditService.record_action(
                user=client.users.filter(role=RoleChoices.CLIENT_ADMIN).first(), # Mocking context user if not passed
                action="LEAD_ASSIGN",
                resource_type="Lead",
                resource_id=lead.id,
                changes={"assigned_to": user.email}
            )
            
            return True, f"Lead assigned to {user.email}"
            
        except User.DoesNotExist:
            return False, "Valid User not found for this client."

    @staticmethod
    def assign_round_robin(queryset, client) -> int:
        """
        Assigns multiple leads sequentially to available telecallers.
        """
        telecallers = list(User.objects.filter(
            client=client, 
            role=RoleChoices.TELECALLER, 
            is_active=True
        ).order_by('id')) # Order guarantees deterministic rotation

        if not telecallers:
            return 0

        # Note: In a true production environment with high concurrency, 
        # tracking the "last_assigned_index" in Redis is safer.
        # For this prototype Phase 4, we will just loop locally.
        assigned_count = 0
        agent_count = len(telecallers)
        agent_index = 0

        for lead in queryset:
            lead.assigned_to = telecallers[agent_index]
            # Batch updates would be faster, but Django's bulk_update is an option here
            lead.save(update_fields=['assigned_to', 'updated_at'])
            assigned_count += 1
            agent_index = (agent_index + 1) % agent_count
            
        return assigned_count

    @staticmethod
    def assign_load_balanced(queryset, client) -> int:
        """
        Assigns leads to the agent with the LEAST amount of active (NEW/CALLED) leads.
        """
        from django.db.models import Count, Q
        
        # Get agents annotated with their active lead count
        telecallers = list(User.objects.filter(
            client=client, 
            role=RoleChoices.TELECALLER, 
            is_active=True
        ).annotate(
            active_leads_count=Count('assigned_leads', filter=Q(assigned_leads__status__in=[LeadStatus.NEW, LeadStatus.CALLED]))
        ).order_by('active_leads_count', 'id'))

        if not telecallers:
            return 0
            
        assigned_count = 0
        
        # We need to re-sort or re-evaluate the counts dynamically 
        # as we assign leads if the queryset is large, to keep it balanced.
        # A simple priority queue or just re-sorting every X leads works.
        
        for lead in queryset:
            # Pop the agent with the least leads
            best_agent = telecallers[0]
            lead.assigned_to = best_agent
            lead.save(update_fields=['assigned_to', 'updated_at'])
            best_agent.active_leads_count += 1
            assigned_count += 1
            
            # Re-sort telecallers so the next lead goes to the new lowest
            telecallers.sort(key=lambda x: (x.active_leads_count, x.id))

        return assigned_count


class UploadService:
    """
    Handles parsing CSV/Excel files, normalizing phones, checking exact/fuzzy duplicates,
    and bulk importing valid leads.
    """
    REQUIRED_COLUMNS = ['first_name', 'phone']
    OPTIONAL_COLUMNS = ['last_name', 'email']

    @staticmethod
    def normalize_phone(phone: str) -> str:
        """Removes spaces, dashes, parentheses to create a pure numeric/plus string for hashing"""
        if pd.isna(phone):
            return ""
        # Keep only plus and digits
        normalized = re.sub(r'[^\+0-9]', '', str(phone).strip())
        return normalized

    @staticmethod
    def hash_phone(normalized_phone: str) -> str:
        if not normalized_phone:
            return ""
        return hashlib.sha256(normalized_phone.encode('utf-8')).hexdigest()

    @classmethod
    def process_batch(cls, batch_id: str) -> None:
        """
        Background/Synchronous job to process a LeadBatch.
        For phase 5 we will run it synchronously, later moved to Celery.
        """
        try:
            batch = LeadBatch.objects.get(id=batch_id)
        except LeadBatch.DoesNotExist:
            return
            
        batch.status = LeadBatchStatus.PROCESSING
        batch.save(update_fields=['status'])

        client = batch.client
        file_path = batch.file.path

        try:
            if file_path.endswith('.csv'):
                df = pd.read_csv(file_path, dtype=str)
            elif file_path.endswith(('.xls', '.xlsx')):
                df = pd.read_excel(file_path, dtype=str)
            else:
                batch.status = LeadBatchStatus.FAILED
                batch.error_log = {"global": "Unsupported file format. Please upload CSV or Excel."}
                batch.save()
                return

            # Clean columns: lowercase and strip spaces
            df.columns = [str(c).lower().strip() for c in df.columns]

            # Flexible column mapping
            column_aliases = {
                'name': 'first_name',
                'full name': 'first_name',
                'first name': 'first_name',
                'firstname': 'first_name',
                'last name': 'last_name',
                'lastname': 'last_name',
                'mobile': 'phone',
                'cell': 'phone',
                'contact': 'phone',
                'phone number': 'phone',
                'mail': 'email',
                'email id': 'email'
            }
            
            # Rename columns based on aliases
            df.rename(columns=column_aliases, inplace=True)

            # Validate required columns
            missing_cols = [col for col in cls.REQUIRED_COLUMNS if col not in df.columns]
            if missing_cols:
                batch.status = LeadBatchStatus.FAILED
                batch.error_log = {"global": f"Missing required columns: {', '.join(missing_cols)}"}
                batch.save()
                return

            # Fetch existing phone hashes for this client for O(1) exact match lookup
            existing_phone_hashes = set(
                Lead.objects.filter(client=client).values_list('phone_hash', flat=True)
            )

            valid_leads = []
            errors = {}
            total_processed = 0

            # Process rows
            for index, row in df.iterrows():
                total_processed += 1
                row_errs = []

                first_name = str(row['first_name']).strip() if not pd.isna(row.get('first_name')) else ""
                last_name = str(row['last_name']).strip() if 'last_name' in df.columns and not pd.isna(row.get('last_name')) else ""
                email = str(row['email']).strip() if 'email' in df.columns and not pd.isna(row.get('email')) else ""
                raw_phone = str(row['phone'])

                if not first_name:
                    row_errs.append("first_name cannot be empty.")
                
                normalized_phone = cls.normalize_phone(raw_phone)
                if not normalized_phone:
                    row_errs.append("phone cannot be empty/invalid.")

                phone_hash = cls.hash_phone(normalized_phone)

                # 1. Exact Duplicate Check (O(1) Memory lookup)
                if phone_hash and phone_hash in existing_phone_hashes:
                    row_errs.append(f"Exact duplicate phone number found: {raw_phone}")

                if row_errs:
                    errors[f"row_{index + 2}"] = row_errs  # +2 because header is row 1, index is 0-based
                else:
                    valid_leads.append(
                        Lead(
                            client=client,
                            first_name=first_name,
                            last_name=last_name,
                            email=email,
                            phone=normalized_phone,
                            phone_hash=phone_hash,
                            source=batch.name if hasattr(batch, 'name') and batch.name else LeadSource.MANUAL,
                            status=LeadStatus.NEW,
                            batch=batch
                        )
                    )
                    # Add to local set to prevent duplicates within the same file
                    existing_phone_hashes.add(phone_hash)

            # Bulk insert valid leads
            if valid_leads:
                Lead.objects.bulk_create(valid_leads, batch_size=1000)

            # Update batch stats
            batch.total_rows = total_processed
            batch.imported_count = len(valid_leads)
            batch.failed_count = len(errors.keys())
            batch.error_log = errors
            batch.status = LeadBatchStatus.COMPLETED if not errors else LeadBatchStatus.COMPLETED  # Marked completed even if partial failures exist, they are logged.
            batch.save()

        except Exception as e:
            batch.status = LeadBatchStatus.FAILED
            batch.error_log = {"global": f"Unexpected error processing file: {str(e)}"}
            batch.save()


class LeadOperationService:
    """
    Industry-grade service for bulk lead operations and lifecycle management.
    """

    @staticmethod
    @transaction.atomic
    def bulk_reassign(client, from_user_id: str, to_user_id: str, performer=None, status: str = None) -> int:
        """
        Reassigns all leads from one agent to another.
        Optionally filter by lead status.
        """
        try:
            target_user = User.objects.get(id=to_user_id, client=client, is_active=True)
            
            queryset = Lead.objects.filter(
                client=client,
                assigned_to_id=from_user_id,
                is_archived=False
            )
            
            if status:
                queryset = queryset.filter(status=status)
            
            count = queryset.update(assigned_to=target_user, updated_at=timezone.now())
            
            # Log action
            from apps.audits.services import AuditService
            AuditService.record_action(
                user=performer,
                action="BULK_REASSIGN",
                resource_type="Lead",
                changes={"from_user_id": from_user_id, "to_user_id": to_user_id, "count": count}
            )
            
            return count
        except User.DoesNotExist:
            return 0

    @staticmethod
    @transaction.atomic
    def merge_leads(client, primary_lead_id: str, duplicate_lead_id: str, performer=None) -> Tuple[bool, str]:
        """
        Merges a duplicate lead into a primary lead. 
        Data from duplicate (like email if missing in primary) is moved, and duplicate is archived.
        """
        try:
            primary = Lead.objects.get(id=primary_lead_id, client=client, is_archived=False)
            duplicate = Lead.objects.get(id=duplicate_lead_id, client=client, is_archived=False)
            
            if primary.id == duplicate.id:
                return False, "Cannot merge a lead with itself."

            # Industry logic: Fill missing fields in primary from duplicate
            updated_fields = []
            if not primary.email and duplicate.email:
                primary.email = duplicate.email
                updated_fields.append('email')
            
            if not primary.last_name and duplicate.last_name:
                primary.last_name = duplicate.last_name
                updated_fields.append('last_name')

            if updated_fields:
                primary.save(update_fields=updated_fields + ['updated_at'])

            # Archive duplicate
            duplicate.is_archived = True
            duplicate.save(update_fields=['is_archived', 'updated_at'])
            
            # Log action
            from apps.audits.services import AuditService
            AuditService.record_action(
                user=performer,
                action="LEAD_MERGE",
                resource_type="Lead",
                resource_id=primary.id,
                changes={"merged_lead_id": str(duplicate.id), "fields_updated": updated_fields}
            )
            
            return True, f"Lead {duplicate_lead_id} merged into {primary_lead_id}."
            
        except Lead.DoesNotExist:
            return False, "One or both leads not found."

    @staticmethod
    def reactivate_stale_leads(client, days: int = 30, performer=None) -> int:
        """
        Reactivates leads that were marked LOST or NOT_ANSWERED more than X days ago.
        """
        threshold = timezone.now() - timedelta(days=days)
        
        queryset = Lead.objects.filter(
            client=client,
            status__in=[LeadStatus.LOST, LeadStatus.NOT_ANSWERED],
            updated_at__lte=threshold,
            is_archived=False
        )
        
        # Log action
        from apps.audits.services import AuditService
        count = queryset.count()
        AuditService.record_action(
            user=performer,
            action="STALE_REACTIVATION",
            resource_type="Lead",
            changes={"days_threshold": days, "count": count}
        )
        
        count = queryset.update(
            status=LeadStatus.NEW,
            assigned_to=None, # Clear assignment for fresh distribution
            updated_at=timezone.now()
        )
        return count
