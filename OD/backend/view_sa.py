import asyncio
from app import database
from app.config import settings

async def f():
    await database.connect_to_mongo()
    db = database.client[settings.MONGODB_DB_NAME]
    u = await db.staff_accounts.find_one({"login_id": "SA"}, {"_id": 0})
    print("STAFF:", u)
    u2 = await db.users.find_one({"login_id": "SA"}, {"_id": 0})
    print("USERS:", u2)
    await database.close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(f())
