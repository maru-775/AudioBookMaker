import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "AudioBookMaker API"
    DEBUG: bool = False
    OUTPUT_DIR: str = "audiobooks"
    MODEL_NAME: str = "tts_models/multilingual/multi-dataset/xtts_v2"
    DEVICE: str = "auto"  # auto, cuda, mps, cpu
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    class Config:
        env_file = ".env"

settings = Settings()
