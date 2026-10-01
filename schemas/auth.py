from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "username": "juanperez",
            "email": "juan@ejemplo.com",
            "password": "password123"
        }
    })


class LoginRequest(BaseModel):
    username: str
    password: str

    model_config = ConfigDict(json_schema_extra={
        "example": {"username": "juanperez", "password": "password123"}
    })


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None