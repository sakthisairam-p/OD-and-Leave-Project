import requests
import json

base = "http://127.0.0.1:8000"
login_res = requests.post(f"{base}/api/v1/auth/login", json={"login_id": "SA", "password": "Password@123", "target_role": "sa"})
if login_res.status_code != 200:
    login_res = requests.post(f"{base}/api/v1/auth/login", json={"login_id": "SA", "password": "SA123", "target_role": "sa"})
token = login_res.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}

staff_res = requests.get(f"{base}/api/v1/users/staff?limit=100", headers=headers)
stu_res = requests.get(f"{base}/api/v1/users/students?limit=100", headers=headers)

with open("raw_live_data.json", "w") as f:
    json.dump({
        "staff": staff_res.json().get("staff", []),
        "students": stu_res.json().get("students", [])
    }, f, indent=2)
print("Saved raw_live_data.json")
