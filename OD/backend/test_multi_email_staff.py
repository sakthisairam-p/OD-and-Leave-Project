import asyncio
import os
import sys

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from httpx import AsyncClient, ASGITransport
from app.main import app
from app import database

async def test_multi_staff_email():
    await database.connect_to_mongo()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login as SA
        sa_resp = await client.post("/api/v1/auth/login", json={
            "login_id": "SA",
            "password": "Password@123",
            "target_role": "sa"
        })
        print("SA Login:", sa_resp.status_code, sa_resp.json() if sa_resp.status_code == 200 else sa_resp.text)
        assert sa_resp.status_code == 200
        sa_token = sa_resp.json()["access_token"]
        sa_headers = {"Authorization": f"Bearer {sa_token}"}

        # 2. SA registers a DEO for CSE
        deo_email = "deo_cse_test@college.edu"
        await client.post("/api/v1/users/institutional", headers=sa_headers, json={
            "role": "DEO",
            "full_name": "CSE DEO",
            "email": deo_email,
            "password": "Password@123",
            "phone": "9876543210",
            "department": "CSE"
        })

        # Login as DEO
        deo_resp = await client.post("/api/v1/auth/login", json={
            "login_id": deo_email,
            "password": "Password@123",
            "target_role": "deo"
        })
        print("DEO Login:", deo_resp.status_code)
        assert deo_resp.status_code == 200
        deo_token = deo_resp.json()["access_token"]
        deo_headers = {"Authorization": f"Bearer {deo_token}"}

        # 3. DEO registers Staff 1: Dr. Ramesh as ADVISOR (CSE III) with shared email
        shared_email = "ramesh_test@college.edu"
        staff1_resp = await client.post("/api/v1/users/institutional", headers=deo_headers, json={
            "role": "ADVISOR",
            "full_name": "Dr. Ramesh",
            "email": shared_email,
            "password": "Password@123",
            "phone": "9876543211",
            "department": "CSE",
            "year": "III",
            "staff_id": "STF-RAMESH"
        })
        print("Staff 1 (Advisor) Register:", staff1_resp.status_code, staff1_resp.text)
        assert staff1_resp.status_code == 200
        staff1_id = staff1_resp.json()["id"]

        # 4. SA/DEO registers Staff 2: SAME Dr. Ramesh as FACULTY (AIML II) with the EXACT SAME college email!
        staff2_resp = await client.post("/api/v1/users/institutional", headers=sa_headers, json={
            "role": "FACULTY",
            "full_name": "Dr. Ramesh",
            "email": shared_email,
            "password": "Password@123",
            "phone": "9876543211",
            "department": "AIML",
            "year": "II",
            "staff_id": "STF-RAMESH"
        })
        print("Staff 2 (Faculty/Subject Staff) Register with same email:", staff2_resp.status_code, staff2_resp.text)
        assert staff2_resp.status_code == 200, f"Expected 200 but got {staff2_resp.status_code}: {staff2_resp.text}"
        staff2_id = staff2_resp.json()["id"]

        # 5. Try registering exact duplicate of Staff 1 (same role, dept, year) -> Should be rejected
        dup_resp = await client.post("/api/v1/users/institutional", headers=deo_headers, json={
            "role": "ADVISOR",
            "full_name": "Dr. Ramesh",
            "email": shared_email,
            "password": "Password@123",
            "phone": "9876543211",
            "department": "CSE",
            "year": "III",
            "staff_id": "STF-RAMESH"
        })
        print("Duplicate Register (expected 400):", dup_resp.status_code, dup_resp.text)
        assert dup_resp.status_code == 400

        # 6. Login as ADVISOR with shared_email
        login_adv = await client.post("/api/v1/auth/login", json={
            "login_id": shared_email,
            "password": "Password@123",
            "target_role": "advisor"
        })
        print("Login as Advisor:", login_adv.status_code, login_adv.json())
        assert login_adv.status_code == 200
        adv_data = login_adv.json()
        assert adv_data["role"].lower() == "advisor"
        assert adv_data["department"] == "CSE"

        # Check /me with Advisor token
        me_adv = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {adv_data['access_token']}"})
        print("/me as Advisor:", me_adv.status_code, me_adv.json().get("department"), me_adv.json().get("year"))
        assert me_adv.status_code == 200
        assert me_adv.json()["department"] == "CSE"
        assert me_adv.json()["year"] == "III"

        # 7. Login as SUBJECT_STAFF with shared_email
        login_sub = await client.post("/api/v1/auth/login", json={
            "login_id": shared_email,
            "password": "Password@123",
            "target_role": "subject_staff"
        })
        print("Login as Subject Staff:", login_sub.status_code, login_sub.json())
        assert login_sub.status_code == 200
        sub_data = login_sub.json()
        assert sub_data["role"].lower() == "subject_staff"
        assert sub_data["department"] == "AIML"

        # Check /me with Subject Staff token
        me_sub = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {sub_data['access_token']}"})
        print("/me as Subject Staff:", me_sub.status_code, me_sub.json().get("department"), me_sub.json().get("year"))
        assert me_sub.status_code == 200
        assert me_sub.json()["department"] == "AIML"
        assert me_sub.json()["year"] == "II"

        # 8. Delete Account 1 (Advisor), verify Account 2 (Faculty/Subject Staff) is NOT deleted
        del_resp = await client.delete(f"/api/v1/users/staff/{staff1_id}", headers=sa_headers)
        print("Delete Account 1:", del_resp.status_code)
        assert del_resp.status_code == 200

        # Login as Subject Staff again -> should STILL WORK!
        login_sub_after = await client.post("/api/v1/auth/login", json={
            "login_id": shared_email,
            "password": "Password@123",
            "target_role": "subject_staff"
        })
        print("Login as Subject Staff after Advisor deletion:", login_sub_after.status_code)
        assert login_sub_after.status_code == 200

        # Cleanup staff 2 and deo
        await client.delete(f"/api/v1/users/staff/{staff2_id}", headers=sa_headers)
        print("ALL MULTI-STAFF EMAIL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_multi_staff_email())
