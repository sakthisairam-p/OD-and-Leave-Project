import asyncio
import os
import sys
import json
from datetime import datetime, timezone

sys.path.append(os.path.dirname(__file__))

from app.auth import get_password_hash
from app.database import PERSISTED_COLLECTIONS, MOCK_DB_FILE

async def reset_database():
    print("[*] Preparing fresh clean database state...")

    # We will reset mock_db_state.json with empty collections except SA
    # Let's create an SA account with known credentials
    sa_login_id = "SA"
    sa_password = "SA@123"
    sa_hash = get_password_hash(sa_password)
    now_iso = datetime.now(timezone.utc).isoformat()

    sa_doc = {
        "fullName": "System Administrator (SA)",
        "name": "System Administrator (SA)",
        "email": "sa@kitech.edu.in",
        "login_id": sa_login_id,
        "role": "sa",
        "department": "ALL",
        "mobileNumber": "9876543210",
        "phone": "9876543210",
        "dateOfBirth": None,
        "accountStatus": "ACTIVE",
        "status": "ACTIVE",
        "password_hash": sa_hash,
        "passwordHash": sa_hash,
        "first_login": False,
        "created_at": now_iso,
        "updated_at": now_iso,
        "_id": "600000000000000000000001"
    }

    clean_state = {
        "__initialized": True
    }

    for coll in PERSISTED_COLLECTIONS:
        clean_state[coll] = []

    # Only add SA in staff_accounts and users
    clean_state["staff_accounts"] = [sa_doc]
    clean_state["users"] = [sa_doc]

    temp_file = f"{MOCK_DB_FILE}.tmp"
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(clean_state, f, indent=2, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp_file, MOCK_DB_FILE)

    print(f"[+] mock_db_state.json cleared successfully! Only SA retained.")
    print(f"    Login ID : {sa_login_id}")
    print(f"    Password : {sa_password}")

if __name__ == "__main__":
    asyncio.run(reset_database())
