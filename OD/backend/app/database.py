import json
import os
import copy
from datetime import datetime, date, time
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from mongomock_motor import AsyncMongoMockClient
from bson import ObjectId

raw_client: AsyncMongoMockClient = None
client = None
MOCK_DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "mock_db_state.json")


def serialize_doc(doc):
    """Deep clone and serialize MongoDB doc to JSON-safe dictionary without mutating in-memory doc."""
    if isinstance(doc, dict):
        return {k: serialize_doc(v) for k, v in doc.items()}
    elif isinstance(doc, list):
        return [serialize_doc(v) for v in doc]
    elif isinstance(doc, ObjectId):
        return str(doc)
    elif isinstance(doc, (datetime, date, time)):
        return doc.isoformat()
    elif isinstance(doc, set):
        return [serialize_doc(v) for v in doc]
    return doc


def deserialize_doc(doc):
    """Restore ObjectId where appropriate."""
    if isinstance(doc, dict):
        res = {}
        for k, v in doc.items():
            if k == "_id" and isinstance(v, str) and ObjectId.is_valid(v) and len(v) == 24:
                res[k] = ObjectId(v)
            else:
                res[k] = deserialize_doc(v)
        return res
    elif isinstance(doc, list):
        return [deserialize_doc(v) for v in doc]
    return doc


PERSISTED_COLLECTIONS = [
    "student_accounts",
    "staff_accounts",
    "student_master",
    "users",
    "leave_requests",
    "od_requests",
    "late_arrival_requests",
    "attendance_corrections",
    "notifications",
    "audit_logs",
    "system_settings",
    "student_attendance_history",
    "holidays",
    "departments",
    "years",
    "sections",
    "subjects"
]


async def save_mock_state(db=None):
    """Atomically save all database collections to MOCK_DB_FILE permanently."""
    global raw_client
    if isinstance(db, AutoPersistDatabase):
        db = db._target_db
    if db is None:
        if raw_client is None:
            return
        db = raw_client[settings.MONGODB_DB_NAME]

    try:
        try:
            dynamic_colls = await db.list_collection_names()
        except Exception:
            dynamic_colls = []
        all_colls = sorted(list(set(PERSISTED_COLLECTIONS + dynamic_colls)))

        state = {
            "__initialized": True
        }
        for coll in all_colls:
            docs = await db[coll].find({}).to_list(length=None)
            state[coll] = [serialize_doc(d) for d in docs]

        temp_file = f"{MOCK_DB_FILE}.tmp"
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_file, MOCK_DB_FILE)
        # print(f"[INFO] Mock database state saved permanently to {MOCK_DB_FILE}")
    except Exception as e:
        print(f"[ERROR] Failed to save mock db state: {e}")


async def load_mock_state(db):
    """Load persisted collections from MOCK_DB_FILE into the mock database."""
    if isinstance(db, AutoPersistDatabase):
        db = db._target_db
    try:
        if os.path.exists(MOCK_DB_FILE):
            with open(MOCK_DB_FILE, "r", encoding="utf-8") as f:
                state = json.load(f)
            total_loaded = 0
            for coll, docs in state.items():
                if coll.startswith("__"):
                    continue
                # Always clear collection first to prevent ghost/deleted records
                await db[coll].delete_many({})
                if docs:
                    deserialized_docs = [deserialize_doc(d) for d in docs]
                    await db[coll].insert_many(deserialized_docs)
                    total_loaded += len(deserialized_docs)
            print(f"[INFO] Mock database state loaded from {MOCK_DB_FILE} ({total_loaded} documents)")
            return True
        return False
    except Exception as e:
        print(f"[ERROR] Failed to load mock db state: {e}")
        return False


class AutoPersistCollection:
    def __init__(self, collection, raw_db):
        self._coll = collection
        self._raw_db = raw_db

    def __getitem__(self, name):
        return self._coll[name]

    def find(self, *args, **kwargs):
        return self._coll.find(*args, **kwargs)

    def __getattr__(self, name):
        attr = getattr(self._coll, name)
        if name in (
            "insert_one", "insert_many",
            "update_one", "update_many",
            "delete_one", "delete_many",
            "replace_one",
            "find_one_and_update", "find_one_and_delete", "find_one_and_replace",
            "bulk_write"
        ):
            async def wrapped_mutation(*args, **kwargs):
                res = await attr(*args, **kwargs)
                try:
                    await save_mock_state(self._raw_db)
                except Exception as e:
                    print(f"[WARN] Auto-persist error on {name}: {e}")
                return res
            return wrapped_mutation
        return attr


class AutoPersistDatabase:
    def __init__(self, db):
        self._target_db = db

    def __getitem__(self, name):
        return AutoPersistCollection(self._target_db[name], self._target_db)

    def __getattr__(self, name):
        attr = getattr(self._target_db, name)
        if callable(attr):
            return attr
        return AutoPersistCollection(attr, self._target_db)


class AutoPersistClient:
    def __init__(self, raw_c):
        self._client = raw_c

    def __getitem__(self, name):
        return AutoPersistDatabase(self._client[name])

    def get_database(self, name):
        return AutoPersistDatabase(self._client.get_database(name))

    def __getattr__(self, name):
        return getattr(self._client, name)


