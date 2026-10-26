"""
User management, DEO management routers - MongoDB version
"""
from datetime import datetime, timezone
from typing import Optional, Union, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
from app.database import get_db
from app import models
from app.auth import get_current_user, require_roles, get_password_hash

# ============================================================
# USER MANAGEMENT (DEO)
# ============================================================
users_router = APIRouter(prefix="/users", tags=["User Management"])


class InstitutionalUserCreate(BaseModel):
    staff_id: Optional[str] = ""
    full_name: str
    email: str
    password: str
    phone: Optional[str] = ""
    department: str
    date_of_birth: Optional[str] = ""
    role: str  # HOD, ADVISOR, FACULTY, STAFF, DEO, CA, NONE
    status: str = "ACTIVE"
    designation: Optional[str] = None
    subjects: Optional[Union[list[str], str]] = []
    assigned_classes: Optional[list[str]] = []
    assigned_year: Optional[str] = None
    year: Optional[str] = None
    assigned_section: Optional[str] = None
    office: Optional[str] = None


class StudentAccountCreate(BaseModel):
    student_id: Optional[str] = None
    full_name: str
    register_number: str
    roll_number: str
    email: str
    mobile_number: str
    department: str
    year: str
    section: str
    date_of_birth: str
    advisor: Optional[str] = ""
    parent_name: Optional[str] = ""
    parent_contact: Optional[str] = ""
    account_status: str = "ACTIVE"
    password: Optional[str] = None


def format_dob_password(dob_raw: str) -> str:
    """Extract DDMMYYYY from a date string (YYYY-MM-DD or DD-MM-YYYY or DD/MM/YYYY)."""
    if not dob_raw:
        return "15082005"
    clean = dob_raw.strip()
    import re
    digits = re.sub(r"\D", "", clean)
    if len(digits) == 8:
        if clean.startswith("19") or clean.startswith("20"):
            yyyy = digits[:4]
            mm = digits[4:6]
            dd = digits[6:8]
            return f"{dd}{mm}{yyyy}"
        else:
            return digits
    return "15082005"


class StudentDeactivateRequest(BaseModel):
    reason: Optional[str] = "Deactivated by DEO"


@users_router.post("/students")
@users_router.post("/student")
async def create_student_account(
    data: StudentAccountCreate,
    current_user: models.User = Depends(require_roles(models.UserRole.DEO)),
    mongo_db = Depends(get_db)
):
    import re
    email = data.email.strip().lower()
    reg_no = data.register_number.strip()
    roll_no = data.roll_number.strip()
    full_name = data.full_name.strip()
    dob = data.date_of_birth.strip() if data.date_of_birth else ""

    if not full_name or not reg_no or not roll_no or not email:
        raise HTTPException(status_code=400, detail="Full Name, Register Number, Roll Number, and College Email are required.")

    # Unique check across student_accounts and staff_accounts
    existing_reg = await mongo_db["student_accounts"].find_one({"register_no": reg_no})
    if existing_reg:
        raise HTTPException(status_code=400, detail="Student already exists with this Register Number.")

    existing_roll = await mongo_db["student_accounts"].find_one({"roll_number": roll_no})
    if existing_roll:
        raise HTTPException(status_code=400, detail="Student already exists with this Roll Number.")

    existing_email = await mongo_db["student_accounts"].find_one({"email": email})
    existing_staff_email = await mongo_db["staff_accounts"].find_one({"email": email})
    if existing_email or existing_staff_email:
        raise HTTPException(status_code=400, detail="A student account already exists with this email.")

    if data.password and data.password.strip():
        initial_pw = data.password.strip()
    else:
        initial_pw = format_dob_password(dob)

    if len(initial_pw) < 6:
        raise HTTPException(status_code=400, detail="Initial password must be at least 6 characters.")

    # Enforce DEO department if the registering DEO has an assigned department
    final_dept = data.department.strip()
    deo_staff = await mongo_db["staff_accounts"].find_one({
        "$or": [{"email": current_user.login_id.lower()}, {"login_id": current_user.login_id}]
    })
    if deo_staff and deo_staff.get("department") and deo_staff.get("department").upper() not in ("ALL", ""):
        final_dept = deo_staff["department"]

    pw_hash = get_password_hash(initial_pw)
    now_iso = datetime.now(timezone.utc).isoformat()
    std_id = data.student_id.strip() if data.student_id and data.student_id.strip() else f"STU-{reg_no}"

    student_doc = {
        "student_id": std_id,
        "name": full_name,
        "fullName": full_name,
        "register_no": reg_no,
        "registerNumber": reg_no,
        "roll_number": roll_no,
        "rollNumber": roll_no,
        "email": email,
        "collegeEmail": email,
        "phone": data.mobile_number.strip(),
        "department": final_dept,
        "department_code": "AIML" if "AI" in final_dept.upper() or "AIML" in final_dept.upper() else final_dept,
        "year": data.year.strip(),
        "section": data.section.strip(),
        "date_of_birth": dob,
        "advisor": data.advisor.strip() if data.advisor else "",
        "parent_name": data.parent_name.strip() if data.parent_name else "",
        "parent_contact": data.parent_contact.strip() if data.parent_contact else "",
        "password_hash": pw_hash,
        "passwordHash": pw_hash,
        "role": "student",
        "status": data.account_status.strip().upper(),
        "accountStatus": data.account_status.strip().upper(),
        "first_login": False,
        "created_at": now_iso,
        "updated_at": now_iso,
        "created_by": str(current_user.id),
        "createdByDEO": True
    }

    result = await mongo_db["student_accounts"].insert_one(student_doc)
    doc_id = str(result.inserted_id)

    # Also keep student_master up to date
    await mongo_db["student_master"].update_one(
        {"register_no": reg_no},
        {"$set": {
            "register_no": reg_no,
            "name": full_name,
            "date_of_birth": dob,
            "department": data.department.strip(),
            "year": data.year.strip(),
            "section": data.section.strip(),
            "email": email,
            "phone": data.mobile_number.strip(),
            "status": "REGISTERED"
        }},
        upsert=True
    )

    # Log to audit_logs
    await mongo_db["audit_logs"].insert_one({
        "action": "STUDENT_CREATED_BY_DEO",
        "entity_type": "student_account",
        "entity_id": doc_id,
        "user_id": str(current_user.id),
        "user_role": str(current_user.role),
        "student_id": std_id,
        "register_no": reg_no,
        "created_at": now_iso
    })

    # Save mock database state immediately to disk
    from app.database import save_mock_state
    await save_mock_state(mongo_db)

    return {
        "message": f"Student account created successfully for {full_name}.",
        "id": doc_id,
        "student_id": std_id,
        "register_no": reg_no,
        "email": email,
        "status": data.account_status.strip().upper()
    }


