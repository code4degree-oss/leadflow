from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0007_clientaccount_force_logout_until'),
    ]

    operations = [
        migrations.AddField(
            model_name='clientaccount',
            name='grace_period_days',
            field=models.IntegerField(default=7, help_text='Number of days after expiry before full lockout'),
        ),
    ]
