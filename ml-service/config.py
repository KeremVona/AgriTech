"""
Precision AgriTech - Application Settings
Loads configuration from environment variables with sensible defaults.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Service metadata
    app_name: str = "AgriTech ML & Vision Service"
    app_version: str = "0.2.0"
    debug: bool = False

    # plant-ml engine configuration (local execution with plant-ml venv)
    plantml_system: str = ""
    plantml_runs_dir: str = ""
    plantml_mode: str = "best"
    plantml_thresholds: str = ""
    plantml_device: str = ""  # empty = auto; "cpu" avoids GPU out-of-memory

    # Upload limits
    max_upload_bytes: int = 10 * 1024 * 1024  # 10 MB
    allowed_mime_types: list[str] = ["image/jpeg", "image/png", "image/webp"]

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
