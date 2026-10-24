"""
Precision AgriTech - Application Settings
Loads configuration from environment variables with sensible defaults.
"""

from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Service metadata
    app_name: str = "AgriTech ML & Vision Service"
    app_version: str = "0.2.0"
    debug: bool = False

    # ONNX Model configuration
    # Populated by TODO-103 (ONNX export). Service starts in stub mode when absent.
    onnx_model_path: str = "models/agritech_classifier.onnx"

    # Inference backend: "onnx" (default) or "plantml" (optional, local; needs torch + plantml)
    model_backend: str = "onnx"
    plantml_system: str = ""
    plantml_runs_dir: str = ""
    plantml_mode: str = "best"
    plantml_thresholds: str = ""

    # Image preprocessing parameters (must match training pipeline: TODO-102)
    image_input_size: int = 224
    imagenet_mean: list[float] = [0.485, 0.456, 0.406]
    imagenet_std: list[float] = [0.229, 0.224, 0.225]

    # Upload limits
    max_upload_bytes: int = 10 * 1024 * 1024  # 10 MB
    allowed_mime_types: list[str] = ["image/jpeg", "image/png", "image/webp"]

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
