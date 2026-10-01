from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class RatingCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=1000)


class RatingUpdate(BaseModel):
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=1000)


class RatingResponse(BaseModel):
    id: int
    product_id: int
    user_id: int
    username: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RatingSummary(BaseModel):
    average: float
    count: int
    distribution: dict[int, int]  # rating -> count