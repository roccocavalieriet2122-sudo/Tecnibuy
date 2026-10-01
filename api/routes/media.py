from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.schemas.media import MediaUploadResponse
from app.api.deps import get_current_user_id
from app.models.user import User
from app.services.media import validate_image, generate_object_key, upload_image, presigned_get_url, delete_image

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/upload", response_model=MediaUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_media(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Upload an image file to MinIO. Returns object_key and presigned URL."""
    # Read file
    file_bytes = await file.read()

    # Validate
    is_valid, error = validate_image(file_bytes, file.filename or "")
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Generate object key and upload
    object_key = generate_object_key(file.filename or "image.jpg")
    content_type = file.content_type or "image/jpeg"
    await upload_image(file_bytes, object_key, content_type)

    # Generate presigned URL
    url = presigned_get_url(object_key)

    return MediaUploadResponse(object_key=object_key, url=url)


@router.delete("/{object_key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(
    object_key: str,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete an image from MinIO (admin only)."""
    # Check if admin
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    success = delete_image(object_key)
    if not success:
        raise HTTPException(status_code=404, detail="Image not found or could not be deleted")