@users_router.post("/institutional")
async def create_institutional_user(
    data: InstitutionalUserCreate,
    current_user: models.User = Depends(require_roles(models.UserRole.DEO, models.UserRole.HOD, models.UserRole.SA)),
    mongo_db = Depends(get_db)
):
    valid_roles = ["HOD", "ADVISOR", "CA", "FACULTY", "STAFF", "DEO", "NONE"]
    role_upper = data.role.strip().upper()
    if role_upper not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid institutional role. Must be one of {', '.join(valid_roles)}")

    if role_upper == "DEO" and str(current_user.role).lower() != "sa":
        raise HTTPException(status_code=403, detail="Only Super Admin (SA) can register a DEO account.")

    # Normalize role to standard role codes
    if role_upper in ("CA", "ADVISOR"):
        normalized_role = "advisor"
    elif role_upper == "HOD":
        normalized_role = "hod"
    elif role_upper == "DEO":
        normalized_role = "deo"
    else:
        normalized_role = "faculty"  # NONE, FACULTY, STAFF mapped to faculty

    email = data.email.strip().lower()

    # Enforce DEO department if current_user is DEO and has assigned department
    final_dept = data.department.strip()
    if str(current_user.role).lower() == "deo":
        deo_staff = await mongo_db["staff_accounts"].find_one({
            "$or": [{"email": current_user.login_id.lower()}, {"login_id": current_user.login_id}]
        })
        if deo_staff and deo_staff.get("department") and deo_staff.get("department").upper() not in ("ALL", ""):
            final_dept = deo_staff["department"]

    # Student check - ensure college email doesn't collide with student account
    existing_student = await mongo_db["student_accounts"].find_one({"email": email})
    if existing_student:
        raise HTTPException(status_code=400, detail="A student account already exists with this email.")

    target_year = data.year or data.assigned_year
    if target_year:
        target_year = str(target_year).strip()

    # Enforce: In a department, per academic year, ONLY ONE Class Advisor (CA) is allowed!
    if normalized_role == "advisor":
        if not target_year:
            raise HTTPException(status_code=400, detail="Academic Year is required when registering a Class Advisor (CA).")
        existing_ca = await mongo_db["staff_accounts"].find_one({
            "role": "advisor",
            "department": final_dept,
            "$or": [{"year": target_year}, {"assigned_year": target_year}]
        })
        if existing_ca and existing_ca.get("email") != email:
            raise HTTPException(
                status_code=400,
                detail=f"A Class Advisor ({existing_ca.get('name')}) is already assigned for {final_dept} Year {target_year}. Only one Class Advisor is allowed per year in a department."
            )

    # Enforce: In a department, ONLY ONE HOD is allowed!
    if normalized_role == "hod":
        existing_hod = await mongo_db["staff_accounts"].find_one({
            "role": "hod",
            "department": final_dept
        })
        if existing_hod and existing_hod.get("email") != email:
            raise HTTPException(
                status_code=400,
                detail=f"An HOD ({existing_hod.get('name')}) is already assigned for department {final_dept}. Only one HOD is allowed per department."
            )

    # Staff can share the same college email across multiple roles (e.g. Advisor, Faculty, Subject Staff).
    # Only reject if the EXACT same appointment (same role, department, and year) already exists for this email.
    exact_duplicate_filter = {
        "email": email,
        "role": normalized_role,
        "department": final_dept
    }
    if target_year:
        exact_duplicate_filter["$or"] = [{"year": target_year}, {"assigned_year": target_year}]

    existing_same_appointment = await mongo_db["staff_accounts"].find_one(exact_duplicate_filter)
    if existing_same_appointment:
        raise HTTPException(
            status_code=400,
            detail=f"This staff member is already registered as {role_upper} for {final_dept}{(' ' + target_year) if target_year else ''}."
        )

    # Parse subjects
    parsed_subjects = []
    if isinstance(data.subjects, str):
        parsed_subjects = [s.strip() for s in data.subjects.split(",") if s.strip()]
    elif isinstance(data.subjects, list):
        parsed_subjects = [str(s).strip() for s in data.subjects if str(s).strip()]

    pw_hash = get_password_hash(data.password)

    import secrets
    stf_id = (data.staff_id or "").strip()
    if not stf_id:
        stf_id = f"STF-{secrets.token_hex(3).upper()}"
    user_doc = {
        "staff_id": stf_id,
        "staffId": stf_id,
        "login_id": email,
        "name": data.full_name.strip(),
        "email": email,
        "password_hash": pw_hash,
        "passwordHash": pw_hash,
        "phone": data.phone.strip(),
        "department": final_dept,
        "date_of_birth": data.date_of_birth.strip() if data.date_of_birth else "",
        "role": normalized_role,
        "status": data.status.strip().upper(),
        "designation": data.designation,
        "subjects": parsed_subjects,
        "assigned_classes": data.assigned_classes or [],
        "assigned_year": target_year if normalized_role != "hod" else None,
        "year": target_year if normalized_role != "hod" else None,
        "assigned_section": data.assigned_section,
        "office": data.office,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": str(current_user.id)
    }

    result = await mongo_db["staff_accounts"].insert_one(user_doc)

    # Also keep users table updated for fallback auth by unique login_id and role
    await mongo_db["users"].update_one(
        {"login_id": user_doc["login_id"], "role": normalized_role},
        {"$set": {
            "login_id": user_doc["login_id"],
            "email": email,
            "name": data.full_name.strip(),
            "role": normalized_role,
            "status": data.status.strip().upper(),
            "password_hash": pw_hash,
            "department": final_dept,
            "year": target_year if normalized_role != "hod" else None,
            "subjects": parsed_subjects
        }},
        upsert=True
    )

    # Save the mock database state immediately to persist this
    from app.database import save_mock_state
    await save_mock_state(mongo_db)

    return {"message": f"{role_upper} account created successfully", "id": str(result.inserted_id)}


