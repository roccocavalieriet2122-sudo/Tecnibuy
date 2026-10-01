from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.schemas.category import CategoryResponse, CategoryCreate
from app.api.deps import get_current_user_id, get_optional_user_id
from app.models.category import Category
from app.models.user import User

router = APIRouter(prefix="/categories", tags=["categories"])


def build_category_tree(categories: List[Category], parent_id: Optional[int] = None) -> List[CategoryResponse]:
    """Build hierarchical category tree."""
    result = []
    for cat in categories:
        if cat.parent_id == parent_id:
            children = build_category_tree(categories, cat.id)
            cat_response = CategoryResponse(
                id=cat.id,
                name=cat.name,
                slug=cat.slug,
                parent_id=cat.parent_id,
                created_at=cat.created_at,
                updated_at=cat.updated_at,
                children=children,
            )
            result.append(cat_response)
    return result


@router.get("", response_model=List[CategoryResponse])
def list_categories(
    flat: bool = Query(False, description="Return flat list instead of tree"),
    db: Session = Depends(get_db),
):
    """Get all categories as tree (default) or flat list."""
    categories = db.query(Category).order_by(Category.name).all()

    if flat:
        return [CategoryResponse.model_validate(c) for c in categories]

    return build_category_tree(categories)


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create a new category (admin only)."""
    # Check if user is admin
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    # Check slug uniqueness
    existing = db.query(Category).filter(Category.slug == data.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Slug already exists")

    # Validate parent exists if provided
    if data.parent_id:
        parent = db.query(Category).filter(Category.id == data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Parent category not found")

    category = Category(**data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
):
    """Get a single category by ID."""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category