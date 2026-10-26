import asyncio
import httpx

async def test_api():
    async with httpx.AsyncClient() as client:
        # 1. Login
        resp_login = await client.post("http://localhost:8000/api/v1/auth/login", json={
            "login_id": "SA",
            "password": "SA@123",
            "target_role": "sa"
        })
        print("Login status:", resp_login.status_code)
        print("Login body:", resp_login.text)
        
        if resp_login.status_code != 200:
            return
            
        token = resp_login.json()["access_token"]
        
        # 2. Register institutional
        resp_reg = await client.post("http://localhost:8000/api/v1/users/institutional", json={
            "role": "DEO",
            "full_name": "test deo",
            "email": "deo@test.com",
            "password": "password123",
            "phone": "1234567890",
            "department": "CSE",
            "date_of_birth": "01/01/1990"
        }, headers={"Authorization": f"Bearer {token}"})
        
        print("Reg status:", resp_reg.status_code)
        print("Reg body:", resp_reg.text)

if __name__ == "__main__":
    asyncio.run(test_api())
