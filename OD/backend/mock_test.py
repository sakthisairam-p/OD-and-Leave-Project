import asyncio
from app import database
from app.config import settings

async def bypass_test():
    await database.connect_to_mongo()
    db = database.client[settings.MONGODB_DB_NAME]
    
    # create a mock token using auth
    from app.auth import create_access_token
    token = create_access_token({"sub": "123", "login_id": "SA", "role": "sa"})
    print("MOCK TOKEN:", token)
    
    import httpx
    async with httpx.AsyncClient() as client:
        resp_reg = await client.post("http://localhost:8000/api/v1/users/institutional", json={
            "role": "DEO",
            "full_name": "Test DEO",
            "email": "deo_test@college.edu",
            "password": "password123",
            "phone": "9876543210",
            "department": "CSE",
            "date_of_birth": "01/01/1990"
        }, headers={"Authorization": f"Bearer {token}"})
        
        print("REG STAT:", resp_reg.status_code)
        print("REG BODY:", resp_reg.text)
        
    await database.close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(bypass_test())
