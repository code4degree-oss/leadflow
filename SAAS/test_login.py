import urllib.request
import json

data = json.dumps({'email': 'clientadmin@testcorp.com', 'password': 'password123'}).encode()
req = urllib.request.Request('http://127.0.0.1:8000/api/v1/auth/login/', data=data, headers={'Content-Type': 'application/json'})

try:
    response = urllib.request.urlopen(req)
    print("Success:", response.read().decode())
except urllib.error.HTTPError as e:
    with open("error.html", "w") as f:
        f.write(e.read().decode())
    print("Error saved to error.html")
