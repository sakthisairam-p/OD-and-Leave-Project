import asyncio
from app import database
from app.config import settings

async def test_auth():
    await database.connect_to_mongo()
    db = database.client[settings.MONGODB_DB_NAME]
    
    # Check what is exactly in staff_accounts
    users = await db.staff_accounts.find({}).to_list(None)
    for u in users:
        print("STAFF ACCOUNT:", u.get('login_id'), u.get('email'), u.get('role'))
        
    u_SA = await db.staff_accounts.find_one({"login_id": "SA"})
    if u_SA:
        print("Found SA:", u_SA.get('login_id'))
        from app.auth import verify_password
        print("Password check:", verify_password("SA@123", u_SA.get("password_hash")))
    else:
        print("Could not find SA user.")
        
    await database.close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(test_auth())
