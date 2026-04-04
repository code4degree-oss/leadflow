from django.core.management.base import BaseCommand
from apps.clients.models import ClientAccount
from apps.accounts.models import RoleChoices, User
from apps.core.firebase import send_push_notification
from django.utils import timezone
import datetime

class Command(BaseCommand):
    help = 'Check for subscription plans expiring in exactly 7 days and send push notifications.'

    def handle(self, *args, **options):
        today = timezone.now().date()
        target_date = today + datetime.timedelta(days=7)

        # Get clients expiring exactly 7 days from today
        clients = ClientAccount.objects.filter(is_active=True, valid_until=target_date)

        for client in clients:
            admins = User.objects.filter(client=client, role=RoleChoices.CLIENT_ADMIN, is_active=True)
            for admin in admins:
                send_push_notification(
                    user=admin,
                    title="Plan Expiring Soon",
                    body=f"Your subscription for {client.name} expires in 7 days. Please renew to continue without interruption.",
                    data={"type": "plan_expiry", "client_id": str(client.id)}
                )
            
            self.stdout.write(self.style.SUCCESS(f'Sent expiry notification to admins of {client.name}'))

        self.stdout.write(self.style.SUCCESS(f'Finished checking expiring plans. Found {clients.count()} expiring.'))
