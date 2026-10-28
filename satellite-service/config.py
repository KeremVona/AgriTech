"""Precision AgriTech - Satellite Service Configuration
Loads configuration from environment variables with sensible defaults.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    stac_url: str = "https://earth-search.aws.element84.com/v1"
    stac_collection: str = "sentinel-2-l2a"
    cache_dir: str = "cache"
    max_area_ha: float = 1000.0
    scene_cloud_max: float = 80.0
    min_valid_fraction: float = 0.5
    workers: int = 4
    window_days: int = 365
    grid_buffer_m: float = 20.0
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
