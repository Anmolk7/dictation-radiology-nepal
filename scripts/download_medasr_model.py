#!/usr/bin/env python3
"""Download the authorized MedASR repository for offline app packaging."""

from pathlib import Path
import os
import sys

from huggingface_hub import HfApi, snapshot_download
from huggingface_hub.errors import GatedRepoError


MODEL_ID = "google/medasr"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_DIRECTORY = PROJECT_ROOT / "resources" / "medasr-model"
REQUIRED_MODEL_FILES = (
    "config.json",
    "model.safetensors",
    "preprocessor_config.json",
    "spiece.model",
    "tokenizer.json",
    "tokenizer_config.json",
)


def main():
    if all((MODEL_DIRECTORY / filename).is_file() for filename in REQUIRED_MODEL_FILES):
        print("MedASR model is already available for offline packaging.")
        return 0

    token = os.environ.get("HF_TOKEN") or None
    if not token:
        print(
            "HF_TOKEN is required to download the gated google/medasr model. "
            "Accept its Hugging Face conditions, set a read token, then run this command again.",
            file=sys.stderr,
        )
        return 1

    MODEL_DIRECTORY.mkdir(parents=True, exist_ok=True)
    try:
        # Check authorization before beginning a multi-gigabyte download. A
        # valid token alone is not enough for a gated model; its account must
        # also have accepted the repository's access conditions.
        HfApi(token=token).model_info(MODEL_ID)
        print(
            f"Downloading {MODEL_ID} for offline packaging into "
            f"{MODEL_DIRECTORY}..."
        )
        snapshot_download(
            repo_id=MODEL_ID,
            token=token,
            local_dir=str(MODEL_DIRECTORY),
        )
    except GatedRepoError:
        print(
            "This Hugging Face account is not authorized for google/medasr. "
            "Sign in to the same account at https://huggingface.co/google/medasr, "
            "accept or request access to the model, then create a new read token "
            "for that account and run the command again.",
            file=sys.stderr,
        )
        return 1

    print("MedASR model is ready for offline packaging.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
