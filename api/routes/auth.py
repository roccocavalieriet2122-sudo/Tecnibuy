from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    MessageResponse,
)
from app.schemas.user import UserResponse
from app.services.security import (
    hash_password,
    verify_password,
    generate_salt,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    rotate_refresh_token,
    revoke_refresh_token,
    get_user_by_username,
    get_user_by_email,
)
from app.api.deps import get_current_user_id

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user."""
    if get_user_by_username(db, data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    if get_user_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    password_hash = hash_password(data.password)
    salt = generate_salt()

    user = User(
        username=data.username,
        email=data.email,
        password_hash=password_hash,
        salt=salt,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user.id)
    refresh_token, _ = create_refresh_token(user.id, db)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=15 * 60,
    )


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Login user and return tokens."""
    user = get_user_by_username(db, data.username)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    access_token = create_access_token(user.id)
    refresh_token, _ = create_refresh_token(user.id, db)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=15 * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    """Rotate refresh token and return new access + refresh tokens."""
    rotated = rotate_refresh_token(data.refresh_token, db)
    if not rotated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    new_raw_refresh, new_rt = rotated
    access_token = create_access_token(new_rt.user_id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_raw_refresh,
        expires_in=15 * 60,
    )


@router.post("/logout", response_model=MessageResponse)
def logout(data: RefreshRequest, db: Session = Depends(get_db)):
    """Revoke refresh token (logout)."""
    success = revoke_refresh_token(data.refresh_token, db)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid refresh token",
        )
    return MessageResponse(message="Logged out successfully")