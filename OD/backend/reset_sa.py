import os
from pymongo import MongoClient
import bcrypt

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def reset_database():
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "KI_Smart_Attendance")
    
    print(f"Connecting to MongoDB Atlas: {uri} / {db_name}")
    client = MongoClient(uri)
    db = client[db_name]
    
    # Wipe data
    print("Deleting all users, staff, and students...")
    db["users"].delete_many({})
    db["student_accounts"].delete_many({})
    db["staff_accounts"].delete_many({})
    db["student_master"].delete_many({})
    
    print("Creating the new SA user...")
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
    
    # Store in users and staff_accounts
    db["users"].insert_one(sa_user.copy())
    db["staff_accounts"].insert_one(sa_user.copy())
    
    print("done! Inserted SA user.")

if __name__ == "__main__":
    reset_database()
