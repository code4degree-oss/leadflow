import os
import django
import json

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from django.test import Client
from apps.accounts.models import User, RoleChoices
from apps.clients.models import ClientAccount
from apps.leads.models import Lead, LeadStatus

c = Client()

# Get the client admin credentials
client_admin = User.objects.filter(role=RoleChoices.CLIENT_ADMIN).first()
client = client_admin.client

print(f"Testing with admin: {client_admin.email} (Client: {client.name})")

# Login to get JWT
login_resp = c.post('/api/v1/auth/login/', data=json.dumps({'email': client_admin.email, 'password': 'password123'}), content_type='application/json')
token = login_resp.json().get('access')

headers = {
    'HTTP_AUTHORIZATION': f'Bearer {token}',
    'content_type': 'application/json'
}

print("1. Creating a new lead via API")
create_resp = c.post('/api/v1/leads/leads/', data=json.dumps({
    'first_name': 'Test',
    'last_name': 'Lead 1',
    'email': 'testlead1@example.com',
    'phone': '+12345678901'
}), **headers)

print("Create Status:", create_resp.status_code)
if create_resp.status_code == 201:
    lead_id = create_resp.json()['id']
    print("Created successfully. Client ID assigned automatically:", create_resp.json()['client'])
else:
    print(create_resp.json())

print("2. Testing Status Transition Validation (NEW -> WON directly should fail)")
update_resp = c.patch(f'/api/v1/leads/leads/{lead_id}/', data=json.dumps({
    'status': LeadStatus.WON
}), **headers)
print("Invalid Update Status:", update_resp.status_code)
print(update_resp.json())

print("3. Testing Round-Robin Assignment")
# Create telecallers if none
telecallers = User.objects.filter(client=client, role=RoleChoices.TELECALLER)
if telecallers.count() < 2:
    print("Creating dummy telecallers...")
    User.objects.create_user(email='tele1@testcorp.com', password='password123', client=client, role=RoleChoices.TELECALLER)
    User.objects.create_user(email='tele2@testcorp.com', password='password123', client=client, role=RoleChoices.TELECALLER)

# Create some dummy leads
for i in range(2, 6):
    Lead.objects.create(
        client=client, 
        first_name=f'Dummy {i}', 
        last_name='Lead', 
        phone=f'+100000000{i}'
    )

# Hit the round robin endpoint
rr_resp = c.post('/api/v1/leads/leads/assign-round-robin/', **headers)
print("Round Robin Status:", rr_resp.status_code)
print(rr_resp.json())

print("Verifying assignments in DB:")
for lead in Lead.objects.filter(client=client).order_by('id'):
    print(f"Lead {lead.first_name}: Assigned to -> {lead.assigned_to.email if lead.assigned_to else 'Unassigned'}")
