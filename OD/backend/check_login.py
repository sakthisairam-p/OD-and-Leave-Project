import requests

session = requests.Session()

# 1. Login
print("Logging in...")
resp = session.post("http://localhost:8000/api/v1/auth/login", json={
    "login_id": "student.aiml@kitech.edu.in",
    "password": "student@aiml",
    "target_role": "STUDENT"
})
print("Login status:", resp.status_code)
print("Login data:", resp.text)

if resp.status_code == 200:
    token = resp.json()["access_token"]
    
    # 2. Get /auth/me
    print("\nFetching /auth/me...")
    me_resp = session.get("http://localhost:8000/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    print("Me status:", me_resp.status_code)
    print("Me data:", me_resp.text)
    
    # 3. Get /leave/my
    print("\nFetching /leave/my...")
    leave_resp = session.get("http://localhost:8000/api/v1/leave/my", headers={"Authorization": f"Bearer {token}"})
    print("Leave status:", leave_resp.status_code)
    print("Leave data:", leave_resp.text)
