from faster_whisper import WhisperModel

print("모델 로딩 시작")

model = WhisperModel(
    "medium",
    device="cuda",
    compute_type="int8_float16"
)

print("모델 로딩 성공")