import requests
import threading

def fetch(url, token):
    try:
        r = requests.get(url, headers={"Authorization": f"Bearer {token}"})
        print(f"{url} -> {r.status_code}")
        if r.status_code != 200:
            print(r.text)
    except Exception as e:
        print(e)
        
login_resp = requests.post("http://localhost:8000/api/v1/auth/login", json={
    "login_id": "student.aiml@kitech.edu.in",
    "password": "student@aiml",
    "target_role": "STUDENT"
}).json()
token = login_resp["access_token"]
print("Got token")

urls = [
    "http://localhost:8000/api/v1/auth/me",
    "http://localhost:8000/api/v1/leave/my",
    "http://localhost:8000/api/v1/od/my",
    "http://localhost:8000/api/v1/auth/me",
    "http://localhost:8000/api/v1/leave/my",
    "http://localhost:8000/api/v1/od/my"
]

threads = []
for u in urls:
    t = threading.Thread(target=fetch, args=(u, token))
    t.start()
    threads.append(t)
    
for t in threads:
    t.join()
