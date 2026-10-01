from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.sql import func
from app.database import Base


class Rating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("product_id", "user_id", name="uq_product_user_rating"),
        Index("idx_ratings_product", "product_id"),
        Index("idx_ratings_user", "user_id"),
    )