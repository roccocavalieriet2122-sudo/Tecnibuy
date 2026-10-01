from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.security import decode_access_token, get_current_user
from app.models.user import User


def get_db_session() -> Session:
    """Dependency for database session."""
    yield from get_db()


async def get_current_user_id(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db_session),
) -> int:
    """Extract and validate access token, return user_id."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ")[1]
    user_id = decode_access_token(token)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_current_user(db, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user.id


async def get_current_user_obj(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db_session),
) -> User:
    """Get current user object."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


async def get_optional_user_id(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db_session),
) -> Optional[int]:
    """Optional authentication - returns user_id if valid token, None otherwise."""
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ")[1]
    return decode_access_token(token)