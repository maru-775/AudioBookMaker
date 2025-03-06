# AudioBookMaker

AudioBookMaker is a Python application that converts eBooks in EPUB or PDF format into audiobooks using the Coqui TTS (Text-to-Speech) engine. It supports multilingual text-to-speech conversion and allows for the resumption of interrupted processes.

## Features

- Convert EPUB and PDF files to audiobooks.
- Supports multilingual TTS using Coqui TTS.
- Option to use a sample voice file for personalized audio output.
- Resumes from where it left off if interrupted.
- Option to use existing temporary audio files to save time.
- Cleans up temporary files after completion.

## Requirements

- Python 3.7 or higher
- [PyTorch](https://pytorch.org/get-started/locally/)
- [nltk](https://www.nltk.org/)
- [ebooklib](https://github.com/aerkalov/ebooklib)
- [BeautifulSoup4](https://www.crummy.com/software/BeautifulSoup/)
- [PyPDF2](https://pypi.org/project/PyPDF2/)
- [Coqui TTS](https://github.com/coqui-ai/TTS)
- [ffmpeg](https://ffmpeg.org/)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/maru-775/AudioBookMaker.git
   cd AudioBookMaker
   ```

2. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

3. Ensure `ffmpeg` is installed on your system. You can download it from [ffmpeg.org](https://ffmpeg.org/download.html).

## Usage

1. Place your eBook file (EPUB or PDF) and an optional sample voice file (e.g., `sample.wav`) in the project directory.

2. Open `AudioBookMaker.py` and update the paths for the eBook and the sample voice file directly in the script.

3. Run the script:
   ```bash
   python AudioBookMaker.py
   ```

4. Follow the prompts to use existing temporary files or clean up after completion.

## Configuration

- You can change the output directory, language, and speed by modifying the `EbookToAudioConverter` class initialization in `AudioBookMaker.py`.

## Troubleshooting

- Ensure all dependencies are installed and correctly configured.
- Check that `ffmpeg` is in your system's PATH.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Coqui TTS](https://github.com/coqui-ai/TTS) for the text-to-speech engine.
- [nltk](https://www.nltk.org/) for natural language processing.
- [ebooklib](https://github.com/aerkalov/ebooklib) for EPUB handling.
- [BeautifulSoup4](https://www.crummy.com/software/BeautifulSoup/) for HTML parsing.
- [PyPDF2](https://pypi.org/project/PyPDF2/) for PDF text extraction. 