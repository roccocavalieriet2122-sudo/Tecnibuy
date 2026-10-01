from pydantic import BaseModel, ConfigDict


class MediaUploadResponse(BaseModel):
    object_key: str
    url: str

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "object_key": "a1b2c3d4e5f6.jpg",
            "url": "http://localhost:9000/tecnibuy-images/a1b2c3d4e5f6.jpg?X-Amz-Algorithm=..."
        }
    })