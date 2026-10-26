import asyncio
import httpx

async def try_reg():
    async with httpx.AsyncClient() as client:
        # 1. Login to get token using the SA endpoint
        resp = await client.post("http://localhost:8000/api/v1/auth/login", json={
            "login_id": "SA",
            "password": "SA@123",
            "target_role": "sa"
        })
        if resp.status_code != 200:
            print("LOGIN FAILED!", resp.text)
            return
            
        token = resp.json()["access_token"]
        print("LOGIN OK. Registering DEO...")
        
        reg_resp = await client.post("http://localhost:8000/api/v1/users/institutional", json={
            "role": "DEO",
            "full_name": "Testing Interface DEO",
            "email": "test_interface@college.edu",
            "password": "password123",
            "phone": "9876543210",
            "department": "CSE",
            "date_of_birth": "01/01/1990"
        }, headers={"Authorization": f"Bearer {token}"})
        
        print("REGISTRATION RESPONSE:", reg_resp.status_code, reg_resp.text)

if __name__ == "__main__":
    asyncio.run(try_reg())
