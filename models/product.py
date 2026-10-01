import enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    DECIMAL,
    Enum as SQLEnum,
    Index,
)
from sqlalchemy.sql import func
from app.database import Base


class ProductStatus(str, enum.Enum):
    active = "active"
    sold = "sold"
    deleted = "deleted"


class ProductCondition(str, enum.Enum):
    new = "new"
    used = "used"
    refurbished = "refurbished"


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False)
    stock = Column(Integer, default=1, nullable=False)
    condition = Column(SQLEnum(ProductCondition), default=ProductCondition.used)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    status = Column(SQLEnum(ProductStatus), default=ProductStatus.active)
    views = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_products_seller", "seller_id"),
        Index("idx_products_category", "category_id"),
        Index("idx_products_status", "status"),
        Index("idx_products_created", "created_at"),
    )


class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    object_key = Column(String(255), nullable=False)
    alt = Column(String(200), nullable=True)
    position = Column(Integer, default=0)

    __table_args__ = (Index("idx_product_images_product", "product_id"),)