from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.database import Base, engine
from app.api.routes import auth, users, products, categories, ratings, chat, media
from app.services.media import ensure_bucket, _media_dir

settings = get_settings()

# Carpeta del frontend: backend/app/main.py -> app/ -> backend/ -> raíz del proyecto -> frontend/
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"

# La carpeta de imágenes tiene que existir ANTES de montarla como estático
_media_dir().mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    await ensure_bucket()
    yield
    # Shutdown (if needed)


# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="TecniBuy API",
    description="Marketplace API - Rioplatense Spanish",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

# Routers
# OJO: cada router (auth.router, products.router, etc.) ya trae su propio
# prefix definido en su archivo (p. ej. "/auth", "/products"). Antes acá se
# pasaba prefix="/api/auth", "/api/products", etc., y eso se SUMABA al
# prefix propio del router -> las rutas quedaban registradas como
# "/api/auth/auth/login", "/api/products/products", etc. El frontend nunca
# iba a poder pegarle a ninguna de esas URLs. Va solo "/api" acá.
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(products.router, prefix="/api", tags=["products"])
app.include_router(categories.router, prefix="/api", tags=["categories"])
app.include_router(ratings.router, prefix="/api", tags=["ratings"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(media.router, prefix="/api", tags=["media"])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api")
def api_root():
    return {
        "name": "TecniBuy API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


# Imágenes subidas por los usuarios (reemplaza el bucket de MinIO)
app.mount(settings.media_url_prefix, StaticFiles(directory=str(_media_dir())), name="media-files")

# Frontend estático: /assets/styles.css y /js/*.js (módulos ES, incluye /js/pages/)
app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="frontend-assets")
app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="frontend-js")


@app.get("/")
def serve_index():
    return FileResponse(str(FRONTEND_DIR / "index.html"))
