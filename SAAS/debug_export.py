import os
import django
import sys

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.urls import reverse

User = get_user_model()
admin = User.objects.filter(is_staff=True).first() or User.objects.first()

client = APIClient()
client.force_authenticate(user=admin)

url = reverse('leads_api:lead-export')
print(f"Testing URL: {url}")
resp = client.get(url + "?format=csv")

print(f"Status Code: {resp.status_code}")
if resp.status_code != 200:
    try:
        print(f"Data: {resp.data}")
    except:
        print(f"Content: {resp.content.decode('utf-8', errors='ignore')[:1000]}")