async def get_deo_or_user_department(mongo_db, current_user):
    user_role = str(getattr(current_user, "role", "")).lower()
    if user_role in ("deo", "hod"):
        deo_staff = await mongo_db["staff_accounts"].find_one({
            "$or": [
                {"email": current_user.email.lower() if current_user.email else ""},
                {"login_id": current_user.login_id}
            ]
        })
        dept = (deo_staff.get("department") if deo_staff else None) or getattr(current_user, "department", None)
        if dept and str(dept).upper() not in ("ALL", ""):
            return str(dept).strip()
    return None


def get_dept_mongo_filter(dept_name: str):
    if not dept_name or dept_name.upper() in ("ALL", ""):
        return None
    import re
    c = dept_name.upper().replace(" ", "")
    aiml_aliases = ["AIML", "CSE(AI&ML)", "CSE(AIML)", "CSE(AI & ML)"]
    if c in [a.upper().replace(" ", "") for a in aiml_aliases]:
        return {"$in": ["AIML", "CSE(AI&ML)", "CSE(AIML)", "CSE(AI & ML)", "cse(ai&ml)", "aiml"]}
    return {"$regex": f"^{re.escape(dept_name)}$", "$options": "i"}


@users_router.get("/students")
async def list_students(
    department: Optional[str] = None,
    year: Optional[str] = None,
    section: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=200),
    current_user: models.User = Depends(require_roles(
        models.UserRole.DEO, models.UserRole.HOD, models.UserRole.ADVISOR, models.UserRole.FACULTY, models.UserRole.STAFF, models.UserRole.SA
    )),
    mongo_db = Depends(get_db)
):
    query_filter = {}
    user_dept = await get_deo_or_user_department(mongo_db, current_user)
    if user_dept:
        dept_cond = get_dept_mongo_filter(user_dept)
        if dept_cond:
            query_filter["department"] = dept_cond
    elif department:
        dept_cond = get_dept_mongo_filter(department)
        if dept_cond:
            query_filter["department"] = dept_cond

    if year and str(year).upper() != "ALL":
        import re
        base_year = str(year).upper().replace(" YEAR", "").replace("ST", "").replace("ND", "").replace("RD", "").replace("TH", "").strip()
        roman_to_num = {"I": "1", "II": "2", "III": "3", "IV": "4"}
        num_to_roman = {"1": "I", "2": "II", "3": "III", "4": "IV"}
        year_variants = {base_year}
        if base_year in roman_to_num:
            year_variants.add(roman_to_num[base_year])
        if base_year in num_to_roman:
            year_variants.add(num_to_roman[base_year])
        expanded = set(year_variants)
        for y in year_variants:
            expanded.add(f"{y} Year")
            expanded.add(f"{y}Year")
        regex_pattern = "^(" + "|".join(re.escape(v) for v in sorted(expanded)) + ")(\\b|\\s|$)"
        query_filter["year"] = {"$regex": regex_pattern, "$options": "i"}

    if section:
        query_filter["section"] = section
    if status:
        query_filter["status"] = status.upper()
    if search:
        import re
        safe_search = re.escape(search.strip())
        query_filter["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"fullName": {"$regex": safe_search, "$options": "i"}},
            {"register_no": {"$regex": safe_search, "$options": "i"}},
            {"registerNumber": {"$regex": safe_search, "$options": "i"}},
            {"roll_number": {"$regex": safe_search, "$options": "i"}},
            {"rollNumber": {"$regex": safe_search, "$options": "i"}},
            {"student_id": {"$regex": safe_search, "$options": "i"}},
            {"email": {"$regex": safe_search, "$options": "i"}},
            {"collegeEmail": {"$regex": safe_search, "$options": "i"}}
        ]

    # Get registered accounts
    students_acc = await mongo_db["student_accounts"].find(
        query_filter,
        {"password_hash": 0, "passwordHash": 0}
    ).to_list(length=1500)
    
    acc_reg_nos = {s.get("register_no") for s in students_acc if s.get("register_no")}
    
    # Get master records that aren't registered yet
    master_query = dict(query_filter)
    master_query["register_no"] = {"$nin": list(acc_reg_nos)}
    
    students_mast = await mongo_db["student_master"].find(
        master_query
    ).to_list(length=1500)
    
    # Merge and paginate
    all_students = students_acc + students_mast
    total = len(all_students)
    skip = (page - 1) * limit
    paged_students = all_students[skip : skip + limit]

    for s in paged_students:
        s["id"] = str(s["_id"])
        del s["_id"]

    return {"total": total, "students": paged_students}


