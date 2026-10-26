import asyncio
from app import database
from app.config import settings
from app.auth import get_password_hash

async def fix():
    await database.connect_to_mongo()
    db = database.client[settings.MONGODB_DB_NAME]
    
    print("Database:", settings.MONGODB_DB_NAME)
    
    print("Before Staff:", await db.staff_accounts.count_documents({}))
    await db.staff_accounts.delete_many({})
    await db.users.delete_many({})
    
    sa_user = {
        "login_id": "SA",
        "email": "sa@college.edu",
        "name": "Super Admin",
        "full_name": "Super Admin",
        "role": "sa",
        "department": "ALL",
        "status": "ACTIVE",
        "password_hash": get_password_hash("SA@123")
    }
    
    await db.users.insert_one(sa_user.copy())
    await db.staff_accounts.insert_one(sa_user.copy())
    
    print("After Staff:", await db.staff_accounts.count_documents({}))
    found = await db.staff_accounts.find_one({"login_id": "SA"})
    print("Found SA:", found.get("login_id") if found else "NO")
    
    await database.close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(fix())
