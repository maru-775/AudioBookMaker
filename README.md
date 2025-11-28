# AudioBookMaker

AudioBookMaker is a modern, full-stack web application that converts eBooks (EPUB and PDF) into audiobooks using advanced AI text-to-speech technology powered by [Coqui TTS](https://github.com/coqui-ai/TTS). Built with a FastAPI backend, Next.js frontend, and asynchronous task processing, it provides a seamless experience for creating personalized audiobooks.

## Features

### Core Capabilities
- **Multi-Format Support**: Convert EPUB and PDF files to audiobooks
- **Multilingual TTS**: Support for multiple languages using Coqui XTTS v2
- **Voice Cloning**: Optional voice cloning using sample audio files for personalized narration
- **Asynchronous Processing**: Background job processing with Celery workers
- **Real-time Progress Tracking**: Monitor conversion progress in real-time
- **Resume Capability**: Automatically resume interrupted conversions
- **Modern UI**: Beautiful, responsive web interface built with Next.js and shadcn/ui

### Technical Features
- **Job Queue Management**: Redis-backed task queue for scalable processing
- **Job History**: Track all conversion jobs with detailed status information
- **Smart Text Processing**: Advanced sentence segmentation with NLTK
- **Hardware Acceleration**: Automatic GPU detection (CUDA, MPS) with CPU fallback
- **Docker Support**: Containerized deployment with Docker Compose
- **Blob Storage Ready**: Configurable for cloud storage (S3, etc.)

## Architecture

The application consists of four main components:
- **Frontend (Next.js)**: Runs on port 3000, provides the user interface
- **Backend (FastAPI)**: Runs on port 8000, handles API requests
- **Redis**: Runs on port 6379, serves as message broker and result backend
- **Celery Worker**: Background worker that processes TTS conversion jobs

### Tech Stack

**Backend:**
- **FastAPI** - High-performance async web framework
- **Celery** - Distributed task queue for background processing
- **Redis** - Message broker and result backend
- **SQLAlchemy** - ORM for job persistence
- **Coqui TTS** - Advanced neural TTS engine
- **PyTorch** - Deep learning framework for TTS models
- **NLTK** - Natural language processing for text segmentation

**Frontend:**
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type-safe development
- **shadcn/ui** - Premium UI component library
- **Tailwind CSS 4** - Utility-first CSS framework
- **Axios** - HTTP client for API requests
- **Lucide React** - Icon library

## Getting Started

### Prerequisites

- **Node.js** 20+ and npm/pnpm
- **Python** 3.9+
- **Redis** (or use Docker)
- **ffmpeg** ([installation guide](https://ffmpeg.org/download.html))
- **CUDA** (optional, for GPU acceleration)

### Installation

#### Option 1: Docker Compose (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/maru-775/AudioBookMaker.git
   cd AudioBookMaker
   ```

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:8000](http://localhost:8000)
   - API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

#### Option 2: Manual Setup

##### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set environment variables (optional):**
   ```bash
   export DEVICE=auto  # Options: auto, cuda, mps, cpu
   export COQUI_TOS_AGREED=1
   export CELERY_BROKER_URL=redis://localhost:6379/0
   export CELERY_RESULT_BACKEND=redis://localhost:6379/0
   ```

5. **Start the FastAPI server:**
   ```bash
   uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
   ```

6. **Start the Celery worker (in a new terminal):**
   ```bash
   celery -A src.core.worker.celery_app worker --loglevel=info
   ```

##### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set environment variables:**
   ```bash
   # Create .env.local file
   echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Access the application:**
   - Frontend: [http://localhost:3000](http://localhost:3000)

## Usage

### Web Interface

1. **Upload an eBook:**
   - Navigate to [http://localhost:3000](http://localhost:3000)
   - Select an EPUB or PDF file
   - Optionally upload a voice sample (WAV format recommended)

2. **Configure conversion:**
   - Select target language
   - Adjust speech speed if desired
   - Click "Create Audiobook"

3. **Monitor progress:**
   - View real-time progress in the job history panel
   - Download completed audiobooks directly from the interface

### API Usage

The backend provides a RESTful API for programmatic access:

```bash
# Create a conversion job
curl -X POST "http://localhost:8000/api/convert" \
  -F "file=@book.epub" \
  -F "language=en" \
  -F "speed=1.0"

# Check job status
curl "http://localhost:8000/api/jobs/{job_id}"

# List all jobs
curl "http://localhost:8000/api/jobs"

# Download audiobook
curl "http://localhost:8000/api/download/{job_id}" -O
```

Full API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs)

## Configuration

### Backend Configuration

Configuration is managed via environment variables or `.env` file in the backend directory:

```env
# Application Settings
APP_NAME=AudioBookMaker API
DEBUG=False
OUTPUT_DIR=audiobooks

# TTS Model Settings
MODEL_NAME=tts_models/multilingual/multi-dataset/xtts_v2
DEVICE=auto  # auto, cuda, mps, or cpu

# Celery Settings
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Database (if using PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost/audiobooks
```

### Frontend Configuration

Create `.env.local` in the frontend directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Hardware Acceleration

The application automatically detects available hardware:
- **CUDA** (NVIDIA GPUs): Set `DEVICE=cuda`
- **MPS** (Apple Silicon): Set `DEVICE=mps`
- **CPU**: Set `DEVICE=cpu`
- **Auto-detect**: Set `DEVICE=auto` (recommended)


### Docker Production Build

```bash
# Build optimized images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## Development

### Project Structure

```
AudioBookMaker/
├── backend/
│   ├── src/
│   │   ├── api/          # FastAPI routes and endpoints
│   │   ├── core/         # Core business logic
│   │   │   ├── converter.py      # E-book to audiobook conversion
│   │   │   ├── text_processor.py # Text extraction and processing
│   │   │   ├── celery_app.py     # Celery configuration
│   │   │   ├── worker.py          # Celery worker tasks
│   │   │   └── database.py        # Database models
│   │   ├── utils/        # Utility functions
│   │   └── config.py     # Configuration management
│   ├── audiobooks/       # Generated audiobook files
│   ├── requirements.txt  # Python dependencies
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js app router pages
│   │   ├── components/   # React components
│   │   │   └── ui/       # shadcn/ui components
│   │   └── lib/          # Utilities and API client
│   ├── public/           # Static assets
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml    # Docker orchestration
├── LICENSE
└── README.md
```

### Adding New Features

1. **Backend**: Add routes in `backend/src/api/main.py`
2. **Workers**: Add tasks in `backend/src/core/worker.py`
3. **Frontend**: Create components in `frontend/src/components/`


## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.


## Support

- **Issues**: [GitHub Issues](https://github.com/maru-775/AudioBookMaker/issues)
- **Discussions**: [GitHub Discussions](https://github.com/maru-775/AudioBookMaker/discussions)

---

**Made by maru-775**