@users_router.get("/staff")
async def list_staff(
    department: Optional[str] = None,
    role: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=200),
    current_user: models.User = Depends(require_roles(
        models.UserRole.DEO, models.UserRole.HOD, models.UserRole.SA
    )),
    mongo_db = Depends(get_db)
):
    user_role = str(getattr(current_user, "role", "")).lower()
    if user_role in ("deo", "hod"):
        # DEOs and HODs must never see DEO or SA accounts in Manage Users
        if role and role.lower() in ("sa", "deo"):
            return {"total": 0, "staff": []}
        query_filter = {"role": {"$nin": ["sa", "deo", "SA", "DEO"]}}
        # Also ensure current DEO user's own email is excluded
        current_email = getattr(current_user, "email", None)
        if current_email:
            query_filter["email"] = {"$ne": current_email}

        user_dept = await get_deo_or_user_department(mongo_db, current_user)
        if user_dept:
            dept_cond = get_dept_mongo_filter(user_dept)
            if dept_cond:
                query_filter["department"] = dept_cond
    else:
        query_filter = {"role": {"$ne": "sa"}}
        if department:
            dept_cond = get_dept_mongo_filter(department)
            if dept_cond:
                query_filter["department"] = dept_cond

    if role:
        if role.lower() == "sa":
            return {"total": 0, "staff": []}
        if user_role in ("deo", "hod") and role.lower() == "deo":
            return {"total": 0, "staff": []}
        query_filter["role"] = role.lower()
    if search:
        query_filter["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"designation": {"$regex": search, "$options": "i"}},
            {"staff_id": {"$regex": search, "$options": "i"}},
            {"staffId": {"$regex": search, "$options": "i"}}
        ]

    total = await mongo_db["staff_accounts"].count_documents(query_filter)
    skip = (page - 1) * limit
    staff = await mongo_db["staff_accounts"].find(
        query_filter,
        {"password_hash": 0, "passwordHash": 0}  # Never return password hash
    ).skip(skip).limit(limit).to_list(length=limit)

    for s in staff:
        s["id"] = str(s["_id"])
        del s["_id"]

    return {"total": total, "staff": staff}


@users_router.post("/students/import")
async def import_students(
    file: UploadFile = File(...),
    confirm: bool = Form(False),
    current_user: models.User = Depends(require_roles(
        models.UserRole.DEO, models.UserRole.HOD
    )),
    mongo_db = Depends(get_db)
):
    import csv
    import io

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    required_cols = ["register_no", "name", "date_of_birth", "department", "year", "section", "email", "phone"]
    missing_cols = [c for c in required_cols if c not in (reader.fieldnames or [])]
    if missing_cols:
        raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing_cols)}")

    valid_rows = []
    invalid_rows = []

    master_coll = mongo_db["student_master"]
    existing_cursor = master_coll.find({}, {"register_no": 1})
    existing_reg_nos = {doc["register_no"] async for doc in existing_cursor}

    user_dept = await get_deo_or_user_department(mongo_db, current_user)

    for row_num, row in enumerate(reader, start=2):
        errors = []
        reg_no = row.get("register_no", "").strip()

        if not reg_no:
            errors.append("Missing register_no")
        elif reg_no in existing_reg_nos:
            errors.append(f"Register number {reg_no} already exists in master data")

        dob_str = row.get("date_of_birth", "").strip()
        if not dob_str:
            errors.append("Missing date of birth")

        row_dept = user_dept if user_dept else row.get("department", "").strip()
        row_data = {
            "register_no": reg_no,
            "name": row.get("name", "").strip(),
            "date_of_birth": dob_str,
            "department": row_dept,
            "year": row.get("year", "").strip(),
            "section": row.get("section", "").strip(),
            "email": row.get("email", "").strip(),
            "phone": row.get("phone", "").strip(),
            "status": "NOT REGISTERED"
        }

        if errors:
            invalid_rows.append({"row": row_num, "data": row_data, "errors": errors})
        else:
            valid_rows.append({"row": row_num, "data": row_data})
            existing_reg_nos.add(reg_no)

    if confirm and not invalid_rows and valid_rows:
        docs_to_insert = [vr["data"] for vr in valid_rows]
        await master_coll.insert_many(docs_to_insert)
        return {"message": f"Successfully imported {len(valid_rows)} students into master", "imported": len(valid_rows)}

    return {
        "total_processed": len(valid_rows) + len(invalid_rows),
        "valid_count": len(valid_rows),
        "invalid_count": len(invalid_rows),
        "valid_rows": valid_rows[:10],
        "invalid_rows": invalid_rows
    }


