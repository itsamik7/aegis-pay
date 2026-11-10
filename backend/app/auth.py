import hashlib
import hmac
import base64
import json
import time
from typing import Optional, List
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db
from .models import User

security = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    salt = "aegis_pay_salt_synth_2024"
    iterations = 100_000
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), iterations)
    return f"pbkdf2:sha256:{iterations}${salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        parts = hashed_password.split('$')
        if len(parts) != 3:
            return False
        iterations = int(parts[0].split(':')[-1])
        salt = parts[1]
        stored_hash = parts[2]
        key = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), iterations)
        return hmac.compare_digest(key.hex(), stored_hash)
    except Exception:
        return False

def create_access_token(user_id: int, username: str, role: str, expires_in_seconds: int = 86400) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": int(time.time()) + expires_in_seconds
    }
    header = {"alg": "HS256", "typ": "JWT"}
    
    encoded_header = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    encoded_payload = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    
    signature_input = f"{encoded_header}.{encoded_payload}"
    signature = hmac.new(
        settings.JWT_SECRET.encode(),
        signature_input.encode(),
        hashlib.sha256
    ).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    
    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"

def decode_access_token(token: str) -> Optional[dict]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        
        encoded_header, encoded_payload, encoded_signature = parts
        
        # Verify signature
        signature_input = f"{encoded_header}.{encoded_payload}"
        expected_sig = hmac.new(
            settings.JWT_SECRET.encode(),
            signature_input.encode(),
            hashlib.sha256
        ).digest()
        
        # Pad signature
        rem = len(encoded_signature) % 4
        padded_sig = encoded_signature + ("=" * (4 - rem) if rem else "")
        given_sig = base64.urlsafe_b64decode(padded_sig.encode())
        
        if not hmac.compare_digest(expected_sig, given_sig):
            return None
            
        rem = len(encoded_payload) % 4
        padded_payload = encoded_payload + ("=" * (4 - rem) if rem else "")
        payload = json.loads(base64.urlsafe_b64decode(padded_payload.encode()).decode())
        
        if payload.get("exp", 0) < time.time():
            return None
            
        return payload
    except Exception:
        return None

def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Returns the authenticated user if valid token is provided, or None for public/anonymous visitors.
    """
    if not credentials:
        return None
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id, User.is_active == True).first()

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided."
        )
    
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token."
        )
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated."
        )
    return user

def require_role(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role in {allowed_roles}, but current user has '{current_user.role}'."
            )
        return current_user
    return role_checker

def require_write_permission(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role == "Read-only Viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only Viewer cannot modify application data."
        )
    return current_user

require_admin = require_role(["Admin"])
require_analyst = require_role(["Admin", "Risk Analyst", "Compliance Reviewer"])
require_reviewer = require_role(["Admin", "Compliance Reviewer"])
