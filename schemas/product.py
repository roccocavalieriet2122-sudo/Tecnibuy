from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class ProductBase(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10)
    price: Decimal = Field(ge=0, decimal_places=2)
    stock: int = Field(ge=1, le=999)
    condition: str = Field(pattern="^(new|used|refurbished)$")
    category_id: int


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, min_length=10)
    price: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    stock: Optional[int] = Field(default=None, ge=0, le=999)
    condition: Optional[str] = Field(default=None, pattern="^(new|used|refurbished)$")
    category_id: Optional[int] = None
    status: Optional[str] = Field(default=None, pattern="^(active|sold|deleted)$")


class ProductImageResponse(BaseModel):
    id: int
    object_key: str
    alt: Optional[str] = None
    position: int
    url: str

    model_config = ConfigDict(from_attributes=True)


class ProductResponse(BaseModel):
    id: int
    seller_id: int
    title: str
    description: str
    price: Decimal
    stock: int
    condition: str
    category_id: int
    status: str
    views: int
    created_at: datetime
    updated_at: datetime
    images: List[ProductImageResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ProductListResponse(BaseModel):
    id: int
    seller_id: int
    title: str
    price: Decimal
    condition: str
    category_id: int
    status: str
    views: int
    created_at: datetime
    main_image: Optional[ProductImageResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ProductListPaginated(BaseModel):
    items: List[ProductListResponse]
    total: int
    page: int
    page_size: int
    total_pages: int