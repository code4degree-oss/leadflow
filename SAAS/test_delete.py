import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.accounts.models import User
admin = User.objects.filter(role='CLIENT_ADMIN').first()
employee = User.objects.filter(role='TELECALLER', client=admin.client).first()

print("Admin:", admin)
print("Employee:", employee)
if employee:
    try:
        employee.delete()
        print("Employee deleted successfully.")
    except Exception as e:
        print("Error deleting employee:", str(e))
