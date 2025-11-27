import os
import torch
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
import PyPDF2
import glob
import re
import subprocess
from TTS.api import TTS
from src.config import settings
from src.utils.logger import setup_logger
from src.core.text_processor import preprocess_text

logger = setup_logger(__name__)

class AudioBookConverter:
    def __init__(self):
        self.output_dir = settings.OUTPUT_DIR
        os.makedirs(self.output_dir, exist_ok=True)
        self.device = self._setup_device()
        self.tts_model = self._load_model()

    def _setup_device(self):
        if settings.DEVICE != "auto":
            return torch.device(settings.DEVICE)
        
        if torch.cuda.is_available():
            logger.info("GPU detected. Using CUDA.")
            return torch.device("cuda")
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            logger.info("Apple MPS detected. Using MPS.")
            return torch.device("mps")
        else:
            logger.info("No GPU detected. Using CPU.")
            return torch.device("cpu")

    def _load_model(self):
        logger.info("Attempting to load TTS model...")
        try:
            model = TTS(
                model_name=settings.MODEL_NAME,
                progress_bar=False
            ).to(self.device)
            logger.info("TTS model loaded successfully")
            return model
        except Exception as e:
            logger.error(f"Failed to load TTS model: {e}")
            raise

    def extract_text_from_epub(self, epub_path):
        try:
            book = epub.read_epub(epub_path)
            text_content = []
            for item in book.get_items():
                if item.get_type() == ebooklib.ITEM_DOCUMENT:
                    soup = BeautifulSoup(item.get_content(), 'html.parser')
                    text_content.append(soup.get_text())
                    text_content.append(soup.get_text())
            full_text = '\n\n'.join(text_content)
            logger.info(f"Extracted {len(full_text)} characters from EPUB.")
            return full_text
        except Exception as e:
            logger.error(f"Error extracting text from EPUB: {e}")
            raise

    def extract_text_from_pdf(self, pdf_path):
        try:
            with open(pdf_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                text_content = []
                for page in reader.pages:
                    text_content.append(page.extract_text())
                for page in reader.pages:
                    text_content.append(page.extract_text())
            full_text = '\n\n'.join(text_content)
            logger.info(f"Extracted {len(full_text)} characters from PDF.")
            return full_text
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            raise

    def generate_audio(self, text_blocks, book_title, speaker_wav="sample.wav", language="en", preview=False, progress_callback=None):
        output_filename = f"{book_title}_audiobook.mp3"
        output_path = os.path.join(self.output_dir, output_filename)
        
        # Check if speaker_wav exists, if not use a default or raise error
        if not os.path.exists(speaker_wav):
            # Try to find any wav file in the output dir to use as sample
            potential_samples = glob.glob(os.path.join(self.output_dir, "*.wav"))
            if potential_samples:
                speaker_wav = potential_samples[0]
                logger.warning(f"Speaker file not found. Using {speaker_wav} as fallback.")
            else:
                # If we are in a container, maybe there is a default asset?
                # For now, we will just log an error but try to proceed if the model allows (it won't for XTTS)
                raise FileNotFoundError(f"Speaker reference file '{speaker_wav}' not found. Please upload a voice sample.")

        if preview:
            logger.info("Preview mode enabled. Processing only the first block.")
            text_blocks = text_blocks[:1]

        total_blocks = len(text_blocks)
        if progress_callback:
            progress_callback(0, total_blocks)

        temp_audio_files = []
        try:
            for i, block in enumerate(text_blocks):
                temp_file = os.path.join(self.output_dir, f'temp_{book_title}_{i}.wav')
                logger.info(f"Generating audio for block {i+1}/{total_blocks}")
                
                self.tts_model.tts_to_file(
                    text=block,
                    file_path=temp_file,
                    speaker_wav=speaker_wav,
                    language=language
                )
                temp_audio_files.append(temp_file)
                
                if progress_callback:
                    progress_callback(i + 1, total_blocks)
            
            logger.info(f"Concatenating {len(temp_audio_files)} audio files")
            output_path = self._concatenate_audio_files(temp_audio_files, output_path)
            
            # Cleanup
            # for temp_file in temp_audio_files:
            #     os.remove(temp_file)
                
            return output_path
            
        except Exception as e:
            logger.error(f"Error during audio generation: {e}")
            raise

    def _concatenate_audio_files(self, input_files, output_file):
        # Check if ffmpeg is available
        ffmpeg_available = False
        try:
            subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            ffmpeg_available = True
        except FileNotFoundError:
            logger.warning("ffmpeg not found. Falling back to WAV concatenation.")

        if ffmpeg_available:
            list_file = os.path.join(self.output_dir, 'file_list.txt')
            with open(list_file, 'w') as f:
                for file in input_files:
                    f.write(f"file '{os.path.abspath(file)}'\n")
            try:
                command = [
                    "ffmpeg",
                    "-f", "concat",
                    "-safe", "0",
                    "-i", list_file,
                    "-c:a", "libmp3lame",
                    "-b:a", "128k",
                    "-y", # Overwrite output file
                    output_file
                ]
                subprocess.run(command, check=True)
            except subprocess.CalledProcessError as e:
                logger.error(f"Audio concatenation failed: {e}")
                raise
            finally:
                if os.path.exists(list_file):
                    os.remove(list_file)
        else:
            # Fallback: Concatenate WAVs using python wave module
            # Note: Output will be WAV, not MP3
            import wave
            
            # Change output extension to .wav if it was .mp3
            if output_file.endswith('.mp3'):
                output_file = output_file[:-4] + '.wav'
                
            data = []
            for infile in input_files:
                w = wave.open(infile, 'rb')
                data.append( [w.getparams(), w.readframes(w.getnframes())] )
                w.close()
            
            output = wave.open(output_file, 'wb')
            output.setparams(data[0][0])
            for i in range(len(data)):
                output.writeframes(data[i][1])
            output.close()
            logger.info(f"Concatenated audio saved to {output_file} (WAV format)")
            
            # Update the output path in the calling function if possible, 
            # but here we just ensure the file exists at the new path.
            # The calling function expects 'output_path' to be the file.
            # Since we changed the extension, we need to handle that.
            # But this method doesn't return anything. 
            # We should probably return the actual output path.
            return output_file
            
        return output_file

    def process_file(self, file_path, speaker_wav="sample.wav", language="en", preview=False, progress_callback=None):
        book_title = os.path.splitext(os.path.basename(file_path))[0]
        file_extension = os.path.splitext(file_path)[1].lower()

        if file_extension == '.epub':
            text = self.extract_text_from_epub(file_path)
        elif file_extension == '.pdf':
            text = self.extract_text_from_pdf(file_path)
        elif file_extension == '.txt':
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
        else:
            raise ValueError("Unsupported file format")

        text_blocks = preprocess_text(text)
        
        return self.generate_audio(text_blocks, book_title, speaker_wav, language, preview=preview, progress_callback=progress_callback)