@users_router.post("/students/{user_id}/deactivate")
@users_router.put("/{user_id}/toggle-status")
async def toggle_user_status(
    user_id: str,
    deactivate_data: Optional[StudentDeactivateRequest] = None,
    current_user: models.User = Depends(require_roles(models.UserRole.DEO)),
    mongo_db = Depends(get_db)
):
    from bson import ObjectId
    query_filter = {}
    if ObjectId.is_valid(user_id):
        query_filter["_id"] = ObjectId(user_id)
    else:
        query_filter["$or"] = [
            {"register_no": user_id},
            {"student_id": user_id},
            {"email": user_id.lower()}
        ]

    student = await mongo_db["student_accounts"].find_one(query_filter)
    if not student:
        raise HTTPException(status_code=404, detail="Student account not found")

    current_status = student.get("status", "ACTIVE").upper()
    new_status = "INACTIVE" if current_status == "ACTIVE" else "ACTIVE"
    reason = (deactivate_data.reason.strip() if deactivate_data and deactivate_data.reason else "Deactivated by DEO") if new_status == "INACTIVE" else ""
    now_iso = datetime.now(timezone.utc).isoformat()

    update_fields = {
        "status": new_status,
        "accountStatus": new_status,
        "updated_at": now_iso
    }
    if new_status == "INACTIVE":
        update_fields["deactivatedAt"] = now_iso
        update_fields["deactivated_at"] = now_iso
        update_fields["deactivatedBy"] = current_user.login_id
        update_fields["deactivated_by"] = current_user.login_id
        update_fields["deactivationReason"] = reason
        update_fields["deactivation_reason"] = reason

    await mongo_db["student_accounts"].update_one(
        {"_id": student["_id"]},
        {"$set": update_fields}
    )

    # Log to audit_logs
    await mongo_db["audit_logs"].insert_one({
        "action": "STUDENT_DEACTIVATED" if new_status == "INACTIVE" else "STUDENT_ACTIVATED",
        "entity_type": "student_account",
        "entity_id": str(student["_id"]),
        "user_id": str(current_user.id),
        "deactivated_by": current_user.login_id,
        "reason": reason,
        "created_at": now_iso
    })

    from app.database import save_mock_state
    await save_mock_state(mongo_db)

    return {
        "message": f"Student account {'deactivated' if new_status == 'INACTIVE' else 'activated'} successfully.",
        "status": new_status,
        "student_id": str(student["_id"]),
        "register_no": student.get("register_no")
    }


