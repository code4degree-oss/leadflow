import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.accounts.api.serializers import UserSerializer
from apps.accounts.models import User

user = User.objects.exclude(role='SUPER_ADMIN').first()
user.is_active = False
user.save()

serializer = UserSerializer(user, data={'is_active': True}, partial=True)
print("Is Valid:", serializer.is_valid())
if not serializer.is_valid(): print(serializer.errors)
serializer.save()

user.refresh_from_db()
print("Final is_active:", user.is_active)
