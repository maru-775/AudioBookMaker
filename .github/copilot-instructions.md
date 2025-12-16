# AudioBookMaker - Copilot Instructions

## Architecture Overview

This is a **full-stack eBook-to-audiobook converter** using a microservices architecture:

```
Frontend (Next.js :3000) → Backend API (FastAPI :8000) → Redis (:6379) → Celery Worker
                                                                              ↓
                                                                    Coqui TTS (XTTS v2)
```

- **Frontend**: Next.js 16 + React 19 with shadcn/ui components, communicates via REST API
- **Backend**: FastAPI handles file uploads, job management; delegates TTS to async workers
- **Celery Worker**: Long-running TTS jobs processed via Redis queue (`src/core/worker.py`)
- **Database**: SQLite (`audiobooks/jobs.db`) for job persistence via SQLAlchemy

## Key Files & Patterns

| Component | Key File | Purpose |
|-----------|----------|---------|
| API routes | `backend/src/api/main.py` | All REST endpoints (`/api/convert`, `/api/jobs`, `/api/status/{id}`) |
| TTS engine | `backend/src/core/converter.py` | `AudioBookConverter` class - model loading, text extraction, audio generation |
| Async tasks | `backend/src/core/worker.py` | Celery task `process_audiobook_task` - handles job lifecycle |
| Config | `backend/src/config.py` | Pydantic settings from env vars (DEVICE, CELERY_*, MODEL_NAME) |
| Main UI | `frontend/src/app/page.tsx` | Single-page app with file upload, progress tracking, job history |

## Development Workflow

### Running Locally (Docker - Recommended)
```bash
docker-compose up -d
# Frontend: http://localhost:3000 | API: http://localhost:8000/docs
```

### Running Without Docker
```bash
# Terminal 1: Backend API
cd backend && uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Celery Worker (requires Redis running)
cd backend && celery -A src.core.worker.celery_app worker --loglevel=info

# Terminal 3: Frontend
cd frontend && npm run dev
```

## Project Conventions

### Backend (Python)
- Use `setup_logger(__name__)` from `src/utils/logger` for consistent logging
- Config via Pydantic `Settings` class - access as `settings.PROPERTY`
- Database operations use `get_db()` dependency injection pattern
- Job statuses: `queued` → `processing` → `completed` | `failed`

### Frontend (TypeScript)
- All UI components from shadcn/ui live in `src/components/ui/`
- API client functions expected in `@/lib/api` (uploadFile, getStatus, getJobs, getDownloadUrl)
- Path alias `@/*` maps to `./src/*`

### Data Flow for Conversion
1. `POST /api/convert` → saves file to `audiobooks/temp_{job_id}_{filename}`
2. Creates `Job` record in SQLite, triggers `process_audiobook_task.delay()`
3. Worker loads TTS model (cached globally), processes text blocks with progress callbacks
4. Updates job status in DB, outputs to `audiobooks/{title}_audiobook.mp3`

## Critical Implementation Details

- **TTS Model**: Coqui XTTS v2 requires a `speaker_wav` reference file (voice cloning)
- **Text Processing**: Uses NLTK sentence tokenization, splits long sentences at punctuation (`text_processor.py`)
- **Audio Concatenation**: Prefers ffmpeg for MP3 output, falls back to Python `wave` module (WAV)
- **Device Detection**: Auto-detects CUDA > MPS > CPU via PyTorch in `converter._setup_device()`
- **Progress Tracking**: Celery task updates `Job.completed_blocks` / `Job.total_blocks` per text block

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEVICE` | `auto` | TTS device: `auto`, `cuda`, `mps`, `cpu` |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0` | Redis connection for Celery |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL for frontend |
| `COQUI_TOS_AGREED` | - | Set to `1` to accept Coqui TOS |
