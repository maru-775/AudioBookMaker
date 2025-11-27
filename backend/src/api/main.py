from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException, Depends
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import shutil
import os
import uuid
from src.core.converter import AudioBookConverter
from src.utils.logger import setup_logger
from src.config import settings
from src.core.database import init_db, get_db, Job

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
converter = AudioBookConverter()

@app.on_event("startup")
def on_startup():
    init_db()

def process_audiobook(job_id: str, file_path: str, original_filename: str, speaker_wav: str = "sample.wav", preview: bool = False):
    db = next(get_db())
    job = db.query(Job).filter(Job.id == job_id).first()
    
    def progress_callback(completed, total):
        try:
            # Refresh job instance to avoid stale data
            db.refresh(job)
            job.completed_blocks = completed
            job.total_blocks = total
            db.commit()
        except Exception as e:
            logger.error(f"Error updating progress for job {job_id}: {e}")

    try:
        job.status = "processing"
        db.commit()
        
        output_path = converter.process_file(
            file_path, 
            speaker_wav=speaker_wav, 
            preview=preview,
            progress_callback=progress_callback
        )
        
        job.status = "completed"
        job.output_path = output_path
        job.filename = f"{os.path.splitext(original_filename)[0]}.mp3"
        db.commit()
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        job.status = "failed"
        job.error = str(e)
        db.commit()
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
        # Cleanup speaker file if it's a temp one (starts with speaker_)
        if speaker_wav.startswith("speaker_") and os.path.exists(speaker_wav):
            os.remove(speaker_wav)
        db.close()

@app.post("/api/convert")
async def convert_book(
    background_tasks: BackgroundTasks, 
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
        temp_input_path = f"temp_{job_id}_{filename}"
        with open(temp_input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    else:
        filename = "text_input.txt"
        temp_input_path = f"temp_{job_id}_{filename}"
        with open(temp_input_path, "w", encoding="utf-8") as f:
            f.write(text)

    # Handle speaker file
    speaker_wav = "sample.wav" # Default
    if speaker_file:
        speaker_path = f"speaker_{job_id}_{speaker_file.filename}"
        with open(speaker_path, "wb") as buffer:
            shutil.copyfileobj(speaker_file.file, buffer)
        speaker_wav = speaker_path

    new_job = Job(id=job_id, filename=filename, status="queued")
    db.add(new_job)
    db.commit()

    background_tasks.add_task(process_audiobook, job_id, temp_input_path, filename, speaker_wav, preview)

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
