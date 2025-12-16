from celery import Celery
from src.shared.config import settings

celery_app = Celery(
    "audiobook_maker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Task routing - all tasks go to default queue
    task_routes={
        "worker.*": {"queue": "audiobook_tasks"},
    },
    # Default queue for workers
    task_default_queue="audiobook_tasks",
)
