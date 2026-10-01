from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from decimal import Decimal

from app.database import get_db
from app.schemas.rating import (
    RatingCreate,
    RatingUpdate,
    RatingResponse,
    RatingSummary,
)
from app.api.deps import get_current_user_id
from app.models.rating import Rating
from app.models.product import Product, ProductStatus
from app.models.user import User

router = APIRouter(prefix="/products", tags=["ratings"])


@router.get("/{product_id}/ratings", response_model=List[RatingResponse])
def list_product_ratings(
    product_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get ratings for a product with pagination."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    offset = (page - 1) * page_size

    ratings = db.query(Rating, User.username).join(
        User, Rating.user_id == User.id
    ).filter(
        Rating.product_id == product_id
    ).order_by(
        Rating.created_at.desc()
    ).offset(offset).limit(page_size).all()

    return [
        RatingResponse(
            id=r.id,
            product_id=r.product_id,
            user_id=r.user_id,
            username=username,
            rating=r.rating,
            comment=r.comment,
            created_at=r.created_at,
        )
        for r, username in ratings
    ]


@router.get("/{product_id}/ratings/summary", response_model=RatingSummary)
def get_product_ratings_summary(
    product_id: int,
    db: Session = Depends(get_db),
):
    """Get rating summary (average, count, distribution) for a product."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Get average and count
    result = db.query(
        func.avg(Rating.rating).label("avg_rating"),
        func.count(Rating.id).label("count")
    ).filter(Rating.product_id == product_id).first()

    avg_rating = float(result.avg_rating) if result.avg_rating else 0.0
    count = result.count or 0

    # Get distribution
    distribution_rows = db.query(
        Rating.rating,
        func.count(Rating.id).label("count")
    ).filter(
        Rating.product_id == product_id
    ).group_by(Rating.rating).all()

    distribution = {i: 0 for i in range(1, 6)}
    for rating_val, cnt in distribution_rows:
        distribution[rating_val] = cnt

    return RatingSummary(
        average=round(avg_rating, 1),
        count=count,
        distribution=distribution,
    )


@router.post("/{product_id}/ratings", response_model=RatingResponse, status_code=status.HTTP_201_CREATED)
def create_rating(
    product_id: int,
    data: RatingCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create a rating for a product (one per user per product)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Can't rate own product
    if product.seller_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot rate your own product")

    # Check if already rated
    existing = db.query(Rating).filter(
        Rating.product_id == product_id,
        Rating.user_id == user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already rated this product")

    rating = Rating(
        product_id=product_id,
        user_id=user_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(rating)
    db.commit()
    db.refresh(rating)

    user = db.query(User).filter(User.id == user_id).first()
    return RatingResponse(
        id=rating.id,
        product_id=rating.product_id,
        user_id=rating.user_id,
        username=user.username,
        rating=rating.rating,
        comment=rating.comment,
        created_at=rating.created_at,
    )


@router.put("/ratings/{rating_id}", response_model=RatingResponse)
def update_rating(
    rating_id: int,
    data: RatingUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Update own rating."""
    rating = db.query(Rating).filter(Rating.id == rating_id).first()
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")

    if rating.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this rating")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rating, field, value)

    db.commit()
    db.refresh(rating)

    user = db.query(User).filter(User.id == user_id).first()
    return RatingResponse(
        id=rating.id,
        product_id=rating.product_id,
        user_id=rating.user_id,
        username=user.username,
        rating=rating.rating,
        comment=rating.comment,
        created_at=rating.created_at,
    )


@router.delete("/ratings/{rating_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rating(
    rating_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete rating (owner or admin)."""
    rating = db.query(Rating).filter(Rating.id == rating_id).first()
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")

    # Check if admin
    current_user = db.query(User).filter(User.id == user_id).first()
    if rating.user_id != user_id and (not current_user or current_user.role != "admin"):
        raise HTTPException(status_code=403, detail="Not authorized to delete this rating")

    db.delete(rating)
    db.commit()