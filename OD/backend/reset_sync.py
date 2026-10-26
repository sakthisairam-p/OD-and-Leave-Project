from pymongo import MongoClient
import os
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def do_reset():
    uri = "mongodb://localhost:27017"
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    db = client["KI_Smart_Attendance"]
    
    print("Pre-purge staff:", db.staff_accounts.count_documents({}))
    
    db.users.delete_many({})
    db.student_accounts.delete_many({})
    db.staff_accounts.delete_many({})
    
    print("Post-purge staff:", db.staff_accounts.count_documents({}))
    
    sa_user = {
        "login_id": "SA",
        "email": "sa@college.edu",
        "name": "Super Admin",
        "full_name": "Super Admin",
        "role": "sa",
        "department": "ALL",
        "status": "ACTIVE",
        "password_hash": pwd_context.hash("SA@123")
    }
    
    db.users.insert_one(sa_user.copy())
    db.staff_accounts.insert_one(sa_user.copy())
    
    print("Inserted! Staff count:", db.staff_accounts.count_documents({}))
    sa = db.staff_accounts.find_one({"login_id": "SA"})
    print("Found inserted SA:", sa["login_id"], sa["role"], sa["password_hash"][:15])

if __name__ == "__main__":
    do_reset()
