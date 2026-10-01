from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional, List
from decimal import Decimal
import math

from app.database import get_db
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    ProductListPaginated,
    ProductImageResponse,
)
from app.api.deps import get_current_user_id, get_optional_user_id
from app.models.product import Product, ProductImage, ProductStatus, ProductCondition
from app.models.category import Category
from app.services.media import validate_image, generate_object_key, upload_image, presigned_get_url, delete_image

router = APIRouter(prefix="/products", tags=["products"])


def build_product_list_response(product: Product, db: Session) -> ProductListResponse:
    """Build ProductListResponse with main image."""
    main_image = db.query(ProductImage).filter(
        ProductImage.product_id == product.id
    ).order_by(ProductImage.position).first()

    main_image_resp = None
    if main_image:
        main_image_resp = ProductImageResponse(
            id=main_image.id,
            object_key=main_image.object_key,
            alt=main_image.alt,
            position=main_image.position,
            url=presigned_get_url(main_image.object_key),
        )

    return ProductListResponse(
        id=product.id,
        seller_id=product.seller_id,
        title=product.title,
        price=product.price,
        condition=product.condition.value,
        category_id=product.category_id,
        status=product.status.value,
        views=product.views,
        created_at=product.created_at,
        main_image=main_image_resp,
    )


def build_product_response(product: Product, db: Session) -> ProductResponse:
    """Build full ProductResponse with all images."""
    images = db.query(ProductImage).filter(
        ProductImage.product_id == product.id
    ).order_by(ProductImage.position).all()

    image_responses = [
        ProductImageResponse(
            id=img.id,
            object_key=img.object_key,
            alt=img.alt,
            position=img.position,
            url=presigned_get_url(img.object_key),
        )
        for img in images
    ]

    return ProductResponse(
        id=product.id,
        seller_id=product.seller_id,
        title=product.title,
        description=product.description,
        price=product.price,
        stock=product.stock,
        condition=product.condition.value,
        category_id=product.category_id,
        status=product.status.value,
        views=product.views,
        created_at=product.created_at,
        updated_at=product.updated_at,
        images=image_responses,
    )


