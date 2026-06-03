import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.leads.models import Lead, LeadBatch
from django.db.models import Count, Q, Max

print("All leads count:", Lead.objects.count())

batch_counts = Lead.objects.values('batch_id', 'batch__name', 'batch__created_at', 'source').annotate(
    total=Count('id'),
    new_leads=Count('id', filter=Q(status__in=['NEW', 'IMPORTED'])),
    covered=Count('id', filter=~Q(status__in=['NEW', 'IMPORTED'])),
).order_by('-total')

for b in batch_counts:
    print(b)
