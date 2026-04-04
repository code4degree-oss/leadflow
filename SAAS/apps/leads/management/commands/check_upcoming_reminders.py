from django.core.management.base import BaseCommand
from apps.leads.models import FollowUpReminder
from apps.core.firebase import send_push_notification
from django.utils import timezone
import datetime

class Command(BaseCommand):
    help = 'Check for upcoming reminders (<= 5 mins) and send push notifications.'

    def handle(self, *args, **options):
        now = timezone.now()
        target_time = now + datetime.timedelta(minutes=5)

        # Get reminders scheduled between now and next 5 mins that haven't been notified yet
        reminders = FollowUpReminder.objects.filter(
            scheduled_at__gt=now,
            scheduled_at__lte=target_time,
            is_completed=False,
            is_push_sent=False
        )

        for reminder in reminders:
            telecaller = reminder.created_by
            lead_name = f"{reminder.lead.first_name} {reminder.lead.last_name}".strip()
            
            send_push_notification(
                user=telecaller,
                title="🔔 Upcoming Follow-up Reminder",
                body=f"Reminder for {lead_name} at {reminder.scheduled_at.strftime('%I:%M %p')}. Note: {reminder.note}",
                data={"type": "reminder", "reminder_id": str(reminder.id)}
            )
            reminder.is_push_sent = True
            reminder.save(update_fields=['is_push_sent'])
            
            self.stdout.write(self.style.SUCCESS(f'Sent reminder push to {telecaller.email} for {lead_name}'))

        self.stdout.write(self.style.SUCCESS(f'Finished tracking {reminders.count()} new reminders.'))
