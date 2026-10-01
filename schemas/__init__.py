# Schemas package
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    MessageResponse,
)
from app.schemas.user import UserResponse, UserUpdate, UserPublic
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    ProductImageResponse,
)
from app.schemas.category import CategoryResponse, CategoryCreate
from app.schemas.rating import RatingCreate, RatingUpdate, RatingResponse
from app.schemas.chat import (
    ConversationResponse,
    MessageResponse,
    MessageCreate,
    ConversationCreate,
)
from app.schemas.media import MediaUploadResponse

__all__ = [
    # auth
    "RegisterRequest",
    "LoginRequest",
    "TokenResponse",
    "RefreshRequest",
    "MessageResponse",
    # user
    "UserResponse",
    "UserUpdate",
    "UserPublic",
    # product
    "ProductCreate",
    "ProductUpdate",
    "ProductResponse",
    "ProductListResponse",
    "ProductImageResponse",
    # category
    "CategoryResponse",
    "CategoryCreate",
    # rating
    "RatingCreate",
    "RatingUpdate",
    "RatingResponse",
    # chat
    "ConversationResponse",
    "MessageResponse",
    "MessageCreate",
    "ConversationCreate",
    # media
    "MediaUploadResponse",
]