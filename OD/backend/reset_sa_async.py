import sys
import os
import asyncio

sys.path.append(os.path.dirname(__file__))

async def purge():
    from app import database
    from app.config import settings
    from app.auth import get_password_hash
    
    await database.connect_to_mongo()
    db = database.client[settings.MONGODB_DB_NAME]
    
    print("Deleting collections...")
    await db.users.delete_many({})
    await db.student_accounts.delete_many({})
    await db.staff_accounts.delete_many({})
    await db.student_master.delete_many({})
    
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
    
    print("Inserting SA...")
    await db.users.insert_one(sa_user.copy())
    await db.staff_accounts.insert_one(sa_user.copy())
    
    await database.close_mongo_connection()
    print("FINISHED PURGE")

if __name__ == "__main__":
    asyncio.run(purge())
