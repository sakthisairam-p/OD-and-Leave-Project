import requests

base = "http://127.0.0.1:8000"
try:
    # Login as SA
    login_res = requests.post(f"{base}/api/v1/auth/login", json={"login_id": "SA", "password": "Password@123", "target_role": "sa"})
    print("SA login status:", login_res.status_code)
    if login_res.status_code != 200:
        login_res = requests.post(f"{base}/api/v1/auth/login", json={"login_id": "SA", "password": "SA123", "target_role": "sa"})
        print("SA login with SA123:", login_res.status_code)
        
    token = login_res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    staff_res = requests.get(f"{base}/api/v1/users/staff?limit=100", headers=headers)
    stu_res = requests.get(f"{base}/api/v1/users/students?limit=100", headers=headers)
    with open("live_dump.txt", "w") as f:
        f.write(f"--- STAFF ({len(staff_res.json().get('staff', []))}) ---\n")
        for s in staff_res.json().get("staff", []):
            f.write(f"  ROLE: {s.get('role')} | EMAIL: {s.get('email')} | NAME: {s.get('name')} | DEPT: {s.get('department')} | YR: {s.get('year')} | STF_ID: {s.get('staff_id')}\n")
        f.write(f"\n--- STUDENTS ({len(stu_res.json().get('students', []))}) ---\n")
        for st in stu_res.json().get("students", []):
            f.write(f"  REG: {st.get('register_no')} | EMAIL: {st.get('email')} | NAME: {st.get('name')} | DEPT: {st.get('department')} | YR: {st.get('year')}\n")
except Exception as e:
    print("Error querying live server:", e)
