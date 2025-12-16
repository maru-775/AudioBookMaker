"""
Celery tasks module - defines all background tasks.
This module is ONLY loaded by the Celery worker process.
The API uses send_task() to trigger tasks by name.
"""
from src.shared.celery_app import celery_app
from src.shared.database import SessionLocal, Job
from src.shared.logger import setup_logger
from src.shared.config import settings
import os
import subprocess

logger = setup_logger(__name__)

# Initialize converter globally for the worker process
# This ensures the model is loaded once when the worker starts
converter = None


def get_converter():
    """Lazy-load the converter to avoid importing torch at module load time."""
    global converter
    if converter is None:
        from src.worker.converter import AudioBookConverter
        converter = AudioBookConverter()
    return converter


def convert_audio_to_wav(input_path: str, output_path: str) -> bool:
    """
    Convert audio file to WAV format using ffmpeg.
    Returns True if conversion successful, False otherwise.
    """
    try:
        command = [
            "ffmpeg",
            "-i", input_path,
            "-ar", "22050",  # Sample rate for TTS
            "-ac", "1",      # Mono
            "-y",            # Overwrite
            output_path
        ]
        subprocess.run(command, check=True, capture_output=True)
        logger.info(f"Converted {input_path} to WAV format")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to convert audio: {e}")
        return False
    except FileNotFoundError:
        logger.error("ffmpeg not found for audio conversion")
        return False


def cleanup_files(file_path: str, speaker_wav: str):
    """Clean up temporary files after job completion."""
    # Cleanup input file
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
            logger.info(f"Cleaned up input file: {file_path}")
        except Exception as e:
            logger.warning(f"Failed to remove input file {file_path}: {e}")
            
    # Cleanup speaker file if it's a temp one (in audiobooks dir)
    if speaker_wav and "speaker_" in speaker_wav and os.path.exists(speaker_wav):
        try:
            os.remove(speaker_wav)
            logger.info(f"Cleaned up speaker file: {speaker_wav}")
        except Exception as e:
            logger.warning(f"Failed to remove speaker file {speaker_wav}: {e}")
    
    # Also cleanup converted wav if it exists
    if speaker_wav and speaker_wav.endswith("_converted.wav") and os.path.exists(speaker_wav):
        try:
            os.remove(speaker_wav)
        except Exception as e:
            logger.warning(f"Failed to remove converted speaker file: {e}")


@celery_app.task(
    bind=True,
    name="worker.process_audiobook",
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 3, "countdown": 60},
    retry_backoff=True,
    retry_backoff_max=600,
    acks_late=True,  # Acknowledge after task completes for reliability
)
def process_audiobook_task(self, job_id: str, file_path: str, original_filename: str, speaker_wav: str = "sample.wav", preview: bool = False):
    """
    Process an audiobook conversion job.
    
    Args:
        job_id: Unique job identifier
        file_path: Path to the input file (PDF, EPUB, or TXT)
        original_filename: Original filename for the output
        speaker_wav: Path to speaker reference audio
        preview: If True, only process first block
    """
    conv = get_converter()
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    
    original_speaker_wav = speaker_wav  # Keep track for cleanup
    
    if not job:
        logger.error(f"Job {job_id} not found")
        return {"status": "error", "message": "Job not found"}

    try:
        logger.info(f"Starting job {job_id} (attempt {self.request.retries + 1})")
        job.status = "processing"
        db.commit()

        # Check if input file exists
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Input file not found: {file_path}")

        # Convert speaker audio to WAV if needed (webm, mp3, etc. are not supported)
        if speaker_wav and speaker_wav != "sample.wav":
            if not speaker_wav.endswith(".wav"):
                wav_path = speaker_wav.rsplit(".", 1)[0] + "_converted.wav"
                if convert_audio_to_wav(speaker_wav, wav_path):
                    speaker_wav = wav_path
                else:
                    raise ValueError(f"Failed to convert speaker audio to WAV format. Please upload a .wav file.")

        def progress_callback(completed, total):
            # Update progress in DB
            try:
                job.completed_blocks = completed
                job.total_blocks = total
                db.commit()
            except Exception as e:
                logger.warning(f"Failed to update progress for job {job_id}: {e}")

        output_path = conv.process_file(
            file_path, 
            speaker_wav=speaker_wav, 
            preview=preview, 
            progress_callback=progress_callback
        )
        
        job.status = "completed"
        job.output_path = output_path
        job.filename = f"{os.path.splitext(original_filename)[0]}.mp3"
        job.error = None  # Clear any previous error
        db.commit()
        logger.info(f"Job {job_id} completed successfully")
        
        # SUCCESS: Clean up files now
        cleanup_files(file_path, original_speaker_wav)
        if speaker_wav != original_speaker_wav:
            cleanup_files(None, speaker_wav)  # Also cleanup converted file
        
        return {"status": "completed", "job_id": job_id, "output_path": output_path}
        
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        
        # Check if we've exhausted retries
        if self.request.retries >= self.max_retries:
            job.status = "failed"
            job.error = str(e)
            db.commit()
            logger.error(f"Job {job_id} permanently failed after {self.request.retries + 1} attempts")
            
            # PERMANENT FAILURE: Clean up files now
            cleanup_files(file_path, original_speaker_wav)
            if speaker_wav != original_speaker_wav:
                cleanup_files(None, speaker_wav)
            
            return {"status": "failed", "job_id": job_id, "error": str(e)}
        
        # Mark as retrying - DO NOT delete files, we need them for retry
        job.status = "retrying"
        job.error = f"Attempt {self.request.retries + 1} failed: {str(e)}"
        db.commit()
        raise  # Let Celery handle the retry
        
    finally:
        db.close()
        
        # Unload model to free memory if configured
        if not settings.KEEP_MODEL_LOADED:
            try:
                conv.unload_model()
            except Exception as e:
                logger.error(f"Failed to unload model: {e}")
        else:
            logger.info("Keeping model loaded as per configuration.")