async def ensure_super_admin_exists(db):
    """Ensure Super Admin (SA) exists so administrator can never be locked out."""
    from app.auth import get_password_hash
    from datetime import datetime, timezone
    existing_sa = await db["staff_accounts"].find_one({"role": "sa"})
    if not existing_sa:
        sa_pw_hash = get_password_hash("SA123")
        sa_doc = {
            "fullName": "System Administrator (SA)",
            "name": "System Administrator (SA)",
            "email": "sa@kitech.edu.in",
            "login_id": "SA",
            "role": "sa",
            "department": "ALL",
            "mobileNumber": "",
            "phone": "",
            "dateOfBirth": None,
            "accountStatus": "ACTIVE",
            "status": "ACTIVE",
            "password_hash": sa_pw_hash,
            "passwordHash": sa_pw_hash,
            "first_login": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db["staff_accounts"].insert_one(sa_doc)
        await db["users"].update_one(
            {"login_id": "SA"},
            {"$set": {
                "login_id": "SA",
                "email": "sa@kitech.edu.in",
                "name": "System Administrator (SA)",
                "role": "sa",
                "status": "ACTIVE",
                "password_hash": sa_pw_hash
            }},
            upsert=True
        )


async def connect_to_mongo():
    global raw_client, client
    raw_client = AsyncMongoMockClient()
    client = AutoPersistClient(raw_client)
    print("[INFO] Connected to MongoDB Atlas (Persistent Mock)")
    try:
        raw_db = raw_client[settings.MONGODB_DB_NAME]
        
        # Load persisted data
        already_initialized = await load_mock_state(raw_db)
        await raw_db["leave_requests"].create_index("studentId")
        await raw_db["leave_requests"].create_index("registerNumber")
        await raw_db["leave_requests"].create_index("requestId", unique=True)
        await raw_db["leave_requests"].create_index("status")
        await raw_db["leave_requests"].create_index("submittedAt")

        await raw_db["od_requests"].create_index("studentId")
        await raw_db["od_requests"].create_index("registerNumber")
        await raw_db["od_requests"].create_index("requestId", unique=True)
        await raw_db["od_requests"].create_index("status")
        await raw_db["od_requests"].create_index("submittedAt")

        try:
            await raw_db["staff_accounts"].drop_index("email_1")
        except Exception:
            pass
        await raw_db["staff_accounts"].create_index("email")
        await raw_db["staff_accounts"].create_index("login_id")
        print("[INFO] Created MongoDB indexes for leave_requests, od_requests, and staff_accounts")

        # Only ensure Super Admin exists; never resurrect or create demo users
        await ensure_super_admin_exists(raw_db)
        await sync_student_history(raw_db)
        # Immediately save database state to disk
        await save_mock_state(raw_db)
    except Exception as e:
        print(f"[WARN] Index creation / seeding warning: {e}")


async def seed_institutional_accounts(db):
    """Deprecated: User manages all institutional accounts manually starting from SA."""
    pass

async def sync_student_history(db=None):
    """
    Syncs approved leave and od records into a dedicated student_attendance_history MongoDB collection.
    """
    global raw_client
    if db is None:
        if raw_client is None:
            return
        db = raw_client[settings.MONGODB_DB_NAME]
    if isinstance(db, AutoPersistDatabase):
        db = db._target_db

    leave_cursor = db["leave_requests"].find({"status": {"$in": ["Approved", "approved", "APPROVED"]}})
    leaves = await leave_cursor.to_list(length=1000)
    
    od_cursor = db["od_requests"].find({"status": {"$in": ["Approved", "approved", "APPROVED"]}})
    ods = await od_cursor.to_list(length=1000)
    
    student_history = {}
    
    for r in leaves:
        reg = r.get("registerNumber")
        if not reg: continue
        
        if reg not in student_history:
            student_history[reg] = {
                "registerNumber": reg,
                "studentName": r.get("studentName"),
                "department": r.get("department"),
                "year": r.get("year"),
                "totalLeaveDays": 0,
                "totalODDays": 0,
                "records": []
            }
            
        days = int(r.get("numberOfDays", 0) or 0)
        student_history[reg]["totalLeaveDays"] += days
        student_history[reg]["records"].append({
            "type": "Leave",
            "fromDate": r.get("fromDate"),
            "toDate": r.get("toDate"),
            "days": days,
            "reason": r.get("reason"),
            "approvedBy": r.get("approvedBy")
        })

    for r in ods:
        reg = r.get("registerNumber")
        if not reg: continue
        
        if reg not in student_history:
            student_history[reg] = {
                "registerNumber": reg,
                "studentName": r.get("studentName"),
                "department": r.get("department"),
                "year": r.get("year"),
                "totalLeaveDays": 0,
                "totalODDays": 0,
                "records": []
            }
            
        days = int(r.get("numberOfDays", 0) or 0)
        student_history[reg]["totalODDays"] += days
        student_history[reg]["records"].append({
            "type": "OD",
            "fromDate": r.get("fromDate"),
            "toDate": r.get("toDate"),
            "days": days,
            "reason": r.get("eventName"),
            "approvedBy": r.get("approvedBy")
        })
        
    await db["student_attendance_history"].delete_many({})
    docs = list(student_history.values())
    if docs:
        await db["student_attendance_history"].insert_many(docs)
    print(f"[INFO] Synced student_attendance_history for {len(docs)} students")
    await save_mock_state(db)

async def close_mongo_connection():
    global raw_client, client
    if raw_client:
        await save_mock_state()
        raw_client.close()
        print("[INFO] Closed MongoDB connection and saved state to disk")

def get_db():
    """Dependency to get MongoDB database (Async)."""
    global client
    return client[settings.MONGODB_DB_NAME]


