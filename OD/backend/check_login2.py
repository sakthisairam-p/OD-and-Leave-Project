import requests

login_resp = requests.post("http://localhost:8000/api/v1/auth/login", json={
    "login_id": "7376241AI101",
    "password": "student@aiml",
    "target_role": "STUDENT"
})
print("Login Status:", login_resp.status_code)
if login_resp.status_code == 200:
    token = login_resp.json()["access_token"]
    me_resp = requests.get("http://localhost:8000/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    print("Me Status:", me_resp.status_code)
