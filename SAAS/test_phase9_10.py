import os
import django
import uuid
import sys
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.urls import reverse

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from django.test import RequestFactory
from rest_framework.test import APIClient
from apps.accounts.models import RoleChoices
from apps.leads.models import Lead, LeadStatus
from apps.audits.models import AuditLog, LoginHistory
from apps.audits.signals import track_login_geo
from apps.audits.services import GeoLocationService

User = get_user_model()

def test_phase9_10():
    print("--- Testing Phase 9 & 10: Audit Logs, Export & Geo Login ---")
    
    # 1. Setup Test Data
    client_admin = User.objects.filter(role=RoleChoices.CLIENT_ADMIN).first()
    if not client_admin:
        print("Error: No Client Admin found. Run Phase 3 tests first.")
        return
        
    client = client_admin.client
    print(f"Testing for User: {client_admin.email}, Client: {client.name}")

    # 2. Test Geo Login tracking
    print("\n[STEP 1] Testing Geo Login / Haversine Logic")
    rf = RequestFactory()
    request = rf.get('/')
    request.META['REMOTE_ADDR'] = '1.1.1.1' 
    
    # Clear history
    LoginHistory.objects.filter(user=client_admin).delete()
    
    # First login (Mumbai)
    print("Triggering Login 1 (from 1.1.1.1)...")
    track_login_geo(sender=User, request=request, user=client_admin)
    lh1 = LoginHistory.objects.filter(user=client_admin).first()
    print(f"Login 1 Recorded: {lh1.city}, {lh1.country} (IP: {lh1.ip_address})")
    
    # Manually move Login 1 to London and backdate it
    lh1.latitude = 51.5074
    lh1.longitude = -0.1278
    lh1.city = "London"
    lh1.save()
    LoginHistory.objects.filter(id=lh1.id).update(created_at=timezone.now() - timedelta(hours=1))
    lh1.refresh_from_db()
    
    # Second login (Mumbai - from a different IP to avoid 5-min cache)
    request.META['REMOTE_ADDR'] = '2.2.2.2' 
    print("\nTriggering Login 2 (from 2.2.2.2)...")
    track_login_geo(sender=User, request=request, user=client_admin)
    
    lh2 = LoginHistory.objects.filter(user=client_admin).order_by('-created_at').first()
    print(f"Login 2 Recorded: {lh2.city}, {lh2.country} ({lh2.latitude}, {lh2.longitude})")
    print(f"Suspicious: {lh2.is_suspicious}")
    if lh2.is_suspicious:
        print(f"Reason: {lh2.suspicious_reason}")
        
    assert lh2.is_suspicious == True, f"Haversine failed detection."

    # 3. Test Audit Log
    print("\n[STEP 2] Testing Audit Logs")
    initial_audits = AuditLog.objects.count()
    
    # Trigger an action that should be audited (e.g., reassign)
    from apps.leads.services import LeadOperationService
    lead = Lead.objects.filter(client=client).first()
    if lead:
        LeadOperationService.bulk_reassign(client, str(client_admin.id), str(client_admin.id), performer=client_admin)
    
    new_audits = AuditLog.objects.count()
    print(f"Audit Logs: Initial={initial_audits}, New={new_audits}")
    assert new_audits > initial_audits

    # 4. Test Data Export
    print("\n[STEP 3] Testing Data Export")
    api_client = APIClient()
    api_client.force_authenticate(user=client_admin)
    
    url = reverse('leads_api:lead-export')
    print(f"Export URL: {url}")
    # Force HTTP_HOST to localhost 
    resp = api_client.get(url + "?format=csv", HTTP_HOST='localhost')
    
    print(f"Export Status: {resp.status_code}")
    if resp.status_code != 200:
        if hasattr(resp, 'data'):
            print(f"Error Data: {resp.data}")
        print(f"Error Content: {resp.content.decode('utf-8', errors='ignore')[:1000]}")
        
    assert resp.status_code == 200
    assert "text/csv" in resp['Content-Type']

    print("\nConclusion: Phase 9 & 10 Implementation Verified.")

if __name__ == "__main__":
    test_phase9_10()
