import ctypes
import os
import tempfile
import threading
import time
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

BASE_DIR = Path(__file__).resolve().parent
MODEL_NAME = "medium"
MODEL_ROOT = Path(os.getenv("AIRNOTE_STT_MODEL_ROOT", BASE_DIR / "models")).resolve()
LOCAL_MODEL_ONLY = os.getenv("AIRNOTE_STT_LOCAL_ONLY", "1") != "0"
PREFERRED_DEVICE = os.getenv("AIRNOTE_STT_DEVICE", "cuda")
PREFERRED_COMPUTE_TYPE = os.getenv("AIRNOTE_STT_COMPUTE", "int8_float16")
CPU_COMPUTE_TYPE = os.getenv("AIRNOTE_STT_CPU_COMPUTE", "int8")
BEAM_SIZE = int(os.getenv("AIRNOTE_STT_BEAM_SIZE", "1"))
CUDA_RUNTIME_DIR = BASE_DIR / "cuda-runtime"

if os.name == "nt" and CUDA_RUNTIME_DIR.is_dir():
    os.environ["PATH"] = f"{CUDA_RUNTIME_DIR}{os.pathsep}{os.environ.get('PATH', '')}"
    os.add_dll_directory(str(CUDA_RUNTIME_DIR))

app = FastAPI(title="AirNote Local STT")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
model_error = None
model_runtime = {"device": None, "compute_type": None}
model_load_lock = threading.Lock()
transcribe_lock = threading.Lock()


def get_model_candidates():
    candidates = [(PREFERRED_DEVICE, PREFERRED_COMPUTE_TYPE)]
    if PREFERRED_DEVICE != "cpu":
        candidates.append(("cpu", CPU_COMPUTE_TYPE))
    return candidates


def get_model():
    global model, model_error

    if model is not None:
        return model

    with model_load_lock:
        if model is not None:
            return model

        MODEL_ROOT.mkdir(parents=True, exist_ok=True)
        errors = []
        for device, compute_type in get_model_candidates():
            try:
                if device == "cuda" and os.name == "nt":
                    ctypes.WinDLL("cublas64_12.dll")
                    ctypes.WinDLL("cudnn64_9.dll")

                print("AirNote STT model loading")
                print(
                    f"model={MODEL_NAME}, device={device}, "
                    f"compute_type={compute_type}, model_root={MODEL_ROOT}"
                )
                model = WhisperModel(
                    MODEL_NAME,
                    device=device,
                    compute_type=compute_type,
                    download_root=str(MODEL_ROOT),
                    local_files_only=LOCAL_MODEL_ONLY,
                )
                model_runtime["device"] = device
                model_runtime["compute_type"] = compute_type
                model_error = None
                print("AirNote STT model loaded")
                return model
            except Exception as error:
                message = f"{device}/{compute_type}: {error}"
                errors.append(message)
                model_error = message
                print(f"AirNote STT model load failed: {message}")

        model_error = " | ".join(errors)
        raise RuntimeError(model_error)


def transcribe_file(temp_path):
    stt_model = get_model()
    with transcribe_lock:
        segments, info = stt_model.transcribe(
            temp_path,
            language="ko",
            task="transcribe",
            beam_size=BEAM_SIZE,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 250},
            condition_on_previous_text=False,
            temperature=0.0,
            no_speech_threshold=0.6,
        )
        return list(segments), info


@app.get("/health")
def health_check():
    return {
        "ok": True,
        "status": "AirNote local STT server running",
        "model": MODEL_NAME,
        "model_loaded": model is not None,
        "model_error": model_error,
        "model_root": str(MODEL_ROOT),
        "local_model_only": LOCAL_MODEL_ONLY,
        "preferred_device": PREFERRED_DEVICE,
        "preferred_compute_type": PREFERRED_COMPUTE_TYPE,
        "device": model_runtime["device"] or PREFERRED_DEVICE,
        "compute_type": model_runtime["compute_type"] or PREFERRED_COMPUTE_TYPE,
        "cpu_fallback_compute_type": CPU_COMPUTE_TYPE,
        "endpoint": "/stt",
    }


@app.post("/warmup")
async def warmup():
    try:
        await run_in_threadpool(get_model)
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=(
                f"STT model could not be loaded: {error}. "
                "AirNote always uses faster-whisper medium. "
                "GPU is tried first, then CPU int8 fallback."
            ),
        ) from error

    return {
        "ok": True,
        "model": MODEL_NAME,
        "model_root": str(MODEL_ROOT),
        "device": model_runtime["device"],
        "compute_type": model_runtime["compute_type"],
    }


@app.post("/stt")
async def stt(audio: UploadFile = File(...)):
    started_at = time.perf_counter()
    raw = await audio.read()
    byte_size = len(raw)
    if byte_size < 4096:
        return {
            "ok": False,
            "text": "",
            "skip_reason": "audio chunk too small",
            "byte_size": byte_size,
        }

    suffix = ".wav"
    if audio.filename:
        ext = Path(audio.filename).suffix.lower()
        if ext in {".wav", ".webm", ".m4a", ".mp3", ".ogg", ".mp4"}:
            suffix = ext

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            temp.write(raw)
            temp_path = temp.name

        segment_list, info = await run_in_threadpool(transcribe_file, temp_path)
        text = " ".join(segment.text.strip() for segment in segment_list).strip()
        elapsed_ms = round((time.perf_counter() - started_at) * 1000)
        print(f"[STT] {byte_size} bytes -> {elapsed_ms}ms -> {text[:80]}")
        return {
            "ok": True,
            "text": text,
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
            "process_time_ms": elapsed_ms,
            "byte_size": byte_size,
            "segments": [
                {"start": segment.start, "end": segment.end, "text": segment.text.strip()}
                for segment in segment_list
            ],
        }
    except Exception as error:
        elapsed_ms = round((time.perf_counter() - started_at) * 1000)
        raise HTTPException(
            status_code=503,
            detail={
                "message": str(error),
                "filename": audio.filename,
                "content_type": audio.content_type,
                "process_time_ms": elapsed_ms,
                "byte_size": byte_size,
            },
        ) from error
    finally:
        if temp_path:
            try:
                os.remove(temp_path)
            except OSError:
                pass
