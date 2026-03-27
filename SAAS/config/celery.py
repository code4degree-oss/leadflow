"""
Celery configuration for LeadFlow CRM.

This module sets up the Celery application with Redis as the message broker.
It auto-discovers tasks from all installed Django apps.
"""
import os

from celery import Celery

# Set the default Django settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("leadflow")

# Load config from Django settings, using the CELERY_ namespace
# so all Celery-related settings in settings.py must be prefixed with CELERY_
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks from all registered Django apps
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task to verify Celery is working."""
    print(f"Request: {self.request!r}")
