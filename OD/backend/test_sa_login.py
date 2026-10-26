import asyncio
from app import database
from app.config import settings
from app.auth import get_password_hash, verify_password

async def test_login():
    await database.connect_to_mongo()
    db = database.client[settings.MONGODB_DB_NAME]
    u = await db.users.find_one({'login_id': 'SA'})
    s = await db.staff_accounts.find_one({'login_id': 'SA'})
    
    print("User in users collection:", bool(u))
    print("User in staff collection:", bool(s))
    
    if s:
        print("Role:", s.get("role"))
        print("Status:", s.get("status"))
        pw_hash = s.get("password_hash")
        print("PWD Valid?", verify_password("SA@123", pw_hash))
    
    await database.close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(test_login())