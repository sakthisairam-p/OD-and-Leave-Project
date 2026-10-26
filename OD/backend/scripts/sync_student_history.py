import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import datetime

# MongoDB config
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "kitech_smart_attendance"

async def sync_history():
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    
    print("Fetching approved OD and Leave requests...")
    # Fetch all approved leaves and ODs
    leave_cursor = db.leave_requests.find({"status": "Approved"})
    leaves = await leave_cursor.to_list(length=None)
    
    od_cursor = db.od_requests.find({"status": "Approved"})
    ods = await od_cursor.to_list(length=None)
    
    print(f"Found {len(leaves)} approved leaves and {len(ods)} approved ODs.")
    
    # Store aggregated history per student
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
            "approvedBy": r.get("approvedBy"),
            "submittedAt": r.get("submittedAt")
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
            "eventName": r.get("eventName"),
            "location": r.get("location"),
            "approvedBy": r.get("approvedBy"),
            "submittedAt": r.get("submittedAt")
        })
        
    print(f"Aggregated records for {len(student_history)} students.")
    
    if student_history:
        print("Saving to 'student_attendance_history' collection...")
        history_collection = db["student_attendance_history"]
        
        # Clear existing collection and replace with updated data
        await history_collection.delete_many({})
        
        docs = list(student_history.values())
        # add a sync timestamp
        for d in docs:
            d["lastSyncedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            
        await history_collection.insert_many(docs)
        print("Successfully created/updated MongoDB student_attendance_history mapping.")
    else:
        print("No approved records found to sync.")

if __name__ == "__main__":
    asyncio.run(sync_history())
