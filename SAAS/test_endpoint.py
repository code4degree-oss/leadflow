import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from django.test import Client
import json
import traceback

c = Client()
try:
    response = c.post('/api/v1/auth/login/', data=json.dumps({'email': 'clientadmin@testcorp.com', 'password': 'password123'}), content_type='application/json')
    if response.status_code == 500:
        with open('error_trace.txt', 'w') as f:
            f.write(response.content.decode('utf-8'))
        print("Logged html to error_trace.txt")
        # Alternative: The test client actually bubbles up exceptions when debug is off, but with debug on it returns the HTML.
        # Let's force an exception by triggering the view directly if needed, but in tests, Django Client catches it.
    else:
        print(response.status_code, response.content)
except Exception as e:
    with open('error_trace.txt', 'w') as f:
        traceback.print_exc(file=f)
    print("Caught exception! Wrote traceback to error_trace.txt")
