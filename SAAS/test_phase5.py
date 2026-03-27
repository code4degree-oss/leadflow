import os
import django
import json

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from django.test import Client
from apps.accounts.models import User, RoleChoices
from apps.leads.models import LeadBatch, Lead

c = Client(SERVER_NAME='localhost')
# Get the client admin credentials
client_admin = User.objects.filter(role=RoleChoices.CLIENT_ADMIN).first()
client = client_admin.client

print(f"Testing CSV Upload with admin: {client_admin.email} (Client: {client.name})")

# Login to get JWT
login_resp = c.post('/api/v1/auth/login/', data=json.dumps({'email': client_admin.email, 'password': 'password123'}), content_type='application/json')
token = login_resp.json().get('access')

headers = {
    'HTTP_AUTHORIZATION': f'Bearer {token}',
}

# Create a dummy CSV file
csv_content = """first_name,last_name,email,phone
John,Doe,john@example.com,+1234567890
Jane,Smith,jane@example.com,+1234567890
Alice,Johnson,,+19876543210
"""
# Jane has the exact same phone number as John (exact duplicate)

with open('test_leads.csv', 'w') as f:
    f.write(csv_content)

print("\n1. Uploading CSV via API (/api/v1/leads/batches/)")
with open('test_leads.csv', 'rb') as f:
    resp = c.post('/api/v1/batches/', {'file': f}, **headers)

print("Status Code:", resp.status_code)
if resp.status_code == 201:
    batch_data = resp.json()
    print("Batch created:", batch_data['id'])
    
    # Refresh batch from DB to see processing results
    batch = LeadBatch.objects.get(id=batch_data['id'])
    print(f"Status: {batch.status}")
    print(f"Total Rows Processed: {batch.total_rows}")
    print(f"Total Imported: {batch.imported_count}")
    print(f"Total Failed: {batch.failed_count}")
    if batch.error_log:
        print("Errors:\n", json.dumps(batch.error_log, indent=2))
else:
    print("Error:\n", resp.json())

# Fetch leads to verify
print("\n2. Checking existing leads for client")
leads = Lead.objects.filter(client=client).order_by('-created_at')[:5]
for lead in leads:
    print(f"- {lead.first_name} {lead.last_name} ({lead.phone}) [Hash: {lead.phone_hash}]")

print("Done")
