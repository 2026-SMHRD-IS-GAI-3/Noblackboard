import os
from pathlib import Path

from faster_whisper import WhisperModel

BASE_DIR = Path(__file__).resolve().parent
MODEL_NAME = "medium"
MODEL_ROOT = Path(os.getenv("AIRNOTE_STT_MODEL_ROOT", BASE_DIR / "models")).resolve()
LOCAL_MODEL_ONLY = os.getenv("AIRNOTE_STT_LOCAL_ONLY", "0") == "1"


def main():
    MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    print("Preparing AirNote STT model")
    print(f"model={MODEL_NAME}")
    print(f"model_root={MODEL_ROOT}")
    WhisperModel(
        MODEL_NAME,
        device="cpu",
        compute_type=os.getenv("AIRNOTE_STT_CPU_COMPUTE", "int8"),
        download_root=str(MODEL_ROOT),
        local_files_only=LOCAL_MODEL_ONLY,
    )
    print("AirNote STT model is ready")


if __name__ == "__main__":
    main()
