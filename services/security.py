import bcrypt
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.token import RefreshToken
from app.models.user import User

settings = get_settings()


def hash_password(password: str) -> str:
    """Hash password using bcrypt directly (not passlib)."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash."""
    return bcrypt.checkpw(password.encode(), hashed.encode())


def generate_salt() -> str:
    """Generate a random salt for E2E key derivation."""
    return secrets.token_hex(16)


def create_access_token(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Optional[int]:
    """Decode and validate JWT access token. Returns user_id or None."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        if payload.get("type") != "access":
            return None
        return int(payload.get("sub"))
    except JWTError:
        return None


def create_refresh_token(user_id: int, db: Session) -> Tuple[str, RefreshToken]:
    """Create a new refresh token, store hash in DB, return raw token and model."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)

    rt = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(rt)
    db.commit()
    db.refresh(rt)
    return raw_token, rt


def verify_refresh_token(raw_token: str, db: Session) -> Optional[RefreshToken]:
    """Verify refresh token by hash. Returns RefreshToken model if valid."""
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    rt = db.query(RefreshToken).filter_by(token_hash=token_hash).first()

    if not rt:
        return None
    if rt.revoked_at is not None:
        return None
    if rt.expires_at < datetime.now(timezone.utc):
        return None

    return rt


def rotate_refresh_token(raw_token: str, db: Session) -> Optional[Tuple[str, RefreshToken]]:
    """Rotate refresh token: revoke old, create new. Returns new raw token and model."""
    rt = verify_refresh_token(raw_token, db)
    if not rt:
        return None

    # Revoke old token
    rt.revoked_at = datetime.now(timezone.utc)
    db.commit()

    # Create new token
    return create_refresh_token(rt.user_id, db)


def revoke_refresh_token(raw_token: str, db: Session) -> bool:
    """Revoke a refresh token (logout)."""
    rt = verify_refresh_token(raw_token, db)
    if not rt:
        return False
    rt.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return True


def revoke_all_user_tokens(user_id: int, db: Session) -> int:
    """Revoke all refresh tokens for a user. Returns count revoked."""
    count = (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .update({"revoked_at": datetime.now(timezone.utc)})
    )
    db.commit()
    return count


def get_current_user(db: Session, token: str) -> Optional[User]:
    """Get user from access token."""
    user_id = decode_access_token(token)
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id, User.is_active).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Get user by username."""
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get user by email."""
    return db.query(User).filter(User.email == email).first()