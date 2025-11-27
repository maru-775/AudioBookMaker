import re
import nltk

# Ensure nltk data is downloaded
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')
    nltk.download('punkt_tab')
    nltk.download('averaged_perceptron_tagger')

import logging

logger = logging.getLogger(__name__)

def preprocess_text(text: str) -> list[str]:
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
    
    logger.info(f"Preprocessed text into {len(processed_blocks)} blocks.")
    return processed_blocks
