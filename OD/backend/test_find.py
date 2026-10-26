from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
from app.database import get_db
from app import models
from app.auth import get_current_user, require_roles, get_password_hash

import asyncio

async def test_auth_directly():
    from app import database
    await database.connect_to_mongo()
    db = database.client["KI_Smart_Attendance"]
    
    auth_user = await db["staff_accounts"].find_one({"login_id": "SA"})
    if auth_user:
        print("FOUND SA in staff_accounts!")
    else:
        print("SA NOT FOUND in staff_accounts")
        
    auth_usr_col = await db["users"].find_one({"login_id": "SA"})
    if auth_usr_col:
        print("FOUND SA in users!")
    else:
        print("SA NOT FOUND in users")
    await database.close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(test_auth_directly())