@router.get("", response_model=ProductListPaginated)
def list_products(
    q: Optional[str] = Query(None, description="Search query in title/description"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    min_price: Optional[Decimal] = Query(None, ge=0, description="Minimum price"),
    max_price: Optional[Decimal] = Query(None, ge=0, description="Maximum price"),
    condition: Optional[str] = Query(None, pattern="^(new|used|refurbished)$"),
    status: Optional[str] = Query("active", pattern="^(active|sold|deleted)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort: str = Query("newest", pattern="^(newest|oldest|price_asc|price_desc|views)$"),
    db: Session = Depends(get_db),
):
    """List products with filters, search, pagination and sorting."""
    query = db.query(Product)

    # Apply filters
    if status:
        query = query.filter(Product.status == ProductStatus(status))

    if q:
        search_term = f"%{q}%"
        query = query.filter(
            or_(
                Product.title.ilike(search_term),
                Product.description.ilike(search_term),
            )
        )

    if category_id:
        # Include subcategories
        subcategories = db.query(Category.id).filter(
            Category.parent_id == category_id
        ).all()
        subcat_ids = [c.id for c in subcategories]
        all_cat_ids = [category_id] + subcat_ids
        query = query.filter(Product.category_id.in_(all_cat_ids))

    if min_price is not None:
        query = query.filter(Product.price >= min_price)

    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    if condition:
        query = query.filter(Product.condition == ProductCondition(condition))

    # Apply sorting
    if sort == "newest":
        query = query.order_by(Product.created_at.desc())
    elif sort == "oldest":
        query = query.order_by(Product.created_at.asc())
    elif sort == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Product.price.desc())
    elif sort == "views":
        query = query.order_by(Product.views.desc())

    # Pagination
    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size

    products = query.offset(offset).limit(page_size).all()

    items = [build_product_list_response(p, db) for p in products]

    return ProductListPaginated(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    data: ProductCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create a new product."""
    # Validate category exists
    category = db.query(Category).filter(Category.id == data.category_id).first()
    if not category:
        raise HTTPException(status_code=400, detail="Category not found")

    product = Product(
        seller_id=user_id,
        title=data.title,
        description=data.description,
        price=data.price,
        stock=data.stock,
        condition=ProductCondition(data.condition),
        category_id=data.category_id,
        status=ProductStatus.active,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return build_product_response(product, db)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    user_id: Optional[int] = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    """Get product detail. Increments view count."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Don't show deleted products unless owner or admin
    if product.status == ProductStatus.deleted:
        if not user_id or (user_id != product.seller_id):
            raise HTTPException(status_code=404, detail="Product not found")

    # Increment views (don't count owner's views)
    if not user_id or user_id != product.seller_id:
        product.views += 1
        db.commit()

    return build_product_response(product, db)


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    data: ProductUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Update product (owner only)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check ownership (admin does NOT get update rights, only delete)
    if product.seller_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this product")

    # Validate category if provided
    if data.category_id is not None:
        category = db.query(Category).filter(Category.id == data.category_id).first()
        if not category:
            raise HTTPException(status_code=400, detail="Category not found")

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ("condition", "status") and value is not None:
            # Convert string to enum
            if field == "condition":
                value = ProductCondition(value)
            elif field == "status":
                value = ProductStatus(value)
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return build_product_response(product, db)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Soft delete product (set status=deleted). Owner or admin only."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    from app.models.user import User
    current_user = db.query(User).filter(User.id == user_id).first()
    if product.seller_id != user_id and (not current_user or current_user.role != "admin"):
        raise HTTPException(status_code=403, detail="Not authorized to delete this product")

    product.status = ProductStatus.deleted
    db.commit()


@router.post("/{product_id}/images", response_model=ProductImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    alt: Optional[str] = Form(None),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Upload image for a product (owner only)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check ownership (admin does NOT get upload rights, only delete)
    if product.seller_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to upload images for this product")

    # Read file
    file_bytes = await file.read()

    # Validate
    is_valid, error = validate_image(file_bytes, file.filename or "")
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Generate object key and upload
    object_key = generate_object_key(file.filename or "image.jpg")
    content_type = file.content_type or "image/jpeg"
    await upload_image(file_bytes, object_key, content_type)

    # Save to DB
    max_pos = db.query(func.max(ProductImage.position)).filter(
        ProductImage.product_id == product_id
    ).scalar() or -1

    image = ProductImage(
        product_id=product_id,
        object_key=object_key,
        alt=alt,
        position=max_pos + 1,
    )
    db.add(image)
    db.commit()
    db.refresh(image)

    return ProductImageResponse(
        id=image.id,
        object_key=image.object_key,
        alt=image.alt,
        position=image.position,
        url=presigned_get_url(image.object_key),
    )


@router.delete("/{product_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_image(
    product_id: int,
    image_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete a product image (owner only)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Owner only (admin does NOT get image-delete rights, only product delete)
    if product.seller_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    image = db.query(ProductImage).filter(
        ProductImage.id == image_id,
        ProductImage.product_id == product_id
    ).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Delete from MinIO
    delete_image(image.object_key)

    # Delete from DB
    db.delete(image)
    db.commit()


@router.get("/my/listings", response_model=ProductListPaginated)
def my_listings(
    status: Optional[str] = Query(None, pattern="^(active|sold|deleted)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get current user's product listings."""
    query = db.query(Product).filter(Product.seller_id == user_id)

    if status:
        query = query.filter(Product.status == ProductStatus(status))

    query = query.order_by(Product.created_at.desc())

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size

    products = query.offset(offset).limit(page_size).all()
    items = [build_product_list_response(p, db) for p in products]

    return ProductListPaginated(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )