from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


class ConversationCreate(BaseModel):
    other_user_id: int


class ConversationResponse(BaseModel):
    id: int
    other_user: "UserMinimal"
    last_message: Optional["MessageMinimal"] = None
    last_activity: datetime
    unread_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class UserMinimal(BaseModel):
    id: int
    username: str
    avatar: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MessageMinimal(BaseModel):
    id: int
    sender_id: int
    text: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MessageCreate(BaseModel):
    conversation_id: int
    recipient_id: int
    text: str = Field(..., min_length=1, max_length=4000)


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    recipient_id: int
    text: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PubkeyResponse(BaseModel):
    user_id: int
    pubkey: str  # base64 encoded JWK
