import { createFreeWritingEngine } from "./gesture/engines/freeWritingEngine.js";
import { createStraightUnderlineEngine } from "./gesture/engines/straightUnderlineEngine.js";
import { createAdvancedGestureEngine } from "./gesture/advancedGestureEngine.js";
import { createPalmEraseGestureTracker } from "./gesture/palmEraseGesture.js";
import { createSwipeGestureTracker } from "./gesture/swipeGesture.js";

document.addEventListener("DOMContentLoaded", () => {
  const video = document.getElementById("webcamVideo");
  const handStatusText = document.getElementById("handStatusText");
  const annotationCanvas = document.getElementById("drawCanvas") || document.getElementById("annotationCanvas");
  const cameraView = video?.closest(".camera-view");
  const gestureHandStatus = document.getElementById("gestureHandStatus");
  const gestureReverseHandInput = document.getElementById("gestureReverseHand");

  const MEDIAPIPE_CDN_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
  const MEDIAPIPE_CDN_WASM_URL = `${MEDIAPIPE_CDN_URL}/wasm`;
  const MEDIAPIPE_CDN_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

  // 로컬 vendor 파일 존재 여부를 미리 확인 (비동기 Promise — loadMediaPipe 내에서 await)
  const _localBase = new URL("../vendor/mediapipe", import.meta.url).href;
  const _localWasmBase = `${_localBase}/wasm`;
  const _localModelUrl = `${_localBase}/hand_landmarker.task`;
  const _localModuleUrl = `${_localBase}/vision_bundle.mjs`;
  const _localAvailablePromise = fetch(`${_localWasmBase}/vision_wasm_internal.js`, { method: "HEAD" })
    .then((r) => r.ok)
    .catch(() => false);
  const CALIBRATION_DURATION_MS = 3000;
  const MIN_CALIBRATION_SAMPLES = 12;
  const POINTER_ON_FRAMES = 3;
  const POINTER_OFF_FRAMES = 3;
  const LOST_GRACE_MS = 280;
  const LOST_END_MS = 700;
  const COMMAND_COOLDOWN_MS = 320;
  const PREVIOUS_HOLD_MS = 520;
  const PREVIOUS_GESTURE_GRACE_MS = 180;
  const PREVIOUS_REPEAT_MS = 1200;
  const MODE_TOGGLE_HOLD_MS = 700;
  const MODE_TOGGLE_COOLDOWN_MS = 350;
  const CLEAR_HOLD_MS = 800;
  const CLEAR_GESTURE_GRACE_MS = 650;
  const NEXT_REPEAT_MS = 1000;
  const PINCH_CONFIRM_MS = 350;
  const PINCH_AIM_MOVE_RESET_RATIO = 0.025;
  const UNDERLINE_HOLD_MS = 0;
  const UNDERLINE_LOST_GRACE_MS = 280;
  const UNDERLINE_RELEASE_GRACE_MS = 90;
  const UNDERLINE_NEW_STROKE_ONLY_MS = 500;
  const UNDERLINE_BRIDGE_MIN_DISTANCE_RATIO = 0.14;
  const UNDERLINE_BRIDGE_MAX_DISTANCE_RATIO = 0.28;
  const MIN_COMMAND_CONFIDENCE = 0.48;
  const MIN_SENSITIVE_CONFIDENCE = 0.58;
  // 발표 페이지에서는 PDF/STT/좌표 변환까지 거치므로 핀치 판정은 HTML 테스트보다 약간 더 관대하게 둔다.
  const DEFAULT_TOUCH_RATIO = 0.38;
  const UNDERLINE_MIN_CONFIDENCE = 0.46;
  const REQUIRED_COMMAND_FRAMES = 1;
  const GESTURE_HAND_STORAGE_KEY = "airnoteGestureHandSettings.v2";

  let HandLandmarker = null;
  let FilesetResolver = null;
  let handLandmarker = null;
  let animationFrameId = null;
  let lastVideoTime = -1;
  let lastHandSeenAt = 0;
  let pointerActive = false;
  let extendedFrames = 0;
  let foldedFrames = 0;
  let smoothedPoint = null;
  let previousPalmCenter = null;
  let previousPalmTime = 0;
  let gestureEnabled = true;
  let gestureControlEnabled = true;
  let connectionState = { connected: false, label: "OFF", percent: 0, color: "red", reason: "연결 필요" };
  let activeStream = null;
  let activeStreamToken = 0;
  let calibrationProfile = loadCalibrationProfile();
  let calibrationState = createIdleCalibrationState();
  let holdState = createHoldState();
  let modeToggleStartedAt = 0;
  let modeToggleLocked = false;
  let lastModeToggleAt = 0;
  let handSettings = loadHandSettings();
  const HANDEDNESS_MIN_CONFIDENCE = 0.65;
  const swipeTracker = createSwipeGestureTracker({
    minDistancePx: 150,
    maxDurationMs: 300,
    minFinalScore: 0.75,
    armFrames: 3,
    armMs: 90,
  });
  const pinchSwipeTracker = createSwipeGestureTracker({
    minDistancePx: 110,
    maxDurationMs: 420,
    minShapeScore: 0.48,
    minFinalScore: 0.72,
    armFrames: 3,
    armMs: 100,
  });
  const palmEraseTracker = createPalmEraseGestureTracker();
  let lastCommand = { command: "", at: 0 };
  let lastPointerDiagnosticAt = 0;
  let underlineLastSeenAt = 0;
  let underlineLastPoint = null;
  let lastStrokePhase = "idle";
  const gestureEngine = createAdvancedGestureEngine({
    getCalibrationProfile: () => calibrationProfile,
    getViewport: () => ({
      width: video?.videoWidth || annotationCanvas?.width || 1280,
      height: video?.videoHeight || annotationCanvas?.height || 720,
    }),
    config: {
      minCommandConfidence: MIN_COMMAND_CONFIDENCE,
      minSensitiveCommandConfidence: MIN_SENSITIVE_CONFIDENCE,
      underlineStartConfidence: UNDERLINE_MIN_CONFIDENCE,
    },
  });

  function createIdleCalibrationState() {
    return {
      active: false,
      phase: "idle",
      phaseIndex: -1,
      startedAt: 0,
      endsAt: 0,
      samples: { open_palm: [], pinch: [] },
      rejections: { noHand: 0, lowConfidence: 0, outOfFrame: 0, unstable: 0 },
    };
  }

  function createHoldState() {
    return {
      previousStartedAt: 0,
      previousSeenAt: 0,
      previousLocked: false,
      previousLastAt: 0,
      clearStartedAt: 0,
      clearSeenAt: 0,
      clearLastUpdateAt: 0,
      clearAccumulatedMs: 0,
      clearLocked: false,
      underlineStartedAt: 0,
      underlineAimPoint: null,
      underlineLocked: false,
      underlineFrames: 0,
      nextLastAt: 0,
    };
  }

  function resetModeToggleState() {
    modeToggleStartedAt = 0;
    modeToggleLocked = false;
  }

  function loadHandSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(GESTURE_HAND_STORAGE_KEY) || "null");
      return {
        // 기본값: 마이크 손의 MediaPipe 라벨 = "Right" (실측 기준).
        micHand: parsed?.micHand === "Left" ? "Left" : "Right",
        reverse: Boolean(parsed?.reverse),
      };
    } catch {
      return { micHand: "Right", reverse: false };
    }
  }

  function saveHandSettings() {
    try {
      localStorage.setItem(GESTURE_HAND_STORAGE_KEY, JSON.stringify(handSettings));
    } catch {
      // Ignore storage failures; the current page state is still usable.
    }
  }

  function getPointerTargetHandLabel() {
    let target = handSettings.micHand === "Right" ? "Left" : "Right";
    if (handSettings.reverse) target = target === "Right" ? "Left" : "Right";
    return target;
  }

  function updateHandSettingsUi() {
    document.querySelectorAll("input[name='gestureMicHand']").forEach((input) => {
      input.checked = input.value === handSettings.micHand;
    });
    if (gestureReverseHandInput) {
      gestureReverseHandInput.checked = handSettings.reverse;
    }
    if (gestureHandStatus) {
      gestureHandStatus.textContent = `인식: ${getPointerTargetHandLabel() === "Right" ? "오른손" : "왼손"}`;
    }
  }

  function bindHandSettingsUi() {
    document.querySelectorAll("input[name='gestureMicHand']").forEach((input) => {
      input.addEventListener("change", (event) => {
        handSettings = {
          ...handSettings,
          micHand: event.target.value === "Left" ? "Left" : "Right",
        };
        saveHandSettings();
        updateHandSettingsUi();
        resetGestureState();
      });
    });
    gestureReverseHandInput?.addEventListener("change", (event) => {
      handSettings = {
        ...handSettings,
        reverse: Boolean(event.target.checked),
      };
      saveHandSettings();
      updateHandSettingsUi();
      resetGestureState();
    });
    updateHandSettingsUi();
  }

  function getPresentationApi() {
    return window.AirNotePresentation || null;
  }

  function getCurrentMode() {
    const apiMode = getPresentationApi()?.getState?.().currentMode;
    if (apiMode === "pen" || apiMode === "highlight" || apiMode === "pointer") return apiMode;
    const activeButton = document.querySelector(".mode-button.active[data-mode]");
    const domMode = activeButton?.dataset?.mode;
    if (domMode === "pen" || domMode === "highlight" || domMode === "pointer") return domMode;
    // 발표 화면의 기본 계약은 펜 + 판서 모드다. API 초기화 순간에 mode가 비어 있으면
    // pointer로 떨어지지 말고 pen으로 보정한다.
    return "pen";
  }

  function getCurrentStrokeMode() {
    const apiMode = getPresentationApi()?.getState?.().underlineMode;
    if (apiMode === "freewriting" || apiMode === "straight") return apiMode;
    const checked = document.querySelector('input[name="underlineMode"]:checked');
    const domMode = checked?.value;
    if (domMode === "freewriting" || domMode === "straight") return domMode;
    return "freewriting";
  }

  function getCurrentUserEmail() {
    try {
      const stored = JSON.parse(localStorage.getItem("airnoteCurrentUser") || "null");
      return stored?.email || "example@google.com";
    } catch {
      return "example@google.com";
    }
  }

  function getCalibrationKey() {
    return `airnoteGestureCalibration:${getCurrentUserEmail()}:v2`;
  }

  function loadCalibrationProfile() {
    try {
      const parsed = JSON.parse(localStorage.getItem(getCalibrationKey()) || "null");
      return parsed?.version === 2 ? parsed : null;
    } catch (error) {
      console.warn("handPointer: calibration profile parse failed.", error);
      localStorage.removeItem(getCalibrationKey());
      return null;
    }
  }

  function saveCalibrationProfile(profile) {
    calibrationProfile = profile;
    localStorage.setItem(getCalibrationKey(), JSON.stringify(profile));
    publishCalibrationState("complete");
  }

  function publishCalibrationState(status, extra = {}) {
    const detail = {
      status,
      active: calibrationState.active,
      phase: calibrationState.phase,
      remainingMs: Math.max(0, calibrationState.endsAt - performance.now()),
      sampleCounts: {
        openPalm: calibrationState.samples.open_palm.length,
        pinch: calibrationState.samples.pinch.length,
      },
      profile: calibrationProfile,
      ...extra,
    };
    window.dispatchEvent(new CustomEvent("airnote:calibration-state", { detail }));
  }

  function startCalibration() {
    if (!connectionState.connected || !handLandmarker) {
      publishCalibrationState("failed", { reason: "카메라 또는 손 인식 엔진이 준비되지 않음" });
      return false;
    }
    const now = performance.now();
    calibrationState = {
      active: true,
      phase: "open_palm",
      phaseIndex: 0,
      startedAt: now,
      endsAt: now + CALIBRATION_DURATION_MS,
      samples: { open_palm: [], pinch: [] },
      rejections: { noHand: 0, lowConfidence: 0, outOfFrame: 0, unstable: 0 },
    };
    resetGestureState();
    publishCalibrationState("collecting");
    return true;
  }

  function resetCalibration() {
    localStorage.removeItem(getCalibrationKey());
    calibrationProfile = null;
    calibrationState = createIdleCalibrationState();
    publishCalibrationState("required");
  }

  function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function percentile(values, ratio) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function scoreRange(value, bad, good) {
    if (bad === good) return value >= good ? 1 : 0;
    return clamp((value - bad) / (good - bad), 0, 1);
  }

  function publishConnectionState(nextState = {}) {
    connectionState = { ...connectionState, ...nextState };
    window.AirNoteWebcamState = connectionState;
    window.dispatchEvent(new CustomEvent("airnote:webcam-state", { detail: connectionState }));
    const headerState = video?.closest(".camera-card")?.querySelector("header span");
    if (headerState) {
      headerState.textContent = connectionState.label;
      headerState.style.color = connectionState.connected ? "#22c55e" : "#ef4444";
    }
    cameraView?.classList.toggle("is-connected", connectionState.connected);
    cameraView?.classList.toggle("is-disconnected", !connectionState.connected);
  }

  function setStatus(message) {
    if (handStatusText) handStatusText.textContent = message;
  }

  function getCameraErrorMessage(error) {
    if (error?.name === "NotAllowedError") return "카메라 권한 거부";
    if (error?.name === "NotFoundError") return "카메라 장치 없음";
    if (error?.name === "NotReadableError") return "다른 프로그램에서 카메라 사용 중";
    return "카메라 연결 실패";
  }
  function getLiveVideoTrack(stream) {
    return stream?.getVideoTracks?.().find((track) => track.readyState === "live") || null;
  }

  function hasLiveVideoStream(stream) {
    return Boolean(getLiveVideoTrack(stream));
  }

  function stopDetectionLoop() {
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    lastVideoTime = -1;
  }

  function detachVideoStream() {
    if (!video) return;
    try {
      video.pause();
    } catch {
      // ignore pause errors from detached media elements
    }
    video.srcObject = null;
    cameraView?.classList.remove("has-video");
  }

  function handleStreamLost(reason = "웹캠 스트림 종료") {
    stopDetectionLoop();
    detachVideoStream();
    activeStream = null;
    resetGestureState();
    setStatus(reason);
    publishConnectionState({ connected: false, label: "OFF", percent: 0, color: "red", reason });
    window.dispatchEvent(new CustomEvent("airnote:webcam-lost", { detail: { reason } }));
  }


  async function loadMediaPipeModule() {
    if (HandLandmarker && FilesetResolver) return true;
    const useLocal = await _localAvailablePromise;
    if (useLocal) {
      try {
        const vision = await import(_localModuleUrl);
        HandLandmarker = vision.HandLandmarker;
        FilesetResolver = vision.FilesetResolver;
        return true;
      } catch (error) {
        console.warn("MediaPipe local vendor import failed. Falling back to CDN.", error);
      }
    }
    try {
      const vision = await import(MEDIAPIPE_CDN_URL);
      HandLandmarker = vision.HandLandmarker;
      FilesetResolver = vision.FilesetResolver;
      return true;
    } catch (error) {
      console.error("MediaPipe CDN import failed.", error);
      setStatus("MediaPipe 로딩 실패");
      publishConnectionState({ connected: false, label: "OFF", percent: 0, color: "red", reason: "MediaPipe 로딩 실패" });
      return false;
    }
  }

  async function createHandLandmarker(delegate) {
    const useLocal = await _localAvailablePromise;
    const wasmUrl = useLocal ? _localWasmBase : MEDIAPIPE_CDN_WASM_URL;
    const modelUrl = useLocal ? _localModelUrl : MEDIAPIPE_CDN_MODEL_URL;
    if (useLocal) console.info("AirNote: MediaPipe 로컬 vendor 사용");
    const filesetResolver = await FilesetResolver.forVisionTasks(wasmUrl);
    return HandLandmarker.createFromOptions(filesetResolver, {
      baseOptions: { modelAssetPath: modelUrl, delegate },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.38,
      minHandPresenceConfidence: 0.38,
      minTrackingConfidence: 0.38,
    });
  }

  async function initMediaPipe() {
    setStatus("MediaPipe 로딩 중...");
    if (!(await loadMediaPipeModule())) return false;
    try {
      handLandmarker = await createHandLandmarker("GPU");
    } catch (gpuError) {
      console.warn("MediaPipe GPU init failed. Retrying with CPU.", gpuError);
      try {
        handLandmarker = await createHandLandmarker("CPU");
      } catch (cpuError) {
        console.error("MediaPipe CPU init failed.", cpuError);
        setStatus("MediaPipe 로딩 실패");
        publishConnectionState({ connected: false, label: "OFF", percent: 0, color: "red", reason: "MediaPipe 로딩 실패" });
        return false;
      }
    }
    setStatus("MediaPipe 준비됨 · 웹캠 권한 대기 중");
    return true;
  }

  async function initWebcam(stream) {
    const track = getLiveVideoTrack(stream);
    if (!video || !track) {
      handleStreamLost("웹캠 스트림 없음 · 권한을 다시 허용해주세요");
      return false;
    }

    const token = ++activeStreamToken;
    stopDetectionLoop();
    resetGestureState();
    activeStream = stream;
    lastHandSeenAt = 0;
    setStatus("카메라 연결 중...");

    try {
      video.srcObject = stream;
      cameraView?.classList.add("has-video");

      const onTrackEnded = () => {
        if (token !== activeStreamToken) return;
        handleStreamLost("웹캠이 꺼졌습니다 · 권한 버튼으로 다시 연결하세요");
      };
      const onTrackMute = () => {
        if (token !== activeStreamToken) return;
        setStatus("웹캠 일시 중지됨 · 다시 켜지면 자동 재개됩니다");
        publishConnectionState({ connected: false, label: "OFF", percent: 0, color: "red", reason: "웹캠 일시 중지" });
      };
      const onTrackUnmute = () => {
        if (token !== activeStreamToken || !hasLiveVideoStream(activeStream)) return;
        setStatus("손 인식 대기 중");
        publishConnectionState({ connected: true, label: "ON", percent: 100, color: "green", reason: "정상 연결" });
        detectHands();
      };
      track.addEventListener?.("ended", onTrackEnded, { once: true });
      track.addEventListener?.("mute", onTrackMute);
      track.addEventListener?.("unmute", onTrackUnmute);

      await new Promise((resolve) => {
        if (video.readyState >= 2) return resolve();
        video.onloadedmetadata = () => resolve();
        video.onloadeddata = () => resolve();
        window.setTimeout(resolve, 1600);
      });
      if (!hasLiveVideoStream(stream)) {
        handleStreamLost("웹캠 스트림이 종료되었습니다 · 다시 연결하세요");
        return false;
      }
      await video.play().catch((error) => {
        console.warn("handPointer: video.play failed, continuing after user gesture may be required.", error);
      });
      setStatus(handLandmarker ? "손 인식 대기 중" : "웹캠 연결됨 · MediaPipe 로딩 중");
      publishConnectionState({ connected: true, label: "ON", percent: 100, color: "green", reason: "정상 연결" });
      detectHands();
      return true;
    } catch (error) {
      const message = getCameraErrorMessage(error);
      console.warn("handPointer: webcam init failed.", error);
      handleStreamLost(message);
      return false;
    }
  }

  function getHandLabel(result, index) {
    return result?.handednesses?.[index]?.[0]?.categoryName || "Unknown";
  }

  function getTargetHand(result) {
    if (!result?.landmarks?.length) return null;
    const targetHandLabel = getPointerTargetHandLabel();
    const micHandLabel = targetHandLabel === "Right" ? "Left" : "Right";
    const count = result.landmarks.length;

    if (count === 1) {
      // 손 하나만 감지: micHandLabel이면 마이크 손이므로 차단.
      // 그 외(targetHandLabel 또는 Unknown)는 통과 — 핀치 중 라벨 오분류 대응.
      const label = getHandLabel(result, 0);
      if (label === micHandLabel) return null;
      return {
        landmarks: result.landmarks[0],
        label,
        targetHandLabel,
        targetMatched: label === targetHandLabel,
        confidence: result?.handednesses?.[0]?.[0]?.score ?? 1,
      };
    }

    // 두 손 감지: micHandLabel 손은 무조건 제외.
    // 남은 손 중 targetHandLabel 우선, 없으면 Unknown(핀치 오분류) 폴백.
    // 동일 라벨이 여러 개면 신뢰도가 높은 손 선택.
    let targetIndex = -1;
    let targetScore = -1;
    let fallbackIndex = -1;
    let fallbackScore = -1;
    for (let i = 0; i < count; i += 1) {
      const label = getHandLabel(result, i);
      if (label === micHandLabel) continue;
      const score = result?.handednesses?.[i]?.[0]?.score ?? 0;
      if (label === targetHandLabel) {
        if (score > targetScore) { targetIndex = i; targetScore = score; }
      } else {
        if (score > fallbackScore) { fallbackIndex = i; fallbackScore = score; }
      }
    }
    const chosen = targetIndex !== -1 ? targetIndex : fallbackIndex;
    if (chosen === -1) return null;
    const chosenLabel = getHandLabel(result, chosen);
    return {
      landmarks: result.landmarks[chosen],
      label: chosenLabel,
      targetHandLabel,
      targetMatched: chosenLabel === targetHandLabel,
      confidence: result?.handednesses?.[chosen]?.[0]?.score ?? 1,
    };
  }

  function distance3D(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
  }

  function angle3D(a, b, c) {
    const ab = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
    const cb = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
    const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
    const abLength = Math.hypot(ab.x, ab.y, ab.z);
    const cbLength = Math.hypot(cb.x, cb.y, cb.z);
    if (!abLength || !cbLength) return 0;
    return Math.acos(clamp(dot / (abLength * cbLength), -1, 1)) * (180 / Math.PI);
  }

  function normalizedToPresentation(point) {
    return {
      xRatio: clamp(1 - point.x, 0, 1),
      yRatio: clamp(point.y, 0, 1),
    };
  }

  function getPalmCenter(hand) {
    const indexes = [0, 5, 9, 13, 17];
    return {
      x: average(indexes.map((index) => hand[index].x)),
      y: average(indexes.map((index) => hand[index].y)),
    };
  }

  function collectCalibrationSample(hand, context, scores, handConfidence = 1) {
    if (!calibrationState.active) return;
    const sample = {
      palmSize: context.palmSize,
      palmSizePx: context.palmSizePx,
      fingerSpread: context.fingerSpread,
      palmFacingScore: context.palmFacingScore,
      stabilityScore: context.stabilityScore,
      touchDistanceRatio: scores.thumbIndexRatio,
    };
    if (handConfidence < 0.45) {
      calibrationState.rejections.lowConfidence += 1;
    } else if (context.partialHand || context.inFrameRatio < 0.85) {
      calibrationState.rejections.outOfFrame += 1;
    } else if (context.stabilityScore < 0.2 || context.fastMotion) {
      calibrationState.rejections.unstable += 1;
    } else if (
      calibrationState.phase === "open_palm" &&
      scores.clear >= 0.58 &&
      context.stabilityScore >= 0.25 &&
      !context.partialHand
    ) {
      calibrationState.samples.open_palm.push(sample);
    } else if (
      calibrationState.phase === "pinch" &&
      scores.thumbIndexRatio > 0.04 &&
      scores.thumbIndexRatio < 0.75 &&
      context.stabilityScore >= 0.2 &&
      !context.partialHand
    ) {
      calibrationState.samples.pinch.push(sample);
    }
    publishCalibrationState("collecting");
  }

  function finishCalibrationIfNeeded(now) {
    if (!calibrationState.active || now < calibrationState.endsAt) return;
    const phaseSamples = calibrationState.samples[calibrationState.phase];
    if (phaseSamples.length < MIN_CALIBRATION_SAMPLES) {
      calibrationState.active = false;
      const rejections = calibrationState.rejections;
      const reasons = [
        ["손이 감지되지 않았습니다.", rejections.noHand],
        ["손 랜드마크 신뢰도가 낮습니다.", rejections.lowConfidence],
        ["손이 화면 밖으로 벗어났습니다.", rejections.outOfFrame],
        ["손 움직임이 너무 불안정합니다.", rejections.unstable],
      ].sort((a, b) => b[1] - a[1]);
      const reason = reasons[0][1] > 0 ? reasons[0][0] : "샘플 수가 부족합니다.";
      publishCalibrationState("failed", { reason, rejections });
      return;
    }
    if (calibrationState.phase === "open_palm") {
      calibrationState.phase = "pinch";
      calibrationState.phaseIndex = 1;
      calibrationState.startedAt = now;
      calibrationState.endsAt = now + CALIBRATION_DURATION_MS;
      publishCalibrationState("collecting");
      return;
    }
    const openPalm = calibrationState.samples.open_palm;
    const pinch = calibrationState.samples.pinch;
    const profile = {
      version: 2,
      createdAt: new Date().toISOString(),
      openPalmSampleCount: openPalm.length,
      pinchSampleCount: pinch.length,
      palmSize: average(openPalm.map((sample) => sample.palmSize)),
      palmSizePx: average(openPalm.map((sample) => sample.palmSizePx)),
      fingerSpread: average(openPalm.map((sample) => sample.fingerSpread)),
      palmFacingScore: average(openPalm.map((sample) => sample.palmFacingScore)),
      touchDistanceRatio: clamp(percentile(pinch.map((sample) => sample.touchDistanceRatio), 0.65) * 1.18, 0.22, 0.5),
    };
    calibrationState.active = false;
    saveCalibrationProfile(profile);
  }

  function updatePointerState(isExtended) {
    if (isExtended) {
      extendedFrames += 1;
      foldedFrames = 0;
    } else {
      foldedFrames += 1;
      extendedFrames = 0;
    }
    if (!pointerActive && extendedFrames >= POINTER_ON_FRAMES) pointerActive = true;
    if (pointerActive && foldedFrames >= POINTER_OFF_FRAMES) pointerActive = false;
    return pointerActive;
  }

  function getSmoothedPoint(point, context = null) {
    if (!smoothedPoint) {
      smoothedPoint = { ...point };
      return smoothedPoint;
    }
    const width = video?.videoWidth || annotationCanvas?.width || 1280;
    const height = video?.videoHeight || annotationCanvas?.height || 720;
    const distance = Math.hypot(
      (point.x - smoothedPoint.x) * width,
      (point.y - smoothedPoint.y) * height,
    );
    // 웹캠 단일 HTML과 비슷한 즉답성을 우선한다. 느린 smoothing은 판서가
    // 손보다 뒤늦게 따라오는 버퍼링처럼 느껴져 통합 페이지 사용감을 망친다.
    if (distance < 2.5) return smoothedPoint;
    if (distance > 260) {
      smoothedPoint = { ...point };
      return smoothedPoint;
    }
    let inputWeight = distance < 8
      ? 0.16
      : distance < 15
        ? 0.26
        : distance < 50
          ? 0.45
          : distance < 110
            ? 0.68
            : 0.86;
    inputWeight = clamp(
      inputWeight + (context?.zoneModifier?.smoothingBoost || 0),
      0.12,
      0.92,
    );
    smoothedPoint = {
      x: smoothedPoint.x + (point.x - smoothedPoint.x) * inputWeight,
      y: smoothedPoint.y + (point.y - smoothedPoint.y) * inputWeight,
    };
    return smoothedPoint;
  }

  function getCommandCooldown(command) {
    if (command === "previous_page") return PREVIOUS_REPEAT_MS;
    if (command === "next_page") return NEXT_REPEAT_MS;
    if (command === "underline") return 0;
    return COMMAND_COOLDOWN_MS;
  }

  function canRunCommand(command, now, repeatInterval = getCommandCooldown(command)) {
    return lastCommand.command !== command || now - lastCommand.at >= repeatInterval;
  }

  function emitCommand(command, detail, now) {
    if (!canRunCommand(command, now, getCommandCooldown(command))) return false;
    lastCommand = { command, at: now };
    getPresentationApi()?.handleGestureEvent?.({ command, phase: "start", ...detail });
    getPresentationApi()?.handleGestureCommand?.(command);
    return true;
  }

  function getPointDistanceRatio(a, b) {
    if (!a || !b) return Infinity;
    return Math.hypot((a.xRatio || 0) - (b.xRatio || 0), (a.yRatio || 0) - (b.yRatio || 0));
  }

  function getUnderlineBridgeMaxRatio(context) {
    const palmScale = clamp((context?.palmSize || 0.12) / 0.12, 0.75, 1.45);
    return clamp(UNDERLINE_BRIDGE_MIN_DISTANCE_RATIO * palmScale, UNDERLINE_BRIDGE_MIN_DISTANCE_RATIO, UNDERLINE_BRIDGE_MAX_DISTANCE_RATIO);
  }

  function emitStrokePhase(phase, point, confidence, thresholds, detail = {}) {
    const handled = getPresentationApi()?.handleUnderlineGesture?.({
      phase,
      handPoint: point,
      confidence,
      thresholds,
      calibrationProfile,
      ...detail,
    });
    if (handled) {
      lastStrokePhase = phase;
      if (["start", "move", "bridge"].includes(phase)) {
        underlineLastSeenAt = performance.now();
        underlineLastPoint = point ? { ...point } : underlineLastPoint;
      }
    }
    return Boolean(handled);
  }

  let strokeEngines = null;

  function getStrokeEngines() {
    if (!strokeEngines) {
      const emitPhase = (phase, point, payload = {}) => emitStrokePhase(phase, point, payload.confidence || 0, payload.thresholds || {}, payload);
      const emitState = (detail = {}) => getPresentationApi()?.handleGestureEvent?.(detail);
      strokeEngines = {
        freewriting: createFreeWritingEngine({
          emitPhase,
          emitState,
          config: { continueTouchMultiplier: 1.55 },
        }),
        straight: createStraightUnderlineEngine({
          emitPhase,
          emitState,
          config: { continueTouchMultiplier: 1.55 },
        }),
      };
    }
    return strokeEngines;
  }

  function getActiveStrokeEngine(mode = getCurrentStrokeMode()) {
    const engines = getStrokeEngines();
    return mode === "straight" ? engines.straight : engines.freewriting;
  }

  function resetInactiveStrokeEngine(activeMode) {
    const engines = getStrokeEngines();
    if (activeMode === "straight") {
      if (engines.freewriting.isActive()) {
        getPresentationApi()?.handleUnderlineGesture?.({ phase: "end", reason: "mode_switched_to_straight" });
      }
      engines.freewriting.reset("mode_switched_to_straight");
    } else {
      if (engines.straight.isActive()) {
        getPresentationApi()?.handleUnderlineGesture?.({ phase: "end", reason: "mode_switched_to_freewriting" });
      }
      engines.straight.reset("mode_switched_to_freewriting");
    }
  }

  function anyStrokeEngineActive() {
    const engines = getStrokeEngines();
    return engines.freewriting.isActive() || engines.straight.isActive();
  }

  function resetGestureState() {
    pointerActive = false;
    extendedFrames = 0;
    foldedFrames = 0;
    smoothedPoint = null;
    gestureEngine.reset();
    swipeTracker.reset();
    pinchSwipeTracker.reset();
    palmEraseTracker.reset();
    holdState = createHoldState();
    if (anyStrokeEngineActive()) {
      getPresentationApi()?.handleUnderlineGesture?.({ phase: "end", reason: "gesture_reset" });
    }
    underlineLastSeenAt = 0;
    underlineLastPoint = null;
    lastStrokePhase = "idle";
    if (strokeEngines) {
      strokeEngines.freewriting.reset("gesture_reset");
      strokeEngines.straight.reset("gesture_reset");
    }
    getPresentationApi()?.updateGestureSession?.(null, false);
  }

  function handleCommands(exclusive, scores, thresholds, point, now) {
    let commandFired = false;
    let claimed = false;
    let claimReason = "";

    const claim = (reason) => {
      claimed = true;
      if (!claimReason) claimReason = reason;
    };

    const setGestureControlEnabled = (enabled) => {
      gestureControlEnabled = Boolean(enabled);
      lastModeToggleAt = now;
      modeToggleLocked = true;
      resetGestureState();
      setStatus(gestureControlEnabled ? "원격조정 모드 ON" : "원격조정 모드 OFF");
      window.dispatchEvent(new CustomEvent("airnote:gesture-control", {
        detail: {
          enabled: gestureControlEnabled,
          source: "pinky_finger_hold",
          holdMs: MODE_TOGGLE_HOLD_MS,
        },
      }));
    };

    if (gestureEnabled && exclusive.command === "mode_toggle" && scores.mode_toggle >= 0.42) {
      claim("mode_toggle_hold");
      if (!modeToggleStartedAt) modeToggleStartedAt = now;
      const holdMs = now - modeToggleStartedAt;
      const cooldownReady = now - lastModeToggleAt >= MODE_TOGGLE_COOLDOWN_MS;
      if (holdMs >= MODE_TOGGLE_HOLD_MS && cooldownReady && !modeToggleLocked) {
        setGestureControlEnabled(!gestureControlEnabled);
        commandFired = true;
      }
      return { claimed, fired: commandFired, command: "mode_toggle", claimReason };
    }
    resetModeToggleState();

    const currentTool = getCurrentMode();
    const strokeMode = getCurrentStrokeMode();
    const controlsActive = gestureEnabled && gestureControlEnabled;
    const strokeToolEnabled = controlsActive && (currentTool === "pen" || currentTool === "highlight");
    const activeStrokeEngine = getActiveStrokeEngine(strokeMode);
    resetInactiveStrokeEngine(strokeMode);
    const width = video?.videoWidth || annotationCanvas?.width || 1280;
    const height = video?.videoHeight || annotationCanvas?.height || 720;

    // 단일 웹캠 HTML과 같은 감각을 목표로 한다. 핀치 계열은 presentation.js에서
    // 다시 판단하지 않고 stroke engine이 start/move/bridge/end를 확정한다.
    const underlineCandidateScore = Math.max(
      scores.underline || 0,
      scores.candidates?.underline?.score || 0
    );
    const initialPinchIntent =
      !activeStrokeEngine.isActive() &&
      !scores.candidates?.underline?.blockedBy &&
      thresholds.commandDistanceAllowed !== false &&
      scores.rawUnderlineStartPinch &&
      underlineCandidateScore >= (thresholds.underlineStartConfidence || UNDERLINE_MIN_CONFIDENCE);
    const pinchSwipeEligible =
      controlsActive &&
      !activeStrokeEngine.isActive() &&
      initialPinchIntent &&
      (scores.pinchSwipeShapeScore || 0) >= (thresholds.pinchSwipeMinShapeScore || 0.48);
    let pinchSwipeMotionIntent = false;
    if (pinchSwipeEligible) {
      const pinchSwipeResult = pinchSwipeTracker.update({
        point: scores.pinchSwipePoint || point,
        shapeScore: scores.pinchSwipeShapeScore || 0,
        now,
        width,
        height,
        minDistancePx: thresholds.pinchSwipeMinDistance,
        maxVerticalDriftPx: thresholds.swipeMaxVerticalDrift,
        minShapeScore: thresholds.pinchSwipeMinShapeScore,
        minFinalScore: thresholds.pinchSwipeMinFinalScore,
        maxDurationMs: thresholds.pinchSwipeMaxDurationMs,
      });
      pinchSwipeMotionIntent =
        pinchSwipeResult.tracking &&
        (pinchSwipeResult.distancePx || 0) >= (thresholds.pinchSwipeIntentDistance || 28) &&
        (pinchSwipeResult.verticalDriftPx || 0) <= thresholds.swipeMaxVerticalDrift;

      if (pinchSwipeResult.fired) {
        getPresentationApi()?.handleUnderlineGesture?.({ phase: "preview-end" });
        holdState.underlineFrames = 0;
        holdState.underlineStartedAt = 0;
        holdState.underlineAimPoint = null;
        claim("pinch_swipe_fired");
        if (now - holdState.nextLastAt >= NEXT_REPEAT_MS && emitCommand("next_page", {
          handPoint: point,
          confidence: pinchSwipeResult.finalScore,
          thresholds,
          calibrationProfile,
          swipeVariant: "thumb_index_pinch",
          ...pinchSwipeResult,
          repeatIntervalMs: NEXT_REPEAT_MS,
        }, now)) {
          commandFired = true;
          holdState.nextLastAt = now;
        }
        return { claimed, fired: commandFired, command: "pinch_swipe", claimReason };
      }

      if (pinchSwipeMotionIntent) {
        getPresentationApi()?.handleUnderlineGesture?.({ phase: "preview-end" });
        claim("pinch_swipe_tracking");
        return { claimed, fired: false, command: "pinch_swipe", claimReason };
      }
    } else {
      pinchSwipeTracker.reset();
    }
    if (initialPinchIntent) {
      holdState.underlineFrames += 1;
      if (!holdState.underlineStartedAt || !holdState.underlineAimPoint) {
        holdState.underlineStartedAt = now;
        holdState.underlineAimPoint = { ...point };
      } else {
        const aimMove = Math.hypot(
          point.xRatio - holdState.underlineAimPoint.xRatio,
          point.yRatio - holdState.underlineAimPoint.yRatio,
        );
        if (aimMove >= PINCH_AIM_MOVE_RESET_RATIO) {
          holdState.underlineStartedAt = now;
          holdState.underlineAimPoint = { ...point };
        }
      }
    } else if (!activeStrokeEngine.isActive()) {
      holdState.underlineFrames = 0;
      holdState.underlineStartedAt = 0;
      holdState.underlineAimPoint = null;
    }
    const pinchHoldMs = holdState.underlineStartedAt
      ? Math.max(0, now - holdState.underlineStartedAt)
      : 0;
    const pinchConfirmMs = Math.max(
      thresholds.underlineConfirmMs || PINCH_CONFIRM_MS,
      pinchSwipeEligible ? thresholds.pinchSwipeDecisionMs || 105 : 0,
    );
    const confirmedPinchIntent =
      initialPinchIntent &&
      pinchHoldMs >= pinchConfirmMs;
    const previewPinchIntent =
      strokeToolEnabled &&
      !activeStrokeEngine.isActive() &&
      initialPinchIntent &&
      !confirmedPinchIntent;
    if (previewPinchIntent) {
      getPresentationApi()?.handleUnderlineGesture?.({
        phase: "preview",
        handPoint: point,
        confidence: underlineCandidateScore,
        thresholds,
        scores,
        context: scores.context,
        strokeMode,
        tool: currentTool,
        holdMs: pinchHoldMs,
        confirmMs: pinchConfirmMs,
        progress: Math.min(1, pinchHoldMs / Math.max(1, pinchConfirmMs)),
      });
      claim(`pinch_preview_${strokeMode}`);
      return { claimed, fired: false, command: "pinch_preview", claimReason };
    }
    if (!activeStrokeEngine.isActive()) {
      getPresentationApi()?.handleUnderlineGesture?.({ phase: "preview-end" });
    }
    const continuingPinchIntent =
      activeStrokeEngine.isActive() &&
      scores.rawUnderlinePinch &&
      scores.thumbIndexRatio <= thresholds.touchRatio;
    const rawPinchIntent =
      strokeToolEnabled &&
      (
        continuingPinchIntent ||
        (confirmedPinchIntent && holdState.underlineFrames >= REQUIRED_COMMAND_FRAMES)
      );
    const strokeResult = activeStrokeEngine.update({
      enabled: strokeToolEnabled,
      pinchIntent: rawPinchIntent,
      rawPinch: continuingPinchIntent || initialPinchIntent,
      thumbIndexRatio: scores.thumbIndexRatio,
      point,
      now,
      confidence: Math.max(exclusive.confidence || 0, scores.underline || 0, rawPinchIntent ? 0.5 : 0),
      thresholds,
      scores,
      context: scores.context,
      strokeMode,
      tool: currentTool,
    });

    if (strokeResult.claimed || anyStrokeEngineActive()) {
      claim(`pinch_stroke_${strokeMode}:${strokeResult.reason || strokeResult.phase}`);
      holdState.previousStartedAt = 0;
      holdState.previousLocked = false;
      holdState.clearStartedAt = 0;
      holdState.clearSeenAt = 0;
      holdState.clearLastUpdateAt = 0;
      holdState.clearAccumulatedMs = 0;
      holdState.clearLocked = false;
      holdState.underlineFrames = Math.max(holdState.underlineFrames, REQUIRED_COMMAND_FRAMES);
      swipeTracker.reset();
      pinchSwipeTracker.reset();
      commandFired = Boolean(strokeResult.fired) || commandFired;
      return { claimed, fired: commandFired, command: "pinch_stroke", claimReason };
    }

    if (!controlsActive) {
      return {
        claimed: false,
        fired: false,
        command: null,
        claimReason: gestureEnabled ? "gesture_control_disabled" : "gesture_disabled",
      };
    }

    const twoFingerSwipePose =
      scores.twoFingerSwipeGuard &&
      (scores.swipeShapeScore || 0) >= (thresholds.swipeMinShapeScore || 0.52);
    if (twoFingerSwipePose) {
      holdState.clearStartedAt = 0;
      holdState.clearSeenAt = 0;
      holdState.clearLastUpdateAt = 0;
      holdState.clearAccumulatedMs = 0;
      holdState.clearLocked = false;
      palmEraseTracker.reset();
    }
    const clearCandidate =
      !twoFingerSwipePose &&
      !scores.candidates?.clear_page?.blockedBy &&
      scores.rawOpenPalm &&
      scores.clear >= thresholds.minSensitiveConfidence;
    const clearContinuation =
      !twoFingerSwipePose &&
      holdState.clearStartedAt > 0 &&
      scores.rawOpenPalm &&
      scores.openFingerCount >= 3 &&
      scores.context.inFrameRatio >= 0.62 &&
      !scores.context.tooFarForCommands &&
      scores.clear >= Math.max(0.38, thresholds.minSensitiveConfidence - 0.22);
    const palmPoint = normalizedToPresentation(scores.context.palmCenter);
    const scrubResult = palmEraseTracker.update({
      point: palmPoint,
      openPalm: clearCandidate || clearContinuation,
      now,
      width,
      height,
    });
    if (clearCandidate || clearContinuation) {
      holdState.clearSeenAt = now;
    }
    const clearWithinGrace =
      !twoFingerSwipePose &&
      holdState.clearStartedAt > 0 &&
      now - holdState.clearSeenAt <= CLEAR_GESTURE_GRACE_MS;
    if (clearCandidate || clearWithinGrace) {
      claim("clear_hold");
      if (!holdState.clearStartedAt) {
        holdState.clearStartedAt = now;
        holdState.clearLastUpdateAt = now;
        holdState.clearAccumulatedMs = 0;
      }
      const frameDeltaMs = Math.min(80, Math.max(0, now - holdState.clearLastUpdateAt));
      holdState.clearLastUpdateAt = now;
      if (clearCandidate || clearContinuation) {
        holdState.clearAccumulatedMs += frameDeltaMs;
      }
      const holdMs = holdState.clearAccumulatedMs;
      if (!holdState.clearLocked && (scrubResult.fired || holdMs >= thresholds.clearHoldMs)) {
        commandFired = emitCommand("clear_page", {
          handPoint: palmPoint,
          confidence: scores.clear,
          thresholds,
          calibrationProfile,
          holdMs,
          eraseVariant: scrubResult.fired ? "palm_scrub" : "palm_hold",
          scrub: scrubResult,
        }, now) || commandFired;
        holdState.clearLocked = true;
        palmEraseTracker.reset();
      }
    } else {
      holdState.clearStartedAt = 0;
      holdState.clearSeenAt = 0;
      holdState.clearLastUpdateAt = 0;
      holdState.clearAccumulatedMs = 0;
      holdState.clearLocked = false;
      palmEraseTracker.reset();
    }

    const swipeShapeScore = scores.swipeShapeScore || 0;
    const swipeEligible =
      !scores.candidates?.next_page?.blockedBy &&
      swipeShapeScore >= (thresholds.swipeMinShapeScore || 0.52);
    if (!claimed && swipeEligible) {
      const swipePoint = scores.swipePoint || point;
      const swipeResult = swipeTracker.update({
        point: swipePoint,
        shapeScore: swipeShapeScore,
        now,
        width,
        height,
        minDistancePx: thresholds.swipeMinDistance,
        maxVerticalDriftPx: thresholds.swipeMaxVerticalDrift,
        minShapeScore: thresholds.swipeMinShapeScore,
        minFinalScore: thresholds.swipeMinFinalScore,
        maxDurationMs: thresholds.swipeMaxDurationMs,
      });
      claim(swipeResult.fired ? "next_swipe_fired" : "next_swipe_tracking");
      if (swipeResult.fired && now - holdState.nextLastAt >= NEXT_REPEAT_MS) {
        if (emitCommand("next_page", {
          handPoint: point,
          confidence: swipeResult.finalScore,
          thresholds,
          calibrationProfile,
          ...swipeResult,
          repeatIntervalMs: NEXT_REPEAT_MS,
        }, now)) {
          commandFired = true;
          holdState.nextLastAt = now;
        }
      }
    } else if (!claimed) {
      swipeTracker.reset();
    }

    const previousCandidate =
      (exclusive.command === "previous_page" || scores.rawThumbOnly) &&
      !scores.nearSidePinchIntent &&
      scores.previous >= 0.28;
    if (previousCandidate) {
      holdState.previousSeenAt = now;
    }
    const previousWithinGrace =
      holdState.previousStartedAt > 0 &&
      now - holdState.previousSeenAt <= PREVIOUS_GESTURE_GRACE_MS;
    if (!claimed && (previousCandidate || previousWithinGrace)) {
      claim("previous_hold");
      if (!holdState.previousStartedAt) holdState.previousStartedAt = now;
      const holdMs = now - holdState.previousStartedAt;
      if (holdMs >= thresholds.previousHoldMs && canRunCommand("previous_page", now, PREVIOUS_REPEAT_MS)) {
        commandFired = emitCommand("previous_page", {
          handPoint: point,
          confidence: scores.previous,
          thresholds,
          calibrationProfile,
          holdMs,
        }, now) || commandFired;
        holdState.previousLocked = true;
        holdState.previousLastAt = now;
      }
    } else if (!claimed) {
      holdState.previousStartedAt = 0;
      holdState.previousSeenAt = 0;
      holdState.previousLocked = false;
    }

    return { claimed, fired: commandFired, command: claimed ? "gesture_command" : null, claimReason };
  }

  function publishDiagnostics(detail) {
    window.dispatchEvent(new CustomEvent("airnote:gesture-diagnostics", { detail }));
  }

  function processHand(hand, now, handConfidence = 1, handMeta = {}) {
    const { context, thresholds, scores, exclusive } =
      gestureEngine.evaluate(hand, now, handConfidence);
    scores.swipePoint = normalizedToPresentation({
      x: (hand[8].x + hand[12].x) / 2,
      y: (hand[8].y + hand[12].y) / 2,
    });
    scores.pinchSwipePoint = normalizedToPresentation({
      x: (hand[4].x + hand[8].x) / 2,
      y: (hand[4].y + hand[8].y) / 2,
    });
    collectCalibrationSample(hand, context, scores, handConfidence);
    finishCalibrationIfNeeded(now);

    const point = normalizedToPresentation(getSmoothedPoint(hand[8], context));
    const commandState = handleCommands(exclusive, scores, thresholds, point, now);
    if (commandState.claimReason?.startsWith("pinch_preview")) {
      updatePointerState(false);
      setStatus("판서 위치 미리보기");
      return;
    }
    const controlsActive = gestureEnabled && gestureControlEnabled;
    const pointerAllowed =
      controlsActive &&
      !commandState.claimed &&
      thresholds.pointerAllowed &&
      !scores.candidates?.pointer?.blockedBy &&
      scores.pointer >= 0.48;
    const pointerOn = commandState.claimed ? false : updatePointerState(pointerAllowed);

    if (commandState.claimed) {
      updatePointerState(false);
      getPresentationApi()?.updateGestureSession?.(null, false);
      if (commandState.claimReason === "clear_hold") {
        const clearProgress = Math.min(
          100,
          Math.round((holdState.clearAccumulatedMs / Math.max(1, thresholds.clearHoldMs)) * 100),
        );
        setStatus(commandState.fired
          ? "지우기 완료"
          : `지우개 준비 ${clearProgress}% · 손바닥을 유지하거나 좌우로 움직이세요`);
      } else {
        setStatus(commandState.claimReason?.startsWith("pinch_stroke")
          ? "판서 제스처 실행 중"
          : "제스처 명령 실행 중");
      }
    } else if (pointerOn) {
      const result = getPresentationApi()?.updateGestureSession?.(point, true);
      setStatus(result?.anchored ? "STT 기준 제스처 실행 중" : "손 좌표 제스처 실행 중");
    } else if (!gestureControlEnabled && gestureEnabled) {
      getPresentationApi()?.updateGestureSession?.(null, false);
      setStatus("원격조정 모드 OFF");
    } else {
      getPresentationApi()?.updateGestureSession?.(null, false);
      setStatus("손 인식 중");
    }

    if (now - lastPointerDiagnosticAt >= 100) {
      lastPointerDiagnosticAt = now;
      publishDiagnostics({
        command: exclusive.command || (pointerOn ? "pointer" : "none"),
        phase: commandState.fired ? "fired" : pointerOn ? "move" : commandState.claimed ? "claimed" : "idle",
        handPoint: point,
        confidence: exclusive.command ? exclusive.confidence : scores.pointer,
        blockedReason: commandState.claimed ? commandState.claimReason : exclusive.blockedReason,
        pointerBlocked: Boolean(commandState.claimed),
        commandState,
        thresholds,
        scores,
        context,
        calibrationProfile,
        handSelection: {
          selectedLabel: handMeta.label || "",
          targetLabel: handMeta.targetHandLabel || getPointerTargetHandLabel(),
          targetMatched: handMeta.targetMatched !== false,
          micHand: handSettings.micHand,
          reverse: handSettings.reverse,
        },
        gestureControl: {
          enabled: gestureControlEnabled,
          modeToggleHoldMs: modeToggleStartedAt ? Math.max(0, now - modeToggleStartedAt) : 0,
          modeToggleLocked,
        },
        selectedTool: getCurrentMode(),
        stroke: {
          active: anyStrokeEngineActive(),
          inGrace: getActiveStrokeEngine().getState().inGrace,
          lastPhase: lastStrokePhase,
          lastSeenAgeMs: underlineLastSeenAt ? Math.max(0, now - underlineLastSeenAt) : null,
        },
      });
    }
  }

  function detectHands() {
    if (animationFrameId) return;
    const loop = () => {
      animationFrameId = window.requestAnimationFrame(loop);
      if (!hasLiveVideoStream(activeStream)) {
        handleStreamLost("웹캠 스트림이 종료되었습니다 · 다시 연결하세요");
        return;
      }
      if (!handLandmarker || !video || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;
      const now = performance.now();
      let result;
      try {
        result = handLandmarker.detectForVideo(video, now);
      } catch (error) {
        console.warn("handPointer: hand detection failed.", error);
        return;
      }
      const targetHand = getTargetHand(result);
      if (!targetHand) {
        const missingMs = lastHandSeenAt ? now - lastHandSeenAt : LOST_END_MS;
        setStatus("손 없음");
        if (calibrationState.active) {
          calibrationState.rejections.noHand += 1;
          publishCalibrationState("collecting");
        }
        if (anyStrokeEngineActive() && missingMs < LOST_END_MS) {
          getActiveStrokeEngine().markLost(now, { reason: "hand_lost", gapMs: missingMs });
        }
        if (missingMs >= LOST_GRACE_MS) {
          getPresentationApi()?.updateGestureSession?.(null, false);
        }
        if (missingMs >= LOST_END_MS) resetGestureState();
        finishCalibrationIfNeeded(now);
        return;
      }
      lastHandSeenAt = now;
      processHand(targetHand.landmarks, now, targetHand.confidence, targetHand);
    };
    animationFrameId = window.requestAnimationFrame(loop);
  }

  async function bootHandPointer() {
    if (!video || !annotationCanvas) {
      console.warn("handPointer: required elements are missing.");
      return;
    }
    if (!(await initMediaPipe())) return;
    publishCalibrationState(calibrationProfile ? "complete" : "required");
  }

  bindHandSettingsUi();
  bootHandPointer();

  window.AirNoteHandPointer = {
    initMediaPipe,
    initWebcam,
    stopWebcam: () => {
      activeStreamToken += 1;
      stopDetectionLoop();
      detachVideoStream();
      activeStream = null;
      resetGestureState();
      setStatus("웹캠 중지");
      publishConnectionState({ connected: false, label: "OFF", percent: 0, color: "red", reason: "웹캠 중지" });
    },
    detectHands,
    startCalibration,
    resetCalibration,
    getCalibrationProfile: () => calibrationProfile,
    setGestureEnabled: (enabled) => {
      gestureEnabled = Boolean(enabled);
      if (gestureEnabled) {
        gestureControlEnabled = true;
      } else {
        resetGestureState();
      }
      resetModeToggleState();
      setStatus(gestureEnabled ? "제스처 인식 ON" : "제스처 인식 OFF");
    },
    setGestureControlEnabled: (enabled) => {
      gestureControlEnabled = Boolean(enabled);
      resetGestureState();
      resetModeToggleState();
      setStatus(gestureControlEnabled ? "원격조정 모드 ON" : "원격조정 모드 OFF");
    },
    getGestureControlEnabled: () => gestureControlEnabled,
    getConnectionState: () => connectionState,
    getHandSettings: () => ({
      ...handSettings,
      targetHand: getPointerTargetHandLabel(),
    }),
    getHandLabel,
    getTargetHand,
    normalizedToPresentation,
  };
  window.dispatchEvent(new CustomEvent("airnote:handpointer-ready"));
  window.addEventListener("pagehide", () => {
    window.AirNoteHandPointer?.stopWebcam?.();
  }, { once: true });
});
