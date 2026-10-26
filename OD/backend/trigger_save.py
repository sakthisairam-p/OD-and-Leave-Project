import requests

base = "http://127.0.0.1:8000"
login_res = requests.post(f"{base}/api/v1/auth/login", json={"login_id": "SA", "password": "Password@123", "target_role": "sa"})
if login_res.status_code != 200:
    login_res = requests.post(f"{base}/api/v1/auth/login", json={"login_id": "SA", "password": "SA123", "target_role": "sa"})
token = login_res.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}

# Trigger an update on DEO AIML (id: 6accfc5d0b25521c13eb7d8e)
res = requests.put(f"{base}/api/v1/users/staff/6accfc5d0b25521c13eb7d8e", headers=headers, json={
    "name": "DEO AIML",
    "email": "deo.aiml@kitech.edu.in",
    "phone": "6383024160",
    "department": "CSE(AI&ML)"
})
print("Update DEO AIML status:", res.status_code, res.text)
