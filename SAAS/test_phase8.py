import os
import django
import uuid
from django.test import Client
from datetime import timedelta
from django.utils import timezone

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from apps.accounts.models import User, RoleChoices
from apps.leads.models import Lead, LeadStatus, LeadSource

def test_phase8():
    print("Testing Phase 8: Advanced Lead Operations")
    
    # 1. Setup Test Data
    client_admin = User.objects.filter(role=RoleChoices.CLIENT_ADMIN).first()
    client = client_admin.client
    
    # Create another telecaller
    new_agent, _ = User.objects.get_or_create(
        email="newagent@testcorp.com",
        defaults={
            "first_name": "New",
            "last_name": "Agent",
            "role": RoleChoices.TELECALLER,
            "client": client,
            "is_active": True
        }
    )
    new_agent.set_password("password123")
    new_agent.save()
    
    # Create some leads assigned to client_admin
    lead1 = Lead.objects.create(
        client=client, first_name="Bulk1", phone="1111111111", 
        assigned_to=client_admin, status=LeadStatus.NEW
    )
    lead2 = Lead.objects.create(
        client=client, first_name="Bulk2", phone="2222222222", 
        assigned_to=client_admin, status=LeadStatus.NEW
    )
    
    c = Client(SERVER_NAME='localhost')
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(client_admin)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {refresh.access_token}'}

    # 2. Test Bulk Reassign
    print("\n1. Testing Bulk Reassign (/api/v1/leads/bulk-reassign/)")
    payload = {
        "from_user": str(client_admin.id),
        "to_user": str(new_agent.id),
        "status": LeadStatus.NEW
    }
    resp = c.post('/api/v1/leads/bulk-reassign/', payload, content_type='application/json', **headers)
    print("Status:", resp.status_code, resp.json())
    
    lead1.refresh_from_db()
    print(f"Lead1 assigned to: {lead1.assigned_to.email}")
    assert lead1.assigned_to == new_agent

    # 3. Test Lead Merge
    print("\n2. Testing Lead Merge (/api/v1/leads/{id}/merge/)")
    primary = lead1
    duplicate = Lead.objects.create(
        client=client, first_name="Duplicate", last_name="Merged", 
        email="merged@example.com", phone="3333333333"
    )
    
    payload = {"duplicate_id": str(duplicate.id)}
    resp = c.post(f'/api/v1/leads/{primary.id}/merge/', payload, content_type='application/json', **headers)
    print("Status:", resp.status_code, resp.json())
    
    primary.refresh_from_db()
    duplicate.refresh_from_db()
    print(f"Primary Email: {primary.email}")
    print(f"Duplicate Archived: {duplicate.is_archived}")
    assert primary.email == "merged@example.com"
    assert duplicate.is_archived == True

    # 4. Test Stale Reactivation
    print("\n3. Testing Stale Reactivation (/api/v1/leads/reactivate-stale/)")
    stale_lead = Lead.objects.create(
        client=client, first_name="Stale", phone="4444444444",
        status=LeadStatus.LOST, assigned_to=new_agent
    )
    # Manually backdate updated_at
    Lead.objects.filter(id=stale_lead.id).update(updated_at=timezone.now() - timedelta(days=40))
    
    payload = {"days": 30}
    resp = c.post('/api/v1/leads/reactivate-stale/', payload, content_type='application/json', **headers)
    print("Status:", resp.status_code, resp.json())
    
    stale_lead.refresh_from_db()
    print(f"Stale Lead Status: {stale_lead.status}, Assigned to: {stale_lead.assigned_to}")
    assert stale_lead.status == LeadStatus.NEW
    assert stale_lead.assigned_to == None

    print("\nPhase 8 Tests Passed!")

if __name__ == "__main__":
    test_phase8()
