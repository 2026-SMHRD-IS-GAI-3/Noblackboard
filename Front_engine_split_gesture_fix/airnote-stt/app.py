import ctypes
import os
import tempfile
import threading
import time
from pathlib import Path

CUDA_RUNTIME_DIR = Path(__file__).with_name("cuda-runtime")
cuda_dll_directory = None
if os.name == "nt" and CUDA_RUNTIME_DIR.is_dir():
    os.environ["PATH"] = f"{CUDA_RUNTIME_DIR}{os.pathsep}{os.environ.get('PATH', '')}"
    cuda_dll_directory = os.add_dll_directory(str(CUDA_RUNTIME_DIR))

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from faster_whisper import WhisperModel

# AirNote local STT server
# RTX 2060 6GB에서 정확도와 지연을 절충한 기본값: medium + beam 1.
MODEL_NAME = os.getenv("AIRNOTE_STT_MODEL", "medium")
DEVICE = os.getenv("AIRNOTE_STT_DEVICE", "cuda")
COMPUTE_TYPE = os.getenv("AIRNOTE_STT_COMPUTE", "int8_float16")
BEAM_SIZE = int(os.getenv("AIRNOTE_STT_BEAM_SIZE", "1"))
UI_PATH = Path(__file__).with_name(
    "pdf_speech_coordinate_demo_local_faster_whisper_wavfix.html"
)

app = FastAPI(title="AirNote Local Faster-Whisper STT")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
model_error = None
model_load_lock = threading.Lock()
transcribe_lock = threading.Lock()


def get_model():
    global model, model_error

    if model is not None:
        return model

    with model_load_lock:
        if model is not None:
            return model

        try:
            if DEVICE == "cuda" and os.name == "nt":
                ctypes.WinDLL("cublas64_12.dll")
                ctypes.WinDLL("cudnn64_9.dll")

            print("AirNote STT 모델 로딩 시작")
            print(
                f"model={MODEL_NAME}, device={DEVICE}, "
                f"compute_type={COMPUTE_TYPE}, beam_size={BEAM_SIZE}"
            )
            model = WhisperModel(
                MODEL_NAME,
                device=DEVICE,
                compute_type=COMPUTE_TYPE,
            )
            model_error = None
            print("AirNote STT 모델 로딩 완료")
            return model
        except Exception as error:
            model_error = str(error)
            print(f"AirNote STT 모델 로딩 실패: {model_error}")
            raise


def transcribe_file(temp_path):
    stt_model = get_model()
    with transcribe_lock:
        segments, info = stt_model.transcribe(
            temp_path,
            language="ko",
            task="transcribe",
            beam_size=BEAM_SIZE,
            vad_filter=True,
            vad_parameters={
                "min_silence_duration_ms": 250,
            },
            condition_on_previous_text=False,
            temperature=0.0,
            no_speech_threshold=0.6,
        )
        return list(segments), info


@app.get("/")
def ui():
    return FileResponse(UI_PATH)


@app.get("/health")
def health_check():
    return {
        "status": "AirNote local STT server running",
        "model_loaded": model is not None,
        "model_error": model_error,
        "model": MODEL_NAME,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
        "beam_size": BEAM_SIZE,
        "endpoint": "/stt",
        "audio_format": "wav from browser PCM capture",
    }


@app.post("/warmup")
async def warmup():
    try:
        await run_in_threadpool(get_model)
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=(
                f"STT 모델을 로드하지 못했습니다: {error}. "
                "CUDA DLL 문제면 AIRNOTE_STT_DEVICE=cpu, "
                "AIRNOTE_STT_COMPUTE=int8로 먼저 확인하세요."
            ),
        ) from error

    return {"ok": True, "model": MODEL_NAME, "device": DEVICE}


@app.post("/stt")
async def stt(audio: UploadFile = File(...)):
    started_at = time.perf_counter()
    temp_path = None

    raw = await audio.read()
    byte_size = len(raw)

    # 너무 작은 chunk는 정상 음성 파일이 아니므로 조용히 무시한다.
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

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        temp.write(raw)
        temp_path = temp.name

    try:
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
                {
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text.strip(),
                }
                for segment in segment_list
            ],
        }

    except Exception as error:
        elapsed_ms = round((time.perf_counter() - started_at) * 1000)
        print(
            "[STT_SKIP]",
            f"bytes={byte_size}",
            f"filename={audio.filename}",
            f"content_type={audio.content_type}",
            f"error={error}",
        )
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
