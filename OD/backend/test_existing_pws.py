import requests

base = "http://127.0.0.1:8000"
test_users = [
    ("deo.aiml@kitech.edu.in", "deo"),
    ("deo.ece@kitech.edu.in", "deo"),
    ("dhanasekar.aiml@kitech.edu.in", "advisor"),
    ("hod.aiml@kitech.edu.in", "hod"),
    ("730324148047", "student")
]
passwords = ["Password@123", "password@123", "123456", "admin", "01012000", "01/01/2000", "01011990", "SA123"]

for login_id, role in test_users:
    found = False
    for p in passwords:
        res = requests.post(f"{base}/api/v1/auth/login", json={"login_id": login_id, "password": p, "target_role": role})
        if res.status_code == 200:
            print(f"SUCCESS: {login_id} password is '{p}'")
            found = True
            break
    if not found:
        print(f"NOT FOUND: {login_id}")
