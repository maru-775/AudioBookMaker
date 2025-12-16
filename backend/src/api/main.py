"""
FastAPI main application.
This module contains HTTP endpoints ONLY.
NO imports from worker module - uses celery_app.send_task() instead.
"""
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import shutil
import os
import uuid

# Import from shared module ONLY - never from worker
from src.shared.logger import setup_logger
from src.shared.config import settings
from src.shared.database import init_db, get_db, Job
from src.shared.celery_app import celery_app

app = FastAPI(title=settings.APP_NAME)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = setup_logger(__name__)


@app.on_event("startup")
def on_startup():
    init_db()


# Import RSS router
from src.api import rss
app.include_router(rss.router)


@app.post("/api/convert")
async def convert_book(
    file: UploadFile = File(None), 
    text: str = Form(None),
    preview: bool = Form(False),
    speaker_file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    if not file and not text:
        raise HTTPException(status_code=400, detail="Either file or text must be provided")

    job_id = str(uuid.uuid4())
    
    if file:
        if not file.filename.lower().endswith(('.pdf', '.epub')):
            raise HTTPException(status_code=400, detail="Only PDF and EPUB files are supported")
        filename = file.filename
        # Save to shared volume
        temp_input_path = os.path.join(settings.OUTPUT_DIR, f"temp_{job_id}_{filename}")
        with open(temp_input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    else:
        filename = "text_input.txt"
        # Save to shared volume
        temp_input_path = os.path.join(settings.OUTPUT_DIR, f"temp_{job_id}_{filename}")
        with open(temp_input_path, "w", encoding="utf-8") as f:
            f.write(text)

    # Handle speaker file
    speaker_wav = "sample.wav"  # Default
    if speaker_file:
        # Save to shared volume
        speaker_path = os.path.join(settings.OUTPUT_DIR, f"speaker_{job_id}_{speaker_file.filename}")
        with open(speaker_path, "wb") as buffer:
            shutil.copyfileobj(speaker_file.file, buffer)
        speaker_wav = speaker_path

    new_job = Job(id=job_id, filename=filename, status="queued")
    db.add(new_job)
    db.commit()

    # ============================================================
    # KEY CHANGE: Use send_task() instead of importing worker.py
    # This prevents loading torch/TTS in the API process
    # ============================================================
    celery_app.send_task(
        "worker.process_audiobook",  # Task name defined in worker/tasks.py
        args=[job_id, temp_input_path, filename, speaker_wav, preview]
    )

    return {"job_id": job_id, "status": "queued"}


@app.get("/api/status/{job_id}")
async def get_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job.id, 
        "status": job.status, 
        "error": job.error,
        "total_blocks": job.total_blocks,
        "completed_blocks": job.completed_blocks
    }


@app.get("/api/stats")
async def get_system_stats(db: Session = Depends(get_db)):
    processing = db.query(Job).filter(Job.status == "processing").count()
    queued = db.query(Job).filter(Job.status == "queued").count()
    completed = db.query(Job).filter(Job.status == "completed").count()
    return {
        "processing": processing,
        "queued": queued,
        "completed": completed
    }


@app.get("/api/jobs")
async def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(Job).order_by(Job.created_at.desc()).all()
    return jobs


@app.get("/api/download/{job_id}")
async def download_audiobook(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Job not completed")
    
    if not os.path.exists(job.output_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(
        job.output_path, 
        media_type="audio/mpeg", 
        filename=job.filename
    )


@app.get("/api/health")
async def health_check():
    """Health check endpoint for Docker/Kubernetes."""
    return {"status": "healthy"}
