import uuid
from pathlib import Path
from typing import Optional, Tuple

from app.config import get_settings

settings = get_settings()

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def _media_dir() -> Path:
    """Resuelve la carpeta de almacenamiento de imágenes.

    Si MEDIA_ROOT es relativo (por defecto "media"), se resuelve relativo a
    la carpeta backend/ (dos niveles arriba de este archivo: services/ -> app/ -> backend/).
    """
    path = Path(settings.media_root)
    if not path.is_absolute():
        path = Path(__file__).resolve().parent.parent.parent / settings.media_root
    return path


async def ensure_bucket() -> None:
    """Crea la carpeta de imágenes si no existe.

    Se mantiene el nombre `ensure_bucket` (aunque ya no hay bucket de MinIO)
    para no tener que tocar app/services/__init__.py ni el import en main.py.
    """
    _media_dir().mkdir(parents=True, exist_ok=True)


def validate_image(file_bytes: bytes, filename: str) -> Tuple[bool, Optional[str]]:
    """Valida el archivo por magic bytes y tamaño. Devuelve (es_valido, error)."""
    if len(file_bytes) > MAX_FILE_SIZE:
        return False, f"File size exceeds maximum of {MAX_FILE_SIZE // (1024*1024)} MB"

    if len(file_bytes) < 12:
        return False, "File too small to determine type"

    if file_bytes[0:3] == b"\xFF\xD8\xFF":
        mime = "image/jpeg"
    elif file_bytes[0:8] == b"\x89PNG\r\n\x1a\n":
        mime = "image/png"
    elif file_bytes[0:4] == b"RIFF" and file_bytes[8:12] == b"WEBP":
        mime = "image/webp"
    else:
        return False, "Unsupported image format. Only JPEG, PNG, WebP allowed."

    if mime not in ALLOWED_MIME_TYPES:
        return False, "Unsupported image format."

    return True, None


def generate_object_key(original_filename: str) -> str:
    """Genera un nombre de archivo aleatorio con la extensión correspondiente."""
    ext = ""
    if "." in original_filename:
        ext = original_filename.rsplit(".", 1)[1].lower()
        if ext not in ("jpg", "jpeg", "png", "webp"):
            ext = ""
    if not ext:
        ext = "jpg"
    return f"{uuid.uuid4().hex}.{ext}"


async def upload_image(file_bytes: bytes, object_key: str, content_type: str) -> str:
    """Guarda la imagen en disco local. Devuelve el object_key (igual que antes)."""
    await ensure_bucket()
    file_path = _media_dir() / object_key
    file_path.write_bytes(file_bytes)
    return object_key


def presigned_get_url(object_key: str, expires: int = 3600) -> str:
    """URL pública de la imagen. Ya no hace falta firmar nada: la sirve FastAPI como estático."""
    return f"{settings.media_url_prefix}/{object_key}"


def delete_image(object_key: str) -> bool:
    """Borra la imagen del disco local."""
    try:
        (_media_dir() / object_key).unlink(missing_ok=True)
        return True
    except OSError:
        return False
