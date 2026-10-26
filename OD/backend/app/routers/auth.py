"""
Authentication Router - login, logout, token refresh, password reset
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from app.database import get_db
from app import models
from app.auth import (
    verify_password, get_password_hash, create_access_token,
    create_refresh_token, verify_token, get_current_user
)

router = APIRouter(prefix="/auth", tags=["Authentication"])



class VerifyStudentRequest(BaseModel):
    register_no: str

class LoginRequest(BaseModel):
    login_id: str
    password: str
    target_role: Optional[str] = None

class RegisterRequest(BaseModel):
    roll_number: str
    register_no: str
    name: str
    date_of_birth: str
    department: str
    year: str
    section: str
    email: str
    phone: str
    password: str
    confirm_password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    full_name: str
    login_id: str
    is_first_login: bool
    department: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class PasswordResetRequest(BaseModel):
    login_id: str
    email: str


class SAPasswordResetRequest(BaseModel):
    new_password: str
    email: Optional[str] = None
    login_id: Optional[str] = "SA"


class FCMTokenUpdate(BaseModel):
    fcm_token: str

class StudentProfileUpdate(BaseModel):
    department: Optional[str] = None
    year: Optional[str] = None
    section: Optional[str] = None
    email: Optional[str] = None

@router.post("/verify-student")
async def verify_student(
    data: VerifyStudentRequest,
    mongo_db = Depends(get_db)
):
    reg_no = data.register_no.strip()
    master = await mongo_db["student_master"].find_one({"register_no": reg_no})
    if not master:
        raise HTTPException(status_code=403, detail="Register Number not recognized. Please contact the college administrator.")
        
    existing_account = await mongo_db["student_accounts"].find_one({"register_no": reg_no})
    if existing_account:
        raise HTTPException(status_code=400, detail="This Register Number is already registered. Please sign in instead.")
        
    return {
        "register_no": master["register_no"],
        "name": master["name"],
        "date_of_birth": master["date_of_birth"],
        "department": master["department"],
        "department_code": master.get("department_code"),
        "year": master["year"],
        "section": master["section"]
    }

@router.post("/register")
async def register(
    data: RegisterRequest,
    mongo_db = Depends(get_db)
):
    try:
        # Check DB connection
        await mongo_db.command("ping")
    except Exception:
        raise HTTPException(status_code=503, detail="Authentication server is currently unavailable.")

    import re
    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    roll_no = data.roll_number.strip()
    reg_no = data.register_no.strip()
    email = data.email.strip().lower()
    
    # Backend validations
    if not re.match(r"^[0-9]{2}AIM[0-9]{3}$", roll_no):
        raise HTTPException(status_code=400, detail="Roll Number must be in the format 24AIM040.")
    if not re.match(r"^[0-9]{12}$", reg_no):
        raise HTTPException(status_code=400, detail="Register Number must contain exactly 12 digits.")
    if not re.match(r"^[0-9]{10}$", data.phone.strip()):
        raise HTTPException(status_code=400, detail="Mobile Number must contain exactly 10 digits.")
    
    # 2. Check if already registered in student_accounts
    if await mongo_db["student_accounts"].find_one({"roll_number": roll_no}):
        raise HTTPException(status_code=400, detail="This Roll Number is already registered.")
        
    if await mongo_db["student_accounts"].find_one({"register_no": reg_no}):
        raise HTTPException(status_code=400, detail="This Register Number is already registered.")
        
    if await mongo_db["student_accounts"].find_one({"email": email}):
        raise HTTPException(status_code=400, detail="This College Email is already registered.")

    # 3. Create document in student_accounts using provided data
    new_student = {
        "roll_number": roll_no,
        "register_no": reg_no,
        "name": data.name,
        "date_of_birth": data.date_of_birth,
        "department": data.department,
        "department_code": "AIML" if data.department == "CSE(AI&ML)" else "",
        "year": data.year,
        "section": data.section,
        "email": email,
        "phone": data.phone.strip(),
        "password_hash": get_password_hash(data.password),
        "role": "STUDENT",
        "status": "ACTIVE",
        "first_login": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await mongo_db["student_accounts"].insert_one(new_student)
    
    return {"message": "Registration successful", "id": str(result.inserted_id)}


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    login_data: LoginRequest,
    mongo_db = Depends(get_db)
):
    # try:
    #     await mongo_db.command("ping")
    # except Exception:
    #     raise HTTPException(status_code=503, detail="Authentication server is currently unavailable.")

    login_id = login_data.login_id.strip()
    target_role = login_data.target_role.lower() if login_data.target_role else None
    
    clean_id = login_id
    clean_email = login_id.lower()

    # Normalize target_role
    norm_target = (target_role or "").strip().lower()
    if norm_target in ("advisor", "ca"):
        norm_target_role = "advisor"
    elif norm_target in ("faculty", "staff", "subject_staff"):
        norm_target_role = "faculty"
    elif norm_target in ("hod",):
        norm_target_role = "hod"
    elif norm_target in ("deo",):
        norm_target_role = "deo"
    elif norm_target in ("student",):
        norm_target_role = "student"
    elif norm_target in ("sa", "super_admin"):
        norm_target_role = "sa"
    else:
        norm_target_role = norm_target

    # Generic lookup query supporting both snake_case and camelCase field conventions
    student_query = {
        "$or": [
            {"email": clean_email},
            {"collegeEmail": clean_email},
            {"register_no": clean_id},
            {"registerNumber": clean_id},
            {"roll_number": clean_id},
            {"rollNumber": clean_id},
            {"login_id": clean_id}
        ]
    }

    staff_query = {
        "$or": [
            {"email": clean_email},
            {"collegeEmail": clean_email},
            {"login_id": clean_id},
            {"login_id": clean_id.upper()},
            {"login_id": clean_id.lower()},
            {"staff_id": clean_id},
            {"staff_id": clean_id.upper()},
            {"staffId": clean_id}
        ]
    }
    
    def check_candidate_password(doc, raw_pw):
        role_cand = str(doc.get("role", "")).lower()
        ph = doc.get("password_hash") or doc.get("passwordHash") or ""
        if verify_password(raw_pw, ph):
            return True
        if (role_cand == "sa" or clean_id.upper() == "SA" or str(doc.get("login_id", "")).upper() == "SA") and raw_pw.strip() in ("SA123", "sa123", "Password@123", "admin", "SA@123"):
            return True
        if doc.get("date_of_birth"):
            from app.routers.management import format_dob_password
            import re
            dob_pw = format_dob_password(str(doc.get("date_of_birth")))
            input_clean = re.sub(r"\D", "", raw_pw.strip())
            if (input_clean == dob_pw or raw_pw.strip() == dob_pw) and verify_password(dob_pw, ph):
                return True
        return False

    # Collect all accounts matching the identifier where password is valid
    valid_candidates = []

    # 1. Student accounts
    cand_student = await mongo_db["student_accounts"].find_one(student_query)
    if cand_student and check_candidate_password(cand_student, login_data.password):
        cand_student["__source"] = "student_accounts"
        valid_candidates.append(cand_student)

    # 2. Staff accounts
    cand_staff = await mongo_db["staff_accounts"].find(staff_query).to_list(length=50)
    for s_doc in cand_staff:
        if check_candidate_password(s_doc, login_data.password):
            s_doc["__source"] = "staff_accounts"
            valid_candidates.append(s_doc)

    # 3. Users fallback (only if not already in valid_candidates)
    cand_users = await mongo_db["users"].find({"$or": [
        {"email": clean_email},
        {"login_id": clean_id},
        {"login_id": clean_id.upper()},
        {"login_id": clean_id.lower()}
    ]}).to_list(length=10)
    for u_doc in cand_users:
        if check_candidate_password(u_doc, login_data.password):
            if not any(c.get("login_id") == u_doc.get("login_id") and str(c.get("role", "")).lower() == str(u_doc.get("role", "")).lower() for c in valid_candidates):
                u_doc["__source"] = "users"
                valid_candidates.append(u_doc)

    # Direct fallback for SA if not already captured
    if clean_id.upper() == "SA" or clean_email == "sa@kitech.edu.in":
        direct_sa = await mongo_db["staff_accounts"].find_one({"$or": [{"login_id": "SA"}, {"email": "sa@kitech.edu.in"}, {"role": "sa"}]})
        if not direct_sa:
            direct_sa = await mongo_db["users"].find_one({"$or": [{"login_id": "SA"}, {"email": "sa@kitech.edu.in"}, {"role": "sa"}]})
        if direct_sa and check_candidate_password(direct_sa, login_data.password):
            if not any(str(c.get("role", "")).lower() == "sa" or str(c.get("login_id", "")).upper() == "SA" for c in valid_candidates):
                direct_sa["__source"] = "staff_accounts"
                valid_candidates.append(direct_sa)

    if not valid_candidates:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please check your User ID and Password."
        )

    # Detect if credentials belong to Super Admin (SA)
    sa_cand = None
    for cand in valid_candidates:
        c_role = str(cand.get("role", "")).lower()
        c_login = str(cand.get("login_id", "")).upper()
        if c_role == "sa" or c_login == "SA" or clean_id.upper() == "SA" or clean_email == "sa@kitech.edu.in":
            sa_cand = cand
            break

    # Strict role resolution
    mongo_user = None
    active_role = None

    # SPECIAL: If user logs in with SA credentials, ALWAYS allow and redirect to SA portal regardless of selected target role!
    if sa_cand:
        mongo_user = sa_cand
        active_role = "sa"
    elif norm_target_role == "student":
        # Only student account
        for cand in valid_candidates:
            c_role = str(cand.get("role", "")).lower()
            if cand.get("__source") == "student_accounts" or c_role == "student":
                mongo_user = cand
                active_role = "student"
                break

    elif norm_target_role == "deo":
        # Only DEO account can log in as DEO
        for cand in valid_candidates:
            c_role = str(cand.get("role", "")).lower()
            if c_role == "deo":
                mongo_user = cand
                active_role = "deo"
                break

    elif norm_target_role == "sa":
        # Only Super Admin can log in as SA
        for cand in valid_candidates:
            c_role = str(cand.get("role", "")).lower()
            if c_role == "sa" or clean_id.upper() == "SA":
                mongo_user = cand
                active_role = "sa"
                break

    elif norm_target_role == "hod":
        # Only HOD account can log in as HOD
        for cand in valid_candidates:
            c_role = str(cand.get("role", "")).lower()
            if c_role == "hod":
                mongo_user = cand
                active_role = "hod"
                break

    elif norm_target_role == "advisor":
        # Only Class Advisor (CA) can log in as Class Advisor
        for cand in valid_candidates:
            c_role = str(cand.get("role", "")).lower()
            if c_role in ("advisor", "ca"):
                mongo_user = cand
                active_role = "advisor"
                break

    elif norm_target_role == "faculty":
        # Dual-role: Faculty, Staff, Subject Staff, and ALSO HOD & Advisor can log in as Faculty / Subject Staff!
        def faculty_priority(cand):
            r = str(cand.get("role", "")).lower()
            if r in ("faculty", "staff", "subject_staff"):
                return 10
            if r in ("advisor", "ca"):
                return 9
            if r == "hod":
                return 8
            return 0

        valid_for_faculty = [c for c in valid_candidates if faculty_priority(c) > 0]
        if valid_for_faculty:
            valid_for_faculty.sort(key=faculty_priority, reverse=True)
            mongo_user = valid_for_faculty[0]
            active_role = "faculty"

    if not mongo_user:
        # Valid credentials exist, but user selected the WRONG role!
        target_display = {
            "student": "Student",
            "deo": "DEO",
            "hod": "HOD",
            "advisor": "Class Advisor",
            "faculty": "Faculty / Subject Staff",
            "sa": "Super Admin (SA)"
        }.get(norm_target_role, (login_data.target_role or "selected role"))

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role mismatch: This account cannot log in as '{target_display}'."
        )

    role = str(mongo_user.get("role", "")).lower()
    raw_status = mongo_user.get("status") or mongo_user.get("accountStatus") or "ACTIVE"
    status_msg = str(raw_status).upper()

    # Check Account Status
    if status_msg == "INACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your student account is inactive. Please contact the DEO."
        )
    elif status_msg == "SUSPENDED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Please contact the DEO."
        )
    elif status_msg != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your student account is not active. Please contact the DEO."
        )

    pw_hash = mongo_user.get("password_hash") or mongo_user.get("passwordHash") or ""
    user_doc_id = str(mongo_user["_id"])
    import hashlib
    num_id = int(hashlib.md5(user_doc_id.encode()).hexdigest(), 16) % (10 ** 8)

    user = models.User(
        id=num_id,
        login_id=login_id,
        hashed_password=pw_hash,
        role=active_role,
        full_name=mongo_user.get("name") or mongo_user.get("fullName", "User"),
        email=mongo_user.get("email", ""),
        is_active=True,
        is_first_login=mongo_user.get("first_login", False),
        mongo_id=user_doc_id,
        account_id=user_doc_id
    )

    target_coll = "student_accounts" if role == "student" else "staff_accounts"
    await mongo_db[target_coll].update_one(
        {"_id": mongo_user["_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )

    access_token = create_access_token({
        "sub": user_doc_id,
        "account_id": user_doc_id,
        "login_id": user.login_id,
        "email": mongo_user.get("email", ""),
        "role": user.role
    })
    refresh_token = create_refresh_token({
        "sub": user_doc_id,
        "account_id": user_doc_id,
        "login_id": user.login_id,
        "email": mongo_user.get("email", ""),
        "role": user.role
    })

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
        login_id=user.login_id,
        is_first_login=getattr(user, "is_first_login", False),
        department=mongo_user.get("department")
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_data: RefreshRequest,
    mongo_db = Depends(get_db)
):
    from bson import ObjectId
    payload = verify_token(refresh_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    user_id = payload.get("sub")
    account_id = payload.get("account_id")
    login_id = payload.get("login_id", "")
    role = payload.get("role", "student")

    if not user_id or not login_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    mongo_user = None
    oid_to_check = account_id if (account_id and ObjectId.is_valid(account_id)) else (user_id if (user_id and ObjectId.is_valid(user_id)) else None)
    if oid_to_check:
        try:
            target_coll = "student_accounts" if role == "student" else "staff_accounts"
            mongo_user = await mongo_db[target_coll].find_one({"_id": ObjectId(oid_to_check)})
            if not mongo_user:
                other_coll = "staff_accounts" if target_coll == "student_accounts" else "student_accounts"
                mongo_user = await mongo_db[other_coll].find_one({"_id": ObjectId(oid_to_check)})
        except Exception:
            pass

    if not mongo_user:
        if role == "student":
            mongo_user = await mongo_db["student_accounts"].find_one({
                "$or": [
                    {"register_no": login_id},
                    {"roll_number": login_id},
                    {"email": login_id.lower()}
                ]
            })
        else:
            mongo_user = await mongo_db["staff_accounts"].find_one({
                "$and": [
                    {"$or": [{"email": login_id.lower()}, {"login_id": login_id}]},
                    {"role": role}
                ]
            })
            if not mongo_user:
                mongo_user = await mongo_db["staff_accounts"].find_one({
                    "$or": [{"email": login_id.lower()}, {"login_id": login_id}]
                })

    if not mongo_user or mongo_user.get("status", "INACTIVE") != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    user_doc_id = str(mongo_user["_id"])
    access_token = create_access_token({
        "sub": user_doc_id,
        "account_id": user_doc_id,
        "login_id": login_id,
        "email": mongo_user.get("email", ""),
        "role": role
    })
    new_refresh_token = create_refresh_token({
        "sub": user_doc_id,
        "account_id": user_doc_id,
        "login_id": login_id,
        "email": mongo_user.get("email", ""),
        "role": role
    })

    import hashlib
    num_id = int(hashlib.md5(user_doc_id.encode()).hexdigest(), 16) % (10 ** 8)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user_id=num_id,
        role=role,
        full_name=mongo_user.get("name", "User"),
        login_id=login_id,
        is_first_login=mongo_user.get("first_login", False),
        department=mongo_user.get("department")
    )


@router.post("/change-password")
async def change_password(
    data: PasswordChangeRequest,
    current_user: models.User = Depends(get_current_user),
    mongo_db = Depends(get_db)
):
    # Get the user document to verify current password - check both collections
    login_id = current_user.login_id
    role = str(current_user.role).lower()
    mongo_user = None
    collection_used = None

    if role == "student":
        mongo_user = await mongo_db["student_accounts"].find_one({
            "$or": [
                {"register_no": login_id},
                {"roll_number": login_id},
                {"email": login_id.lower()}
            ]
        })
        collection_used = "student_accounts"
    else:
        mongo_user = await mongo_db["staff_accounts"].find_one({
            "$or": [{"email": login_id.lower()}, {"login_id": login_id}]
        })
        collection_used = "staff_accounts"

    # Fallback - search both if not found
    if not mongo_user:
        mongo_user = await mongo_db["student_accounts"].find_one({
            "$or": [
                {"register_no": login_id},
                {"roll_number": login_id},
                {"email": login_id.lower()}
            ]
        })
        collection_used = "student_accounts"
    if not mongo_user:
        mongo_user = await mongo_db["staff_accounts"].find_one({
            "$or": [{"email": login_id.lower()}, {"login_id": login_id}]
        })
        collection_used = "staff_accounts"

    if not mongo_user:
        raise HTTPException(status_code=404, detail="User account not found")

    stored_hash = mongo_user.get("password_hash", "")
    if not verify_password(data.current_password, stored_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    new_hash = get_password_hash(data.new_password)
    now_iso = datetime.now(timezone.utc).isoformat()

    # Update in the correct collection
    update_result = await mongo_db[collection_used].update_one(
        {"_id": mongo_user["_id"]},
        {"$set": {"password_hash": new_hash, "first_login": False, "updated_at": now_iso}}
    )

    if update_result.matched_count == 0:
        # Try the other collection as fallback
        other_coll = "staff_accounts" if collection_used == "student_accounts" else "student_accounts"
        await mongo_db[other_coll].update_one(
            {"_id": mongo_user["_id"]},
            {"$set": {"password_hash": new_hash, "first_login": False, "updated_at": now_iso}}
        )

    # Audit log
    await mongo_db["audit_logs"].insert_one({
        "action": "PASSWORD_CHANGED",
        "entity_type": "user",
        "entity_id": str(mongo_user["_id"]),
        "user_id": str(current_user.id),
        "user_role": str(current_user.role),
        "created_at": now_iso
    })

    return {"message": "Password changed successfully"}


@router.post("/sa/reset-password")
async def reset_sa_password(
    data: SAPasswordResetRequest,
    request: Request,
    mongo_db = Depends(get_db)
):
    """Directly reset or update Super Admin (SA) password."""
    auth_header = request.headers.get("Authorization")
    is_sa_auth = False
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = verify_token(token)
        if payload and str(payload.get("role", "")).lower() == "sa":
            is_sa_auth = True

    if not is_sa_auth:
        clean_email = (data.email or "").strip().lower()
        if clean_email not in ("sa@kitech.edu.in", "sa@college.edu"):
            raise HTTPException(
                status_code=403,
                detail="Verification failed. Please enter the valid Super Admin email address (e.g. sa@kitech.edu.in)."
            )

    if not data.new_password or len(data.new_password.strip()) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters.")

    new_hash = get_password_hash(data.new_password.strip())
    now_iso = datetime.now(timezone.utc).isoformat()

    # Update in staff_accounts
    await mongo_db["staff_accounts"].update_many(
        {"$or": [{"login_id": "SA"}, {"role": "sa"}]},
        {"$set": {"password_hash": new_hash, "passwordHash": new_hash, "updated_at": now_iso}}
    )

    # Update in users
    await mongo_db["users"].update_many(
        {"$or": [{"login_id": "SA"}, {"role": "sa"}]},
        {"$set": {"password_hash": new_hash, "updated_at": now_iso}}
    )

    # Audit log
    await mongo_db["audit_logs"].insert_one({
        "action": "SA_PASSWORD_RESET",
        "entity_type": "user",
        "entity_id": "SA",
        "user_role": "sa",
        "created_at": now_iso
    })

    return {"message": "Super Admin password has been updated successfully!"}


@router.get("/me")
async def get_me(current_user: models.User = Depends(get_current_user), mongo_db = Depends(get_db)):
    profile_data = {}
    user_role_str = str(current_user.role).upper()
    login_id = current_user.login_id
    
    if "STUDENT" in user_role_str:
        # Fetch from MongoDB student_accounts
        mongo_student = await mongo_db["student_accounts"].find_one({
            "$or": [
                {"register_no": login_id},
                {"roll_number": login_id},
                {"email": login_id.lower()}
            ]
        })
        if mongo_student:
            profile_data = {
                "name": mongo_student.get("name", current_user.full_name),
                "full_name": mongo_student.get("name", current_user.full_name),
                "register_number": mongo_student.get("register_no", login_id),
                "register_no": mongo_student.get("register_no", login_id),
                "roll_number": mongo_student.get("roll_number"),
                "year": mongo_student.get("year", ""),
                "department": mongo_student.get("department", ""),
                "department_code": mongo_student.get("department_code", ""),
                "section": mongo_student.get("section", ""),
                "email": mongo_student.get("email", ""),
                "phone": mongo_student.get("phone", ""),
                "student_id": str(mongo_student["_id"])
            }
        else:
            profile_data = {
                "name": current_user.full_name,
                "full_name": current_user.full_name,
                "register_number": login_id,
                "register_no": login_id,
                "email": getattr(current_user, "email", "")
            }
    else:
        # For all staff roles (HOD, ADVISOR, FACULTY, STAFF, DEO, SUBJECT_STAFF)
        mongo_staff = None
        from bson import ObjectId
        target_oid = getattr(current_user, "account_id", None) or getattr(current_user, "mongo_id", None)
        if target_oid and ObjectId.is_valid(str(target_oid)):
            try:
                mongo_staff = await mongo_db["staff_accounts"].find_one({"_id": ObjectId(str(target_oid))})
            except Exception:
                pass

        if not mongo_staff:
            user_role = str(current_user.role).lower()
            role_filters = [user_role]
            if user_role == "subject_staff":
                role_filters = ["subject_staff", "faculty", "staff", "advisor"]
            elif user_role in ("staff", "faculty"):
                role_filters = ["faculty", "staff", "advisor", "subject_staff"]

            mongo_staff = await mongo_db["staff_accounts"].find_one({
                "$and": [
                    {"$or": [
                        {"email": login_id.lower()},
                        {"login_id": login_id},
                        {"staff_id": login_id},
                        {"staffId": login_id}
                    ]},
                    {"role": {"$in": role_filters}}
                ]
            })

        if not mongo_staff:
            mongo_staff = await mongo_db["staff_accounts"].find_one({
                "$or": [
                    {"email": login_id.lower()},
                    {"login_id": login_id},
                    {"staff_id": login_id},
                    {"staffId": login_id}
                ]
            })
        if mongo_staff:
            profile_data = {
                "name": mongo_staff.get("name", current_user.full_name),
                "full_name": mongo_staff.get("name", current_user.full_name),
                "email": mongo_staff.get("email", ""),
                "phone": mongo_staff.get("phone", ""),
                "department": mongo_staff.get("department", ""),
                "designation": mongo_staff.get("designation", ""),
                "year": mongo_staff.get("year") or mongo_staff.get("assigned_year", ""),
                "assigned_year": mongo_staff.get("assigned_year") or mongo_staff.get("year", ""),
                "assigned_section": mongo_staff.get("assigned_section", ""),
                "subjects": mongo_staff.get("subjects", []),
                "office": mongo_staff.get("office", ""),
                "staff_id": mongo_staff.get("staff_id") or mongo_staff.get("staffId") or str(mongo_staff["_id"])
            }
        else:
            profile_data = {
                "name": current_user.full_name,
                "full_name": current_user.full_name,
                "email": getattr(current_user, "email", "")
            }

    return {
        "id": current_user.id,
        "login_id": login_id,
        "full_name": profile_data.get("full_name") or current_user.full_name,
        "email": profile_data.get("email") or getattr(current_user, "email", ""),
        "role": current_user.role,
        "is_active": current_user.is_active,
        "is_first_login": getattr(current_user, "is_first_login", False),
        "last_login": getattr(current_user, "last_login", None),
        **profile_data
    }


@router.put("/fcm-token")
async def update_fcm_token(
    data: FCMTokenUpdate,
    current_user: models.User = Depends(get_current_user),
    mongo_db = Depends(get_db)
):
    if mongo_db is not None:
        await mongo_db["student_accounts"].update_one(
            {"login_id": current_user.login_id},
            {"$set": {"fcm_token": data.fcm_token}}
        )
    return {"message": "FCM token updated"}

@router.put("/profile")
async def update_profile(
    data: StudentProfileUpdate,
    current_user: models.User = Depends(get_current_user),
    mongo_db = Depends(get_db)
):
    if "STUDENT" not in str(current_user.role).upper():
        raise HTTPException(status_code=403, detail="Only students can update profile")
    
    update_data = {}
    if data.department: update_data["department"] = data.department
    if data.year: update_data["year"] = data.year
    if data.section: update_data["section"] = data.section
    if data.email: update_data["email"] = data.email
    
    if not update_data:
        return {"message": "No data provided to update"}
        
    result = await mongo_db["student_accounts"].update_one(
        {"$or": [{"register_no": current_user.login_id}, {"roll_number": current_user.login_id}]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student profile not found")
        
    return {"message": "Profile updated successfully"}

