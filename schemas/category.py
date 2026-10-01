from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9-]+$")
    parent_id: Optional[int] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    updated_at: datetime
    children: List["CategoryResponse"] = []

    model_config = ConfigDict(from_attributes=True)


CategoryResponse.model_rebuild()