import os
import torch
import nltk
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
import re
import logging
import subprocess
import PyPDF2
import glob

# Use Coqui TTS instead of TTS
from TTS.api import TTS

nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('averaged_perceptron_tagger')

class EbookToAudioConverter:
    def __init__(self, output_dir='audiobooks', language='en', speed=1.0):
        os.makedirs(output_dir, exist_ok=True)
        self.output_dir = output_dir
        
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        self.device = self._setup_device()
        self.logger.info(f"Using device: {self.device}")
        
        self.logger.info("Attempting to load TTS model...")
        try:
            # Update model loading to use Coqui TTS
            self.tts_model = TTS(
                model_name="tts_models/multilingual/multi-dataset/xtts_v2",
                progress_bar=False
            ).to(self.device)
            self.logger.info("TTS model loaded successfully")
        except Exception as e:
            self.logger.error(f"Failed to load TTS model: {e}")
            raise
        
        self.language = language
        self.speed = speed
    
    def _setup_device(self):
        if torch.cuda.is_available():
            self.logger.info("GPU detected. Using CUDA.")
            return torch.device("cuda")
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            self.logger.info("Apple MPS detected. Using MPS.")
            return torch.device("mps")
        else:
            self.logger.info("No GPU detected. Using CPU.")
            return torch.device("cpu")
    
    def extract_text_from_epub(self, epub_path):
        try:
            book = epub.read_epub(epub_path)
            text_content = []
            for item in book.get_items():
                if item.get_type() == ebooklib.ITEM_DOCUMENT:
                    soup = BeautifulSoup(item.get_content(), 'html.parser')
                    text_content.append(soup.get_text())
            return '\n\n'.join(text_content)
        except Exception as e:
            self.logger.error(f"Error extracting text from EPUB: {e}")
            return ""
    
    def extract_text_from_pdf(self, pdf_path):
        try:
            with open(pdf_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                text_content = []
                for page in reader.pages:
                    text_content.append(page.extract_text())
            return '\n\n'.join(text_content)
        except Exception as e:
            self.logger.error(f"Error extracting text from PDF: {e}")
            return ""
    
    def preprocess_text(self, text):
        text = re.sub(r'\s+', ' ', text).strip()
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        processed_blocks = []
        for paragraph in paragraphs:
            sentences = nltk.sent_tokenize(paragraph)
            for sentence in sentences:
                if len(sentence) > 250:
                    # Split long sentences into smaller chunks
                    clause_chunks = re.split(r'(?<=[,;:])\s', sentence)
                    processed_blocks.extend(clause_chunks)
                else:
                    processed_blocks.append(sentence)
        return processed_blocks
    
    def check_existing_temp_files(self, book_title):
        """Check for existing temporary audio files from previous executions"""
        temp_pattern = os.path.join(self.output_dir, "temp_audio_*.wav")
        existing_temp_files = sorted(glob.glob(temp_pattern), 
                                     key=lambda x: int(re.search(r'temp_audio_(\d+)\.wav', x).group(1)))
        
        if existing_temp_files:
            self.logger.info(f"Found {len(existing_temp_files)} existing temporary audio files")
            return existing_temp_files
        return []
    
    def generate_audio(self, text_blocks, book_title):
        output_filename = f"{book_title}_audiobook.mp3"
        output_path = os.path.join(self.output_dir, output_filename)
        
        # Check for existing temporary files
        existing_temp_files = self.check_existing_temp_files(book_title)
        
        if existing_temp_files:
            user_input = input(f"Found {len(existing_temp_files)} existing temporary audio files. "
                             f"Use them (y/n)? ")
            if user_input.lower() == 'y':
                self.logger.info("Using existing temporary audio files")
                self._concatenate_audio_files(existing_temp_files, output_path)
                
                # Ask if cleanup is desired
                cleanup = input("Do you want to delete the temporary files after completion? (y/n): ")
                if cleanup.lower() == 'y':
                    for temp_file in existing_temp_files:
                        os.remove(temp_file)
                    self.logger.info("Temporary files removed")
                
                self.logger.info(f"Audiobook generated: {output_path}")
                return
        
        # No existing files or user chose not to use them
        temp_audio_files = []
        try:
            # Find the starting index to resume from
            start_idx = 0
            if existing_temp_files:
                highest_idx = max([int(re.search(r'temp_audio_(\d+)\.wav', file).group(1)) 
                                  for file in existing_temp_files])
                start_idx = highest_idx + 1
            
            for i, block in enumerate(text_blocks[start_idx:], start=start_idx):
                try:
                    temp_file = os.path.join(self.output_dir, f'temp_audio_{i}.wav')
                    self.logger.info(f"Generating audio for block {i}/{len(text_blocks)}")
                    
                    # Ensure you have a reference voice sample 'sample.wav' in the same directory
                    self.tts_model.tts_to_file(
                        text=block,
                        file_path=temp_file,
                        speaker_wav="sample.wav",  # Make sure this file exists
                        language=self.language
                    )
                    temp_audio_files.append(temp_file)
                except Exception as e:
                    self.logger.error(f"Error generating audio for block {i}: {e}")
                    # Continue with the next block instead of stopping entirely
            
            # Combine all audio files (existing + newly generated)
            all_temp_files = sorted(glob.glob(os.path.join(self.output_dir, "temp_audio_*.wav")), 
                                    key=lambda x: int(re.search(r'temp_audio_(\d+)\.wav', x).group(1)))
            
            self.logger.info(f"Concatenating {len(all_temp_files)} audio files")
            self._concatenate_audio_files(all_temp_files, output_path)
            
            # Ask if cleanup is desired
            cleanup = input("Do you want to delete the temporary files after completion? (y/n): ")
            if cleanup.lower() == 'y':
                for temp_file in all_temp_files:
                    os.remove(temp_file)
                self.logger.info("Temporary files removed")
            
        except KeyboardInterrupt:
            self.logger.info("Process interrupted. Temporary files are saved and can be used in the next run.")
            return
        except Exception as e:
            self.logger.error(f"Error during audio generation: {e}")
            self.logger.info("Temporary files are saved and can be used in the next run.")
            return
        
        self.logger.info(f"Audiobook generated: {output_path}")
    
    def _concatenate_audio_files(self, input_files, output_file):
        with open('file_list.txt', 'w') as f:
            for file in input_files:
                # Ensure the path is correctly formatted
                f.write(f"file '{os.path.abspath(file)}'\n")
        try:
            command = [
                "ffmpeg",
                "-f", "concat",
                "-safe", "0",
                "-i", 'file_list.txt',
                "-c:a", "libmp3lame",
                "-b:a", "128k",
                output_file
            ]
            subprocess.run(command, check=True)
        except subprocess.CalledProcessError as e:
            self.logger.error(f"Audio concatenation failed: {e}")
        finally:
            os.remove('file_list.txt')
    
    def convert_ebook_to_audiobook(self, file_path):
        book_title = os.path.splitext(os.path.basename(file_path))[0]
        file_extension = os.path.splitext(file_path)[1].lower()

        if file_extension == '.epub':
            text = self.extract_text_from_epub(file_path)
        elif file_extension == '.pdf':
            text = self.extract_text_from_pdf(file_path)
        else:
            self.logger.error("Unsupported file format. Please provide a .epub or .pdf file.")
            return

        text_blocks = self.preprocess_text(text)
        self.generate_audio(text_blocks, book_title)


if __name__ == "__main__":
    converter = EbookToAudioConverter()
    converter.convert_ebook_to_audiobook('ebook.pdf')  # Replace with your .epub file