@users_router.delete("/students/{user_id}")
@users_router.delete("/student/{user_id}")
async def delete_student_account(
    user_id: str,
    current_user: models.User = Depends(require_roles(models.UserRole.DEO, models.UserRole.SA)),
    mongo_db = Depends(get_db)
):
    from bson import ObjectId
    query_filter = {}
    if ObjectId.is_valid(user_id):
        query_filter["_id"] = ObjectId(user_id)
    else:
        query_filter["$or"] = [
            {"register_no": user_id},
            {"registerNumber": user_id},
            {"student_id": user_id},
            {"email": user_id.lower()},
            {"collegeEmail": user_id.lower()},
            {"roll_number": user_id},
            {"rollNumber": user_id}
        ]

    student = await mongo_db["student_accounts"].find_one(query_filter)
    if not student:
        student = await mongo_db["users"].find_one(query_filter)
    if not student:
        student = await mongo_db["student_master"].find_one(query_filter)

    if not student:
        raise HTTPException(status_code=404, detail="Student account not found in database.")

    doc_id_str = str(student["_id"])
    reg_no = student.get("register_no") or student.get("registerNumber") or ""
    roll_no = student.get("roll_number") or student.get("rollNumber") or ""
    email = (student.get("email") or student.get("collegeEmail") or "").strip().lower()
    student_name = student.get("name") or student.get("fullName") or "Student"

    # 1. Permanently remove from student_accounts & users collections
    await mongo_db["student_accounts"].delete_many({
        "$or": [
            {"_id": student["_id"]},
            {"register_no": reg_no} if reg_no else {"_id": None},
            {"registerNumber": reg_no} if reg_no else {"_id": None},
            {"roll_number": roll_no} if roll_no else {"_id": None},
            {"rollNumber": roll_no} if roll_no else {"_id": None},
            {"email": email} if email else {"_id": None},
            {"collegeEmail": email} if email else {"_id": None}
        ]
    })

    await mongo_db["users"].delete_many({
        "$or": [
            {"login_id": reg_no} if reg_no else {"_id": None},
            {"login_id": email} if email else {"_id": None},
            {"email": email} if email else {"_id": None}
        ]
    })

    # 2. Delete master registration record if existing
    if reg_no:
        await mongo_db["student_master"].delete_many({
            "$or": [{"register_no": reg_no}, {"registerNumber": reg_no}]
        })

    # 3. Clean up associated notifications
    notif_filter = {"$or": [{"user_id": doc_id_str}]}
    if email:
        notif_filter["$or"].append({"email": email})
    await mongo_db["notifications"].delete_many(notif_filter)

    # 4. Clean up leave, OD, late arrival requests and corrections
    req_filter = {"$or": [{"studentId": doc_id_str}]}
    if reg_no:
        req_filter["$or"].append({"registerNumber": reg_no})
        req_filter["$or"].append({"register_no": reg_no})
    await mongo_db["leave_requests"].delete_many(req_filter)
    await mongo_db["od_requests"].delete_many(req_filter)
    await mongo_db["late_arrival_requests"].delete_many(req_filter)
    await mongo_db["attendance_corrections"].delete_many(req_filter)

    now_iso = datetime.now(timezone.utc).isoformat()

    # Log to audit_logs
    await mongo_db["audit_logs"].insert_one({
        "action": "STUDENT_PERMANENTLY_DELETED",
        "entity_type": "student_account",
        "entity_id": doc_id_str,
        "user_id": str(current_user.id),
        "deleted_by": current_user.login_id,
        "student_name": student_name,
        "register_no": reg_no,
        "email": email,
        "created_at": now_iso
    })

    # Save the mock database state immediately to persist this permanently
    from app.database import save_mock_state
    await save_mock_state(mongo_db)

    return {
        "message": f"Student {student_name} ({reg_no}) permanently deleted successfully.",
        "student_id": doc_id_str,
        "register_no": reg_no
    }

class StaffAccountUpdate(BaseModel):
    staff_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    year: Optional[str] = None
    assigned_year: Optional[str] = None
    password: Optional[str] = None

