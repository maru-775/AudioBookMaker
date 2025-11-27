import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "AudioBookMaker API"
    DEBUG: bool = False
    OUTPUT_DIR: str = "audiobooks"
    MODEL_NAME: str = "tts_models/multilingual/multi-dataset/xtts_v2"
    DEVICE: str = "auto"  # auto, cuda, mps, cpu

    class Config:
        env_file = ".env"

settings = Settings()
