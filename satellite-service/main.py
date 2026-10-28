import os

# GDAL environment defaults must be set before any rasterio import
os.environ.setdefault("AWS_NO_SIGN_REQUEST", "YES")
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "2")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings


def create_app(registry=None, today=None) -> FastAPI:
    """Create and configure the FastAPI application.

    Task 5 fills in the registry and full routes; for now it mounts health
    and CORS.
    """
    app = FastAPI(title="Precision AgriTech - Satellite NDVI Service")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health/live")
    def health_live():
        return {"status": "ok"}

    return app


app = create_app()
