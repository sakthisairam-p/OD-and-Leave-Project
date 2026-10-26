import asyncio
from app import database
from app.config import settings

async def insert_deo():
    await database.connect_to_mongo()
    db = database.client[settings.MONGODB_DB_NAME]
    
    from app.auth import get_password_hash
    from datetime import datetime, timezone
    
    deo_user = {
        "login_id": "deo@college.edu",
        "name": "Default DEO",
        "email": "deo@college.edu",
        "password_hash": get_password_hash("deo123"),
        "phone": "9999999999",
        "department": "CSE(AI&ML)",
        "role": "deo",
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db["staff_accounts"].delete_many({"email": "deo@college.edu"})
    await db["users"].delete_many({"email": "deo@college.edu"})
    
    await db["staff_accounts"].insert_one(deo_user.copy())
    await db["users"].insert_one(deo_user.copy())
    print("DEO INSERTED SUCCESSFULLY: deo@college.edu / deo123")
    
    await database.close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(insert_deo())
