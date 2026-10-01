from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import UserResponse, UserUpdate, UserPublic, ChangePasswordRequest
from app.schemas.auth import MessageResponse
from app.services.security import get_user_by_username, hash_password, verify_password, revoke_all_user_tokens
from app.api.deps import get_current_user_id
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get current authenticated user info."""
    # NOTE: previously this called get_current_user(db, user_id), but that
    # function expects a raw JWT string, not an already-decoded user_id.
    # Passing the int broke this endpoint with a 500 error every time.
    user = db.query(User).filter(User.id == user_id, User.is_active).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/me", response_model=UserResponse)
def update_current_user(
    data: UserUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Update current user profile."""
    user = db.query(User).filter(User.id == user_id, User.is_active).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.username is not None and data.username != user.username:
        existing = db.query(User).filter(User.username == data.username, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already in use")
        user.username = data.username

    if data.email is not None:
        # Check if email is taken by another user
        existing = db.query(User).filter(User.email == data.email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = data.email

    if data.avatar is not None:
        user.avatar = data.avatar

    if data.salt is not None:
        user.salt = data.salt

    db.commit()
    db.refresh(user)
    return user


@router.put("/me/password", response_model=MessageResponse)
def change_password(
    data: ChangePasswordRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Change current user's password."""
    user = db.query(User).filter(User.id == user_id, User.is_active).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")

    user.password_hash = hash_password(data.new_password)
    db.commit()

    # Log out other sessions for safety
    revoke_all_user_tokens(user_id, db)

    return MessageResponse(message="Password updated")


@router.delete("/me", response_model=MessageResponse)
def delete_current_user(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Deactivate (soft-delete) current user's account."""
    user = db.query(User).filter(User.id == user_id, User.is_active).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    db.commit()

    revoke_all_user_tokens(user_id, db)

    return MessageResponse(message="Account deleted")


@router.get("/{user_id}/public", response_model=UserPublic)
def get_public_user(
    user_id: int,
    db: Session = Depends(get_db),
):
    """Get public user profile (for chat, product seller info)."""
    user = db.query(User).filter(User.id == user_id, User.is_active).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/me/pubkey", response_model=MessageResponse)
def update_pubkey(
    pubkey: bytes = File(...),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Upload user's public key for E2E encryption."""
    user = db.query(User).filter(User.id == user_id, User.is_active).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.pubkey = pubkey
    db.commit()
    return MessageResponse(message="Public key updated")