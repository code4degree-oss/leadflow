from apps.accounts.models import User
users = User.objects.filter(role='CLIENT_ADMIN')
users.update(is_active=True)
print(f'Reactivated {users.count()} client admins.')
