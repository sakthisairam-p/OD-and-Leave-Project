import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import database
from app.config import settings

async def main():
    await database.connect_to_mongo()
    db = database.client[settings.MONGODB_DB_NAME]
    email = "dhanasekar.aiml@kitech.edu.in"
    with open("db_res.txt", "w") as f:
        for coll_name in ["staff_accounts", "student_accounts", "users"]:
            docs = await db[coll_name].find({}).to_list(None)
            f.write(f"\n--- COLL {coll_name} ({len(docs)} docs) ---\n")
            for d in docs:
                f.write(f"  _id={d.get('_id')} login_id={d.get('login_id')} email={d.get('email')} name={d.get('name')} role={d.get('role')} dept={d.get('department')} yr={d.get('year') or d.get('assigned_year')}\n")
    await database.close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(main())
