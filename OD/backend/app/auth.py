"""
Authentication utilities: JWT, password hashing, token management
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from app.database import get_db
from app import models

import bcrypt
if not hasattr(bcrypt, "__about__"):
    bcrypt.__about__ = type("about", (), {"__version__": getattr(bcrypt, "__version__", "4.0.0")})

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        try:
            pw_bytes = plain_password.encode('utf-8')
            hash_bytes = hashed_password.encode('utf-8')
            return bcrypt.checkpw(pw_bytes, hash_bytes)
        except Exception:
            return False


def get_password_hash(password: str) -> str:
    try:
        return pwd_context.hash(password)
    except Exception:
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    mongo_db = Depends(get_db)
) -> models.User:
    from bson import ObjectId
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = verify_token(credentials.credentials)
    if payload is None:
        raise credentials_exception

    token_type = payload.get("type")
    if token_type != "access":
        raise credentials_exception

    user_id = payload.get("sub")
    login_id = payload.get("login_id")
    role = payload.get("role")
    account_id = payload.get("account_id")
    
    if user_id is None or not login_id:
        raise credentials_exception

    mongo_user = None

    # 1. Direct ObjectId lookup by account_id or sub if valid
    oid_to_check = account_id if (account_id and ObjectId.is_valid(account_id)) else (user_id if (user_id and ObjectId.is_valid(user_id)) else None)
    if oid_to_check:
        try:
            target_coll = "student_accounts" if (role and role.lower() == "student") else "staff_accounts"
            mongo_user = await mongo_db[target_coll].find_one({"_id": ObjectId(oid_to_check)})
            if not mongo_user:
                other_coll = "staff_accounts" if target_coll == "student_accounts" else "student_accounts"
                mongo_user = await mongo_db[other_coll].find_one({"_id": ObjectId(oid_to_check)})
        except Exception:
            pass

    # 2. If not found by ObjectId, role-aware lookup across collections
    if not mongo_user:
        if role and role.lower() == "student":
            mongo_user = await mongo_db["student_accounts"].find_one({
                "$or": [
                    {"register_no": login_id},
                    {"roll_number": login_id},
                    {"email": login_id.lower()}
                ]
            })
        else:
            role_l = (role or "").lower()
            role_filters = [role_l] if role_l else []
            if role_l == "subject_staff":
                role_filters = ["subject_staff", "faculty", "staff", "advisor"]
            elif role_l in ("staff", "faculty"):
                role_filters = ["faculty", "staff", "advisor", "subject_staff"]

            if role_filters:
                mongo_user = await mongo_db["staff_accounts"].find_one({
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

            if not mongo_user:
                mongo_user = await mongo_db["staff_accounts"].find_one({
                    "$or": [
                        {"email": login_id.lower()},
                        {"login_id": login_id},
                        {"staff_id": login_id},
                        {"staffId": login_id}
                    ]
                })

    if not mongo_user:
        mongo_user = await mongo_db["student_accounts"].find_one({
            "$or": [
                {"register_no": login_id},
                {"roll_number": login_id},
                {"email": login_id.lower()}
            ]
        })

    if not mongo_user:
        mongo_user = await mongo_db["users"].find_one({"login_id": login_id})
        
    if not mongo_user:
        raise credentials_exception

    import hashlib
    num_id = int(hashlib.md5(str(mongo_user["_id"]).encode()).hexdigest(), 16) % (10 ** 8)
    
    user_role = (role or mongo_user.get("role", "STUDENT")).lower()

    user = models.User(
        id=num_id,
        login_id=login_id,
        role=user_role,
        full_name=mongo_user.get("name") or mongo_user.get("fullName", "User"),
        email=mongo_user.get("email", ""),
        is_active=mongo_user.get("status", "ACTIVE") == "ACTIVE",
        mongo_id=str(mongo_user["_id"]),
        account_id=str(mongo_user["_id"])
    )
        
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return user


def require_roles(*roles: models.UserRole):
    """Role-based access control decorator factory."""
    async def role_checker(current_user: models.User = Depends(get_current_user)):
        allowed = [r.value.lower() if hasattr(r, "value") else str(r).lower() for r in roles]
        user_r = str(current_user.role).lower()
        if user_r == "subject_staff" and ("staff" in allowed or "faculty" in allowed or "subject_staff" in allowed):
            return current_user
        if user_r not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {allowed}"
            )
        return current_user
    return role_checker


# Convenience role dependencies
get_student_user = require_roles(models.UserRole.STUDENT)
get_staff_user = require_roles(models.UserRole.STAFF, models.UserRole.FACULTY, models.UserRole.ADVISOR, models.UserRole.HOD, models.UserRole.DEO)
get_faculty_user = require_roles(models.UserRole.FACULTY, models.UserRole.ADVISOR, models.UserRole.HOD, models.UserRole.DEO)
get_advisor_user = require_roles(models.UserRole.ADVISOR, models.UserRole.HOD, models.UserRole.DEO)
get_hod_user = require_roles(models.UserRole.HOD, models.UserRole.DEO)
get_deo_user = require_roles(models.UserRole.DEO)
get_any_authenticated = get_current_user

