from src.core.celery_app import celery_app
from src.core.converter import AudioBookConverter
from src.core.database import SessionLocal, Job
from src.utils.logger import setup_logger
import os

logger = setup_logger(__name__)

# Initialize converter globally for the worker process
# This ensures the model is loaded once when the worker starts
converter = None

@celery_app.task(bind=True)
def process_audiobook_task(self, job_id: str, file_path: str, original_filename: str, speaker_wav: str = "sample.wav", preview: bool = False):
    global converter
    if converter is None:
        converter = AudioBookConverter()

    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    
    if not job:
        logger.error(f"Job {job_id} not found")
        return

    try:
        logger.info(f"Starting job {job_id}")
        job.status = "processing"
        db.commit()

        def progress_callback(completed, total):
            # Update progress in DB
            # Note: We might want to throttle this update to avoid hitting DB too hard
            try:
                # Re-query to avoid stale state if needed, or just update
                # For SQLite, frequent writes might be locked, so be careful
                # Here we just update the object and commit
                job.completed_blocks = completed
                job.total_blocks = total
                db.commit()
            except Exception as e:
                logger.warning(f"Failed to update progress for job {job_id}: {e}")

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
        logger.info(f"Job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        job.status = "failed"
        job.error = str(e)
        db.commit()
    finally:
        # Cleanup input file
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to remove input file {file_path}: {e}")
                
        # Cleanup speaker file if it's a temp one
        if speaker_wav.startswith("speaker_") and os.path.exists(speaker_wav):
            try:
                os.remove(speaker_wav)
            except Exception as e:
                logger.warning(f"Failed to remove speaker file {speaker_wav}: {e}")
                
        db.close()
