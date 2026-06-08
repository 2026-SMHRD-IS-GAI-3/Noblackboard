document.addEventListener("DOMContentLoaded", () => {
  const video = document.getElementById("webcamVideo");
  const handStatusText = document.getElementById("handStatusText");
  const annotationCanvas = document.getElementById("annotationCanvas");
  const cameraView = video?.closest(".camera-view");

  let HandLandmarker = null;
  let FilesetResolver = null;
  let handLandmarker = null;
  let animationFrameId = null;
  let lastVideoTime = -1;
  let pointerActive = false;
  let extendedFrameCount = 0;
  let foldedFrameCount = 0;
  let smoothedPoint = null;
  let lostHandFrames = 0;
  let lastThumbPrevAt = 0;
  let pinchStartPoint = null;
  let palmOpenStartedAt = null;
  let clearGestureLocked = false;

  const MEDIAPIPE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
  const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
  const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
  const POINTER_ON_FRAMES = 3;
  const POINTER_OFF_FRAMES = 3;
  const REQUIRED_LOST_FRAMES = 8;
  const ANGLE_THRESHOLD = 135;
  const DISTANCE_RATIO_PIP = 1.08;
  const DISTANCE_RATIO_DIP = 1.02;
  const SMOOTHING = 0.72;

  function setStatus(message) {
    if (handStatusText) handStatusText.textContent = message;
  }

  function getPresentationApi() {
    return window.AirNotePresentation || null;
  }

  function getCurrentMode() {
    return getPresentationApi()?.getState?.().currentMode || "pointer";
  }

  async function loadMediaPipeModule() {
    if (HandLandmarker && FilesetResolver) return true;

    try {
      const vision = await import(MEDIAPIPE_URL);
      HandLandmarker = vision.HandLandmarker;
      FilesetResolver = vision.FilesetResolver;
      return true;
    } catch (error) {
      console.error("MediaPipe CDN import failed.", error);
      setStatus("MediaPipe \uB85C\uB529 \uC2E4\uD328");
      return false;
    }
  }

  async function createHandLandmarker(delegate) {
    const filesetResolver = await FilesetResolver.forVisionTasks(WASM_URL);
    return HandLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate,
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
  }

  async function initMediaPipe() {
    setStatus("MediaPipe \uB85C\uB529 \uC911...");

    const moduleReady = await loadMediaPipeModule();
    if (!moduleReady) return false;

    try {
      handLandmarker = await createHandLandmarker("GPU");
    } catch (gpuError) {
      console.warn("MediaPipe GPU init failed. Retrying with CPU.", gpuError);
      try {
        handLandmarker = await createHandLandmarker("CPU");
      } catch (cpuError) {
        console.error("MediaPipe CPU init failed.", cpuError);
        setStatus("MediaPipe \uB85C\uB529 \uC2E4\uD328");
        return false;
      }
    }

    return true;
  }

  async function initWebcam() {
    if (!video) {
      console.warn("handPointer: #webcamVideo element is missing.");
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("\uCE74\uBA54\uB77C \uAD8C\uD55C\uC744 \uD5C8\uC6A9\uD574\uC8FC\uC138\uC694.");
      return false;
    }

    setStatus("\uCE74\uBA54\uB77C \uC5F0\uACB0 \uC911...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = stream;
      cameraView?.classList.add("has-video");
      await video.play().catch(() => undefined);
      setStatus("\uC190 \uC778\uC2DD \uB300\uAE30 \uC911");
      return true;
    } catch (error) {
      console.warn("handPointer: webcam init failed.", error);
      setStatus("\uCE74\uBA54\uB77C \uAD8C\uD55C\uC744 \uD5C8\uC6A9\uD574\uC8FC\uC138\uC694.");
      return false;
    }
  }

  function getHandLabel(result, index) {
    return result?.handednesses?.[index]?.[0]?.categoryName || "Unknown";
  }

  function getTargetHand(result) {
    if (!result?.landmarks?.length) return null;
    const preferredIndex = result.landmarks.findIndex((_, index) => getHandLabel(result, index) === "Right");
    const index = preferredIndex >= 0 ? preferredIndex : 0;
    return { landmarks: result.landmarks[index], label: getHandLabel(result, index) };
  }

  function getDistance3D(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  function getAngle3D(a, b, c) {
    const ab = {
      x: a.x - b.x,
      y: a.y - b.y,
      z: (a.z || 0) - (b.z || 0),
    };
    const cb = {
      x: c.x - b.x,
      y: c.y - b.y,
      z: (c.z || 0) - (b.z || 0),
    };
    const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
    const abLength = Math.sqrt(ab.x * ab.x + ab.y * ab.y + ab.z * ab.z);
    const cbLength = Math.sqrt(cb.x * cb.x + cb.y * cb.y + cb.z * cb.z);
    if (abLength === 0 || cbLength === 0) return 0;
    const cosine = Math.max(-1, Math.min(1, dot / (abLength * cbLength)));
    return Math.acos(cosine) * (180 / Math.PI);
  }

  function isIndexFingerExtended(landmarks) {
    if (!landmarks?.[0] || !landmarks?.[5] || !landmarks?.[6] || !landmarks?.[7] || !landmarks?.[8]) {
      return false;
    }

    const wrist = landmarks[0];
    const indexMCP = landmarks[5];
    const indexPIP = landmarks[6];
    const indexDIP = landmarks[7];
    const indexTIP = landmarks[8];

    const anglePIP = getAngle3D(indexMCP, indexPIP, indexDIP);
    const angleDIP = getAngle3D(indexPIP, indexDIP, indexTIP);
    const wristToPIP = getDistance3D(wrist, indexPIP);
    const wristToDIP = getDistance3D(wrist, indexDIP);
    const wristToTIP = getDistance3D(wrist, indexTIP);

    const angleCondition = anglePIP > ANGLE_THRESHOLD && angleDIP > ANGLE_THRESHOLD;
    const distanceCondition =
      wristToTIP > wristToPIP * DISTANCE_RATIO_PIP &&
      wristToTIP > wristToDIP * DISTANCE_RATIO_DIP;

    return angleCondition && distanceCondition;
  }

  function isThumbOnlyExtended(landmarks) {
    if (!landmarks?.[4] || !landmarks?.[3]) return false;
    const thumbExtended = Math.abs(landmarks[4].x - landmarks[3].x) > 0.055;
    const indexExtended = isIndexFingerExtended(landmarks);
    const middleExtended = landmarks[12]?.y < landmarks[10]?.y - 0.025;
    const ringExtended = landmarks[16]?.y < landmarks[14]?.y - 0.025;
    const pinkyExtended = landmarks[20]?.y < landmarks[18]?.y - 0.025;
    return thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended;
  }

  function isPalmOpen(landmarks) {
    if (!landmarks) return false;
    return [8, 12, 16, 20].every((tipIndex) => landmarks[tipIndex]?.y < landmarks[tipIndex - 2]?.y - 0.02);
  }

  function isIndexMiddlePinched(landmarks) {
    if (!landmarks?.[8] || !landmarks?.[12]) return false;
    const dx = landmarks[8].x - landmarks[12].x;
    const dy = landmarks[8].y - landmarks[12].y;
    return Math.hypot(dx, dy) < 0.055;
  }

  function updateIndexGestureState(isExtended) {
    if (isExtended) {
      extendedFrameCount += 1;
      foldedFrameCount = 0;
    } else {
      foldedFrameCount += 1;
      extendedFrameCount = 0;
    }

    if (!pointerActive && extendedFrameCount >= POINTER_ON_FRAMES) pointerActive = true;
    if (pointerActive && foldedFrameCount >= POINTER_OFF_FRAMES) pointerActive = false;

    return pointerActive;
  }

  function getSmoothedPoint(point) {
    if (!smoothedPoint) {
      smoothedPoint = { ...point };
      return smoothedPoint;
    }

    smoothedPoint = {
      x: smoothedPoint.x * SMOOTHING + point.x * (1 - SMOOTHING),
      y: smoothedPoint.y * SMOOTHING + point.y * (1 - SMOOTHING),
    };

    return smoothedPoint;
  }

  function normalizedToScreen(point) {
    if (!annotationCanvas) return { x: 0, y: 0 };
    return {
      x: (1 - point.x) * annotationCanvas.width,
      y: point.y * annotationCanvas.height,
    };
  }

  function resetPointer() {
    pointerActive = false;
    extendedFrameCount = 0;
    foldedFrameCount = 0;
    smoothedPoint = null;
    getPresentationApi()?.updatePointerFromHand?.(0, 0, false);
    getPresentationApi()?.stopDrawing?.();
  }

  function handleOptionalGestures(landmarks, point) {
    const api = getPresentationApi();
    if (!api) return;

    const now = performance.now();

    if (isThumbOnlyExtended(landmarks) && now - lastThumbPrevAt > 1400) {
      api.prevPage?.();
      lastThumbPrevAt = now;
    }

    if (isIndexMiddlePinched(landmarks)) {
      if (!pinchStartPoint) pinchStartPoint = { ...point };
      if (point.x - pinchStartPoint.x > 0.18) {
        api.nextPage?.();
        pinchStartPoint = null;
      }
    } else {
      pinchStartPoint = null;
    }

    if (isPalmOpen(landmarks)) {
      if (!palmOpenStartedAt) palmOpenStartedAt = now;
      if (!clearGestureLocked && now - palmOpenStartedAt >= 1000) {
        api.clearCanvas?.();
        clearGestureLocked = true;
      }
    } else {
      palmOpenStartedAt = null;
      clearGestureLocked = false;
    }
  }

  function handleActivePointer(x, y) {
    const api = getPresentationApi();
    if (!api) return;

    const mode = getCurrentMode();
    api.updatePointerFromHand?.(x, y, true);

    if (mode === "pointer") {
      setStatus("\uAC80\uC9C0 \uD3EC\uC778\uD130 ON");
      api.stopDrawing?.();
      return;
    }

    if (mode === "pen" || mode === "highlight") {
      setStatus("\uC190 \uC778\uC2DD \uC911");
      api.drawAt?.(x, y);
    }
  }

  function detectHands() {
    if (animationFrameId) return;

    const loop = () => {
      animationFrameId = window.requestAnimationFrame(loop);

      if (!handLandmarker || !video || video.readyState < 2) return;
      if (video.currentTime === lastVideoTime) return;

      lastVideoTime = video.currentTime;

      let result;
      try {
        result = handLandmarker.detectForVideo(video, performance.now());
      } catch (error) {
        console.warn("handPointer: hand detection failed.", error);
        return;
      }

      const targetHand = getTargetHand(result);
      if (!targetHand) {
        lostHandFrames += 1;
        setStatus("\uC190 \uC5C6\uC74C");
        if (lostHandFrames >= REQUIRED_LOST_FRAMES) resetPointer();
        return;
      }

      lostHandFrames = 0;

      const landmarks = targetHand.landmarks;
      const isActive = updateIndexGestureState(isIndexFingerExtended(landmarks));
      handleOptionalGestures(landmarks, landmarks[8]);

      if (!isActive) {
        setStatus("\uC190 \uC778\uC2DD \uC911");
        getPresentationApi()?.updatePointerFromHand?.(0, 0, false);
        getPresentationApi()?.stopDrawing?.();
        return;
      }

      const smoothed = getSmoothedPoint(landmarks[8]);
      const screenPoint = normalizedToScreen(smoothed);
      handleActivePointer(screenPoint.x, screenPoint.y);
    };

    animationFrameId = window.requestAnimationFrame(loop);
  }

  async function bootHandPointer() {
    if (!video || !annotationCanvas) {
      console.warn("handPointer: required elements are missing.");
      return;
    }

    const mediaPipeReady = await initMediaPipe();
    if (!mediaPipeReady) return;

    const webcamReady = await initWebcam();
    if (!webcamReady) return;

    detectHands();
  }

  bootHandPointer();

  window.AirNoteHandPointer = {
    initMediaPipe,
    initWebcam,
    detectHands,
    isIndexFingerExtended,
    updateIndexGestureState,
    getSmoothedPoint,
    normalizedToScreen,
    getHandLabel,
    getTargetHand,
  };
});