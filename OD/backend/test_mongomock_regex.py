import mongomock
import re

client = mongomock.MongoClient()
db = client["test_db"]
coll = db["test_coll"]

coll.insert_one({"name": "Student 1", "year": "III", "fromDate": "2026-10-12", "toDate": "2026-10-12", "status": "Approved"})

# Test 1: string regex with options
r1 = list(coll.find({"year": {"$regex": "^(3|III)", "$options": "i"}}))
print("Test 1 (string regex):", len(r1))

# Test 2: compiled regex
r2 = list(coll.find({"year": re.compile("^(3|III)", re.I)}))
print("Test 2 (compiled re):", len(r2))

# Test 3: exact match or in list
r3 = list(coll.find({"year": {"$in": ["III", "3", "III Year", "3rd Year"]}}))
print("Test 3 ($in list):", len(r3))

# Test 4: date range query
date = "2026-10-12"
date_q = {
    "$or": [
        {"$and": [{"fromDate": {"$lte": date}}, {"toDate": {"$gte": date}}]},
        {"fromDate": date},
        {"toDate": date}
    ]
}
r4 = list(coll.find(date_q))
print("Test 4 (date query):", len(r4))

# Test 5: date query with $or and status
# In requests.py:
# if "$or" in query_filter:
#     query_filter["$and"] = [{"$or": query_filter.pop("$or")}, date_q]
# else:
#     query_filter["$or"] = date_q["$or"]
q5 = {"$or": date_q["$or"]}
r5 = list(coll.find(q5))
print("Test 5 (q5):", len(r5))
