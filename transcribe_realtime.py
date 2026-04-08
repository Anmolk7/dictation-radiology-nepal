#!/usr/bin/env python3
"""
Real-time transcription script using faster-whisper
Streams results as they're transcribed
"""

import sys
import json
from faster_whisper import WhisperModel

def transcribe_realtime(audio_file, language="en"):
    """Transcribe audio file with real-time output"""
    try:
        # Load the tiny model (very fast, good accuracy for simple speech)
        model = WhisperModel("tiny", device="cpu", compute_type="int8")

        segments, info = model.transcribe(
            audio_file,
            language=language,
            beam_size=5,
            condition_on_previous_text=True
        )

        full_transcript = ""
        for segment in segments:
            full_transcript += segment.text + " "
            # Stream each segment as it's available
            result = {
                "type": "segment",
                "text": segment.text,
                "start": segment.start,
                "end": segment.end,
                "full_transcript": full_transcript.strip()
            }
            print(json.dumps(result))
            sys.stdout.flush()

        # Send final result
        final_result = {
            "type": "complete",
            "text": full_transcript.strip(),
            "language": info.language
        }
        print(json.dumps(final_result))
        sys.stdout.flush()

    except Exception as e:
        error_result = {
            "type": "error",
            "error": str(e)
        }
        print(json.dumps(error_result))
        sys.stdout.flush()
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"type": "error", "error": "Audio file path required"}))
        sys.exit(1)

    audio_file = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "en"

    transcribe_realtime(audio_file, language)
