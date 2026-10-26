import asyncio
from app import database
from app.config import settings
from app.auth import verify_password
import hashlib

async def test_logic():
    await database.connect_to_mongo()
    db = database.client[settings.MONGODB_DB_NAME]
    
    clean_id = "SA"
    clean_email = "sa"
    
    staff_query = {
        "$or": [
            {"email": clean_email},
            {"collegeEmail": clean_email},
            {"login_id": clean_id}
        ]
    }
    
    mongo_user = await db.staff_accounts.find_one(staff_query)
    if not mongo_user:
        print("FAIL: mongo_user NOT FOUND")
        return
        
    print("Found user:", mongo_user)
    
    role = str(mongo_user.get("role", "")).lower()
    raw_status = mongo_user.get("status") or mongo_user.get("accountStatus") or "ACTIVE"
    status_msg = str(raw_status).upper()
    
    target_role = "sa"
    print("Role check:", target_role == role, f"(target={target_role}, role={role})")
    print("Status check:", status_msg == "ACTIVE", f"(status={status_msg})")
    
    pw_hash = mongo_user.get("password_hash") or mongo_user.get("passwordHash") or ""
    password_valid = verify_password("SA@123", pw_hash)
    print("Password valid?", password_valid)
    
    await database.close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(test_logic())