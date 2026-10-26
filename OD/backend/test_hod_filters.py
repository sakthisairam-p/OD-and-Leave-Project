import asyncio
import httpx
from app.main import app
from app.database import connect_to_mongo

async def main():
    await connect_to_mongo()
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        # Login as HOD
        login_res = await client.post("/api/v1/auth/login", json={
            "login_id": "hod.aiml@kitech.edu.in",
            "password": "Password@123",
            "target_role": "hod"
        })
        print("HOD Login status:", login_res.status_code, login_res.json())
        if login_res.status_code != 200:
            return

        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Test All
        res_all = await client.get("/api/v1/leave/pending?status=all", headers=headers)
        print("Leaves status=all count:", len(res_all.json().get("requests", [])))

        # 2. Test Year = III Year
        res_yr_long = await client.get("/api/v1/leave/pending?status=all&year=III%20Year", headers=headers)
        print("Leaves year=III Year count:", len(res_yr_long.json().get("requests", [])))

        # 3. Test Year = III
        res_yr_short = await client.get("/api/v1/leave/pending?status=all&year=III", headers=headers)
        print("Leaves year=III count:", len(res_yr_short.json().get("requests", [])))

        # 4. Test Date = 2026-10-12
        res_date = await client.get("/api/v1/leave/pending?status=all&date=2026-10-12", headers=headers)
        print("Leaves date=2026-10-12 count:", len(res_date.json().get("requests", [])))

        # 5. Test Year = III Year & Date = 2026-10-12
        res_both = await client.get("/api/v1/leave/pending?status=all&year=III%20Year&date=2026-10-12", headers=headers)
        print("Leaves both count:", len(res_both.json().get("requests", [])))

        # 6. Test OD
        od_all = await client.get("/api/v1/od/pending?status=all", headers=headers)
        print("OD status=all count:", len(od_all.json().get("requests", [])))

        od_both = await client.get("/api/v1/od/pending?status=all&year=III%20Year&date=2026-10-13", headers=headers)
        print("OD both count:", len(od_both.json().get("requests", [])))

if __name__ == "__main__":
    asyncio.run(main())
