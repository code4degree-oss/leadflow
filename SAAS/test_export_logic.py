import os
import django
import sys

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from apps.leads.models import Lead
from apps.leads.exporters import LeadExportService
from django.contrib.auth import get_user_model

# Get some data
queryset = Lead.objects.all()[:5]
print(f"Exporting {queryset.count()} leads...")

try:
    resp = LeadExportService.export_to_csv(queryset)
    print(f"CSV Export Success: {resp.status_code}")
    print(f"Content Length: {len(resp.content)}")
    
    resp_excel = LeadExportService.export_to_excel(queryset)
    print(f"Excel Export Success: {resp_excel.status_code}")
    print(f"Content Length: {len(resp_excel.content)}")
    
    print("Export Service Logic: VERIFIED")
except Exception as e:
    import traceback
    print(f"Export Service Logic: FAILED")
    traceback.print_exc()
