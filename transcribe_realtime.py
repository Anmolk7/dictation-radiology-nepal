#!/usr/bin/env python3
"""Transcribe a completed medical dictation locally with Google MedASR."""

import sys
import json
import os
import subprocess
import tempfile
import base64

import torch
from transformers import pipeline


MODEL_ID = "google/medasr"
_transcriber = None


def get_transcriber():
    """Load MedASR once per worker process, using CUDA when available."""
    global _transcriber
    if _transcriber is None:
        device = 0 if torch.cuda.is_available() else -1
        _transcriber = pipeline(
            "automatic-speech-recognition",
            model=MODEL_ID,
            token=os.environ.get("HF_TOKEN") or None,
            device=device,
        )
    return _transcriber


def to_medasr_audio(audio_file):
    """Convert browser WebM/Opus audio to MedASR's 16 kHz mono WAV input."""
    output_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    output_file.close()
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                audio_file,
                "-ac",
                "1",
                "-ar",
                "16000",
                "-sample_fmt",
                "s16",
                output_file.name,
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as error:
        os.unlink(output_file.name)
        raise RuntimeError(
            "ffmpeg is required to convert recordings for MedASR. "
            "Install it with: brew install ffmpeg"
        ) from error
    except subprocess.CalledProcessError as error:
        os.unlink(output_file.name)
        raise RuntimeError(
            f"Could not convert the recording for MedASR: {error.stderr.strip()}"
        ) from error
    return output_file.name


def transcribe(audio_file):
    """Return a MedASR transcription for one audio file."""
    converted_audio = None
    try:
        converted_audio = to_medasr_audio(audio_file)
        result = get_transcriber()(
            converted_audio,
            chunk_length_s=20,
            stride_length_s=2,
        )
        return result["text"].replace("</s>", "").strip()
    finally:
        if converted_audio and os.path.exists(converted_audio):
            os.unlink(converted_audio)


def transcribe_realtime(audio_file):
    """Transcribe one file and emit the established IPC JSON response."""
    try:
        print(json.dumps({"type": "complete", "text": transcribe(audio_file)}))
        sys.stdout.flush()
    except Exception as error:
        print(json.dumps({"type": "error", "error": str(error)}))
        sys.stdout.flush()
        sys.exit(1)


def run_worker():
    """Keep MedASR loaded while Electron sends JSON/base64 audio requests."""
    # Load the model before the first recording chunk arrives. This runs in a
    # background Electron child process, so the user can begin recording while
    # initialization finishes.
    get_transcriber()
    print(json.dumps({"type": "ready"}), flush=True)

    for line in sys.stdin:
        try:
            request = json.loads(line)
            request_id = request["id"]
            audio_file = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
            try:
                audio_file.write(base64.b64decode(request["audioBase64"]))
                audio_file.close()
                response = {"id": request_id, "text": transcribe(audio_file.name)}
            finally:
                if not audio_file.closed:
                    audio_file.close()
                if os.path.exists(audio_file.name):
                    os.unlink(audio_file.name)
        except Exception as error:
            response = {"id": request.get("id") if "request" in locals() else None, "error": str(error)}

        print(json.dumps(response), flush=True)

if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--server":
        run_worker()
        sys.exit(0)

    if len(sys.argv) < 2:
        print(json.dumps({"type": "error", "error": "Audio file path required"}))
        sys.exit(1)

    audio_file = sys.argv[1]
    transcribe_realtime(audio_file)
