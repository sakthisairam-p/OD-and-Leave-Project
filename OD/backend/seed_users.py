import sys
import os
import asyncio
sys.path.append(os.path.dirname(__file__))
async def main():
    try:
        from app.config import settings
        from app.auth import get_password_hash
        from motor.motor_asyncio import AsyncIOMotorClient
        
        client = AsyncIOMotorClient("mongodb://127.0.0.1:27017")
        db = client[settings.MONGODB_DB_NAME]
        
        # System Administrator (SA)
        sa_user = {
            "login_id": "SA_ADMIN",
            "email": "sa@college.edu",
            "name": "Super Admin",
            "role": "sa", # Super Admin
            "department": "ALL",
            "status": "ACTIVE",
            "password_hash": get_password_hash("SA@123") # Default password
        }
        
        # Staff Advisor (Class Advisor CA)
        ca_user = {
            "login_id": "CA_ADVISOR",
            "email": "ca@college.edu",
            "name": "Staff Advisor",
            "role": "advisor", # Class Advisor
            "department": "CSE(AI&ML)",
            "status": "ACTIVE",
            "password_hash": get_password_hash("CA@312")
        }
        
        for user in [sa_user, ca_user]:
            existing = await db.staff_accounts.find_one({"login_id": user["login_id"]})
            if existing:
                await db.staff_accounts.update_one({"login_id": user["login_id"]}, {"$set": user})
                print(f"Updated {user['login_id']}")
            else:
                await db.staff_accounts.insert_one(user)
                print(f"Inserted {user['login_id']}")
                
            # Also seed into master users collection so auth works easily
            user_auth = {
                "login_id": user["login_id"],
                "email": user["email"],
                "name": user["name"],
                "full_name": user["name"],
                "role": user["role"],
                "status": user["status"],
                "password_hash": user["password_hash"]
            }
            if await db.users.find_one({"login_id": user["login_id"]}):
                await db.users.update_one({"login_id": user["login_id"]}, {"$set": user_auth})
            else:
                await db.users.insert_one(user_auth)
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
