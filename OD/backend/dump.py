import asyncio
from app import database
from app.config import settings

async def explore():
    await database.connect_to_mongo()
    client = database.client
    dbs = await client.list_database_names()
    print("Databases:", dbs)
    
    db = client[settings.MONGODB_DB_NAME]
    print("DB Name:", settings.MONGODB_DB_NAME)
    
    cols = await db.list_collection_names()
    print("Collections:", cols)
    
    for c in cols:
        count = await db[c].count_documents({})
        print(f" - {c}: {count} docs")
        
    s = await db.staff_accounts.find_one({})
    print("One staff:", s)
    
    await database.close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(explore())
