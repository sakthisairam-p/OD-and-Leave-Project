import requests

token = requests.post("http://localhost:8000/api/v1/auth/login", json={
    "login_id": "student.aiml@kitech.edu.in",
    "password": "student@aiml",
    "target_role": "STUDENT"
}).json().get("access_token")

r = requests.get("http://localhost:8000/api/v1/od/my", headers={"Authorization": f"Bearer {token}"})
print(r.status_code)
print(r.text)