@users_router.put("/staff/{user_id}")
async def update_staff_account(
    user_id: str,
    data: StaffAccountUpdate,
    current_user: models.User = Depends(require_roles(models.UserRole.DEO, models.UserRole.SA)),
    mongo_db = Depends(get_db)
):
    from app.auth import get_password_hash
    from bson import ObjectId
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user ID")
        
    staff = await mongo_db["staff_accounts"].find_one({"_id": ObjectId(user_id)})
    if not staff:
        raise HTTPException(404, "Staff account not found")
        
    if staff.get("role", "").lower() == "deo" and str(current_user.role).lower() != "sa":
        raise HTTPException(status_code=403, detail="Only Super Admin (SA) can modify a DEO account.")
        
    update_data = {k: v for k, v in data.dict(exclude_unset=True).items() if v is not None and k != "password"}
    if data.staff_id is not None:
        update_data["staff_id"] = data.staff_id.strip()
        update_data["staffId"] = data.staff_id.strip()
    if data.year:
        update_data["year"] = data.year
        update_data["assigned_year"] = data.year
    elif data.assigned_year:
        update_data["year"] = data.assigned_year
        update_data["assigned_year"] = data.assigned_year

    if data.password:
        pw_hash = get_password_hash(data.password)
        update_data["password_hash"] = pw_hash
        update_data["passwordHash"] = pw_hash
        
    if not update_data:
        return {"message": "No fields to update"}
        
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
    await mongo_db["staff_accounts"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    # Also update master user collection if password changed
    users_update = {}
    if data.password:
        users_update["password_hash"] = get_password_hash(data.password)
    if data.email:
        users_update["email"] = data.email
    if data.name:
        users_update["name"] = data.name
        
    if users_update and staff.get("email"):
        await mongo_db["users"].update_many(
            {"email": staff.get("email")},
            {"$set": users_update}
        )
        
    # Save the mock database state immediately to persist this
    from app.database import save_mock_state
    await save_mock_state(mongo_db)
        
    return {"message": "Staff account updated successfully"}


@users_router.delete("/staff/{user_id}")
async def delete_staff_account(
    user_id: str,
    current_user: models.User = Depends(require_roles(models.UserRole.DEO, models.UserRole.SA)),
    mongo_db = Depends(get_db)
):
    from bson import ObjectId
    staff_query = {}
    if ObjectId.is_valid(user_id):
        staff_query = {"$or": [{"_id": ObjectId(user_id)}, {"_id": user_id}, {"email": user_id.lower()}, {"login_id": user_id}]}
    else:
        staff_query = {"$or": [{"_id": user_id}, {"email": user_id.lower()}, {"login_id": user_id}]}

    staff = await mongo_db["staff_accounts"].find_one(staff_query)
    if not staff:
        raise HTTPException(404, "Staff account not found")
        
    if staff.get("role", "").lower() == "deo" and str(current_user.role).lower() != "sa":
        raise HTTPException(status_code=403, detail="Only Super Admin (SA) can permanently delete a DEO account.")
        
    # Delete only the specific staff account by _id so other roles sharing the same email are preserved
    email = (staff.get("email") or "").strip().lower()
    login_id = staff.get("login_id")
    await mongo_db["staff_accounts"].delete_one({"_id": staff["_id"]})
    
    # Check if this email has any other accounts before removing from users fallback table
    if email:
        other_staff = await mongo_db["staff_accounts"].find_one({"email": email})
        if not other_staff:
            await mongo_db["users"].delete_many({"email": email})
        elif login_id:
            await mongo_db["users"].delete_many({"login_id": login_id, "role": staff.get("role", "").lower()})
        
    await mongo_db["audit_logs"].insert_one({
        "action": "STAFF_PERMANENTLY_DELETED",
        "entity_type": "staff_account",
        "entity_id": user_id,
        "user_id": str(current_user.id),
        "deleted_by": current_user.login_id,
        "email": email,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Save the mock database state immediately to persist this
    from app.database import save_mock_state
    await save_mock_state(mongo_db)
    
    return {"message": "Staff account permanently deleted successfully."}

class StudentAccountUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    register_number: Optional[str] = None
    roll_number: Optional[str] = None
    phone: Optional[str] = None
    year: Optional[str] = None
    password: Optional[str] = None

@users_router.put("/students/{user_id}")
async def update_student_account(
    user_id: str,
    data: StudentAccountUpdate,
    current_user: models.User = Depends(require_roles(models.UserRole.DEO)),
    mongo_db = Depends(get_db)
):
    from app.auth import get_password_hash
    from bson import ObjectId
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user ID")
        
    obj_id = ObjectId(user_id)
    collection_used = "student_accounts"
    student = await mongo_db["student_accounts"].find_one({"_id": obj_id})
    if not student:
        student = await mongo_db["student_master"].find_one({"_id": obj_id})
        collection_used = "student_master"
        
    if not student:
        raise HTTPException(status_code=404, detail="Student account not found")
        
    update_data = {}
    if data.name:
        update_data["name"] = data.name
        update_data["fullName"] = data.name
    if data.email:
        update_data["email"] = data.email
        update_data["collegeEmail"] = data.email
    if data.department:
        update_data["department"] = data.department
    if data.register_number:
        update_data["register_no"] = data.register_number
        update_data["registerNumber"] = data.register_number
    if data.roll_number:
        update_data["roll_number"] = data.roll_number
        update_data["rollNumber"] = data.roll_number
    if data.phone:
        update_data["phone"] = data.phone
        update_data["mobileNumber"] = data.phone
    if data.year:
        update_data["year"] = data.year
    if data.password:
        pw_hash = get_password_hash(data.password)
        update_data["password_hash"] = pw_hash
        update_data["passwordHash"] = pw_hash
        
    if not update_data:
        return {"message": "No fields to update"}
        
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
    await mongo_db[collection_used].update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )
    
    # Also update master user collection
    users_update = {}
    if data.password:
        users_update["password_hash"] = get_password_hash(data.password)
    if data.email:
        users_update["email"] = data.email
    if data.name:
        users_update["name"] = data.name
    if data.register_number:
        users_update["login_id"] = data.register_number
        
    existing_email = student.get("email") or student.get("collegeEmail")
    if users_update and existing_email:
        await mongo_db["users"].update_many(
            {"email": existing_email},
            {"$set": users_update}
        )
        
    # Save the mock database state immediately
    from app.database import save_mock_state
    await save_mock_state(mongo_db)

    return {"message": "Student account updated successfully"}

# ============================================================
# DEPARTMENT / SECTION / SUBJECT MANAGEMENT (MongoDB)
# ============================================================
admin_router = APIRouter(prefix="/admin", tags=["Administration"])


class DepartmentCreate(BaseModel):
    name: str
    code: str


class SectionCreate(BaseModel):
    department_code: str
    year: str
    section_name: str


class SubjectCreate(BaseModel):
    name: str
    code: str
    department_code: str
    year: str
    semester: str
    credits: int = 3
    is_lab: bool = False


class TimetableCreate(BaseModel):
    section: str
    subject_name: str
    subject_code: str
    faculty_name: str
    day_of_week: int  # 0=Monday..6=Sunday
    period_number: int
    start_time: str
    end_time: str
    room: Optional[str] = None
    academic_year: str = "2024-25"
    semester: str = "5"


class SettingUpdate(BaseModel):
    value: str


@admin_router.post("/departments")
async def create_department(
    data: DepartmentCreate,
    current_user: models.User = Depends(require_roles(models.UserRole.DEO)),
    mongo_db = Depends(get_db)
):
    existing = await mongo_db["departments"].find_one({"code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Department code already exists")

    result = await mongo_db["departments"].insert_one({
        "name": data.name,
        "code": data.code,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Department created", "id": str(result.inserted_id)}


@admin_router.get("/departments")
async def list_departments(
    current_user: models.User = Depends(get_current_user),
    mongo_db = Depends(get_db)
):
    depts = await mongo_db["departments"].find({"is_active": True}).to_list(length=100)
    for d in depts:
        d["id"] = str(d["_id"])
        del d["_id"]
    return {"departments": depts}


@admin_router.get("/config/departments")
async def get_config_departments(
    mongo_db = Depends(get_db)
):
    depts = await mongo_db["departments"].find({}, {"_id": 0}).to_list(length=100)
    return {"departments": depts}


@admin_router.get("/config/years")
async def get_config_years(
    mongo_db = Depends(get_db)
):
    years = await mongo_db["years"].find({}, {"_id": 0}).to_list(length=50)
    return {"years": years}


@admin_router.get("/config/sections")
async def get_config_sections(
    mongo_db = Depends(get_db)
):
    sections = await mongo_db["sections"].find({}, {"_id": 0}).to_list(length=200)
    return {"sections": sections}


@admin_router.post("/config/sections")
async def add_config_section(
    data: SectionCreate,
    current_user: models.User = Depends(require_roles(models.UserRole.DEO, models.UserRole.HOD)),
    mongo_db = Depends(get_db)
):
    new_section = {
        "department_code": data.department_code,
        "year": data.year,
        "section_name": data.section_name,
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await mongo_db["sections"].insert_one(new_section)
    return {"message": "Section added successfully"}


@admin_router.put("/config/sections/{section_name}/toggle")
async def toggle_config_section(
    section_name: str,
    current_user: models.User = Depends(require_roles(models.UserRole.DEO, models.UserRole.HOD)),
    mongo_db = Depends(get_db)
):
    section = await mongo_db["sections"].find_one({"section_name": section_name})
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    new_status = "INACTIVE" if section.get("status") == "ACTIVE" else "ACTIVE"
    await mongo_db["sections"].update_one(
        {"section_name": section_name},
        {"$set": {"status": new_status}}
    )
    return {"message": f"Section {new_status}"}


@admin_router.get("/classes")
async def list_classes(
    department: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    mongo_db = Depends(get_db)
):
    query_filter = {"is_active": True}
    if department:
        query_filter["department_code"] = department

    sections = await mongo_db["sections"].find(query_filter).to_list(length=200)
    for s in sections:
        s["id"] = str(s["_id"])
        del s["_id"]
    return {"classes": sections}


@admin_router.get("/sections")
async def list_sections(
    class_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    mongo_db = Depends(get_db)
):
    query_filter = {}
    if class_id:
        query_filter["department_code"] = class_id

    sections = await mongo_db["sections"].find(query_filter).to_list(length=200)
    for s in sections:
        s["id"] = str(s["_id"])
        del s["_id"]
    return {"sections": sections}


@admin_router.post("/subjects")
async def create_subject(
    data: SubjectCreate,
    current_user: models.User = Depends(require_roles(models.UserRole.DEO, models.UserRole.HOD)),
    mongo_db = Depends(get_db)
):
    result = await mongo_db["subjects"].insert_one({
        "name": data.name,
        "code": data.code,
        "department_code": data.department_code,
        "year": data.year,
        "semester": data.semester,
        "credits": data.credits,
        "is_lab": data.is_lab,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Subject created", "id": str(result.inserted_id)}


@admin_router.get("/subjects")
async def list_subjects(
    department_code: Optional[str] = None,
    year: Optional[str] = None,
    semester: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    mongo_db = Depends(get_db)
):
    query_filter = {"is_active": True}
    if department_code:
        query_filter["department_code"] = department_code
    if year:
        query_filter["year"] = year
    if semester:
        query_filter["semester"] = semester

    subjects = await mongo_db["subjects"].find(query_filter).to_list(length=200)
    for s in subjects:
        s["id"] = str(s["_id"])
        del s["_id"]
    return {"subjects": subjects}


@admin_router.post("/timetable")
async def create_timetable_entry(
    data: TimetableCreate,
    current_user: models.User = Depends(require_roles(models.UserRole.DEO, models.UserRole.HOD)),
    mongo_db = Depends(get_db)
):
    result = await mongo_db["timetables"].insert_one({
        "section": data.section,
        "subject_name": data.subject_name,
        "subject_code": data.subject_code,
        "faculty_name": data.faculty_name,
        "day_of_week": data.day_of_week,
        "period_number": data.period_number,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "room": data.room,
        "academic_year": data.academic_year,
        "semester": data.semester,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Timetable entry created", "id": str(result.inserted_id)}


@admin_router.get("/settings")
async def get_settings(
    current_user: models.User = Depends(get_current_user),
    mongo_db = Depends(get_db)
):
    settings_list = await mongo_db["settings"].find({}).to_list(length=200)
    for s in settings_list:
        s["id"] = str(s["_id"])
        del s["_id"]
    return {"settings": settings_list}


@admin_router.put("/settings/{key}")
async def update_setting(
    key: str,
    data: SettingUpdate,
    current_user: models.User = Depends(require_roles(models.UserRole.DEO, models.UserRole.SA)),
    mongo_db = Depends(get_db)
):
    setting = await mongo_db["settings"].find_one({"key": key})
    old_val = setting.get("value") if setting else None
    await mongo_db["settings"].update_one(
        {"key": key},
        {"$set": {"value": data.value, "updated_by": str(current_user.id), "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )

    await mongo_db["audit_logs"].insert_one({
        "action": "SETTING_UPDATED",
        "entity_type": "setting",
        "entity_id": key,
        "user_id": str(current_user.id),
        "user_role": str(current_user.role),
        "previous_value": {"value": old_val},
        "new_value": {"value": data.value},
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return {"message": "Setting updated"}
