// =============================================================================
// presentation.js ??AirNote 諛쒗몴 ?섏씠吏 ?ㅼ??ㅽ듃?덉씠??
//
// ?뱀뀡 援ъ꽦 (Ctrl+F 濡?寃??:
//   SECTION: STATE         ??怨듭쑀 ?곹깭 蹂??
//   SECTION: TIMER         ????대㉧ / 吏꾪뻾瑜?(?쒖닔 濡쒖쭅: timerUtils.js 李몄“)
//   SECTION: FULLSCREEN    ???꾩껜?붾㈃ ?⑤꼸 UI
//   SECTION: BACKEND       ??諛깆뿏??API ?몄텧 / annotation ??
//   SECTION: SESSION       ??諛쒗몴 ?몄뀡 ?쒖옉/醫낅즺
//   SECTION: PERMISSIONS   ???뱀틺/留덉씠??沅뚰븳
//   SECTION: CALIBRATION   ??罹섎━釉뚮젅?댁뀡
//   SECTION: CANVAS        ??罹붾쾭??由ъ궗?댁쫰 / ?먯꽌 ?곹깭
//   SECTION: SUMMARY       ??由ы뿀??蹂닿퀬??/ ?붿빟 紐⑤떖
//   SECTION: STT           ???뚯꽦 ?몄떇 / STT ?붾쾭洹?
//   SECTION: GESTURE       ???쒖뒪泥?洹몃━湲?/ 諛묒쨪
//   SECTION: PDF           ??PDF ?뚮뜑留?/ ?뚯씪 ?좏깮
//   SECTION: ANCHORS       ???띿뒪???듭빱 異붿텧 / ?ㅼ퐫?대쭅
//   SECTION: INIT          ???대깽??諛붿씤??/ 遺?몄뒪?몃옪
// =============================================================================
(() => {
  function initAirNotePresentation() {
  const {
    getStraightenedStroke,
    smoothStrokePoint,
  } = window.AirNoteModules;
  const PDFJS_VERSION = "3.11.174";
  const PDF_DB_NAME = "airnote-local-pdfs";
  const PDF_STORE_NAME = "pdfs";
  const CURRENT_PDF_KEY = "airnote.currentPdfKey";
  const CURRENT_MOCK_PDF_KEY = "airnote.currentMockPdf";
  const CURRENT_PDF_ID_KEY = "airnote.currentPdfId";
  const CURRENT_PRESENTATION_ID_KEY = "airnote.currentPresentationId";
  const PRESENTATION_RECORDS_KEY = "airnote.presentationRecords";
  const SPEECH_ANCHOR_TTL_MS = 3500;        // 음성 앵커 유효시간(과거 8초 → 3.5초로 단축)
  const ANCHOR_TRANSITION_MS = 220;         // 앵커 점프 시 부드러운 전환 시간
  const GESTURE_MOVEMENT_GAIN = 1.8;  // 앵커 포인터의 손 변위 증폭
  const STROKE_MOVEMENT_GAIN = 1.2;   // 앵커 판서(밑줄/형광)의 손 변위 증폭
  const POINTER_MOVEMENT_MIN_GAIN = 1.8;
  const POINTER_MOVEMENT_MAX_GAIN = 1.8;
  const MAX_PHRASE_LENGTH = 6;
  // STT 매칭 임계값 단일 진실 공급원(SSOT). 모든 곳에서 이 두 상수만 사용한다.
  const STT_CONFIDENCE_THRESHOLD = 0.55; // 앵커 채택 최소 점수
  const STT_AMBIGUITY_GAP = 0.05;        // 1·2위 점수 차이 최소값
  // 하위 호환 별칭(selectActiveTextAnchor 메인 분기는 이 이름을 그대로 사용 → 값 동일하므로 동작 불변)
  const STT_SCORE_THRESHOLD = STT_CONFIDENCE_THRESHOLD;
  const STT_ANCHOR_BOX_TTL_MS = 3000;
  const ANALYTICS_DB_NAME = "airnote-analytics";
  const ANALYTICS_DB_VERSION = 1;
  const DEFAULT_HIGHLIGHT_WIDTH = 18;
  const DRAWING_COLOR = "#e11d48";
  const STROKE_START_STABILIZE_MS = 140;
  const STROKE_START_SAMPLE_LIMIT = 4;
  const STROKE_START_LINE_SNAP_RATIO = 0.035;
  const RECENT_STROKE_DELETE_MS = 3000;
  const STROKE_DELETE_HIT_RADIUS_PX = 50;
  const STROKE_DELETE_HOLD_MS = 800;
  const debugParams = new URLSearchParams(location.search);
  const isTruthyDebugParam = (name) => {
    if (!debugParams.has(name)) return false;
    const value = String(debugParams.get(name) || "1").trim().toLowerCase();
    return !["0", "false", "off", "no"].includes(value);
  };
  const isDebugMode = isTruthyDebugParam("debug") || isTruthyDebugParam("sttDebug");
  const DEBUG_MODE = isDebugMode;
  const normalizeLocalSttEndpoint = (endpoint) => String(endpoint || "").replace(/\/stt\/?$/, "").replace(/\/+$/, "");
  const savedLocalSttEndpoint = normalizeLocalSttEndpoint(localStorage.getItem("airnote.localSttEndpoint"));
  const AIRNOTE_STT_ENDPOINT = savedLocalSttEndpoint || "http://127.0.0.1:8000";
  const LOCAL_STT_ENDPOINTS = [
    savedLocalSttEndpoint,
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:5000",
    "http://localhost:5000",
  ].map(normalizeLocalSttEndpoint).filter(Boolean)
    .filter((endpoint, index, list) => list.indexOf(endpoint) === index);
  const STT_DEBUG_STORAGE_KEY = "airnote.sttDebugEnabled";
  const AIR_DEBUG_PANEL_POSITION_KEY = "airnote.debugPanelPosition";
  const STT_DEVICE_STORAGE_KEY = "airnote.sttAudioDeviceId";
  const STT_DEBUG_QUERY_ENABLED = isTruthyDebugParam("sttDebug");
  const STOP_WORDS = new Set([
    "은", "는", "이", "가", "을", "를", "의", "에", "에서", "으로", "로",
    "와", "과", "도", "만", "부터", "까지", "그리고", "하지만", "그래서",
    "합니다", "입니다", "있습니다", "하는", "그", "이것",
  ]);

  const slideArt = document.getElementById("slideArt") || document.querySelector(".slide-art");
  const pdfCanvas = document.getElementById("pdfCanvas");
  const drawCanvas = document.getElementById("drawCanvas") || document.getElementById("annotationCanvas");
  const anchorMatchOverlay = document.getElementById("anchorMatchOverlay");
  const laserPointer = document.getElementById("laserPointer");
  const pdfCtx = pdfCanvas ? pdfCanvas.getContext("2d") : null;
  const drawCtx = drawCanvas ? drawCanvas.getContext("2d") : null;

  const pdfUploadInput = document.getElementById("pdfUploadInput");
  const pdfLibraryOpenBtn = document.getElementById("pdfLibraryOpenBtn");
  const pdfSelectModal = document.getElementById("pdfSelectModal");
  const pdfModalCloseBtn = document.getElementById("pdfModalCloseBtn");
  const modalPdfList = document.getElementById("modalPdfList");
  const selectedPdfLabel = document.getElementById("selectedPdfLabel");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const calibrationGuideModal = document.getElementById("calibrationGuideModal");
  const calibrationGuideCheck = document.getElementById("calibrationGuideCheck");
  const calibrationGuideConfirmBtn = document.getElementById("calibrationGuideConfirmBtn");
  const permissionRequestBtn = document.getElementById("permissionRequestBtn");
  const permissionStatusText = document.getElementById("permissionStatusText");
  const calibrationModal = document.getElementById("calibrationModal");
  const calibrationConfirmBtn = document.getElementById("calibrationConfirmBtn");
  const calibrationCloseBtn = document.getElementById("calibrationCloseBtn");
  const calibrationVideo = document.getElementById("calibrationVideo");
  const calibrationCameraPlaceholder = document.getElementById("calibrationCameraPlaceholder");
  const calibrationModalBadge = document.getElementById("calibrationModalBadge");
  const calibrationPhaseTitle = document.getElementById("calibrationPhaseTitle");
  const calibrationPhaseGuide = document.getElementById("calibrationPhaseGuide");
  const calibrationProgressBar = document.getElementById("calibrationProgressBar");
  const calibrationStepper = document.getElementById("calibrationStepper");
  const calibrationSampleText = document.getElementById("calibrationSampleText");
  const calibrationErrorText = document.getElementById("calibrationErrorText");
  const calibrationBadge = document.getElementById("calibrationBadge");
  const calibrationStatusText = document.getElementById("calibrationStatusText");
  const calibrationStartBtn = document.getElementById("calibrationStartBtn");
  const calibrationResetBtn = document.getElementById("calibrationResetBtn");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const pageIndicator = document.getElementById("pageIndicator");
  const presentationToggleBtn = document.getElementById("presentationToggleBtn");
  const timerText = document.getElementById("timerText");
  const currentModeText = document.getElementById("currentModeText");
  const fullscreenClearCanvasBtn = document.getElementById("fullscreenClearCanvasBtn");
  const toast = document.getElementById("toast");
  const modeButtons = document.querySelectorAll("[data-mode]");
  const expectedTimeSelect = document.getElementById("expectedTimeSelect");
  const progressText = document.getElementById("progressText");
  const presentationProgressBar = document.getElementById("presentationProgressBar");
  const fullscreenPageIndicator = document.getElementById("fullscreenPageIndicator");
  const fullscreenProgressText = document.getElementById("fullscreenProgressText");
  const fullscreenProgressBar = document.getElementById("fullscreenProgressBar");
  const fullscreenTimerText = document.getElementById("fullscreenTimerText");
  const fullscreenExpectedTimeText = document.getElementById("fullscreenExpectedTimeText");
  const fullscreenEndBtn = document.getElementById("fullscreenEndBtn");
  const fullscreenPanelToggleBtn = document.getElementById("fullscreenPanelToggleBtn");
  const fullscreenPanelLockBtn = document.getElementById("fullscreenPanelLockBtn");
  const fullscreenPresenterUi = document.querySelector(".fullscreen-presenter-ui");
  const presentationSummaryModal = document.getElementById("presentationSummaryModal");
  const presentationSummaryList = document.getElementById("presentationSummaryList");
  const summaryConfirmBtn = document.getElementById("summaryConfirmBtn");
  const underlineModeInputs = document.querySelectorAll('input[name="underlineMode"]');
  const underlineModeSelector = document.getElementById("underlineModeSelector");
  // 우측 패널의 레거시 "STT 디버그" 카드는 제거되었다. 인식 단어 박스는 슬라이드
  // 오버레이(showSttAnchorBox/showAnchorMatchBox)로, 상세 정보는 우하단 플로팅
  // 디버그 패널(air-debug-panel)로 확인한다.

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      window.AIRNOTE_PDFJS_WORKER_SRC ||
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
  } else {
    console.warn("AirNote presentation: PDF.js was not loaded. PDF upload will be disabled.");
  }

  let isRunning = false;
  let timerId = null;
  let elapsedSeconds = 0;
  let presentationStartedAt = null;
  let pdfDoc = null;
  let currentPage = 1;
  let totalPage = 1;
  let currentPdfFileName = "";
  let currentPdfId = sessionStorage.getItem(CURRENT_PDF_ID_KEY) || localStorage.getItem(CURRENT_PDF_ID_KEY) || "";
  let currentPresentationId = sessionStorage.getItem(CURRENT_PRESENTATION_ID_KEY) || "";
  let renderTask = null;
  let renderSequence = 0;
  let currentMode = "pen";
  let isDrawing = false;
  let lastPoint = null;
  let toastTimerId = null;
  let expectedMinutes = Number(expectedTimeSelect?.value || 20);
  let pdfTextAnchors = new Map();
  let pdfRawTextItems = new Map();
  let textAnchorSource = "none";
  let textAnchorLoadError = "";
  let activeTextAnchor = null;
  let pendingSpeechAnchorKey = "";
  let pendingSpeechAnchorCount = 0;
  let speechRecognition = null;
  let speechStarted = false;
  let gestureSession = null;
  let lastSelectedAnchorOrder = -1;
  let latestMatchDiagnostics = null;
  let latestSttStatus = { provider: "none", status: "idle" };
  let latestSttError = "";
  let latestSttActivity = "";
  let latestSttLevelDb = null;
  let latestSttOutputLevelDb = null;
  let latestSttGain = 1;
  let latestSttDeviceLabel = "";
  let selectedSttDeviceId = localStorage.getItem(STT_DEVICE_STORAGE_KEY) || "";
  let sttDebugEnabled = false;
  let latestSttRequestAt = "";
  let latestSttResponseAt = "";
  let latestRecognizedSpeech = null;
  let latestGestureDiagnostics = null;
  let latestCalibrationState = null;
  let lastSavedCalibrationKey = "";
  let guidedCalibrationToken = 0;        // 가이드 진행 취소/무효화 토큰
  let guidedCalibrationActive = false;   // 5단계 가이드 진행 중 여부
  const CALIBRATION_PHASE_MS = 3000;     // handPointer CALIBRATION_DURATION_MS와 동기화(진행률 표시용)
  let latestBackendError = null;
  let currentHighlightWidth = DEFAULT_HIGHLIGHT_WIDTH;
  let debugPanel = null;
  let debugToggleBtn = null;
  let airDebugAdvancedOpen = false;
  let airDebugDragging = null;
  let debugHealthTimerId = null;
  let backendHealthState = { ok: null, status: null, message: "-", payload: null, error: "" };
  let sttHealthState = { ok: null, status: null, message: "-", payload: null, error: "" };
  let sttAnchorOverlay = null;
  let sttAnchorClearTimer = null;
  // 디버그: 채택된 매칭 박스를 TTL 동안 화면에 유지하기 위한 타이머. 활성 동안에는
  // 제스처 소비·무음 청크 등의 일상적 clearAnchorMatchBox()가 박스를 지우지 않는다.
  let sttMatchBoxTimer = null;
  // 현재 화면에 떠 있는 매칭 박스의 앵커. 전체화면/리사이즈로 오버레이 크기가 바뀌면
  // 이 앵커로 박스를 현재 좌표계에 다시 그린다(옛 좌표로 남는 문제 방지).
  let lastMatchBoxAnchor = null;
  let underlineMode = document.querySelector('input[name="underlineMode"]:checked')?.value || "freewriting";
  let permissionStream = null;
  let permissionState = { webcam: false, microphone: false };
  let permissionRequestPromise = null;
  let initialPermissionRequestDone = false;
  let presentationSession = null;
  let underlineGesture = null;
  let activeStrokeSnapshot = null;
  let lastStrokePreviewAt = 0;
  const STROKE_PREVIEW_INTERVAL_MS = 33;
  let lastRecordedPointerAt = 0;
  let lastRecordedGestureAt = 0;
  let lastDebugPanelRenderAt = 0;           // 디버그 패널 재구성 스로틀(매 프레임 호출 방지)
  let lastRenderedPointerRatio = null;      // 직전 프레임 포인터 위치(부드러운 앵커 전환 기준점)
  let lastRecordedGestureKey = "";
  let lastPageChangedAt = 0;
  const PAGE_CHANGE_STT_GRACE_MS = 600;
  let overlayLayoutApplied = false;
  let activePresentationMode = null;
  let sessionStopPending = false;
  let panelPinned = false;
  let panelAutoMinimizeTimer = null;
  let pageEnteredAt = 0;
  let pageMoveCount = 0;
  const pageDurationsMs = new Map();
  const pageGestureCounts = new Map();
  const countableGestureCommands = new Set(["clear_page", "next_page", "previous_page"]);
  let strokeSequence = 0;
  const strokeScenesByPage = new Map();
  const strokeDeletionTracker = window.AirNoteModules.createRecentStrokeDeletionTracker({
    recentMs: RECENT_STROKE_DELETE_MS,
    hitRadiusPx: STROKE_DELETE_HIT_RADIUS_PX,
    holdMs: STROKE_DELETE_HOLD_MS,
  });
  const presentationStore = window.AirNoteModules.createPresentationStore({
    permission: { webcam: "unknown", microphone: "unknown" },
    calibration: { status: "required" },
    presentation: { running: false, recording: false },
    gesture: { active: false, mode: currentMode },
    speechAnchor: null,
  });
  const permissionManager = window.AirNoteModules.createPermissionManager();
  const presentationRecorder = window.AirNoteModules.createPresentationRecorder({ maxEvents: 5000 });
  const speechAnchorEngine = window.AirNoteModules.createSpeechAnchorEngine({
    ttlMs: SPEECH_ANCHOR_TTL_MS,
    // 엔진 기본값(0.78/0.12)을 무시하고 SSOT 상수로 강제 오버라이드한다.
    scoreThreshold: STT_CONFIDENCE_THRESHOLD,
    ambiguityGap: STT_AMBIGUITY_GAP,
  });
  const pdfRepository = window.AirNoteModules.createPresentationPdfRepository();
  const backendApi = window.AirNoteModules.AirNoteApi;
  const annotationEngine = window.AirNoteModules.createAnnotationEngine({
    pdfCanvas,
    drawCanvas,
    pointerElement: laserPointer,
  });
  let speechController = null;
  let speechControllerProvider = "";

  const modeLabelMap = {
    pointer: "포인터",
    pen: "펜",
    highlight: "형광펜",
    underline: "밑줄",
  };

  // --- SECTION: TIMER ---
  function formatTime(totalSeconds) {
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    if (!minutes) return `${remainder}초`;
    return `${minutes}분 ${String(remainder).padStart(2, "0")}초`;
  }

  // --- SECTION: FULLSCREEN ---
  function setPanelMinimized(minimized) {
    fullscreenPresenterUi?.classList.toggle("is-minimized", minimized);
    if (fullscreenPanelToggleBtn) {
      fullscreenPanelToggleBtn.textContent = minimized ? "최대화" : "최소화";
      fullscreenPanelToggleBtn.setAttribute("aria-expanded", String(!minimized));
    }
  }

  function clearPanelAutoMinimize() {
    if (!panelAutoMinimizeTimer) return;
    window.clearTimeout(panelAutoMinimizeTimer);
    panelAutoMinimizeTimer = null;
  }

  function schedulePanelAutoMinimize() {
    clearPanelAutoMinimize();
    if (panelPinned || !isRunning) return;
    panelAutoMinimizeTimer = window.setTimeout(() => {
      panelAutoMinimizeTimer = null;
      if (!panelPinned && isRunning) setPanelMinimized(true);
    }, 3000);
  }

  function setPanelPinned(pinned) {
    panelPinned = Boolean(pinned);
    fullscreenPresenterUi?.classList.toggle("is-pinned", panelPinned);
    fullscreenPanelLockBtn?.classList.toggle("is-locked", panelPinned);
    fullscreenPanelLockBtn?.setAttribute("aria-pressed", String(panelPinned));
    fullscreenPanelLockBtn?.setAttribute(
      "aria-label",
      panelPinned ? "발표 도구 고정 해제" : "발표 도구 고정",
    );
    fullscreenPanelLockBtn?.setAttribute(
      "title",
      panelPinned ? "발표 도구 고정 해제" : "발표 도구 고정",
    );
    if (panelPinned) {
      clearPanelAutoMinimize();
      setPanelMinimized(false);
    } else {
      schedulePanelAutoMinimize();
    }
  }

  function resetSessionMetrics(now = performance.now()) {
    pageDurationsMs.clear();
    pageGestureCounts.clear();
    pageMoveCount = 0;
    pageEnteredAt = now;
  }

  function incrementPageGestureCount(pageNo = currentPage) {
    if (!isRunning) return;
    pageGestureCounts.set(pageNo, (pageGestureCounts.get(pageNo) || 0) + 1);
  }

  function commitCurrentPageDuration(now = performance.now()) {
    if (!pageEnteredAt) return;
    const duration = Math.max(0, now - pageEnteredAt);
    pageDurationsMs.set(currentPage, (pageDurationsMs.get(currentPage) || 0) + duration);
    pageEnteredAt = now;
  }

  function getPageDurationSnapshot(now = performance.now()) {
    const snapshot = new Map(pageDurationsMs);
    if (pageEnteredAt && isRunning) {
      snapshot.set(
        currentPage,
        (snapshot.get(currentPage) || 0) + Math.max(0, now - pageEnteredAt),
      );
    }
    return snapshot;
  }

  function updateTimerText() {
    if (timerText) timerText.textContent = formatTime(elapsedSeconds);
    if (fullscreenTimerText) fullscreenTimerText.textContent = formatTime(elapsedSeconds);
    updatePresentationProgress();
  }

  function getProgressPercent() {
    const expectedSeconds = Math.max(1, expectedMinutes * 60);
    return Math.floor((elapsedSeconds / expectedSeconds) * 100);
  }

  function updatePresentationProgress() {
    const percent = getProgressPercent();
    const barPercent = `${Math.min(100, percent)}%`;
    if (progressText) progressText.textContent = `발표 진행률 ${percent}%`;
    presentationProgressBar?.style.setProperty("--progress", barPercent);
    if (fullscreenProgressText) fullscreenProgressText.textContent = `${percent}%`;
    fullscreenProgressBar?.style.setProperty("--progress", barPercent);
    if (fullscreenExpectedTimeText) fullscreenExpectedTimeText.textContent = `${expectedMinutes}분`;
  }

  function startTimer() {
    if (timerId) return;
    timerId = window.setInterval(() => {
      elapsedSeconds += 1;
      updateTimerText();
    }, 1000);
  }

  function stopTimer() {
    if (!timerId) return;
    window.clearInterval(timerId);
    timerId = null;
  }

  function updatePresentationButton() {
    if (!presentationToggleBtn) return;
    presentationToggleBtn.classList.toggle("is-running", isRunning);
    presentationToggleBtn.textContent = isRunning ? "발표 종료" : "발표 시작";
    presentationToggleBtn.setAttribute("aria-pressed", String(isRunning));
  }

  function setPresentationRunning(nextRunning) {
    isRunning = nextRunning;
    presentationStore.setState({
      presentation: { running: isRunning, recording: isRunning },
    });
    document.body.classList.toggle("presentation-session-active", isRunning);
    document.body.classList.toggle(
      "live-presentation-session",
      isRunning && activePresentationMode === "live",
    );

    if (isRunning) {
      elapsedSeconds = 0;
      presentationStartedAt = new Date();
      resetSessionMetrics();
      setPanelPinned(false);
      setPanelMinimized(false);
      startPresentationRecord();
      updateTimerText();
      startTimer();
      schedulePanelAutoMinimize();
      if (activePresentationMode === "rehearsal") {
        showToast("발표 기록을 시작했습니다.");
      }
    } else {
      commitCurrentPageDuration();
      pageEnteredAt = 0;
      clearPanelAutoMinimize();
      setPanelMinimized(false);
      stopTimer();
      presentationStartedAt = null;
      endGestureSession("presentation-stop");
      stopPresentationRecord();
    }

    if (!isRunning) document.body.classList.remove("live-presentation-session");

    updatePresentationButton();
    refreshStageLayout(true);
  }

  async function exitNativeFullscreen() {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen?.();
    } catch (error) {
      console.warn("AirNote presentation: fullscreen exit failed.", error);
    }
  }

  function getCurrentUserId() {
    try {
      const stored = JSON.parse(localStorage.getItem("airnoteCurrentUser") || "null");
      return stored?.userId || "";
    } catch {
      return "";
    }
  }

  function isLocalGestureMode() {
    return sessionStorage.getItem("airnoteLocalGestureMode") === "true"
      || new URLSearchParams(window.location.search).get("local") === "1";
  }

  function setBackendError(operation, error) {
    latestBackendError = {
      operation,
      status: Number(error?.status || 0),
      code: error?.code || "UNKNOWN",
      message: error?.message || String(error),
      at: new Date().toISOString(),
    };
    renderDebugPanel();
  }

  function clearBackendError(operation) {
    if (latestBackendError?.operation === operation) latestBackendError = null;
    renderDebugPanel();
  }

  function saveBackendCalibration(profile) {
    const userId = getCurrentUserId();
    if (!backendApi || !userId || !profile || isLocalGestureMode()) return;
    const calibrationKey = `${userId}:${profile.createdAt || ""}:${profile.openPalmSampleCount || 0}:${profile.pinchSampleCount || 0}`;
    if (calibrationKey === lastSavedCalibrationKey) return;
    lastSavedCalibrationKey = calibrationKey;
    backendApi.saveUserCalibration({
      userId,
      calibrationOffsetX: 0,
      calibrationOffsetY: 0,
      calibrationScaleX: 1,
      calibrationScaleY: 1,
      calibrationMirrorYn: "Y",
      cameraWidth: webcamVideo?.videoWidth || 640,
      cameraHeight: webcamVideo?.videoHeight || 480,
      canvasWidth: drawCanvas?.width || 1280,
      canvasHeight: drawCanvas?.height || 720,
    }).catch((error) => {
      setBackendError("calibration", error);
      console.warn("AirNote presentation: backend calibration save failed.", error);
      showToast("서버 캘리브레이션 저장에 실패했습니다.");
    });
  }

  async function startBackendPresentation() {
    if (isLocalGestureMode()) return { local: true };
    const userId = getCurrentUserId();
    if (!backendApi || !userId || !currentPdfId) {
      throw new Error("로그인 또는 PDF 서버 정보가 없어 발표를 시작할 수 없습니다.");
    }
    try {
      const response = await backendApi.startPresentation({ userId, pdfId: currentPdfId });
      clearBackendError("presentationStart");
      const data = response.data || {};
      currentPresentationId = data.presentationId ? String(data.presentationId) : "";
      if (currentPresentationId) sessionStorage.setItem(CURRENT_PRESENTATION_ID_KEY, currentPresentationId);
      if (data.pdfId) {
        currentPdfId = String(data.pdfId);
        sessionStorage.setItem(CURRENT_PDF_ID_KEY, currentPdfId);
      }
      return data;
    } catch (error) {
      setBackendError("presentationStart", error);
      console.warn("AirNote presentation: backend rehearsal start failed.", error);
      throw error;
    }
  }

  async function endBackendPresentation() {
    if (isLocalGestureMode()) return { local: true };
    if (!backendApi || !currentPresentationId) return null;
    try {
      const response = await backendApi.endPresentation(currentPresentationId);
      clearBackendError("presentationEnd");
      sessionStorage.removeItem(CURRENT_PRESENTATION_ID_KEY);
      currentPresentationId = "";
      return response.data || null;
    } catch (error) {
      setBackendError("presentationEnd", error);
      console.warn("AirNote presentation: backend rehearsal end failed.", error);
      showToast("서버 발표 종료 저장에 실패했습니다.");
      return null;
    }
  }

  async function ensureBackendPdf(file) {
    if (isLocalGestureMode()) return null;
    if (!backendApi || currentPdfId) return currentPdfId || null;
    const userId = getCurrentUserId();
    if (!userId) return null;
    try {
      const response = await backendApi.uploadDocument({ userId, file, pageCount: totalPage });
      const data = response.data || {};
      if (data.pdfId) {
        currentPdfId = String(data.pdfId);
        sessionStorage.setItem(CURRENT_PDF_ID_KEY, currentPdfId);
      }
      return currentPdfId || null;
    } catch (error) {
      console.warn("AirNote presentation: backend PDF upload failed.", error);
      throw error;
    }
  }

  function saveBackendPageAction(fromPageNo, toPageNo, direction) {
    if (!backendApi || !currentPresentationId) return;
    backendApi.savePageAction({
      presentationId: currentPresentationId,
      fromPageNo,
      toPageNo,
      actionType: direction > 0 ? "NEXT" : "PREV",
    }).catch((error) => {
      console.warn("AirNote presentation: backend page action save failed.", error);
    });
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => {
      if (!canvas?.toBlob) {
        resolve(null);
        return;
      }
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  function dataUrlToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string") return null;
    const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/);
    if (!match) return null;
    const mimeType = match[1] || "image/png";
    const body = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
    const bytes = new Uint8Array(body.length);
    for (let index = 0; index < body.length; index += 1) {
      bytes[index] = body.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
  }

  async function uploadRecordImageForPage(pageNo, dataUrl) {
    // 합성 이미지(PDF+판서)를 우선 사용하고, 없으면 현재 캔버스로 폴백한다.
    const blob = dataUrlToBlob(dataUrl)
      || (pageNo === currentPage ? await canvasToBlob(drawCanvas) : null);
    if (!blob) return false;
    const response = await backendApi.saveRecordImage({
      presentationId: currentPresentationId,
      pageNo,
      image: new File([blob], `airnote-page-${pageNo}.png`, { type: "image/png" }),
    });
    return response?.success === true;
  }

  async function saveBackendRecordImage() {
    if (!backendApi || !currentPresentationId) return false;
    // 종료 직전: 현재 페이지의 판서 저장 + 스냅샷 캡처 (PDF+판서 합성본)
    saveCurrentPageAnnotation();
    annotationEngine.snapshotPage(currentPage);
    // 방문한 모든 페이지의 합성 스냅샷을 업로드한다 (판서 여부 무관)
    const pages = annotationEngine.getSnapshots()
      .filter(([, item]) => item?.dataUrl)
      .map(([pageNo, item]) => ({ pageNo, dataUrl: item.dataUrl }));
    if (!pages.length) return true; // 방문 페이지가 없으면 종료를 막지 않는다
    try {
      let savedAny = false;
      for (const { pageNo, dataUrl } of pages) {
        const ok = await uploadRecordImageForPage(pageNo, dataUrl);
        savedAny = savedAny || ok;
      }
      clearBackendError("recordImage");
      return savedAny;
    } catch (error) {
      setBackendError("recordImage", error);
      console.warn("AirNote presentation: backend record image save failed.", error);
      showToast("서버 이미지 저장에 실패했습니다.");
      return false;
    }
  }

  // --- SECTION: BACKEND ---
  const ANNOTATION_QUEUE_KEY = "airnote.annotationQueue";
  const ANNOTATION_QUEUE_MAX = 200;

  function _loadAnnotationQueue() {
    try { return JSON.parse(localStorage.getItem(ANNOTATION_QUEUE_KEY) || "[]"); } catch { return []; }
  }

  function _saveAnnotationQueue(queue) {
    try { localStorage.setItem(ANNOTATION_QUEUE_KEY, JSON.stringify(queue)); } catch {}
  }

  function _enqueueAnnotation(fields) {
    const queue = _loadAnnotationQueue();
    if (queue.length >= ANNOTATION_QUEUE_MAX) queue.shift();
    queue.push({ ...fields, _queuedAt: new Date().toISOString() });
    _saveAnnotationQueue(queue);
  }

  async function _flushAnnotationQueue() {
    if (!backendApi) return;
    const queue = _loadAnnotationQueue();
    if (!queue.length) return;
    const remaining = [];
    for (const item of queue) {
      try {
        const { _queuedAt: _ignored, ...f } = item;
        await backendApi.saveAnnotation(f);
      } catch {
        remaining.push(item);
      }
    }
    _saveAnnotationQueue(remaining);
  }

  function saveBackendAnnotation(fields) {
    if (!backendApi || !currentPresentationId) return;
    const payload = { presentationId: currentPresentationId, pageNo: currentPage, ...fields };
    backendApi.saveAnnotation(payload).catch((error) => {
      setBackendError("annotation", error);
      console.warn("AirNote presentation: backend annotation save failed ??queued locally.", error);
      _enqueueAnnotation(payload);
    });
  }

  // --- SECTION: SESSION ---
  async function startPresentationSession(mode = "rehearsal") {
    if (isRunning || presentationSessionController.isRunning()) return true;
    activePresentationMode = mode === "live" ? "live" : "rehearsal";
    if (presentationToggleBtn) presentationToggleBtn.disabled = true;
    if (fullscreenBtn) fullscreenBtn.disabled = true;
    _flushAnnotationQueue().catch(() => {});
    try {
      await requestPresentationPermissions();
      const backendSession = await startBackendPresentation();
      if (!backendSession) return false;
      await enterStageFullscreen();
      await presentationSessionController.start();
      console.info("[AirNote STT] 발표 세션 시작 완료. micPermission=", permissionState.microphone);
      if (permissionState.microphone) startSpeechRecognition();
      else console.warn("[AirNote STT] 마이크 권한이 없어 startSpeechRecognition 호출 안 함");
      return true;
    } catch (error) {
      console.warn("AirNote presentation: session start failed.", error);
      showToast(error?.message || "백엔드 발표 세션을 시작하지 못했습니다.");
      return false;
    } finally {
      if (presentationToggleBtn) presentationToggleBtn.disabled = false;
      if (fullscreenBtn) fullscreenBtn.disabled = false;
    }
  }

  async function stopPresentationSession({ silent = false, reason = "user" } = {}) {
    if (sessionStopPending) return presentationSession;
    if (!isRunning && !presentationSessionController.isRunning()) return null;
    sessionStopPending = true;
    try {
      saveCurrentPageAnnotation();
      const imageSaved = await saveBackendRecordImage();
      const ended = await endBackendPresentation();
      await presentationSessionController.stop(reason);
      if (!silent) {
        if (!imageSaved) showToast("이미지 저장에 실패했지만 발표가 종료되었습니다.");
        else showToast(ended ? "발표 기록이 저장되었습니다." : "발표 종료 저장에 실패했습니다.");
      }
      activePresentationMode = null;
      return presentationSession;
    } finally {
      sessionStopPending = false;
    }
  }

  async function finishLivePresentation({ exitFullscreen = true, reason = "live-end" } = {}) {
    if (!isRunning || activePresentationMode !== "live" || sessionStopPending) return false;
    stopTimer();
    commitCurrentPageDuration();
    pageEnteredAt = 0;
    updateTimerText();
    const summary = getPresentationSummary();
    savePresentationRecord(summary);
    await stopPresentationSession({ silent: true, reason });
    if (exitFullscreen) await exitNativeFullscreen();
    return true;
  }

  async function togglePresentation() {
    if (isRunning) {
      if (activePresentationMode === "live") {
        await finishLivePresentation();
      } else {
        await requestPresentationSummary();
      }
      return;
    }
    await startPresentationSession("rehearsal");
  }

  function updatePageIndicator() {
    if (pageIndicator) pageIndicator.textContent = `${currentPage} / ${totalPage}`;
    if (fullscreenPageIndicator) fullscreenPageIndicator.textContent = `${currentPage} / ${totalPage}`;
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPage;
  }

  function setModalOpen(modal, isOpen) {
    window.AirNoteModules.presentationUi.setModalOpen(modal, isOpen);
  }

  // --- SECTION: PERMISSIONS ---
  async function readBrowserMediaPermission(name) {
    try {
      if (!globalThis.navigator?.permissions?.query) return "unknown";
      return (await navigator.permissions.query({ name })).state || "unknown";
    } catch {
      return "unknown";
    }
  }

  async function getMediaPermissionBlockMessage() {
    const [camera, microphone] = await Promise.all([
      readBrowserMediaPermission("camera"),
      readBrowserMediaPermission("microphone"),
    ]);
    if (camera !== "denied" && microphone !== "denied") return "";
    if (camera === "denied" && microphone === "denied") {
      return "브라우저에서 카메라와 마이크가 차단되어 있습니다. 주소창 왼쪽 사이트 설정에서 권한을 허용으로 바꿔주세요.";
    }
    if (camera === "denied") {
      return "브라우저에서 카메라가 차단되어 있습니다. 주소창 왼쪽 사이트 설정에서 카메라를 허용으로 바꿔주세요.";
    }
    return "브라우저에서 마이크가 차단되어 있습니다. 주소창 왼쪽 사이트 설정에서 마이크를 허용으로 바꿔주세요.";
  }

  function getPermissionErrorMessage(result) {
    const webcamError = result?.errors?.webcam;
    const microphoneError = result?.errors?.microphone;
    const error = webcamError || microphoneError;
    if (!error) return "";
    if (error.name === "NotAllowedError") {
      return "브라우저가 권한을 차단했습니다. 주소창 왼쪽 사이트 설정에서 카메라와 마이크를 허용으로 바꿔주세요.";
    }
    if (error.name === "NotFoundError") {
      return "카메라 또는 마이크 장치를 찾을 수 없습니다. 장치 연결 상태를 확인해주세요.";
    }
    if (error.name === "NotReadableError") {
      return "카메라 또는 마이크가 다른 프로그램에서 사용 중입니다. 화상회의/카메라 앱을 종료하고 다시 시도해주세요.";
    }
    if (error.name === "SecurityError") {
      return "브라우저 보안 정책 때문에 권한 요청이 차단되었습니다. localhost, 127.0.0.1 또는 HTTPS 주소에서 실행해주세요.";
    }
    return `권한 요청 실패: ${error.name || "알 수 없는 오류"}`;
  }

  function getLiveVideoTrack(stream) {
    return stream?.getVideoTracks?.().find((track) => track.readyState === "live") || null;
  }

  function hasLiveVideoStream(stream) {
    return Boolean(getLiveVideoTrack(stream));
  }

  function markWebcamDisconnected(reason = "웹캠 연결이 종료되었습니다.") {
    permissionStream = null;
    permissionState = { ...permissionState, webcam: false };
    presentationStore.setState({
      permission: { ...presentationStore.getState().permission, webcam: "unavailable" },
    });
    window.AirNoteHandPointer?.setGestureEnabled?.(false);
    if (permissionStatusText) permissionStatusText.textContent = `${reason} 권한 버튼으로 다시 연결해주세요.`;
    if (permissionRequestBtn) {
      permissionRequestBtn.disabled = false;
      permissionRequestBtn.textContent = "웹캠·마이크 권한 다시 확인";
    }
  }

  function bindPermissionStreamLifecycle(stream) {
    const track = getLiveVideoTrack(stream);
    if (!track) return;
    const handleEnded = () => {
      markWebcamDisconnected("웹캠이 꺼졌습니다.");
    };
    const handleMute = () => {
      if (permissionStatusText) permissionStatusText.textContent = "웹캠이 일시 중지되었습니다. 다시 켜지면 권한 버튼으로 재연결할 수 있습니다.";
    };
    const handleUnmute = () => {
      if (hasLiveVideoStream(permissionStream)) {
        void attachPermissionStreamToHandPointer();
      }
    };
    track.addEventListener?.("ended", handleEnded, { once: true });
    track.addEventListener?.("mute", handleMute);
    track.addEventListener?.("unmute", handleUnmute);
  }

  async function attachPermissionStreamToHandPointer() {
    if (!permissionState.webcam || !window.AirNoteHandPointer?.initWebcam) return false;
    if (!hasLiveVideoStream(permissionStream)) {
      markWebcamDisconnected("기존 웹캠 스트림이 종료되었습니다.");
      return false;
    }
    const attached = await window.AirNoteHandPointer.initWebcam(permissionStream);
    window.AirNoteHandPointer?.setGestureEnabled?.(Boolean(attached));
    if (!attached) {
      markWebcamDisconnected("웹캠 재연결에 실패했습니다.");
      return false;
    }
    return true;
  }

  async function requestPresentationPermissions() {
    if (permissionRequestPromise) return permissionRequestPromise;
    permissionRequestPromise = doRequestPresentationPermissions().finally(() => {
      permissionRequestPromise = null;
    });
    return permissionRequestPromise;
  }

  async function doRequestPresentationPermissions() {
    if (permissionRequestBtn) {
      permissionRequestBtn.disabled = true;
      permissionRequestBtn.textContent = "권한 확인 중...";
    }
    if (permissionStatusText) permissionStatusText.textContent = "브라우저 권한 요청을 실행하고 있습니다.";
    const mediaDevices = globalThis.navigator?.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      const protocol = window.location?.protocol || "";
      const hostname = window.location?.hostname || "";
      const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
      const canUseMedia = window.isSecureContext || protocol === "https:" || isLocalHost;
      const message = canUseMedia
        ? "이 브라우저에서 웹캠/마이크 권한 요청을 사용할 수 없습니다."
        : "웹캠/마이크 권한은 localhost, 127.0.0.1 또는 HTTPS에서 요청할 수 있습니다.";
      permissionStream = null;
      permissionState = { webcam: false, microphone: false };
      presentationStore.setState({
        permission: { webcam: "unavailable", microphone: "unavailable" },
      });
      window.AirNoteHandPointer?.setGestureEnabled?.(false);
      showToast(message);
      if (permissionStatusText) permissionStatusText.textContent = message;
      if (permissionRequestBtn) {
        permissionRequestBtn.disabled = false;
        permissionRequestBtn.textContent = "웹캠/마이크 권한 다시 확인";
      }
      return permissionState;
    }

    window.AirNoteHandPointer?.stopWebcam?.();
    const result = await permissionManager.request();
    permissionStream = result.videoStream;
    if (hasLiveVideoStream(permissionStream)) {
      bindPermissionStreamLifecycle(permissionStream);
    }
    permissionState = {
      webcam: result.webcam === "granted",
      microphone: result.microphone === "granted",
    };
    presentationStore.setState({
      permission: { webcam: result.webcam, microphone: result.microphone },
    });

    if (permissionState.webcam && hasLiveVideoStream(permissionStream)) {
      const attached = await attachPermissionStreamToHandPointer();
      if (attached && calibrationVideo) {
        calibrationVideo.srcObject = permissionStream;
        await calibrationVideo.play().catch(() => undefined);
      }
      if (attached) calibrationCameraPlaceholder?.classList.add("hidden");
    } else {
      window.AirNoteHandPointer?.setGestureEnabled?.(false);
      if (calibrationCameraPlaceholder) calibrationCameraPlaceholder.textContent = "웹캠 권한이 허용되지 않았습니다.";
      showToast("웹캠 권한이 없어 제스처 기능을 사용할 수 없습니다.");
      if (permissionStatusText) permissionStatusText.textContent = "웹캠 권한이 허용되지 않았습니다.";
    }

    if (!permissionState.microphone) {
      showToast("마이크 권한이 없어 음성 앵커 기능을 사용할 수 없습니다.");
      if (permissionStatusText) permissionStatusText.textContent = "마이크 권한이 허용되지 않았습니다.";
    }

    if (!permissionState.webcam || !permissionState.microphone) {
      const errorMessage = getPermissionErrorMessage(result);
      if (errorMessage) {
        showToast(errorMessage);
        if (permissionStatusText) permissionStatusText.textContent = errorMessage;
      }
      const blockedMessage = await getMediaPermissionBlockMessage();
      if (blockedMessage) {
        showToast(blockedMessage);
        if (permissionStatusText) permissionStatusText.textContent = blockedMessage;
      }
    } else if (permissionStatusText) {
      permissionStatusText.textContent = "웹캠과 마이크 권한이 허용되었습니다.";
    }

    if (permissionRequestBtn) {
      permissionRequestBtn.disabled = false;
      permissionRequestBtn.textContent = permissionState.webcam && permissionState.microphone
        ? "웹캠·마이크 권한 허용 완료"
        : "웹캠·마이크 권한 다시 확인";
    }

    return permissionState;
  }

  function recordPresentationEvent(type, detail = {}) {
    presentationRecorder.record(type, {
      pageNo: currentPage,
      elapsedSeconds,
      ...detail,
    });
    presentationSession = presentationRecorder.getSession();
  }

  function startPresentationRecord() {
    presentationSession = presentationRecorder.start({
      underlineMode,
      fileName: currentPdfFileName,
      presentationMode: activePresentationMode || "rehearsal",
      permissions: { ...permissionState },
    });
    recordPresentationEvent("session_start", { permissions: { ...permissionState } });
  }

  function stopPresentationRecord() {
    presentationSession = presentationRecorder.stop();
    return presentationSession;
  }

  const presentationSessionController = window.AirNoteModules.createPresentationSessionController({
    onStart() {
      setPresentationRunning(true);
    },
    onStop() {
      setPresentationRunning(false);
      speechController?.stop();
      speechStarted = false;
      permissionManager.stop();
    },
  });

  async function enterStageFullscreen() {
    if (!slideArt || document.fullscreenElement === slideArt) return true;
    try {
      await slideArt.requestFullscreen?.();
      return document.fullscreenElement === slideArt;
    } catch (error) {
      console.warn("AirNote presentation: stage fullscreen failed.", error);
      showToast("전체화면을 시작할 수 없습니다.");
      return false;
    }
  }

  function openAnalyticsDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(ANALYTICS_DB_NAME, ANALYTICS_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        ["matchLogs", "matchCandidates", "annotations"].forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
          }
        });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveAnalyticsRecord(storeName, record) {
    try {
      const db = await openAnalyticsDb();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        transaction.objectStore(storeName).add({ ...record, createdAt: new Date().toISOString() });
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    } catch (error) {
      console.warn(`AirNote analytics: ${storeName} save failed.`, error);
    }
  }

  function debugValue(value) {
    return value === undefined || value === null || value === "" ? "-" : value;
  }

  function debugEscape(value) {
    return String(debugValue(value))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function debugJson(value, emptyText = "아직 결과가 없습니다.") {
    if (value === undefined || value === null) return debugEscape(emptyText);
    if (Array.isArray(value) && value.length === 0) return debugEscape(emptyText);
    return debugEscape(JSON.stringify(value, null, 2));
  }

  function debugRound(value, digits = 3) {
    return Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
  }

  function getDebugBackendBaseUrl() {
    return backendApi?.getBaseUrl?.() || "-";
  }

  function getDebugSttBaseUrl() {
    return LOCAL_STT_ENDPOINTS[0] || "http://127.0.0.1:8000";
  }

  function getDebugSttEndpoint() {
    return `${getDebugSttBaseUrl()}/stt`;
  }

  function getDebugHealthUrl(baseUrl) {
    return `${String(baseUrl || "").replace(/\/+$/, "")}/api/health`;
  }

  async function fetchDebugHealth(url) {
    const response = await fetch(url, { cache: "no-store" });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    return {
      ok: response.ok,
      status: response.status,
      message: payload?.message || (response.ok ? "OK" : `HTTP ${response.status}`),
      payload,
      error: "",
    };
  }

  async function refreshDebugHealth() {
    if (!DEBUG_MODE) return;
    const backendBase = getDebugBackendBaseUrl();
    try {
      backendHealthState = await fetchDebugHealth(getDebugHealthUrl(backendBase));
    } catch (error) {
      backendHealthState = {
        ok: false,
        status: 0,
        message: "network-error",
        payload: null,
        error: error?.message || String(error),
      };
    }
    const sttErrors = [];
    // 갱신 중에는 공유 상태(sttHealthState)를 null로 비우지 않는다.
    // 비워두면 async 대기 사이에 디버그 패널이 렌더될 때 null.ok 접근으로 크래시한다.
    let nextSttHealthState = null;
    for (const endpoint of LOCAL_STT_ENDPOINTS) {
      try {
        const candidateHealth = await fetchDebugHealth(`${endpoint}/health`);
        nextSttHealthState = { ...candidateHealth, endpoint };
        if (candidateHealth.ok) break;
      } catch (error) {
        sttErrors.push(`${endpoint}: ${error?.message || error}`);
      }
    }
    sttHealthState = nextSttHealthState || {
      ok: false,
      status: 0,
      message: "network-error",
      payload: null,
      error: sttErrors.join(" | "),
    };
    renderDebugPanel();
  }

  function isDebugEnabled() {
    return DEBUG_MODE;
  }

  function isAirDebugMobile() {
    return window.matchMedia?.("(max-width: 768px)")?.matches || window.innerWidth <= 768;
  }

  function clampAirDebugPanelPosition(position) {
    if (!debugPanel) return { left: 16, top: 16 };
    const rect = debugPanel.getBoundingClientRect();
    const panelWidth = rect.width || 360;
    const panelHeight = rect.height || 480;
    const maxLeft = Math.max(8, window.innerWidth - panelWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - panelHeight - 8);
    return {
      left: Math.min(maxLeft, Math.max(8, Number(position?.left) || 8)),
      top: Math.min(maxTop, Math.max(8, Number(position?.top) || 8)),
    };
  }

  function applyAirDebugPanelPosition(position) {
    if (!debugPanel) return;
    debugPanel.style.left = `${position.left}px`;
    debugPanel.style.top = `${position.top}px`;
    debugPanel.style.right = "auto";
    debugPanel.style.bottom = "auto";
  }

  function clearAirDebugPanelPosition() {
    if (!debugPanel) return;
    debugPanel.style.left = "";
    debugPanel.style.top = "";
    debugPanel.style.right = "";
    debugPanel.style.bottom = "";
  }

  function restoreAirDebugPanelPosition() {
    if (!debugPanel) return;
    if (isAirDebugMobile()) {
      clearAirDebugPanelPosition();
      return;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(localStorage.getItem(AIR_DEBUG_PANEL_POSITION_KEY) || "null");
    } catch {
      parsed = null;
    }
    if (!Number.isFinite(Number(parsed?.left)) || !Number.isFinite(Number(parsed?.top))) {
      clearAirDebugPanelPosition();
      return;
    }
    applyAirDebugPanelPosition(clampAirDebugPanelPosition(parsed));
  }

  function saveAirDebugPanelPosition() {
    if (!debugPanel || isAirDebugMobile()) return;
    const rect = debugPanel.getBoundingClientRect();
    const position = clampAirDebugPanelPosition({ left: rect.left, top: rect.top });
    localStorage.setItem(AIR_DEBUG_PANEL_POSITION_KEY, JSON.stringify(position));
  }

  function openAirDebugPanel() {
    if (!isDebugEnabled()) return;
    ensureDebugPanel();
    if (!debugPanel) return;
    debugPanel.classList.add("is-open");
    debugToggleBtn?.setAttribute("aria-expanded", "true");
    renderDebugPanel();
    restoreAirDebugPanelPosition();
  }

  function closeAirDebugPanel() {
    if (!debugPanel) return;
    debugPanel.classList.remove("is-open");
    debugPanel.classList.remove("is-dragging");
    debugToggleBtn?.setAttribute("aria-expanded", "false");
    airDebugDragging = null;
  }

  function toggleAirDebugPanel() {
    if (debugPanel?.classList.contains("is-open")) closeAirDebugPanel();
    else openAirDebugPanel();
  }

  function startAirDebugDrag(event) {
    if (!debugPanel || isAirDebugMobile()) return;
    if (event.target?.closest?.(".air-debug-close")) return;
    const rect = debugPanel.getBoundingClientRect();
    airDebugDragging = {
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
    };
    debugPanel.classList.add("is-dragging");
    event.preventDefault();
  }

  function moveAirDebugPanel(event) {
    if (!airDebugDragging || !debugPanel) return;
    const next = clampAirDebugPanelPosition({
      left: airDebugDragging.left + event.clientX - airDebugDragging.startX,
      top: airDebugDragging.top + event.clientY - airDebugDragging.startY,
    });
    applyAirDebugPanelPosition(next);
    event.preventDefault();
  }

  function endAirDebugDrag() {
    if (!airDebugDragging) return;
    airDebugDragging = null;
    debugPanel?.classList.remove("is-dragging");
    saveAirDebugPanelPosition();
  }

  function initAirDebugPanel() {
    if (!isDebugEnabled() || debugPanel) return;
    if (!document.getElementById("airDebugStyle")) {
      const style = document.createElement("style");
      style.id = "airDebugStyle";
      style.textContent = `
.air-debug-toggle {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 900;
  min-width: 88px;
  height: 40px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.96);
  color: #f8fafc;
  font: 700 13px/1 "Noto Sans KR", Arial, sans-serif;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.28);
}
.air-debug-toggle[hidden] { display: none; }
.air-debug-panel {
  position: fixed;
  right: 16px;
  bottom: 72px;
  z-index: 900;
  display: none;
  width: clamp(320px, 28vw, 420px);
  height: min(70vh, 680px);
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.97);
  color: #e5e7eb;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.36);
  font: 12px/1.45 "Noto Sans KR", Arial, sans-serif;
}
.air-debug-panel.is-open {
  display: flex;
  flex-direction: column;
}
.air-debug-panel.is-dragging { user-select: none; }
.air-debug-panel * { box-sizing: border-box; }
.air-debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  gap: 8px;
  padding: 12px 12px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  cursor: grab;
}
.air-debug-header:active { cursor: grabbing; }
.air-debug-title {
  margin: 0;
  color: #ffffff;
  font-size: 14px;
  font-weight: 800;
}
.air-debug-close {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.86);
  color: #cbd5e1;
  font: 800 16px/1 Arial, sans-serif;
}
.air-debug-content {
  min-height: 0;
  padding: 10px 12px 12px;
  overflow-y: auto;
}
.air-debug-section {
  margin: 0 0 10px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.82);
}
.air-debug-section > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 10px;
  color: #bfdbfe;
  font-weight: 800;
  cursor: pointer;
}
.air-debug-section > summary::-webkit-details-marker { display: none; }
.air-debug-section > summary::after {
  color: #94a3b8;
  content: "+";
}
.air-debug-section[open] > summary::after { content: "-"; }
.air-debug-section-body {
  padding: 0 10px 10px;
}
.air-debug-rows {
  display: grid;
  grid-template-columns: minmax(112px, 0.52fr) minmax(0, 1fr);
  gap: 6px 8px;
  margin: 0;
}
.air-debug-rows dt {
  min-width: 0;
  color: #94a3b8;
  font-weight: 700;
}
.air-debug-rows dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: #f8fafc;
}
.air-debug-summary-list {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}
.air-debug-summary-list li {
  padding: 7px 8px;
  border-radius: 6px;
  background: rgba(2, 6, 23, 0.4);
  color: #fde68a;
}
.air-debug-badge {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 800;
}
.air-debug-badge--success {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
}
.air-debug-badge--danger {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}
.air-debug-badge--warning {
  background: rgba(234, 179, 8, 0.18);
  color: #fde68a;
}
.air-debug-pre {
  max-height: 180px;
  margin: 0;
  overflow: auto;
  padding: 8px;
  border-radius: 6px;
  background: rgba(2, 6, 23, 0.86);
  color: #d1fae5;
  font: 11px/1.45 Consolas, monospace;
  white-space: pre-wrap;
}
.air-debug-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.air-debug-table th,
.air-debug-table td {
  padding: 5px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  overflow-wrap: anywhere;
  text-align: left;
  vertical-align: top;
}
.air-debug-table th {
  color: #93c5fd;
  font-weight: 800;
}
.air-debug-selected {
  background: rgba(34, 197, 94, 0.18);
  color: #ffffff;
}
.air-debug-muted { color: #94a3b8; }
.air-debug-advanced-toggle {
  width: 100%;
  min-height: 34px;
  margin: 2px 0 10px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 8px;
  background: rgba(51, 65, 85, 0.86);
  color: #e2e8f0;
  font: 800 12px/1 "Noto Sans KR", Arial, sans-serif;
}
.air-debug-advanced[hidden] { display: none; }
@media (max-width: 768px) {
  .air-debug-panel {
    left: 12px;
    right: 12px;
    bottom: 64px;
    width: auto;
    height: auto;
    max-height: 65vh;
  }
  .air-debug-header { cursor: default; }
}
`;
      document.head.appendChild(style);
    }

    debugToggleBtn = document.createElement("button");
    debugToggleBtn.type = "button";
    debugToggleBtn.className = "air-debug-toggle";
    debugToggleBtn.textContent = "디버그";
    debugToggleBtn.setAttribute("aria-controls", "airnoteDebugPanel");
    debugToggleBtn.setAttribute("aria-expanded", "false");

    debugPanel = document.createElement("section");
    debugPanel.id = "airnoteDebugPanel";
    debugPanel.className = "air-debug-panel";
    debugPanel.setAttribute("aria-label", "AirNote debug panel");

    debugToggleBtn.addEventListener("click", toggleAirDebugPanel);
    debugPanel.addEventListener("click", (event) => {
      if (event.target?.closest?.(".air-debug-close")) {
        closeAirDebugPanel();
        return;
      }
      if (event.target?.closest?.(".air-debug-advanced-toggle")) {
        airDebugAdvancedOpen = !airDebugAdvancedOpen;
        renderDebugPanel();
      }
    });

    document.addEventListener("mousemove", moveAirDebugPanel);
    document.addEventListener("mouseup", endAirDebugDrag);
    window.addEventListener("resize", () => {
      if (!debugPanel?.classList.contains("is-open")) return;
      if (isAirDebugMobile()) {
        clearAirDebugPanelPosition();
        return;
      }
      if (debugPanel.style.left || debugPanel.style.top) {
        applyAirDebugPanelPosition(clampAirDebugPanelPosition(debugPanel.getBoundingClientRect()));
      }
    });

    document.body.append(debugToggleBtn, debugPanel);
    void refreshDebugHealth();
    debugHealthTimerId = window.setInterval(refreshDebugHealth, 10000);
  }

  function ensureDebugPanel() {
    initAirDebugPanel();
  }

  function renderAirDebugBadge(value, tone = "muted") {
    return `<span class="air-debug-badge air-debug-badge--${debugEscape(tone)}">${debugEscape(value)}</span>`;
  }

  function renderDebugRows(rows) {
    return `<dl class="air-debug-rows">${rows.map(([key, value]) => (
      `<dt>${debugEscape(key)}</dt><dd>${value}</dd>`
    )).join("")}</dl>`;
  }

  function renderAirDebugSection(title, body, { open = false } = {}) {
    return `<details class="air-debug-section"${open ? " open" : ""}><summary>${debugEscape(title)}</summary><div class="air-debug-section-body">${body}</div></details>`;
  }

  function ensureAirDebugContentShell() {
    let debugContent = debugPanel.querySelector(".air-debug-content");
    if (!debugContent) {
      debugPanel.innerHTML = `
        <div class="air-debug-header">
          <h2 class="air-debug-title">AirNote Debug</h2>
          <button class="air-debug-close" type="button" aria-label="닫기">X</button>
        </div>
        <div class="air-debug-content"></div>`;
      debugPanel.querySelector(".air-debug-header")?.addEventListener("mousedown", startAirDebugDrag);
      debugContent = debugPanel.querySelector(".air-debug-content");
    }
    if (!debugContent.dataset.airDebugShellReady) {
      debugContent.innerHTML = `
        <div data-air-debug-section="summary"></div>
        <div data-air-debug-section="backend"></div>
        <div data-air-debug-section="stt"></div>
        <div data-air-debug-section="pdf"></div>
        <div data-air-debug-section="gesture"></div>
        <button class="air-debug-advanced-toggle" type="button" aria-expanded="false">고급 정보 보기</button>
        <div class="air-debug-advanced" hidden>
          <div data-air-debug-section="speech"></div>
          <div data-air-debug-section="active-anchor"></div>
          <div data-air-debug-section="candidates"></div>
          <div data-air-debug-section="raw-items"></div>
          <div data-air-debug-section="anchors"></div>
          <div data-air-debug-section="rev2"></div>
          <div data-air-debug-section="execution"></div>
          <div data-air-debug-section="api-detail"></div>
        </div>`;
      debugContent.dataset.airDebugShellReady = "1";
    }
    return debugContent;
  }

  function updateAirDebugSection(key, title, body, { open = false } = {}) {
    const mount = debugPanel?.querySelector(`[data-air-debug-section="${key}"]`);
    if (!mount) return;
    let section = mount.querySelector(".air-debug-section");
    if (!section) {
      mount.innerHTML = renderAirDebugSection(title, "", { open });
      section = mount.querySelector(".air-debug-section");
    }
    const summary = section?.querySelector("summary");
    if (summary && summary.textContent !== title) summary.textContent = title;
    const bodyEl = section?.querySelector(".air-debug-section-body");
    if (bodyEl && bodyEl.innerHTML !== body) bodyEl.innerHTML = body;
  }

  function updateAirDebugAdvancedVisibility() {
    const advancedToggle = debugPanel?.querySelector(".air-debug-advanced-toggle");
    const advanced = debugPanel?.querySelector(".air-debug-advanced");
    if (advancedToggle) {
      advancedToggle.setAttribute("aria-expanded", String(airDebugAdvancedOpen));
      advancedToggle.textContent = airDebugAdvancedOpen ? "고급 정보 숨기기" : "고급 정보 보기";
    }
    if (advanced) advanced.hidden = !airDebugAdvancedOpen;
  }

  function getAirDebugPanelUiState() {
    const content = debugPanel?.querySelector(".air-debug-content");
    return {
      scrollTop: content ? content.scrollTop : 0,
      sectionOpenStates: Array.from(debugPanel?.querySelectorAll(".air-debug-section") || [])
        .map((section) => section.open),
    };
  }

  function restoreAirDebugPanelUiState(state) {
    if (!state || !debugPanel) return;
    const sections = Array.from(debugPanel.querySelectorAll(".air-debug-section"));
    state.sectionOpenStates.forEach((isOpen, index) => {
      if (sections[index]) sections[index].open = Boolean(isOpen);
    });
    const content = debugPanel.querySelector(".air-debug-content");
    if (!content) return;
    const maxScrollTop = Math.max(0, content.scrollHeight - content.clientHeight);
    content.scrollTop = Math.min(maxScrollTop, Math.max(0, Number(state.scrollTop) || 0));
  }

  function getDebugAnchorPayload(anchor) {
    if (!anchor || !pdfCanvas) return null;
    const startX = Number(anchor.xRatio || 0) * pdfCanvas.width;
    const startY = Number(anchor.yRatio || 0) * pdfCanvas.height;
    const endX = Number(anchor.xRatio || 0) * pdfCanvas.width + Number(anchor.widthRatio || 0) * pdfCanvas.width;
    const endY = Number(anchor.yRatio || 0) * pdfCanvas.height + Number(anchor.heightRatio || 0) * pdfCanvas.height;
    return {
      matched_phrase: anchor.matchedText || anchor.text || null,
      page_no: anchor.pageNo || currentPage,
      anchor_id: anchor.matchedAnchorId || anchor.id || null,
      score: debugRound(anchor.score),
      start_px: { x: debugRound(startX, 1), y: debugRound(startY, 1) },
      end_px: { x: debugRound(endX, 1), y: debugRound(endY, 1) },
      start_ratio: { x: debugRound(anchor.xRatio), y: debugRound(anchor.yRatio) },
      end_ratio: {
        x: debugRound(Number(anchor.xRatio || 0) + Number(anchor.widthRatio || 0)),
        y: debugRound(Number(anchor.yRatio || 0) + Number(anchor.heightRatio || 0)),
      },
      coordinate_system: "CANVAS_PX",
    };
  }

  function getDebugCandidates() {
    return (latestMatchDiagnostics?.candidates || []).slice(0, 5).map((candidate, index) => ({
      rank: index + 1,
      text: candidate.text || "",
      score: debugRound(candidate.score),
      selected: Boolean(latestMatchDiagnostics?.accepted && index === 0),
      page_no: candidate.pageNo || null,
    }));
  }

  function getDebugAnchorRows(anchor) {
    const selectedId = anchor?.matchedAnchorId || anchor?.id || "";
    return (pdfTextAnchors.get(currentPage) || [])
      .filter((item) => item.kind === "line")
      .slice(0, 20)
      .map((item) => ({
        anchor_id: item.id || "-",
        page_no: item.pageNo || currentPage,
        text: item.text || "",
        start_px: pdfCanvas ? debugRound(Number(item.xRatio || 0) * pdfCanvas.width, 1) : null,
        end_px: pdfCanvas ? debugRound((Number(item.xRatio || 0) + Number(item.widthRatio || 0)) * pdfCanvas.width, 1) : null,
        score: selectedId === item.id ? debugRound(anchor?.score) : null,
        selected: selectedId === item.id || selectedId === item.lineId,
      }));
  }

  function getDebugGestureSummary() {
    const detail = latestGestureDiagnostics || {};
    const handSettings = window.AirNoteHandPointer?.getHandSettings?.();
    const command = detail.command || "";
    return {
      handDetected: Boolean(detail.handPoint || detail.handSelection || detail.context),
      pointer: command === "pointer" ? detail.phase || "active" : "idle",
      underline: underlineGesture?.phase || detail.underline?.lastPhase || "idle",
      previousPage: command === "previous_page" ? detail.phase || "active" : "idle",
      nextPage: command === "next_page" ? detail.phase || "active" : "idle",
      clearGesture: command === "clear_page" ? detail.phase || "active" : "idle",
      gestureControl: detail.blockedReason === "gesture_control_disabled" ? "OFF" : "ON",
      handTarget: handSettings?.targetHand || "-",
    };
  }

  function getDebugRev2Preview(anchorPayload, candidates) {
    return {
      presentation_id: currentPresentationId ? Number(currentPresentationId) || currentPresentationId : null,
      pdf_id: currentPdfId ? Number(currentPdfId) || currentPdfId : null,
      page_no: currentPage || null,
      coordinate_system: "CANVAS_PX",
      anchors: getDebugAnchorRows(getValidSpeechAnchor()).map(({ selected, ...row }) => row),
      match_log: latestMatchDiagnostics ? {
        transcript: latestMatchDiagnostics.transcript || null,
        accepted: Boolean(latestMatchDiagnostics.accepted),
        reason: latestMatchDiagnostics.reason || null,
        active_anchor: anchorPayload,
      } : null,
      candidates,
      annotation: null,
    };
  }

  function getAirDebugHealthLabel(state) {
    if (state.ok === null) return "확인 필요";
    return state.ok ? "OK" : "FAIL";
  }

  function getAirDebugHealthTone(state) {
    if (state.ok === null) return "muted";
    return state.ok ? "success" : "danger";
  }

  function getAirDebugMicPermission() {
    const storeMic = presentationStore.getState().permission?.microphone;
    if (permissionState.microphone || storeMic === "granted") return "granted";
    if (storeMic === "denied") return "denied";
    if (storeMic === "prompt") return "prompt";
    return "unknown";
  }

  function getAirDebugMicTone(permission) {
    if (permission === "granted") return "success";
    if (permission === "denied") return "danger";
    if (permission === "prompt") return "warning";
    return "muted";
  }

  function getAirDebugStatusBadge(label, tone) {
    return renderAirDebugBadge(label, tone);
  }

  function getAirDebugSuspectedIssues({ micPermission, gesture }) {
    const issues = [];
    // health 갱신 도중/이전에는 null일 수 있으므로 빈 객체로 방어한다.
    const backend = backendHealthState || {};
    const stt = sttHealthState || {};
    const backendMessage = backend.error || backend.message || "";
    if (backend.ok === false && Number(backend.status) === 0) {
      issues.push("백엔드 연결 실패 가능성: 서버 미실행 / 주소 오류 / CORS 또는 네트워크 문제 가능성");
    } else if (/failed to fetch/i.test(backendMessage)) {
      issues.push("fetch failed: 서버 미실행 / 주소 오류 / CORS 가능성");
    } else if (backend.ok === false) {
      issues.push("백엔드 health check 확인 필요");
    }
    if (stt.ok === true && Number(stt.status) === 200 && micPermission === "denied") {
      issues.push("STT 서버는 응답 정상, 브라우저 마이크 권한 차단 가능성");
    } else if (stt.ok === false) {
      issues.push("STT 서버 응답 확인 필요");
    }
    if (micPermission === "denied") {
      issues.push("마이크 권한 차단으로 STT 녹음 불가 가능성");
    }
    if (!pdfDoc) {
      issues.push("PDF 誘몃줈?쒕줈 TEXT_ANCHOR / activeAnchor 寃곌낵 ?놁쓬");
    }
    if (!gesture.handDetected) {
      issues.push("현재 손 인식 없음");
    }
    return issues.slice(0, 3);
  }

  function renderAirDebugPre(value, emptyText = "아직 결과가 없습니다.") {
    return `<pre class="air-debug-pre">${debugJson(value, emptyText)}</pre>`;
  }

  function renderDebugCandidateRows(candidates) {
    if (!candidates.length) return `<p class="air-debug-muted">아직 결과가 없습니다.</p>`;
    return `<table class="air-debug-table"><thead><tr><th>rank</th><th>text</th><th>score</th><th>selected</th></tr></thead><tbody>${candidates.map((candidate) => (
      `<tr class="${candidate.selected ? "air-debug-selected" : ""}"><td>${debugEscape(candidate.rank)}</td><td>${debugEscape(candidate.text)}</td><td>${debugEscape(candidate.score)}</td><td>${debugEscape(candidate.selected)}</td></tr>`
    )).join("")}</tbody></table>`;
  }

  function renderDebugAnchorTable(rows) {
    if (!rows.length) return `<p class="air-debug-muted">아직 결과가 없습니다.</p>`;
    return `<table class="air-debug-table"><thead><tr><th>anchor_id</th><th>page_no</th><th>text</th><th>start_px</th><th>end_px</th><th>score</th></tr></thead><tbody>${rows.map((row) => (
      `<tr class="${row.selected ? "air-debug-selected" : ""}"><td>${debugEscape(row.anchor_id)}</td><td>${debugEscape(row.page_no)}</td><td>${debugEscape(row.text)}</td><td>${debugEscape(row.start_px)}</td><td>${debugEscape(row.end_px)}</td><td>${debugEscape(row.score)}</td></tr>`
    )).join("")}</tbody></table>`;
  }

  function renderDebugPanel() {
    if (!DEBUG_MODE) return;
    ensureDebugPanel();
    if (!debugPanel) return;
    const previousUiState = getAirDebugPanelUiState();

    const anchor = getValidSpeechAnchor();
    // 빨간 매칭 박스 시스템은 폐기됨 — 매 렌더마다 오버레이를 만지지 않는다(불필요한 DOM 작업 제거).
    const anchorPayload = getDebugAnchorPayload(anchor);
    const candidates = getDebugCandidates();
    const rawItems = (pdfRawTextItems.get(currentPage) || []).slice(0, 30);
    const anchorRows = getDebugAnchorRows(anchor);
    const apiState = window.AirNoteDebugApiState || {};
    const gesture = getDebugGestureSummary();
    const rev2Preview = getDebugRev2Preview(anchorPayload, candidates);
    const micPermission = getAirDebugMicPermission();
    const pdfStatus = pdfDoc ? "loaded" : "not-loaded";
    const gestureStatus = gesture.handDetected ? "hand detected" : "not detected";
    const suspectedIssues = getAirDebugSuspectedIssues({ micPermission, gesture });
    const apiHasRequest = Boolean(apiState.url);
    const pdfPageText = pdfDoc ? debugEscape(currentPage || "-") : "-";
    const pdfTotalText = pdfDoc ? debugEscape(totalPage || "-") : "-";
    const pdfScaleText = pdfDoc && pdfCanvas?.width ? `${debugEscape(pdfCanvas.width)}x${debugEscape(pdfCanvas.height)}` : "-";

    const summaryBody = `
      ${renderDebugRows([
        ["Backend", getAirDebugStatusBadge(getAirDebugHealthLabel(backendHealthState), getAirDebugHealthTone(backendHealthState))],
        ["Backend message", debugEscape(backendHealthState.error || backendHealthState.message || "확인 필요")],
        ["STT Server", getAirDebugStatusBadge(getAirDebugHealthLabel(sttHealthState), getAirDebugHealthTone(sttHealthState))],
        ["Mic Permission", getAirDebugStatusBadge(micPermission, getAirDebugMicTone(micPermission))],
        ["PDF", getAirDebugStatusBadge(pdfStatus, pdfDoc ? "success" : "muted")],
        ["Gesture", getAirDebugStatusBadge(gestureStatus, gesture.handDetected ? "success" : "muted")],
      ])}
      <ul class="air-debug-summary-list">${
        (suspectedIssues.length ? suspectedIssues : ["확인 필요 항목 없음"]).map((issue) => `<li>${debugEscape(issue)}</li>`).join("")
      }</ul>`;

    const backendBody = `
      ${renderDebugRows([
        ["Backend Base URL", debugEscape(getDebugBackendBaseUrl())],
        ["health check", getAirDebugStatusBadge(`${getAirDebugHealthLabel(backendHealthState)} ${debugValue(backendHealthState.status)}`, getAirDebugHealthTone(backendHealthState))],
        ["health message", debugEscape(backendHealthState.error || backendHealthState.message || "-")],
      ])}`;

    const sttBody = renderDebugRows([
      ["Local STT endpoint", debugEscape(getDebugSttEndpoint())],
      ["STT health check", getAirDebugStatusBadge(`${getAirDebugHealthLabel(sttHealthState)} ${debugValue(sttHealthState.status)}`, getAirDebugHealthTone(sttHealthState))],
      ["Mic Permission", getAirDebugStatusBadge(micPermission, getAirDebugMicTone(micPermission))],
      ["recording", debugEscape(speechStarted)],
      ["STT request", debugEscape(latestSttStatus?.status === "transcribing" ? "running" : "idle")],
      ["last STT error", debugEscape(latestSttError || sttHealthState.error || "-")],
    ]);

    const pdfBody = renderDebugRows([
      ["PDF", getAirDebugStatusBadge(pdfStatus, pdfDoc ? "success" : "muted")],
      ["문서명", debugEscape(pdfDoc ? currentPdfFileName : "-")],
      ["현재 페이지", pdfPageText],
      ["전체 페이지", pdfTotalText],
      ["PDF scale", pdfScaleText],
      ["TEXT_ANCHOR source", debugEscape(pdfDoc ? textAnchorSource : "-")],
    ]);

    const gestureBody = renderDebugRows([
      ["손 감지 여부", getAirDebugStatusBadge(gesture.handDetected ? "true" : "false", gesture.handDetected ? "success" : "muted")],
      ["pointer 상태", debugEscape(gesture.pointer)],
      ["underline 상태", debugEscape(gesture.underline)],
      ["previous page 상태", debugEscape(gesture.previousPage)],
      ["next page 상태", debugEscape(gesture.nextPage)],
      ["clear gesture 상태", debugEscape(gesture.clearGesture)],
      ["gesture control", getAirDebugStatusBadge(gesture.gestureControl, gesture.gestureControl === "ON" ? "success" : "warning")],
      ["target hand", debugEscape(gesture.handTarget)],
    ]);

    const executionDetailBody = renderDebugRows([
      ["Debug Mode", "ON"],
      ["프론트 실행 주소", debugEscape(location.origin)],
      ["현재 페이지 URL", debugEscape(location.href)],
      ["좌표계", "CANVAS_PX"],
      ["userId", debugEscape(getCurrentUserId?.())],
      ["pdfId", debugEscape(currentPdfId)],
      ["presentationId", debugEscape(currentPresentationId)],
      ["recording", debugEscape(Boolean(presentationSession?.recording))],
      ["last STT request", debugEscape(latestSttRequestAt)],
      ["last STT response", debugEscape(latestSttResponseAt)],
    ]);

    const rawItemsBody = pdfDoc
      ? renderAirDebugPre(rawItems, "아직 결과가 없습니다.")
      : `<p class="air-debug-muted">PDF 업로드 후 확인 가능</p>`;
    const anchorsBody = pdfDoc
      ? renderDebugAnchorTable(anchorRows)
      : `<p class="air-debug-muted">PDF 업로드 후 확인 가능</p>`;
    const apiDetailSection = apiHasRequest ? renderAirDebugSection("마지막 API 상세 정보", renderDebugRows([
      ["마지막 API URL", debugEscape(apiState.url)],
      ["method", debugEscape(apiState.method)],
      ["status code", debugEscape(apiState.status)],
      ["성공/실패", getAirDebugStatusBadge(apiState.ok ? "success" : "fail", apiState.ok ? "success" : "danger")],
      ["오류 메시지", debugEscape(apiState.error || "-")],
      ["CORS/네트워크 오류", debugEscape(apiState.networkError === undefined ? "-" : apiState.networkError)],
      ["JSON 파싱 오류", debugEscape(apiState.jsonParseError === undefined ? "-" : apiState.jsonParseError)],
    ])) : "";

    ensureAirDebugContentShell();
    updateAirDebugSection("summary", "핵심 진단 요약", summaryBody, { open: true });
    updateAirDebugSection("backend", "백엔드 연결 상태", backendBody, { open: true });
    updateAirDebugSection("stt", "STT 서버 / 마이크 상태", sttBody, { open: true });
    updateAirDebugSection("pdf", "PDF 기본 상태", pdfBody, { open: true });
    updateAirDebugSection("gesture", "제스처 상태 요약", gestureBody, { open: true });
    updateAirDebugAdvancedVisibility();
    updateAirDebugSection("speech", "STT 인식 문장", renderAirDebugPre(latestRecognizedSpeech, "아직 인식된 문장이 없습니다."));
    updateAirDebugSection("active-anchor", "activeAnchor 결과", renderAirDebugPre(anchorPayload, pdfDoc ? "아직 결과가 없습니다." : "PDF 업로드 후 확인 가능"));
    updateAirDebugSection("candidates", "candidates 상위 5개", renderDebugCandidateRows(candidates));
    updateAirDebugSection("raw-items", "현재 페이지 Raw Text Items", rawItemsBody);
    updateAirDebugSection("anchors", "TEXT_ANCHOR 목록", anchorsBody);
    updateAirDebugSection("rev2", "Rev2 Table JSON Preview", renderAirDebugPre(rev2Preview));
    updateAirDebugSection("execution", "실행 상태 상세 정보", executionDetailBody);
    const apiDetailMount = debugPanel.querySelector('[data-air-debug-section="api-detail"]');
    if (apiDetailMount) {
      const nextApiDetail = apiDetailSection || "";
      if (apiDetailMount.innerHTML !== nextApiDetail) apiDetailMount.innerHTML = nextApiDetail;
    }
    restoreAirDebugPanelUiState(previousUiState);
  }

  function updateGestureDiagnostics(detail) {
    latestGestureDiagnostics = detail;
    // 디버그 패널을 제스처 프레임마다(~30fps) 재구성하면 메인 스레드가 막혀 손 추적이
    // 밀린다(증상: 음성 인식 중 제스처 멈춤/지연). 150ms로 스로틀해 부하를 낮춘다.
    if (!DEBUG_MODE) return;
    const now = performance.now();
    if (now - lastDebugPanelRenderAt < 150) return;
    lastDebugPanelRenderAt = now;
    renderDebugPanel();
  }

  function getCurrentUserEmail() {
    try {
      const stored = JSON.parse(localStorage.getItem("airnoteCurrentUser") || "null");
      return stored?.email || "example@google.com";
    } catch {
      return "example@google.com";
    }
  }

  // --- SECTION: CALIBRATION ---
  function getCalibrationKey() {
    return `airnoteGestureCalibration:${getCurrentUserEmail()}:v2`;
  }

  function getCalibrationGuideKey() {
    return `airnoteCalibrationGuideRead:${getCurrentUserEmail()}`;
  }

  function getCalibrationData() {
    const raw = localStorage.getItem(getCalibrationKey());
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.version === 2 ? parsed : null;
    } catch (error) {
      console.warn("AirNote presentation: calibration data parse failed.", error);
      return null;
    }
  }

  function renderCalibrationState(statusMessage = "") {
    const calibration = getCalibrationData();
    if (calibration) {
      calibrationBadge?.classList.add("complete");
      if (calibrationBadge) calibrationBadge.textContent = "캘리브레이션 완료";
      if (calibrationStatusText) {
        calibrationStatusText.textContent = statusMessage
          || `???ш린 ${Number(calibration.palmSizePx || 0).toFixed(1)}px 湲곗????곸슜?⑸땲??`;
      }
      if (calibrationStartBtn) calibrationStartBtn.hidden = true;
      if (calibrationResetBtn) calibrationResetBtn.hidden = false;
      return;
    }

    calibrationBadge?.classList.remove("complete");
    if (calibrationBadge) calibrationBadge.textContent = "캘리브레이션 필요";
    if (calibrationStatusText) {
      calibrationStatusText.textContent = statusMessage || "손바닥과 핀치 제스처를 등록해주세요.";
    }
    if (calibrationStartBtn) calibrationStartBtn.hidden = false;
    if (calibrationResetBtn) calibrationResetBtn.hidden = true;
  }

  // 현재 단계(1~5)를 스테퍼에 반영. n<=0이면 모두 비활성.
  function setCalibrationStep(n) {
    if (!calibrationStepper) return;
    calibrationStepper.setAttribute("aria-hidden", n > 0 ? "false" : "true");
    calibrationStepper.querySelectorAll("li").forEach((li) => {
      const step = Number(li.dataset.step);
      li.classList.toggle("is-active", step === n);
      li.classList.toggle("is-done", step < n);
    });
  }

  // 토큰 기반 취소 가능한 지연. 진행 중 모달이 닫히거나 실패하면 무효화된다.
  function guidedDelay(ms, token) {
    return new Promise((resolve) => {
      window.setTimeout(() => resolve(token === guidedCalibrationToken), ms);
    });
  }

  // 손이 인식될 때까지 대기(gesture-diagnostics 1회 수신). timeoutMs 후엔 그냥 진행.
  function waitForHandDetected(token, timeoutMs = 6000) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        window.removeEventListener("airnote:gesture-diagnostics", onDiag);
        resolve(ok && token === guidedCalibrationToken);
      };
      const onDiag = (event) => {
        if (event.detail?.handPoint) finish(true);
      };
      window.addEventListener("airnote:gesture-diagnostics", onDiag);
      window.setTimeout(() => finish(true), timeoutMs); // 손이 안 잡혀도 측정은 시도(엔진이 실패 처리)
    });
  }

  // 5단계 친절 가이드: Step1~2/5는 UI 타이머, Step3~4는 handPointer 측정 이벤트로 구동.
  async function runGuidedCalibration() {
    guidedCalibrationToken += 1;
    const token = guidedCalibrationToken;
    guidedCalibrationActive = true;
    setModalOpen(calibrationModal, true);
    if (calibrationErrorText) calibrationErrorText.textContent = "";
    if (calibrationConfirmBtn) {
      calibrationConfirmBtn.disabled = true;
      calibrationConfirmBtn.textContent = "측정 진행 중...";
    }

    const permissions = await requestPresentationPermissions();
    if (token !== guidedCalibrationToken) return false;
    if (!permissions.webcam) {
      guidedCalibrationActive = false;
      updateCalibrationState({ status: "failed", reason: "웹캠 권한이 허용되지 않았습니다." });
      return false;
    }

    // Step 1 (준비, 1.5초)
    setCalibrationStep(1);
    if (calibrationModalBadge) { calibrationModalBadge.textContent = "1단계 · 준비"; calibrationModalBadge.classList.remove("complete"); }
    if (calibrationPhaseTitle) calibrationPhaseTitle.textContent = "👋 준비되셨나요?";
    if (calibrationPhaseGuide) calibrationPhaseGuide.textContent = "측정을 시작하려면 카메라(화면)를 바라봐주세요.";
    if (calibrationProgressBar) calibrationProgressBar.style.width = "0%";
    if (calibrationSampleText) calibrationSampleText.textContent = "잠시 후 시작합니다...";
    if (!(await guidedDelay(1500, token))) return false;

    // Step 2 (손 인식 대기)
    setCalibrationStep(2);
    if (calibrationModalBadge) calibrationModalBadge.textContent = "2단계 · 손 인식";
    if (calibrationPhaseTitle) calibrationPhaseTitle.textContent = "✋ 손을 얼굴 높이까지 들어주세요";
    if (calibrationPhaseGuide) calibrationPhaseGuide.textContent = "카메라가 손을 인식할 때까지 기다리는 중입니다...";
    await waitForHandDetected(token);
    if (token !== guidedCalibrationToken) return false;
    if (calibrationPhaseGuide) calibrationPhaseGuide.textContent = "손을 인식했어요! 측정을 시작합니다.";
    if (!(await guidedDelay(800, token))) return false;

    // Step 3~4: 실제 측정 시작 → handPointer가 open_palm(3s)→pinch(3s) 진행,
    // updateCalibrationState가 Step 3/4 UI를 구동한다. 완료 시 Step 5 자동 처리.
    if (!window.AirNoteHandPointer?.startCalibration?.()) {
      guidedCalibrationActive = false;
      updateCalibrationState({ status: "failed", reason: "카메라 또는 손 인식 엔진이 준비되지 않았습니다." });
      return false;
    }
    return true;
  }

  function updateCalibrationState(detail = {}) {
    latestCalibrationState = detail;
    presentationStore.setState({ calibration: detail });
    if (detail.status === "collecting") {
      const isPalm = detail.phase === "open_palm";
      const count = isPalm ? detail.sampleCounts?.openPalm : detail.sampleCounts?.pinch;
      const progress = Math.min(100, Math.max(0, (1 - Number(detail.remainingMs || 0) / CALIBRATION_PHASE_MS) * 100));
      // Step 3(손바닥) / Step 4(핀치) — 실제 측정 단계는 handPointer 이벤트로 구동된다.
      setCalibrationStep(isPalm ? 3 : 4);
      if (calibrationStartBtn) {
        calibrationStartBtn.disabled = true;
        calibrationStartBtn.textContent = isPalm ? "✋ 손바닥 측정 중..." : "🤏 핀치 측정 중...";
      }
      if (calibrationModalBadge) {
        calibrationModalBadge.textContent = isPalm ? "3단계 · 손바닥" : "4단계 · 핀치";
        calibrationModalBadge.classList.remove("complete");
      }
      if (calibrationPhaseTitle) calibrationPhaseTitle.textContent = isPalm ? "✋ 손바닥을 펴고 유지해주세요" : "🤏 엄지와 검지를 붙여 유지해주세요";
      if (calibrationPhaseGuide) {
        calibrationPhaseGuide.textContent = isPalm
          ? "손 전체가 화면 중앙에 보이도록 펴고 3초간 천천히 유지해주세요. (최대 범위를 측정 중...)"
          : "엄지와 검지 끝을 붙인 상태로 움직이지 말고 3초간 유지해주세요. (핀치 기준을 측정 중...)";
      }
      if (calibrationProgressBar) calibrationProgressBar.style.width = `${progress}%`;
      if (calibrationSampleText) calibrationSampleText.textContent = `수집된 샘플 ${count || 0}개`;
      if (calibrationErrorText) calibrationErrorText.textContent = "";
      if (calibrationConfirmBtn) {
        calibrationConfirmBtn.disabled = true;
        calibrationConfirmBtn.textContent = "샘플 수집 중";
      }
      renderCalibrationState(
        `${isPalm ? "손바닥을 열고" : "엄지와 검지를 붙이고"} 유지해주세요. 샘플 ${count || 0}개`
      );
    } else if (detail.status === "complete") {
      saveBackendCalibration(detail.profile);
      setCalibrationStep(5);
      if (calibrationStartBtn) {
        calibrationStartBtn.disabled = false;
        calibrationStartBtn.textContent = "🎯 손 움직임 보정 (측정 시작하기)";
      }
      calibrationModalBadge?.classList.add("complete");
      if (calibrationModalBadge) calibrationModalBadge.textContent = "5단계 · 완료";
      if (calibrationPhaseTitle) calibrationPhaseTitle.textContent = "✅ 측정 완료!";
      if (calibrationPhaseGuide) calibrationPhaseGuide.textContent = "이제 더 정확하게 손을 따라갑니다. 잠시 후 자동으로 닫혀요.";
      if (calibrationProgressBar) calibrationProgressBar.style.width = "100%";
      if (calibrationSampleText) {
        calibrationSampleText.textContent = `손바닥 ${detail.sampleCounts?.openPalm || 0}개 · 핀치 ${detail.sampleCounts?.pinch || 0}개`;
      }
      if (calibrationErrorText) calibrationErrorText.textContent = "";
      if (calibrationConfirmBtn) {
        calibrationConfirmBtn.disabled = false;
        calibrationConfirmBtn.textContent = "완료";
      }
      renderCalibrationState("손 캘리브레이션이 완료되었습니다.");
      showToast("캘리브레이션이 저장되었습니다.");
      // Step 5: 가이드 진행 중이면 1.5초 후 자동 종료.
      if (guidedCalibrationActive) {
        guidedCalibrationActive = false;
        const token = guidedCalibrationToken;
        window.setTimeout(() => {
          if (token === guidedCalibrationToken) setModalOpen(calibrationModal, false);
        }, 1500);
      }
    } else if (detail.status === "failed") {
      guidedCalibrationActive = false;
      guidedCalibrationToken += 1;   // 진행 중 타이머/대기 무효화
      setCalibrationStep(0);
      if (calibrationStartBtn) {
        calibrationStartBtn.disabled = false;
        calibrationStartBtn.textContent = "🎯 다시 측정하기";
      }
      calibrationModalBadge?.classList.remove("complete");
      if (calibrationModalBadge) calibrationModalBadge.textContent = "등록 실패";
      if (calibrationPhaseTitle) calibrationPhaseTitle.textContent = "다시 시도해주세요";
      if (calibrationPhaseGuide) calibrationPhaseGuide.textContent = "손 전체가 웹캠 화면 안에 안정적으로 보이는지 확인해주세요.";
      if (calibrationProgressBar) calibrationProgressBar.style.width = "0%";
      if (calibrationErrorText) calibrationErrorText.textContent = detail.reason || "샘플 수가 부족합니다.";
      if (calibrationConfirmBtn) {
        calibrationConfirmBtn.disabled = false;
        calibrationConfirmBtn.textContent = "다시 시도";
      }
      renderCalibrationState(`캘리브레이션 실패: ${detail.reason || "유효 샘플 부족"}`);
    } else {
      if (calibrationConfirmBtn) {
        calibrationConfirmBtn.disabled = false;
        calibrationConfirmBtn.textContent = "캘리브레이션 등록";
      }
      renderCalibrationState();
    }
    renderDebugPanel();
  }

  function updateSelectedPdfLabel(name, extraText = "") {
    if (!selectedPdfLabel) return;
    selectedPdfLabel.textContent = name ? `${name}${extraText ? ` · ${extraText}` : ""}` : "";
  }

  // --- SECTION: CANVAS ---
  function copyCanvasToBackup(canvas) {
    const backup = document.createElement("canvas");
    backup.width = canvas.width || 1;
    backup.height = canvas.height || 1;
    const backupCtx = backup.getContext("2d");
    if (backupCtx && canvas.width && canvas.height) backupCtx.drawImage(canvas, 0, 0);
    return backup;
  }

  function resizeOneCanvas(canvas, ctx, width, height, preserveContent) {
    if (!canvas || !ctx) return;
    if (canvas.width === width && canvas.height === height) return;
    const backup = preserveContent ? copyCanvasToBackup(canvas) : null;
    canvas.width = width;
    canvas.height = height;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (backup && backup.width && backup.height) {
      ctx.drawImage(backup, 0, 0, backup.width, backup.height, 0, 0, width, height);
    }
  }


  function applyOverlayLayout() {
    if (overlayLayoutApplied) return;
    [pdfCanvas, drawCanvas].forEach((canvas) => {
      if (!canvas) return;
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.background = canvas === pdfCanvas && pdfDoc ? "white" : "transparent";
    });

    if (pdfCanvas) {
      pdfCanvas.style.zIndex = "1";
      pdfCanvas.style.pointerEvents = "none";
    }

    if (drawCanvas) {
      drawCanvas.style.zIndex = "2";
      drawCanvas.style.pointerEvents = "none";
      drawCanvas.style.touchAction = "none";
    }

    if (laserPointer) {
      laserPointer.style.position = "absolute";
      // 디버그 매칭 박스 오버레이(anchorMatchOverlay z-index 30)보다 위에 둬서
      // 박스가 떠 있을 때도 포인터가 박스 뒤에 가려지지 않게 한다.
      // (박스가 포인터를 덮으면 제스처가 인식 안 되는 것처럼 보임)
      laserPointer.style.zIndex = "40";
      laserPointer.style.pointerEvents = "none";
    }
    overlayLayoutApplied = true;
  }
  function resizeOverlayCanvases(preserveAnnotation = true) {
    applyOverlayLayout();
    syncAnchorMatchOverlaySize();
    if (!pdfDoc) clearAnchorMatchBox();
    if (pdfCanvas?.width && pdfCanvas?.height) {
      const changed =
        drawCanvas?.width !== pdfCanvas.width ||
        drawCanvas?.height !== pdfCanvas.height;
      if (!changed) return false;
      resizeOneCanvas(drawCanvas, drawCtx, pdfCanvas.width, pdfCanvas.height, preserveAnnotation);
      clearPointer();
      publishPresentationOverlay();
      return true;
    }

    if (!slideArt) return false;
    const rect = slideArt.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const changed =
      pdfCanvas?.width !== width ||
      pdfCanvas?.height !== height ||
      drawCanvas?.width !== width ||
      drawCanvas?.height !== height;
    if (!changed) return false;
    resizeOneCanvas(pdfCanvas, pdfCtx, width, height, false);
    resizeOneCanvas(drawCanvas, drawCtx, width, height, preserveAnnotation);
    clearPointer();
    publishPresentationOverlay();
    return true;
  }

  function clearAnnotationCanvasOnly() {
    annotationEngine.clear();
  }

  function saveCurrentPageAnnotation() {
    annotationEngine.savePage(currentPage);
  }

  function hasCanvasInk() {
    return annotationEngine.hasInk();
  }

  function restoreCurrentPageAnnotation() {
    annotationEngine.restorePage(currentPage, {
      ImageCtor: Image,
      onRestored: () => {
        renderTrackedPage(currentPage);
        publishPresentationOverlay();
      },
    });
  }

  function resetAnnotationState() {
    annotationEngine.reset();
    strokeScenesByPage.clear();
    strokeDeletionTracker.reset();
  }

  function clearCanvas() {
    clearAnnotationCanvasOnly();
    annotationEngine.deletePage(currentPage);
    strokeScenesByPage.delete(currentPage);
    strokeDeletionTracker.reset();
    stopDrawing();
    publishPresentationOverlay();
    recordPresentationEvent("clear_annotations");
  }

  function getAnnotationCount() {
    saveCurrentPageAnnotation();
    return annotationEngine.count();
  }

  function formatDate(date = new Date()) {
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  }

  // --- SECTION: SUMMARY ---
  function getPresentationSummary() {
    const now = new Date();
    const report = window.AirNoteModules.buildPresentationReport({
      totalPage,
      pageDurationsMs: getPageDurationSnapshot(),
      pageMoveCount,
      gestureCounts: pageGestureCounts,
    });
    const progressPercent = getProgressPercent();
    const annotationCount = getAnnotationCount();
    const annotationImages = annotationEngine.entries()
      .filter(([, item]) => item?.dataUrl)
      .map(([pageNo, item]) => ({
        pageNo,
        dataUrl: item.dataUrl,
        width: item.width,
        height: item.height,
      }));

    return {
      id: `presentation-${Date.now()}`,
      date: formatDate(now),
      presentationDate: formatDate(now),
      fileName: currentPdfFileName || "선택한 발표 자료 없음",
      annotationCount,
      elapsedSeconds,
      elapsedText: formatTime(elapsedSeconds),
      elapsedTime: formatTime(elapsedSeconds),
      expectedMinutes,
      progressPercent,
      progressRate: progressPercent,
      totalPage,
      presentationMode: activePresentationMode || "rehearsal",
      pageDurations: report.pageDurations,
      pageMoveCount: report.pageMoveCount,
      longestPage: report.longestPage,
      mostGesturePage: report.mostGesturePage,
      presentationStartTime: presentationStartedAt?.toISOString() || now.toISOString(),
      presentationEndTime: now.toISOString(),
      endedAt: now.toISOString(),
      createdAt: now.toISOString(),
      annotations: annotationImages,
      annotationImages,
    };
  }

  function renderPresentationSummary(summary) {
    if (!presentationSummaryList) return;
    const pageDurationRows = (summary.pageDurations || [])
      .map((page) => `
        <li>
          <span>${page.pageNo}페이지</span>
          <strong>${formatDuration(page.durationSeconds)}</strong>
        </li>
      `)
      .join("");
    const mostGesturePage = summary.mostGesturePage?.count > 0
      ? `${summary.mostGesturePage.pageNo}페이지 · ${summary.mostGesturePage.count}회`
      : "사용 기록 없음";
    presentationSummaryList.innerHTML = `
      <div class="report-overview">
        <article>
          <span>총 발표 시간</span>
          <strong>${summary.elapsedTime || summary.elapsedText}</strong>
        </article>
        <article>
          <span>페이지 이동</span>
          <strong>${summary.pageMoveCount || 0}회</strong>
        </article>
        <article>
          <span>가장 오래 설명</span>
          <strong>${summary.longestPage?.pageNo || 1}페이지</strong>
          <small>${formatDuration(summary.longestPage?.durationSeconds || 0)}</small>
        </article>
        <article>
          <span>제스처가 가장 많이 사용된 페이지</span>
          <strong>${mostGesturePage}</strong>
        </article>
      </div>
      <section class="report-page-section">
        <div class="report-section-heading">
          <h3>페이지별 체류 시간</h3>
          <span>${summary.totalPage || 1}개 슬라이드</span>
        </div>
        <ul class="report-page-list">${pageDurationRows}</ul>
      </section>
      <div class="report-meta">
        <span>${summary.fileName}</span>
        <span>${summary.presentationDate || summary.date}</span>
      </div>
    `;
  }

  function getStoredPresentationRecords() {
    try {
      return JSON.parse(localStorage.getItem(PRESENTATION_RECORDS_KEY) || "[]");
    } catch (error) {
      console.warn("AirNote presentation: records parse failed.", error);
      return [];
    }
  }

  function savePresentationRecord(summary) {
    // 합성 이미지(PDF+판서) dataURL은 페이지당 수 MB라 localStorage 용량을 초과시킨다.
    // 실제 이미지는 백엔드(record image)에 저장되므로 로컬 기록에는 메타데이터만 남긴다.
    const { annotations: _annotations, annotationImages: _annotationImages, ...lightSummary } = summary || {};
    const records = getStoredPresentationRecords();
    try {
      localStorage.setItem(PRESENTATION_RECORDS_KEY, JSON.stringify([lightSummary, ...records]));
    } catch (error) {
      // 그래도 초과하면 가장 최신 기록만 남겨 종료 흐름이 막히지 않게 한다.
      console.warn("AirNote presentation: presentation record save trimmed.", error);
      try {
        localStorage.setItem(PRESENTATION_RECORDS_KEY, JSON.stringify([lightSummary]));
      } catch (innerError) {
        console.warn("AirNote presentation: presentation record save failed.", innerError);
      }
    }
  }

  function showPresentationSummary() {
    stopTimer();
    commitCurrentPageDuration();
    pageEnteredAt = 0;
    updateTimerText();
    const summary = getPresentationSummary();
    renderPresentationSummary(summary);
    if (summaryConfirmBtn) {
      // 무거운 이미지 dataURL은 dataset에 담지 않는다(저장은 백엔드가 담당).
      const { annotations: _a, annotationImages: _ai, ...lightSummary } = summary;
      summaryConfirmBtn.dataset.summary = JSON.stringify(lightSummary);
    }
    setModalOpen(presentationSummaryModal, true);
  }

  async function requestPresentationSummary() {
    await exitNativeFullscreen();
    showPresentationSummary();
  }

  async function confirmPresentationSummary() {
    let summary = null;
    try {
      summary = JSON.parse(summaryConfirmBtn?.dataset.summary || "null");
    } catch (error) {
      console.warn("AirNote presentation: summary parse failed.", error);
    }
    if (summary) savePresentationRecord(summary);
    setModalOpen(presentationSummaryModal, false);
    await stopPresentationSession();
    await exitNativeFullscreen();
  }

  function clearPointer() {
    if (!laserPointer) return;
    laserPointer.style.opacity = "0";
    laserPointer.classList.remove("is-stroke-preview", "is-undo-target");
    laserPointer.style.removeProperty("--undo-progress");
  }

  function clampRatio(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  // --- SECTION: STT ---
  function ensureSttAnchorOverlay() {
    if (sttAnchorOverlay || !slideArt) return sttAnchorOverlay;
    sttAnchorOverlay = document.createElement("div");
    sttAnchorOverlay.id = "sttAnchorOverlay";
    sttAnchorOverlay.setAttribute("aria-hidden", "true");
    slideArt.appendChild(sttAnchorOverlay);
    return sttAnchorOverlay;
  }

  function clearSttAnchorBox() {
    if (sttAnchorClearTimer) {
      window.clearTimeout(sttAnchorClearTimer);
      sttAnchorClearTimer = null;
    }
    sttAnchorOverlay?.replaceChildren();
  }

  function syncAnchorMatchOverlaySize() {
    if (!anchorMatchOverlay || !pdfCanvas) return;
    const w = pdfCanvas.clientWidth;
    const h = pdfCanvas.clientHeight;
    // 캔버스가 아직 렌더되지 않았으면 건너뜀 (intrinsic 버퍼 사이즈를 쓰면 overlay가 PDF 해상도만큼 커져서 레이아웃이 깨짐)
    if (!w || !h) {
      anchorMatchOverlay.style.width = "";
      anchorMatchOverlay.style.height = "";
      return;
    }
    anchorMatchOverlay.style.width = `${w}px`;
    anchorMatchOverlay.style.height = `${h}px`;
  }

  function clearAnchorMatchBox({ force = false } = {}) {
    // 디버그: 매칭 박스는 TTL 동안 유지한다. 제스처 소비/무음 청크 같은 일상적 clear는
    // 무시하고, 페이지 전환·PDF 교체 등 하드 리셋(force)에서만 즉시 지운다.
    if (sttMatchBoxTimer && !force) return;
    if (force && sttMatchBoxTimer) {
      window.clearTimeout(sttMatchBoxTimer);
      sttMatchBoxTimer = null;
    }
    anchorMatchOverlay?.replaceChildren();
    lastMatchBoxAnchor = null;
  }

  // (삭제됨) showPersistentMatchBox — 빨간 매칭 박스 시스템 폐기로 호출자가 사라져 제거함.
  //  채택된 앵커는 후보 박스 #1(is-selected ✓) 단일 시스템으로 표시한다.

  function getAnchorPageNo(anchor) {
    const pageNo = Number(anchor?.page_no ?? anchor?.pageNo ?? anchor?.page ?? anchor?.PAGE_NO);
    return Number.isFinite(pageNo) ? pageNo : null;
  }

  function readAnchorPoint(anchor, names) {
    for (const name of names) {
      const value = name.includes(".")
        ? name.split(".").reduce((target, key) => target?.[key], anchor)
        : anchor?.[name];
      const numberValue = Number(value);
      if (Number.isFinite(numberValue)) return numberValue;
    }
    return null;
  }

  function getAnchorMatchBox(anchor) {
    if (!anchor || !anchorMatchOverlay || !pdfCanvas) {
      console.warn("[AirNote BOX] null: 기본 요소 없음", { anchor: !!anchor, overlay: !!anchorMatchOverlay, canvas: !!pdfCanvas });
      return null;
    }
    const anchorPage = getAnchorPageNo(anchor);
    if (anchorPage !== currentPage) {
      console.warn("[AirNote BOX] null: 페이지 불일치", { anchorPage, currentPage });
      return null;
    }

    syncAnchorMatchOverlaySize();

    const coordBaseWidth = Number(
      anchor.coord_base_width ?? anchor.coordBaseWidth ??
      anchor.page_width ?? anchor.pageWidth ?? anchor.COORD_BASE_WIDTH ?? pdfCanvas.width,
    );
    const coordBaseHeight = Number(
      anchor.coord_base_height ?? anchor.coordBaseHeight ??
      anchor.page_height ?? anchor.pageHeight ?? anchor.COORD_BASE_HEIGHT ?? pdfCanvas.height,
    );

    // 좌표를 0~1 비율로 통일한다. 비율 필드가 없으면 px를 coordBase로 나눠 비율화.
    let xR = Number(anchor.xRatio ?? anchor.x_ratio ?? anchor.X_RATIO);
    let yR = Number(anchor.yRatio ?? anchor.y_ratio ?? anchor.Y_RATIO);
    let wR = Number(anchor.widthRatio ?? anchor.width_ratio ?? anchor.WIDTH_RATIO);
    let hR = Number(anchor.heightRatio ?? anchor.height_ratio ?? anchor.HEIGHT_RATIO);

    if (![xR, yR].every(Number.isFinite)) {
      const sx = readAnchorPoint(anchor, ["start_px.x", "startPx.x", "START_X_PX", "start_x_px", "x_px", "x"]);
      const sy = readAnchorPoint(anchor, ["start_px.y", "startPx.y", "START_Y_PX", "start_y_px", "y_px", "y"]);
      const ex = readAnchorPoint(anchor, ["end_px.x", "endPx.x", "END_X_PX", "end_x_px", "endX"]);
      const ey = readAnchorPoint(anchor, ["end_px.y", "endPx.y", "END_Y_PX", "end_y_px", "endY"]);
      if (Number.isFinite(sx) && Number.isFinite(sy) && coordBaseWidth > 0 && coordBaseHeight > 0) {
        xR = sx / coordBaseWidth;
        yR = sy / coordBaseHeight;
        if (Number.isFinite(ex)) wR = (ex - sx) / coordBaseWidth;
        if (Number.isFinite(ey)) hR = (ey - sy) / coordBaseHeight;
      } else {
        console.warn("[AirNote BOX] null: px/비율 둘 다 없음", { sx, sy, anchorKeys: Object.keys(anchor) });
        return null;
      }
    }
    if (!Number.isFinite(wR) || wR <= 0) wR = 0.04;
    if (!Number.isFinite(hR) || hR <= 0) hR = 0.025;
    // mapRatioToOverlayPx: territory 기반 단일 변환원 (getBoundingClientRect 실측,
    // 레터박스·오프셋·전체화면 전환 보정). appendSttOverlayBox와 동일 경로.
    const px = mapRatioToOverlayPx(
      anchorMatchOverlay, clampRatio(xR), clampRatio(yR),
      Math.max(0.01, wR), Math.max(0.018, hR),
    );
    if (!px) {
      console.warn("[AirNote BOX] null: 캔버스 표시 크기 0");
      return null;
    }
    return {
      left: Math.max(0, px.left - 6),
      top: Math.max(0, px.top - 6),
      width: Math.max(40, px.width) + 12,
      height: Math.max(28, px.height) + 12,
    };
  }

  // 박스 DOM만 현재 오버레이 크기에 맞춰 그린다(타이머/TTL은 건드리지 않음).
  // 레이아웃 변경 시 재호출해도 박스가 유지되도록 분리했다.
  function paintAnchorMatchBox(anchor) {
    if (!anchorMatchOverlay) return false;
    const box = getAnchorMatchBox(anchor);
    if (!box) return false;

    const el = document.createElement("div");
    el.className = "stt-anchor-match-box";
    el.style.left = `${box.left}px`;
    el.style.top = `${box.top}px`;
    el.style.width = `${box.width}px`;
    el.style.height = `${box.height}px`;

    const label = document.createElement("div");
    label.className = "stt-anchor-match-label";
    const matchedPhrase =
      anchor.matched_phrase ||
      anchor.matchedPhrase ||
      anchor.matchedText ||
      anchor.text ||
      anchor.TEXT_ORIGINAL ||
      "matched";
    // 진단: 박스에 앵커 종류/비율/매칭된 라인 텍스트를 함께 표기한다.
    // 인식 문구와 라인 텍스트가 다르면 "엉뚱한 텍스트에 매칭"된 것, y비율이 실제 글자
    // 위치와 다르면 "좌표 변환" 문제임을 스크린샷만으로 구분할 수 있다.
    const yR = Number(anchor.yRatio ?? anchor.y_ratio);
    const xR = Number(anchor.xRatio ?? anchor.x_ratio);
    const kind = anchor.kind || "?";
    const lineText = anchor.lineText || anchor.text || "";
    label.textContent =
      `${matchedPhrase}  ·[${kind}] x${Number.isFinite(xR) ? xR.toFixed(2) : "?"} ` +
      `y${Number.isFinite(yR) ? yR.toFixed(2) : "?"} · 라인:"${String(lineText).slice(0, 24)}"`;

    el.appendChild(label);
    anchorMatchOverlay.replaceChildren(el);
    lastMatchBoxAnchor = anchor;
    return true;
  }

  function showAnchorMatchBox() {
    // 빨간 매칭 박스(stt-anchor-match-box)는 후보 #1(is-selected)과 중복이라 폐기한다.
    // 모든 호출 경로(updateAnchorMatchDebugOverlay / showPersistentMatchBox)가 이 함수를
    // 거치므로, 여기서 오버레이를 비워만 두면 빨간 박스가 어디서도 그려지지 않는다.
    if (!anchorMatchOverlay) return;
    clearAnchorMatchBox({ force: true });
  }

  // 전체화면/리사이즈 등 레이아웃 변경 후, 떠 있는 매칭 박스를 현재 좌표계로 다시 그린다.
  function redrawAnchorMatchBoxForLayout() {
    if (!lastMatchBoxAnchor || !anchorMatchOverlay?.childElementCount) return;
    paintAnchorMatchBox(lastMatchBoxAnchor);
  }

  function updateAnchorMatchDebugOverlay(anchor) {
    if (!DEBUG_MODE) {
      clearAnchorMatchBox();
      return;
    }
    if (!anchor) {
      clearAnchorMatchBox();
      return;
    }
    if (getAnchorPageNo(anchor) !== currentPage) {
      clearAnchorMatchBox();
      return;
    }

    const selected =
      anchor.selected === true ||
      anchor.SELECTED === true ||
      anchor.is_selected === true ||
      anchor.isSelected === true ||
      activeTextAnchor === anchor ||
      speechAnchorEngine.getActive(currentPage) === anchor;
    const score = Number(anchor.score ?? anchor.SCORE ?? anchor.match_score ?? anchor.matchScore ?? 0);
    const threshold = Number(window.CURRENT_PAGE_AUTO_SELECT_THRESHOLD || STT_CONFIDENCE_THRESHOLD);

    if (!selected && score < threshold) {
      clearAnchorMatchBox();
      return;
    }

    showAnchorMatchBox(anchor);
  }

  // 단일 좌표 변환원(territory 기반): 앵커 비율(0~1, PDF 페이지 기준)을 오버레이 로컬
  // 픽셀로 변환한다. 실제 렌더된 pdfCanvas/오버레이의 getBoundingClientRect를 읽으므로
  // 레터박스·object-fit:fill·전체화면 전환과 무관하게 정확하다. getAnchorMatchBox(빨간
  // 매칭 박스)가 쓰는 검증된 방식과 동일하다. (구 % 기반 배치는 전체화면에서 깨져 폐기)
  function mapRatioToOverlayPx(overlay, xR, yR, wR, hR) {
    if (!overlay || !pdfCanvas) return null;
    const canvasRect = pdfCanvas.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const dispW = canvasRect.width || pdfCanvas.clientWidth || pdfCanvas.width;
    const dispH = canvasRect.height || pdfCanvas.clientHeight || pdfCanvas.height;
    if (!dispW || !dispH) return null;
    const offsetX = canvasRect.x - overlayRect.x;
    const offsetY = canvasRect.y - overlayRect.y;
    return {
      left: offsetX + clampRatio(xR) * dispW,
      top: offsetY + clampRatio(yR) * dispH,
      width: Math.max(0, wR) * dispW,
      height: Math.max(0, hR) * dispH,
    };
  }

  // 레이아웃 변경(리사이즈/전체화면) 후, 이미 떠 있는 STT 박스들을 현재 좌표계로 재배치한다.
  // 박스는 절대 px로 배치되므로(% 자동추적 불가) 비율을 dataset에 보관해 두고 다시 계산한다.
  function repositionSttAnchorBoxes() {
    if (!sttAnchorOverlay) return;
    for (const box of sttAnchorOverlay.children) {
      const xR = Number(box.dataset.xr);
      const yR = Number(box.dataset.yr);
      const wR = Number(box.dataset.wr);
      const hR = Number(box.dataset.hr);
      if (![xR, yR, wR, hR].every(Number.isFinite)) continue;
      const px = mapRatioToOverlayPx(sttAnchorOverlay, xR, yR, wR, hR);
      if (!px) continue;
      box.style.left = `${px.left}px`;
      box.style.top = `${px.top}px`;
      box.style.width = `${px.width}px`;
      box.style.height = `${px.height}px`;
    }
  }

  function appendSttOverlayBox(anchor, { className, label } = {}) {
    if (!anchor) return null;
    const anchorPageNo = Number.isFinite(Number(anchor.pageNo)) ? Number(anchor.pageNo) : null;
    if (anchorPageNo === null || anchorPageNo !== currentPage) return null;
    const overlay = ensureSttAnchorOverlay();
    if (!overlay) return null;
    const xR = clampRatio(anchor.xRatio);
    const yR = clampRatio(anchor.yRatio);
    const wR = Math.max(0.018, clampRatio(anchor.widthRatio || 0.04));
    const hR = Math.max(0.018, clampRatio(anchor.heightRatio || 0.025));
    const px = mapRatioToOverlayPx(overlay, xR, yR, wR, hR);
    if (!px) return null;
    const box = document.createElement("div");
    box.className = className;
    box.style.left = `${px.left}px`;
    box.style.top = `${px.top}px`;
    box.style.width = `${px.width}px`;
    box.style.height = `${px.height}px`;
    // 레이아웃 재배치(repositionSttAnchorBoxes)를 위해 원본 비율을 보관한다.
    box.dataset.xr = String(xR);
    box.dataset.yr = String(yR);
    box.dataset.wr = String(wR);
    box.dataset.hr = String(hR);
    box.dataset.label = label || anchor.text || "";
    overlay.appendChild(box);
    return box;
  }

  function renderSttDebugOverlay() {
    if (!sttDebugEnabled) return;
    const diagnostics = latestMatchDiagnostics;
    const candidates = diagnostics?.candidates || [];
    candidates.forEach((candidate, index) => {
      const isTop = index === 0;
      const accepted = Boolean(diagnostics?.accepted && isTop);
      // 1위 후보는 채택 여부와 무관하게 항상 강조한다(채택=초록, 미채택 1위=주황).
      const modifier = accepted ? " is-selected" : isTop ? " is-top" : "";
      appendSttOverlayBox(candidate, {
        className: `air-debug-candidate-box${modifier}`,
        label: `#${index + 1} ${Number(candidate.score || 0).toFixed(2)}${accepted ? " ✓" : ""} ${candidate.text || ""}`,
      });
    });
    // 채택 후보가 0개일 때: "근접 추정" 약한 후보를 회색 점선으로 표시해, 미매칭 상황에서도
    // STT가 어느 단어 근처로 들렸는지 눈으로 확인하게 한다.
    (diagnostics?.debugCandidates || []).forEach((candidate) => {
      appendSttOverlayBox(candidate, {
        className: "air-debug-candidate-box is-weak",
        label: `~${Number(candidate.score || 0).toFixed(2)} ${candidate.text || ""}`,
      });
    });
  }

  function showSttAnchorBox(anchor, { transcript = "", matchedText = "" } = {}) {
    if (!anchor) return;
    // 방어적 가드: 프로덕션(비디버그)에서는 박스를 그리지 않는다.
    if (!DEBUG_MODE) return;
    const anchorPageNo = Number.isFinite(Number(anchor.pageNo)) ? Number(anchor.pageNo) : null;
    if (anchorPageNo === null || anchorPageNo !== currentPage) return;
    if (!ensureSttAnchorOverlay()) return;
    // 박스 시스템 일원화: 매칭/후보를 단일 후보 박스(air-debug-candidate-box)로만 표시한다.
    // 채택된 앵커는 후보 #1에 is-selected(초록 ✓)로 강조되므로 별도 anchor-box(중복)는 그리지 않는다.
    clearSttAnchorBox();
    renderSttDebugOverlay();
  }

  // 레거시 STT 디버그 카드는 제거되었다. 카드 갱신은 더 이상 필요 없으므로 no-op으로
  // 둔다(STT 상태 변화 시 호출되던 다수 지점을 안전하게 유지하기 위함). 인식 단어 박스는
  // 슬라이드 오버레이로, 상세 정보는 우하단 플로팅 디버그 패널로 확인한다.
  function renderSttDebugPanel() {}

  function setSttDebugEnabled(enabled) {
    sttDebugEnabled = DEBUG_MODE && Boolean(enabled);
    localStorage.setItem(STT_DEBUG_STORAGE_KEY, String(sttDebugEnabled));
    clearSttAnchorBox();
    if (sttDebugEnabled) {
      renderSttDebugOverlay();
      const anchor = getValidSpeechAnchor();
      if (anchor) showSttAnchorBox(anchor, {
        transcript: latestMatchDiagnostics?.transcript || "",
        matchedText: anchor.matchedText || anchor.text,
      });
    }
  }

  function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function getValidSpeechAnchor() {
    // speechAnchorEngine이 TTL·pageNo·clear를 단일 권위로 관리한다.
    // activeTextAnchorSelectedAt(이중 시계)는 제거 — 엔진이 ttlMs: SPEECH_ANCHOR_TTL_MS로
    // 이미 동일 만료를 수행하므로 중복 판정이 불필요하다.
    return speechAnchorEngine.getActive(currentPage);
  }

  // 포인터 세션이 소비한 앵커를 stroke로 넘길 때, 음성 인식 시점 기준 TTL 이내이고
  // 현재 페이지일 때만 유효한 것으로 본다. 이렇게 해야 "음성인식 후" 모드(앵커 고정)와
  // "음성없이" 모드(상대이동)가 시간으로 깔끔하게 분리되어 서로 섞이지 않는다.
  function getFreshSessionAnchor(anchor) {
    if (!anchor) return null;
    if (Number(anchor.pageNo) !== currentPage) return null;
    const selectedAt = Number(anchor.selectedAt);
    if (!Number.isFinite(selectedAt)) return null;
    if (Date.now() - selectedAt > SPEECH_ANCHOR_TTL_MS) return null;
    return anchor;
  }

  // 앵커를 즉시 만료(consume)시킨다. 이미 시작된 세션의 anchorPoint는 유지되므로
  // 현재 비례 이동은 계속되고, 이후 새 제스처가 옛 앵커로 튀는 것을 막는다.
  // 화면 박스(activeTextAnchor)는 디버그용이라 그대로 두고, 유효성 판정만 끊는다.
  function consumeSpeechAnchor() {
    speechAnchorEngine.clear();
  }

  function updateSpeechAnchor(anchor) {
    if (!anchor) {
      activeTextAnchor = null;
      speechAnchorEngine.clear();
      presentationStore.setState({ speechAnchor: null });
      clearSttAnchorBox();
      clearAnchorMatchBox();
      renderDebugPanel();
      return null;
    }
    activeTextAnchor = {
      ...anchor,
      pageNo: Number(anchor.pageNo || currentPage),
      xRatio: clampRatio(anchor.xRatio),
      yRatio: clampRatio(anchor.yRatio),
      widthRatio: clampRatio(anchor.widthRatio),
      heightRatio: clampRatio(anchor.heightRatio),
      selectedAt: anchor.selectedAt || Date.now(),
    };
    speechAnchorEngine.update(activeTextAnchor);
    presentationStore.setState({ speechAnchor: activeTextAnchor });
    recordPresentationEvent("speech_anchor", activeTextAnchor);
    showSttAnchorBox(activeTextAnchor, { matchedText: activeTextAnchor.matchedText || activeTextAnchor.text });
    updateAnchorMatchDebugOverlay(activeTextAnchor);
    renderDebugPanel();
    return activeTextAnchor;
  }

  function getAnchorStartPoint(anchor) {
    if (!anchor) return null;
    return {
      xRatio: clampRatio(anchor.xRatio),
      yRatio: clampRatio(anchor.yRatio + anchor.heightRatio / 2),
    };
  }


  function getUnderlineStartPoint(anchor) {
    if (!anchor) return null;
    return {
      xRatio: clampRatio(anchor.xRatio),
      yRatio: clampRatio(anchor.yRatio + anchor.heightRatio + 0.006),
    };
  }

  function getStrokeAnchorStartPoint(anchor, tool = currentMode, mode = underlineMode) {
    if (!anchor) return null;
    if (mode === "straight") return getUnderlineStartPoint(anchor);
    if (tool === "highlight") {
      return {
        xRatio: clampRatio(anchor.xRatio),
        yRatio: clampRatio(anchor.yRatio + anchor.heightRatio / 2),
      };
    }
    return getAnchorStartPoint(anchor);
  }

  function getCurrentLineAnchors() {
    return (pdfTextAnchors.get(currentPage) || []).filter((anchor) => anchor.kind === "line");
  }

  function getNearestTextLine(xRatio, yRatio) {
    const lines = getCurrentLineAnchors();
    let best = null;
    let bestDistance = Infinity;
    lines.forEach((line) => {
      const centerY = line.yRatio + line.heightRatio / 2;
      const left = line.xRatio - 0.04;
      const right = line.xRatio + line.widthRatio + 0.04;
      const xDistance = xRatio < left ? left - xRatio : xRatio > right ? xRatio - right : 0;
      const yDistance = Math.abs(yRatio - centerY);
      const distance = yDistance + xDistance * 0.45;
      const maxDistance = Math.max(0.045, line.heightRatio * 2.8);
      if (distance <= maxDistance && distance < bestDistance) {
        best = line;
        bestDistance = distance;
      }
    });
    return best;
  }

  function getHighlightWidth(line) {
    if (!line || !drawCanvas) return DEFAULT_HIGHLIGHT_WIDTH;
    return Math.max(8, Math.min(42, line.heightRatio * drawCanvas.height * 0.8));
  }

  // --- SECTION: GESTURE ---
  function endGestureSession(reason = "ended") {
    gestureSession = null;
    lastRenderedPointerRatio = null;   // 세션 종료 시 전환 기준점 초기화(재진입 시 즉시 배치)
    presentationStore.setState({ gesture: { active: false, mode: currentMode, reason } });
    stopDrawing();
    if (reason !== "mode-change") clearPointer();
  }

  function beginGestureSession(mode, handPoint) {
    if (!handPoint || !drawCanvas) return null;
    const normalizedMode = modeLabelMap[mode] ? mode : currentMode;
    const anchor = getValidSpeechAnchor();
    // 포인터/판서 원점 = 인식된 문장(줄)의 "시작점"(좌측 끝, 세로 중앙).
    const anchorPoint = getAnchorStartPoint(anchor);
    // 부드러운 전환: 현재 포인터 위치에서 앵커 시작점으로 글라이드한다.
    const anchorTransition = anchorPoint && lastRenderedPointerRatio
      ? { from: { ...lastRenderedPointerRatio }, startedAt: performance.now() }
      : null;
    gestureSession = {
      mode: normalizedMode,
      pageNo: currentPage,
      anchored: Boolean(anchorPoint),
      anchor,
      anchorPoint,
      anchorTransition,
      currentLine: anchor || null,
      highlightWidth: anchor ? getHighlightWidth(anchor) : DEFAULT_HIGHLIGHT_WIDTH,
      startHand: {
        xRatio: clampRatio(handPoint.xRatio),
        yRatio: clampRatio(handPoint.yRatio),
      },
      lastOutput: null,
      annotationLogged: false,
    };
    currentHighlightWidth = gestureSession.highlightWidth || DEFAULT_HIGHLIGHT_WIDTH;
    presentationStore.setState({
      gesture: { active: true, mode: gestureSession.mode, anchored: gestureSession.anchored },
    });
    // Point 1: 앵커를 세션이 소비(consume)했으므로 즉시 만료시킨다.
    // 세션은 이미 anchorPoint를 캡처했으므로 비례 이동은 계속되고,
    // 7초 뒤 손을 들었을 때 옛 앵커로 튀는 부작용을 막는다. 새 음성이 오면 다시 무장된다.
    if (gestureSession.anchored) consumeSpeechAnchor();
    return gestureSession;
  }

  // 제스처 중 매칭: 이미 active 상태인 포인터 세션이 아직 채택하지 않은 새 음성 앵커가
  // 무장되면, 세션 원점을 그 글자로 재정렬한다. (기존 주석이 약속했으나 구현이 빠져 있던 동작.)
  function realignGestureSessionToAnchor(session, anchor, handPoint) {
    const anchorPoint = getAnchorStartPoint(anchor);
    if (!anchorPoint) return;
    session.anchor = anchor;
    session.anchorPoint = anchorPoint;
    session.anchored = true;
    session.currentLine = anchor;
    session.highlightWidth = getHighlightWidth(anchor);
    // 원점이 글자로 점프하므로 손 변위 기준점도 현재 손으로 리셋한다(점프 폭 폭주 방지).
    session.startHand = {
      xRatio: clampRatio(handPoint.xRatio),
      yRatio: clampRatio(handPoint.yRatio),
    };
    session.anchorTransition = lastRenderedPointerRatio
      ? { from: { ...lastRenderedPointerRatio }, startedAt: performance.now() }
      : null;
    currentHighlightWidth = session.highlightWidth || DEFAULT_HIGHLIGHT_WIDTH;
    presentationStore.setState({ gesture: { active: true, mode: session.mode, anchored: true } });
    // 채택했으므로 앵커를 만료시킨다(다음 새 음성에서 다시 무장).
    consumeSpeechAnchor();
  }

  function getGestureOutputPoint(handPoint) {
    if (!drawCanvas || !handPoint) return null;
    const handX = clampRatio(handPoint.xRatio);
    const handY = clampRatio(handPoint.yRatio);

    // 寃吏 ?섎굹 ?쒖뒪泥섎뒗 UI?먯꽌 ?좏깮???꾧뎄? 臾닿??섍쾶 ??긽 ?ъ씤?곕떎.
    // STT ?듭빱媛 ?좏슚?섎㈃ ?ъ씤???쒖옉?먯쓣 ?듭빱 以묒떖?쇰줈 蹂댁젙?섍퀬,
    // ?댄썑 ???대룞?됱? 湲곗〈 ?곷? 醫뚰몴 媛먮룄 諛곗닔瑜??좎??쒕떎.
    // 포인터 세션이 없으면 새로 시작하며 그 순간의 유효 앵커를 채택한다.
    // 손이 이미 떠 있는 상태(active 세션)에서 말한 경우만 1회 보정: "앵커 없이 시작한"
    // 세션에 한해, 새로 무장된 음성 앵커를 획득해 원점을 글자로 재정렬한다.
    //   - 버그 해결: 손 들고 말하면 포인터가 그 문장에서 시작.
    //   - 지터 방지: 이미 앵커가 잡힌 세션은 잠겨서, 발화 중 비슷한 단어가 매칭돼도
    //     좌표가 튀지 않는다. (다른 문장으로 옮기려면 손을 잠깐 내렸다 다시 든다.)
    const needsNewSession = !gestureSession || gestureSession.pageNo !== currentPage || gestureSession.mode !== "pointer";
    if (needsNewSession) {
      beginGestureSession("pointer", { xRatio: handX, yRatio: handY });
    } else if (gestureSession && !gestureSession.anchored) {
      const freshAnchor = getValidSpeechAnchor();
      if (freshAnchor && freshAnchor !== gestureSession.anchor) {
        realignGestureSessionToAnchor(gestureSession, freshAnchor, { xRatio: handX, yRatio: handY });
      }
    }
    if (!gestureSession) return null;

    let xRatio = handX;
    let yRatio = handY;
    if (gestureSession.anchored && gestureSession.anchorPoint) {
      xRatio = gestureSession.anchorPoint.xRatio + (handX - gestureSession.startHand.xRatio) * GESTURE_MOVEMENT_GAIN;
      yRatio = gestureSession.anchorPoint.yRatio + (handY - gestureSession.startHand.yRatio) * GESTURE_MOVEMENT_GAIN;
      // 부드러운 전환: 세션 시작 직후 ANCHOR_TRANSITION_MS 동안 직전 포인터 위치 →
      // (앵커 시작점 + 손 변위) 목표 지점으로 easeOutCubic 글라이드한다.
      const transition = gestureSession.anchorTransition;
      if (transition?.from) {
        const elapsed = performance.now() - transition.startedAt;
        const t = clampRatio(elapsed / ANCHOR_TRANSITION_MS);
        if (t >= 1) {
          gestureSession.anchorTransition = null;
        } else {
          const eased = 1 - Math.pow(1 - t, 3);
          xRatio = transition.from.xRatio + (xRatio - transition.from.xRatio) * eased;
          yRatio = transition.from.yRatio + (yRatio - transition.from.yRatio) * eased;
        }
      }
    } else {
      const pointerPoint = window.AirNoteModules.mapDynamicPointerPoint(
        gestureSession.startHand,
        { xRatio: handX, yRatio: handY },
        {
          minGain: POINTER_MOVEMENT_MIN_GAIN,
          maxGain: POINTER_MOVEMENT_MAX_GAIN,
        },
      );
      xRatio = pointerPoint.xRatio;
      yRatio = pointerPoint.yRatio;
    }

    const line = getNearestTextLine(clampRatio(xRatio), clampRatio(yRatio)) || gestureSession.currentLine;
    if (line) {
      gestureSession.currentLine = line;
      gestureSession.highlightWidth = getHighlightWidth(line);
      currentHighlightWidth = gestureSession.highlightWidth;
    } else {
      currentHighlightWidth = DEFAULT_HIGHLIGHT_WIDTH;
    }

    const output = {
      xRatio: clampRatio(xRatio),
      yRatio: clampRatio(yRatio),
      x: clampRatio(xRatio) * drawCanvas.width,
      y: clampRatio(yRatio) * drawCanvas.height,
    };
    gestureSession.lastOutput = output;
    lastRenderedPointerRatio = { xRatio: output.xRatio, yRatio: output.yRatio };
    return output;
  }

  function updateGestureSession(handPoint, isActive = true) {
    if (!isActive) {
      strokeDeletionTracker.reset();
      endGestureSession("gesture-off");
      return null;
    }
    resizeOverlayCanvases(true);
    const output = getGestureOutputPoint(handPoint);
    if (!output) return null;

    // 寃吏??臾댁“嫄??ъ씤?곕쭔 ?쒖떆?쒕떎.
    // ???뺢킅???좏깮? ?꾩?+寃吏 ?먯꽌 ?쒖뒪泥섏쓽 ?ㅽ????좏깮??肉먯씠??
    const deletionState = updateRecentStrokeDeletion(output);
    drawPointer(
      output.x,
      output.y,
      deletionState.active ? "undo-target" : "pointer",
      deletionState.progress,
    );
    stopDrawing();

    const now = performance.now();
    if (now - lastRecordedPointerAt >= 180) {
      lastRecordedPointerAt = now;
      recordPresentationEvent("pointer_move", {
        xRatio: output.xRatio,
        yRatio: output.yRatio,
        selectedTool: currentMode,
      });
    }
    return {
      ...output,
      anchored: Boolean(gestureSession?.anchored),
      anchorText: gestureSession?.anchor?.text || "",
      selectedTool: currentMode,
      pointerOnly: true,
      strokeDeletion: deletionState,
    };
  }

  function mapUnderlinePoint(handPoint) {
    if (!underlineGesture || !drawCanvas) return null;
    const handX = clampRatio(handPoint?.xRatio);
    const handY = clampRatio(handPoint?.yRatio);
    let xRatio = handX;
    let yRatio = handY;
    if (underlineGesture.anchored && underlineGesture.anchorPoint) {
      xRatio = underlineGesture.anchorPoint.xRatio
        + (handX - underlineGesture.startHand.xRatio) * STROKE_MOVEMENT_GAIN;
      yRatio = underlineGesture.anchorPoint.yRatio
        + (handY - underlineGesture.startHand.yRatio) * STROKE_MOVEMENT_GAIN;
    }

    xRatio = clampRatio(xRatio);
    yRatio = clampRatio(yRatio);

    // ?뺢킅?쒖? STT ?듭빱 ?먮뒗 fallback 醫뚰몴 二쇰????띿뒪??以?以묒떖?쇰줈 蹂댁젙?쒕떎.
    // 二쇰? ?띿뒪?멸? ?놁쓣 ?뚮쭔 湲곕낯 18px 援듦린瑜??ъ슜?쒕떎.
    if (underlineGesture.tool === "highlight") {
      const nearestLine = getNearestTextLine(xRatio, yRatio) || underlineGesture.currentLine || underlineGesture.anchor;
      if (nearestLine) {
        underlineGesture.currentLine = nearestLine;
        currentHighlightWidth = getHighlightWidth(nearestLine);
        yRatio = clampRatio(nearestLine.yRatio + nearestLine.heightRatio / 2);
      } else {
        underlineGesture.currentLine = null;
        currentHighlightWidth = DEFAULT_HIGHLIGHT_WIDTH;
      }
    }

    return {
      xRatio,
      yRatio,
      x: xRatio * drawCanvas.width,
      y: yRatio * drawCanvas.height,
    };
  }

  function getStrokePreviewPoint(handPoint) {
    if (!drawCanvas || !handPoint) return null;
    const tool = currentMode === "highlight" ? "highlight" : "pen";
    const anchor = getValidSpeechAnchor();
    const anchorPoint = getStrokeAnchorStartPoint(anchor, tool, underlineMode);
    let xRatio = anchorPoint?.xRatio ?? clampRatio(handPoint.xRatio);
    let yRatio = anchorPoint?.yRatio ?? clampRatio(handPoint.yRatio);
    const nearestLine = getNearestTextLine(xRatio, yRatio);
    if (!anchorPoint && nearestLine) {
      yRatio = clampRatio(nearestLine.yRatio + nearestLine.heightRatio / 2);
    }
    return {
      xRatio: clampRatio(xRatio),
      yRatio: clampRatio(yRatio),
      x: clampRatio(xRatio) * drawCanvas.width,
      y: clampRatio(yRatio) * drawCanvas.height,
      anchored: Boolean(anchorPoint),
      anchorText: anchor?.text || "",
    };
  }

  function getMedianPoint(points) {
    return {
      xRatio: getMedianValue(points.map((point) => point.xRatio)),
      yRatio: getMedianValue(points.map((point) => point.yRatio)),
    };
  }

  function getLineSnappedStartPoint(point, gesture = underlineGesture) {
    if (!point || !drawCanvas || gesture?.anchored) return point;
    const nearestLine = getNearestTextLine(point.xRatio, point.yRatio);
    if (!nearestLine) return point;
    const lineCenterY = nearestLine.yRatio + nearestLine.heightRatio / 2;
    const snapRange = Math.max(STROKE_START_LINE_SNAP_RATIO, nearestLine.heightRatio * 1.4);
    if (Math.abs(point.yRatio - lineCenterY) > snapRange) return point;
    gesture.currentLine = nearestLine;
    currentHighlightWidth = getHighlightWidth(nearestLine);
    return {
      ...point,
      yRatio: clampRatio(lineCenterY),
      y: clampRatio(lineCenterY) * drawCanvas.height,
    };
  }

  function updateStrokeStartStabilization(point, now = performance.now()) {
    if (!underlineGesture || !point || underlineGesture.anchored) return point;
    if (now > underlineGesture.startStableUntil || underlineGesture.startSamples.length >= STROKE_START_SAMPLE_LIMIT) {
      return point;
    }
    underlineGesture.startSamples.push(point);
    const medianPoint = getMedianPoint(underlineGesture.startSamples);
    const stablePoint = getLineSnappedStartPoint({
      ...point,
      xRatio: clampRatio(medianPoint.xRatio),
      yRatio: clampRatio(medianPoint.yRatio),
      x: clampRatio(medianPoint.xRatio) * drawCanvas.width,
      y: clampRatio(medianPoint.yRatio) * drawCanvas.height,
    });
    if (underlineGesture.points.length) {
      underlineGesture.points[0] = stablePoint;
    }
    underlineGesture.stabilizedStartPoint = stablePoint;
    return point;
  }

  function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getMedianValue(values) {
    if (!values?.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  function getStraightenedUnderline(points) {
    return getStraightenedStroke(points, {
      canvasWidth: drawCanvas?.width || Infinity,
      canvasHeight: drawCanvas?.height || Infinity,
    });
  }

  function getSmartFreewritingUnderline(points, gesture = underlineGesture) {
    if (!drawCanvas || !points || points.length < 3) return null;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const xRange = Math.max(...xs) - Math.min(...xs);
    const yRange = Math.max(...ys) - Math.min(...ys);
    const canvasWidth = Math.max(1, drawCanvas.width || 1);
    const minWidthRatio = gesture?.anchored ? 0.06 : 0.14;
    const maxVerticalDrift = Math.max(16, Math.min(64, xRange * 0.30));
    const horizontalEnough = xRange >= canvasWidth * minWidthRatio && xRange > yRange * 2.4;
    if (!horizontalEnough || yRange > maxVerticalDrift) return null;
    return getStraightenedUnderline(points);
  }

  function createCanvasSnapshot(canvas) {
    if (!canvas?.width || !canvas?.height) return null;
    const snapshot = document.createElement("canvas");
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
    return snapshot;
  }

  function restoreCanvasSnapshot(snapshot) {
    if (!drawCtx || !drawCanvas || !snapshot) return;
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    drawCtx.drawImage(snapshot, 0, 0, drawCanvas.width, drawCanvas.height);
  }

  function drawFreewritingStroke(points, options = {}) {
    if (!drawCtx || !points?.length) return;
    const tool = options.tool || currentMode;
    drawCtx.save();
    drawCtx.globalCompositeOperation = "source-over";
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";
    if (tool === "highlight") {
      drawCtx.strokeStyle = "#fff176";
      drawCtx.globalAlpha = 0.45;
      drawCtx.lineWidth = options.lineWidth || Math.max(12, currentHighlightWidth || DEFAULT_HIGHLIGHT_WIDTH);
    } else {
      drawCtx.strokeStyle = DRAWING_COLOR;
      drawCtx.globalAlpha = 1;
      drawCtx.lineWidth = options.lineWidth || 4;
    }
    drawCtx.beginPath();
    drawCtx.moveTo(points[0].x, points[0].y);
    if (points.length === 1) {
      drawCtx.lineTo(points[0].x + 0.01, points[0].y + 0.01);
    } else if (points.length === 2) {
      drawCtx.lineTo(points[1].x, points[1].y);
    } else {
      for (let index = 1; index < points.length - 1; index += 1) {
        const current = points[index];
        const next = points[index + 1];
        drawCtx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
      }
      const last = points[points.length - 1];
      drawCtx.lineTo(last.x, last.y);
    }
    drawCtx.stroke();
    drawCtx.restore();
  }

  function renderActiveStrokePreview(options = {}) {
    if (!underlineGesture) return;
    const now = performance.now();
    if (!options.force && now - lastStrokePreviewAt < STROKE_PREVIEW_INTERVAL_MS) {
      return;
    }
    lastStrokePreviewAt = now;
    restoreCanvasSnapshot(underlineGesture.snapshot);
    if (underlineGesture.mode === "straight") {
      const line = getStraightenedUnderline(underlineGesture.points);
      if (line) drawStrokeSegment(line.start, line.end, { tool: underlineGesture.tool, geometry: "straight" });
    } else {
      const smartLine = getSmartFreewritingUnderline(underlineGesture.points);
      if (smartLine) {
        drawStrokeSegment(smartLine.start, smartLine.end, { tool: underlineGesture.tool, geometry: "straight" });
      } else {
        drawFreewritingStroke(underlineGesture.points, { tool: underlineGesture.tool });
      }
    }
    publishPresentationOverlay();
  }

  function drawStrokeSegment(start, end, options = {}) {
    if (!drawCtx || !start || !end) return;
    const tool = options.tool || currentMode;
    const geometry = options.geometry || underlineMode;
    drawCtx.save();
    drawCtx.globalCompositeOperation = "source-over";
    drawCtx.globalAlpha = 1;
    if (tool === "highlight") {
      drawCtx.strokeStyle = "#fff176";
      drawCtx.globalAlpha = 0.45;
      drawCtx.lineWidth = options.lineWidth || Math.max(12, currentHighlightWidth || DEFAULT_HIGHLIGHT_WIDTH);
    } else {
      drawCtx.strokeStyle = DRAWING_COLOR;
      drawCtx.globalAlpha = geometry === "straight" ? 0.92 : 1;
      drawCtx.lineWidth = options.lineWidth || (geometry === "straight" ? Math.max(4, drawCanvas.width * 0.0035) : 4);
    }
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";
    drawCtx.beginPath();
    drawCtx.moveTo(start.x, start.y);
    drawCtx.lineTo(end.x, end.y);
    drawCtx.stroke();
    drawCtx.restore();
  }

  function drawUnderlineSegment(start, end, options = {}) {
    drawStrokeSegment(start, end, { tool: currentMode, geometry: underlineMode, ...options });
  }

  function normalizeStrokePoints(points) {
    if (!drawCanvas) return [];
    return (points || []).map((point) => ({
      xRatio: clampRatio(point.x / Math.max(1, drawCanvas.width)),
      yRatio: clampRatio(point.y / Math.max(1, drawCanvas.height)),
    }));
  }

  function createTrackedStroke(gesture, renderedLine, createdAt) {
    if (!gesture?.hasDrawn || !drawCanvas) return null;
    const isStraight = Boolean(renderedLine);
    const points = isStraight
      ? normalizeStrokePoints([renderedLine.start, renderedLine.end])
      : normalizeStrokePoints(gesture.points);
    if (points.length < 2) return null;
    const lineWidth = gesture.tool === "highlight"
      ? Math.max(12, currentHighlightWidth || DEFAULT_HIGHLIGHT_WIDTH)
      : gesture.mode === "straight" || gesture.smartStraightened
        ? Math.max(4, drawCanvas.width * 0.0035)
        : 4;
    strokeSequence += 1;
    return {
      id: `stroke-${strokeSequence}`,
      pageNo: currentPage,
      createdAt,
      tool: gesture.tool,
      geometry: isStraight ? "straight" : "freewriting",
      points,
      lineWidthRatio: lineWidth / Math.max(1, drawCanvas.height),
    };
  }

  function trackStroke(stroke, baseSnapshot) {
    if (!stroke) return;
    let scene = strokeScenesByPage.get(currentPage);
    if (!scene) {
      scene = { baseSnapshot, strokes: [] };
      strokeScenesByPage.set(currentPage, scene);
    }
    scene.strokes.push(stroke);
  }

  function renderTrackedStroke(stroke) {
    if (!drawCanvas || !stroke?.points?.length) return;
    const points = stroke.points.map((point) => ({
      x: point.xRatio * drawCanvas.width,
      y: point.yRatio * drawCanvas.height,
    }));
    const lineWidth = Math.max(
      stroke.tool === "highlight" ? 12 : 4,
      stroke.lineWidthRatio * drawCanvas.height,
    );
    if (stroke.geometry === "straight") {
      drawStrokeSegment(points[0], points[points.length - 1], {
        tool: stroke.tool,
        geometry: "straight",
        lineWidth,
      });
      return;
    }
    drawFreewritingStroke(points, { tool: stroke.tool, lineWidth });
  }

  function renderTrackedPage(pageNo = currentPage) {
    const scene = strokeScenesByPage.get(pageNo);
    if (!scene || !drawCtx || !drawCanvas) return false;
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    if (scene.baseSnapshot) {
      drawCtx.drawImage(scene.baseSnapshot, 0, 0, drawCanvas.width, drawCanvas.height);
    }
    scene.strokes.forEach(renderTrackedStroke);
    publishPresentationOverlay();
    return true;
  }

  function deleteTrackedStroke(strokeId) {
    const scene = strokeScenesByPage.get(currentPage);
    if (!scene) return false;
    const nextStrokes = scene.strokes.filter((stroke) => stroke.id !== strokeId);
    if (nextStrokes.length === scene.strokes.length) return false;
    scene.strokes = nextStrokes;
    incrementPageGestureCount();
    renderTrackedPage(currentPage);
    saveCurrentPageAnnotation();
    recordPresentationEvent("stroke_delete", { strokeId, pageNo: currentPage });
    showToast("선이 삭제되었습니다.");
    return true;
  }

  function updateRecentStrokeDeletion(point, now = performance.now()) {
    const scene = strokeScenesByPage.get(currentPage);
    const result = strokeDeletionTracker.update({
      pageNo: currentPage,
      strokes: scene?.strokes || [],
      point,
      now,
      width: drawCanvas?.width || 1,
      height: drawCanvas?.height || 1,
    });
    if (result.deleteStrokeId) deleteTrackedStroke(result.deleteStrokeId);
    return result;
  }

  function handleUnderlineGesture(detail = {}) {
    if (!drawCanvas || !drawCtx) return false;

    if (detail.phase === "preview") {
      const point = getStrokePreviewPoint(detail.handPoint);
      if (!point) {
        clearPointer();
        return false;
      }
      drawPointer(point.x, point.y, "stroke-preview", detail.progress || 0);
      return true;
    }

    if (detail.phase === "preview-end") {
      clearPointer();
      return true;
    }

    // ?꾩?+寃吏 ?쒖뒪泥섎뒗 ?좏깮???꾧뎄媛 ???뺢킅?쒖씪 ?뚮쭔 ?먯꽌?쒕떎.
    // ?ъ씤??紐⑤뱶?먯꽌??寃吏 ?ъ씤?곕쭔 ?ъ슜?섍퀬, pinch媛 ?ㅼ뼱????좎쓣 留뚮뱾吏 ?딅뒗??
    if (detail.phase === "start" && currentMode === "pointer") {
      underlineGesture = null;
      activeStrokeSnapshot = null;
      stopDrawing();
      return false;
    }

    if (detail.phase === "start") {
      clearPointer();
      // 포인터 세션이 앵커를 소비(consumeSpeechAnchor)했을 수 있으므로,
      // endGestureSession 전에 포인터 세션의 앵커를 먼저 저장해 stroke에서도 사용한다.
      // 단, "음성인식 후" 모드와 "음성없이" 모드를 깨끗이 분리하기 위해
      // 음성 인식 시점(selectedAt)으로부터 TTL 이내일 때만 carry-over한다.
      // TTL이 지나면 음성과 무관한 제스처로 보고 상대이동 모드로 떨어진다.
      const prevSessionAnchor = getFreshSessionAnchor(gestureSession?.anchor);
      endGestureSession("stroke-start");
      resizeOverlayCanvases(true);
      const tool = currentMode === "highlight" ? "highlight" : "pen";
      const anchor = getValidSpeechAnchor() || prevSessionAnchor;
      const anchorPoint = getStrokeAnchorStartPoint(anchor, tool, underlineMode);
      underlineGesture = {
        phase: "start",
        mode: underlineMode,
        tool,
        anchor,
        anchored: Boolean(anchorPoint),
        anchorPoint,
        currentLine: anchor || null,
        startHand: {
          xRatio: clampRatio(detail.handPoint?.xRatio),
          yRatio: clampRatio(detail.handPoint?.yRatio),
        },
        startSamples: [],
        startStableUntil: performance.now() + STROKE_START_STABILIZE_MS,
        stabilizedStartPoint: null,
        snapshot: createCanvasSnapshot(drawCanvas),
        points: [],
        hasDrawn: false,
      };
      activeStrokeSnapshot = underlineGesture.snapshot;
      const point = mapUnderlinePoint(detail.handPoint);
      if (point) underlineGesture.points.push(smoothStrokePoint(null, point));
      if (tool === "highlight") {
        currentHighlightWidth = getHighlightWidth(underlineGesture.currentLine) || DEFAULT_HIGHLIGHT_WIDTH;
      }
      if (point) updateStrokeStartStabilization(point);
      renderActiveStrokePreview({ force: true });
      recordPresentationEvent("stroke_start", {
        mode: underlineMode,
        tool: underlineGesture.tool,
        anchored: Boolean(anchor),
        anchorText: anchor?.text || null,
      });
      return true;
    }

    if (!underlineGesture) return false;

    if (["move", "bridge"].includes(detail.phase)) {
      underlineGesture.phase = detail.phase;
      const previous = underlineGesture.points[underlineGesture.points.length - 1];
      const point = smoothStrokePoint(previous, mapUnderlinePoint(detail.handPoint));
      if (!point || (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 1.5 && detail.phase !== "bridge")) {
        return true;
      }
      updateStrokeStartStabilization(point);
      underlineGesture.points.push(point);
      renderActiveStrokePreview();
      underlineGesture.hasDrawn = underlineGesture.points.length > 1;
      return true;
    }

    if (detail.phase === "grace") {
      underlineGesture.phase = "grace";
      renderDebugPanel();
      return true;
    }

      if (detail.phase === "end") {
      underlineGesture.phase = "end";
      const point = smoothStrokePoint(
        underlineGesture.points[underlineGesture.points.length - 1],
        detail.handPoint ? mapUnderlinePoint(detail.handPoint) : null,
      );
      if (point) underlineGesture.points.push(point);

      restoreCanvasSnapshot(underlineGesture.snapshot || activeStrokeSnapshot);
      let renderedLine = null;
      if (underlineGesture.mode === "straight") {
        const line = getStraightenedUnderline(underlineGesture.points);
        if (line) {
          drawUnderlineSegment(line.start, line.end, { tool: underlineGesture.tool, geometry: "straight" });
          underlineGesture.hasDrawn = true;
          renderedLine = line;
        }
      } else {
        const smartLine = getSmartFreewritingUnderline(underlineGesture.points);
        if (smartLine) {
          drawUnderlineSegment(smartLine.start, smartLine.end, { tool: underlineGesture.tool, geometry: "straight" });
          underlineGesture.hasDrawn = true;
          underlineGesture.smartStraightened = true;
          renderedLine = smartLine;
        } else {
          drawFreewritingStroke(underlineGesture.points, { tool: underlineGesture.tool });
          underlineGesture.hasDrawn = underlineGesture.points.length > 1;
        }
      }

      if (underlineGesture.hasDrawn) {
        const trackedStroke = createTrackedStroke(
          underlineGesture,
          renderedLine,
          performance.now(),
        );
        trackStroke(trackedStroke, underlineGesture.snapshot || activeStrokeSnapshot);
        incrementPageGestureCount();
        saveCurrentPageAnnotation();
        publishPresentationOverlay();
        saveAnalyticsRecord("annotations", {
          pageNo: currentPage,
          type: underlineGesture.mode === "straight" ? "straight_underline" : "freewriting_stroke",
          tool: underlineGesture.tool,
          geometry: underlineGesture.smartStraightened ? "smart_straight" : underlineGesture.mode,
          anchored: underlineGesture.anchored,
          anchorText: underlineGesture.anchor?.text || null,
          sourceType: underlineGesture.anchored ? "VOICE_START" : "MANUAL",
          pointCount: underlineGesture.points.length,
          highlightWidth: underlineGesture.tool === "highlight" ? currentHighlightWidth : undefined,
        });
        if (underlineGesture.points.length >= 2) {
          const first = renderedLine?.start || underlineGesture.points[0];
          const last = renderedLine?.end || underlineGesture.points[underlineGesture.points.length - 1];
          saveBackendAnnotation({
            toolType: underlineGesture.tool === "highlight" ? "HIGHLIGHT" : "UNDERLINE",
            color: underlineGesture.tool === "highlight" ? "#fff176" : DRAWING_COLOR,
            startX: Math.round(first.x),
            startY: Math.round(first.y),
            endX: Math.round(last.x),
            endY: Math.round(last.y),
            sourceType: underlineGesture.anchored ? "VOICE_START" : "MANUAL",
            anchorId: underlineGesture.anchor?.matchedAnchorId || underlineGesture.anchor?.id,
            matchConfidence: underlineGesture.anchor?.score || undefined,
          });
        }
      }
      recordPresentationEvent("stroke_end", {
        mode: underlineGesture.mode,
        tool: underlineGesture.tool,
        anchored: underlineGesture.anchored,
        pointCount: underlineGesture.points.length,
        drawn: underlineGesture.hasDrawn,
        reason: detail.reason || "ended",
      });
      underlineGesture = null;
      activeStrokeSnapshot = null;
      return true;
    }
    return false;
  }

  function fitSlideToPdfCanvas() {
    if (!slideArt || !pdfCanvas?.width || !pdfCanvas?.height) return;
    slideArt.classList.add("has-pdf");
    slideArt.style.aspectRatio = `${pdfCanvas.width} / ${pdfCanvas.height}`;
    slideArt.style.setProperty("--slide-aspect-value", String(pdfCanvas.width / Math.max(1, pdfCanvas.height)));
  }

  function refreshStageLayout(preserveAnnotation = true) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (pdfDoc) renderPdfPage(currentPage);
        else resizeOverlayCanvases(preserveAnnotation);
        // 캔버스/오버레이 크기가 바뀌었으므로 떠 있는 STT 매칭 박스를 현재 좌표계로 다시 그린다.
        // (renderPdfPage는 비동기지만 getAnchorMatchBox가 매번 오버레이 크기를 재동기화하므로 안전)
        redrawAnchorMatchBoxForLayout();
        repositionSttAnchorBoxes();
      });
    });
  }

  function getFitViewport(page) {
    const baseViewport = page.getViewport({ scale: 1 });
    const rect = slideArt?.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const fitScale = rect?.width && rect?.height
      ? Math.min(rect.width / baseViewport.width, rect.height / baseViewport.height) * ratio
      : 1.5;
    return page.getViewport({ scale: Math.max(0.5, fitScale || 1.5) });
  }

  // --- SECTION: ANCHORS ---
  function normalizeText(value = "") {
    return String(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeToken(token) {
    const suffixes = ["으로", "에서", "부터", "까지", "은", "는", "이", "가", "을", "를", "의", "에", "와", "과", "도", "만", "로"];
    const suffix = suffixes.find((candidate) => token.length > candidate.length + 1 && token.endsWith(candidate));
    return suffix ? token.slice(0, -suffix.length) : token;
  }

  function tokenize(value = "", removeStopWords = false) {
    const tokens = normalizeText(value)
      .split(" ")
      .map(normalizeToken)
      .filter((token) => token.length > 0);
    return removeStopWords ? tokens.filter((token) => token.length > 1 && !STOP_WORDS.has(token)) : tokens;
  }

  function isWeakStandaloneText(text) {
    const normalized = normalizeText(text);
    if (!normalized || normalized.length < 2) return true;
    if (/^\d+$/.test(normalized)) return true;
    const tokens = tokenize(normalized, true);
    return tokens.length === 0 || (tokens.length === 1 && tokens[0].length < 2);
  }

  function makeAnchor(pageNo, text, rect, viewport, options = {}) {
    const safeWidth = Math.max(1, viewport.width);
    const safeHeight = Math.max(1, viewport.height);
    return {
      id: options.id,
      pageNo,
      text: text.trim(),
      norm: normalizeText(text),
      tokens: tokenize(text, true),
      kind: options.kind || "line",
      order: options.order ?? 0,
      lineId: options.lineId || options.id,
      xRatio: rect.x / safeWidth,
      yRatio: rect.y / safeHeight,
      widthRatio: rect.width / safeWidth,
      heightRatio: rect.height / safeHeight,
    };
  }

  function createTextAnchorsFromItems(pageNo, textItems, viewport) {
    const rawItems = [];
    textItems.forEach((item, itemIndex) => {
      const rawText = item.str?.trim();
      if (!rawText) return;
      const transformed = window.pdfjsLib.Util.transform(viewport.transform, item.transform);
      const x = transformed[4];
      const y = transformed[5];
      const width = Math.max(1, item.width * viewport.scale);
      const height = Math.max(8, Math.abs(transformed[3]) || item.height * viewport.scale || 12);
      const words = rawText.split(/\s+/).filter(Boolean);
      const totalUnits = Math.max(1, words.reduce((sum, word) => sum + word.length, 0) + Math.max(0, words.length - 1) * 0.5);
      let cursorX = x;
      words.forEach((word, wordIndex) => {
        const wordWidth = width * (word.length / totalUnits);
        rawItems.push({
          id: `${itemIndex}-${wordIndex}`,
          text: word,
          x: cursorX,
          y: y - height,
          width: Math.max(1, wordWidth),
          height,
        });
        cursorX += wordWidth + width * (0.5 / totalUnits);
      });
    });

    rawItems.sort((a, b) => {
      const ay = a.y + a.height / 2;
      const by = b.y + b.height / 2;
      return Math.abs(ay - by) > 6 ? ay - by : a.x - b.x;
    });

    const lines = [];
    rawItems.forEach((item) => {
      const centerY = item.y + item.height / 2;
      let line = lines.find((candidate) => (
        Math.abs(centerY - candidate.centerY) <= Math.max(6, candidate.avgHeight * 0.75)
      ));
      if (!line) {
        line = { centerY, avgHeight: item.height, items: [] };
        lines.push(line);
      }
      line.items.push(item);
      line.avgHeight = average(line.items.map((lineItem) => lineItem.height));
      line.centerY = average(line.items.map((lineItem) => lineItem.y + lineItem.height / 2));
    });

    const anchors = [];
    let order = 0;
    lines
      .sort((a, b) => a.centerY - b.centerY)
      .forEach((line, lineIndex) => {
        const items = line.items.sort((a, b) => a.x - b.x);
        const lineId = `p${pageNo}-l${lineIndex + 1}`;
        const lineText = items.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim();
        const lineRect = {
          x: Math.min(...items.map((item) => item.x)),
          y: Math.min(...items.map((item) => item.y)),
          width: Math.max(...items.map((item) => item.x + item.width)) - Math.min(...items.map((item) => item.x)),
          height: Math.max(...items.map((item) => item.y + item.height)) - Math.min(...items.map((item) => item.y)),
        };
        const lineAnchor = makeAnchor(pageNo, lineText, lineRect, viewport, {
          id: lineId,
          lineId,
          kind: "line",
          order,
        });
        anchors.push(lineAnchor);
        order += 1;

        for (let start = 0; start < items.length; start += 1) {
          for (let length = 1; length <= MAX_PHRASE_LENGTH && start + length <= items.length; length += 1) {
            const phraseItems = items.slice(start, start + length);
            const phraseText = phraseItems.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim();
            if (isWeakStandaloneText(phraseText)) continue;
            const x = Math.min(...phraseItems.map((item) => item.x));
            const y = Math.min(...phraseItems.map((item) => item.y));
            const right = Math.max(...phraseItems.map((item) => item.x + item.width));
            const bottom = Math.max(...phraseItems.map((item) => item.y + item.height));
            anchors.push({
              ...makeAnchor(pageNo, phraseText, {
                x,
                y,
                width: right - x,
                height: bottom - y,
              }, viewport, {
                id: `${lineId}-p${start + 1}-${length}`,
                lineId,
                kind: length === 1 ? "word" : "phrase",
                order: order + start / 100,
              }),
              lineXRatio: lineAnchor.xRatio,
              lineYRatio: lineAnchor.yRatio,
              lineWidthRatio: lineAnchor.widthRatio,
              lineHeightRatio: lineAnchor.heightRatio,
              lineText: lineAnchor.text,
            });
          }
        }
        order += items.length;
      });
    pdfRawTextItems.set(pageNo, rawItems.slice(0, 80).map((item) => ({
      text: item.text,
      x: debugRound(item.x, 1),
      y: debugRound(item.y, 1),
      width: debugRound(item.width, 1),
      height: debugRound(item.height, 1),
    })));
    return anchors;
  }

  function getBackendAnchorText(anchor = {}) {
    return String(anchor.textOriginal || anchor.text || anchor.content || anchor.keywords || "").trim();
  }

  function toSafeRatio(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? clampRatio(number) : fallback;
  }

  function normalizeBackendTextAnchors(pageNo, backendAnchors = []) {
    const anchors = [];
    let order = 0;
    backendAnchors.forEach((backendAnchor, index) => {
      const text = getBackendAnchorText(backendAnchor);
      if (isWeakStandaloneText(text)) return;

      const rawStartX = toSafeRatio(backendAnchor.startXRatio ?? backendAnchor.xRatio ?? backendAnchor.leftRatio, 0);
      const rawStartY = toSafeRatio(backendAnchor.startYRatio ?? backendAnchor.yRatio ?? backendAnchor.topRatio, 0);
      const rawEndX = toSafeRatio(
        backendAnchor.endXRatio ?? backendAnchor.rightRatio ?? backendAnchor.x2Ratio ?? rawStartX + Number(backendAnchor.widthRatio || 0),
        rawStartX,
      );
      const rawEndY = toSafeRatio(
        backendAnchor.endYRatio ?? backendAnchor.bottomRatio ?? backendAnchor.y2Ratio ?? rawStartY + Number(backendAnchor.heightRatio || 0),
        rawStartY,
      );
      const xRatio = Math.min(rawStartX, rawEndX);
      const yRatio = Math.min(rawStartY, rawEndY);
      const widthRatio = Math.max(0.006, Math.abs(rawEndX - rawStartX) || Number(backendAnchor.widthRatio) || 0.08);
      const heightRatio = Math.max(0.012, Math.abs(rawEndY - rawStartY) || Number(backendAnchor.heightRatio) || 0.022);
      const anchorId = String(backendAnchor.anchorId ?? backendAnchor.id ?? `${pageNo}-${index + 1}`);
      const lineId = `backend-${pageNo}-line-${anchorId}`;
      const baseAnchor = {
        pageNo,
        text,
        norm: normalizeText(text),
        tokens: tokenize(`${text} ${backendAnchor.keywords || ""}`, true),
        order,
        xRatio: clampRatio(xRatio),
        yRatio: clampRatio(yRatio),
        widthRatio: clampRatio(widthRatio),
        heightRatio: clampRatio(heightRatio),
        backendAnchor: true,
        keywords: backendAnchor.keywords || "",
      };

      anchors.push({
        ...baseAnchor,
        id: lineId,
        lineId,
        kind: "line",
      });
      anchors.push({
        ...baseAnchor,
        id: anchorId,
        lineId,
        kind: "phrase",
        lineXRatio: baseAnchor.xRatio,
        lineYRatio: baseAnchor.yRatio,
        lineWidthRatio: baseAnchor.widthRatio,
        lineHeightRatio: baseAnchor.heightRatio,
        lineText: text,
        order: order + 0.01,
      });
      order += 1;
    });
    return anchors;
  }

  async function extractFrontendTextAnchorsForPage(pageNo) {
    const page = await pdfDoc.getPage(pageNo);
    const viewport = getFitViewport(page);
    const textContent = await page.getTextContent();
    return createTextAnchorsFromItems(pageNo, textContent.items || [], viewport);
  }

  async function loadFrontendPdfTextAnchors(targetMap = new Map(), onlyMissingPages = false) {
    if (!pdfDoc) return targetMap;
    for (let pageNo = 1; pageNo <= totalPage; pageNo += 1) {
      if (onlyMissingPages && (targetMap.get(pageNo) || []).length > 0) continue;
      const anchors = await extractFrontendTextAnchorsForPage(pageNo);
      targetMap.set(pageNo, anchors);
    }
    return targetMap;
  }

  async function loadBackendTextAnchors() {
    if (!backendApi?.listTextAnchors || !currentPdfId) return null;
    const backendMap = new Map();
    let totalBackendAnchors = 0;
    for (let pageNo = 1; pageNo <= totalPage; pageNo += 1) {
      const response = await backendApi.listTextAnchors({ pdfId: currentPdfId, pageNo });
      const rawAnchors = Array.isArray(response?.data?.anchors)
        ? response.data.anchors
        : Array.isArray(response?.data) ? response.data : [];
      const normalizedAnchors = normalizeBackendTextAnchors(pageNo, rawAnchors);
      totalBackendAnchors += normalizedAnchors.length;
      backendMap.set(pageNo, normalizedAnchors);
    }
    return totalBackendAnchors > 0 ? backendMap : null;
  }

  async function extractPdfTextAnchors() {
    pdfTextAnchors = new Map();
    pdfRawTextItems = new Map();
    textAnchorSource = "none";
    textAnchorLoadError = "";
    activeTextAnchor = null;
    clearSttAnchorBox();
    clearAnchorMatchBox({ force: true });
    if (!pdfDoc) {
      renderDebugPanel();
      return;
    }

    try {
      const backendAnchors = await loadBackendTextAnchors();
      if (backendAnchors) {
        pdfTextAnchors = backendAnchors;
        textAnchorSource = "backend";
        await loadFrontendPdfTextAnchors(pdfTextAnchors, true);
        if (Array.from(pdfTextAnchors.values()).some((anchors) => anchors.some((anchor) => !anchor.backendAnchor))) {
          textAnchorSource = "backend+frontend-fallback";
        }
        renderDebugPanel();
        return;
      }
      if (currentPdfId) textAnchorLoadError = "백엔드 TEXT_ANCHOR 응답이 비어 있어 프론트 추출로 대체했습니다.";
    } catch (error) {
      textAnchorLoadError = error?.message || "백엔드 TEXT_ANCHOR 조회 실패";
      console.warn("AirNote presentation: backend text anchor load failed. Falling back to PDF.js extraction.", error);
    }

    try {
      await loadFrontendPdfTextAnchors(pdfTextAnchors, false);
      textAnchorSource = "frontend";
      renderDebugPanel();
    } catch (error) {
      textAnchorSource = "failed";
      textAnchorLoadError = error?.message || "PDF text anchor extraction failed";
      console.warn("AirNote presentation: PDF text anchor extraction failed.", error);
      showToast("PDF ?띿뒪???듭빱 ?앹꽦 ?ㅽ뙣");
      renderDebugPanel();
    }
  }

  // --- 휴리스틱 매칭 유틸 (STT 띄어쓰기/조사/오타/동음이의 흡수) ---
  function levenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, index) => index);
    for (let i = 1; i <= m; i += 1) {
      const cur = [i];
      for (let j = 1; j <= n; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[n];
  }

  function similarity(a = "", b = "") {
    const max = Math.max(a.length, b.length);
    return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
  }

  // "세 번째 항목", "3번째", "마지막 줄", "맨 위" 같은 서수/지시 발화 → 줄 인덱스(1-base, -1=마지막)
  function parseOrdinalCommand(normalized = "") {
    const koOrd = {
      첫: 1, 한: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 네: 4, 넷: 4,
      다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10,
    };
    const digit = normalized.match(/(\d+)\s*번째/);
    if (digit) return Number(digit[1]);
    const korean = normalized.match(/(첫|한|두|둘|세|셋|네|넷|다섯|여섯|일곱|여덟|아홉|열)\s*번째/);
    if (korean) return koOrd[korean[1]] || null;
    if (/마지막/.test(normalized) || /맨\s*아래|제일\s*아래|끝\s*줄/.test(normalized)) return -1;
    if (/맨\s*위|제일\s*위|첫\s*줄|첫째\s*줄/.test(normalized)) return 1;
    return null;
  }

  function scoreTextAnchor(anchor, queryTokens, normalizedQuery) {
    if (!anchor?.norm || !queryTokens.length || anchor.kind === "line" || isWeakStandaloneText(anchor.text)) return null;
    const anchorTokens = anchor.tokens || [];
    const matchedTokens = anchorTokens.filter((token) => queryTokens.includes(token));
    const overlapRatio = matchedTokens.length / Math.max(1, anchorTokens.length);
    let score = 0;
    let matchType = "weak";
    if (normalizedQuery === anchor.norm) {
      score = 1;
      matchType = "exact";
    } else if (normalizedQuery.includes(anchor.norm)) {
      score = anchorTokens.length >= 3 ? 0.96 : 0.84;
      matchType = "queryIncludes";
    } else if (anchor.norm.includes(normalizedQuery) && normalizedQuery.length >= 2) {
      score = 0.8;
      matchType = "anchorIncludes";
    } else if (anchorTokens.length === 1 && matchedTokens.length === 1) {
      score = 0.82;
      matchType = "singleKeyword";
    } else if (matchedTokens.length >= 2) {
      score = 0.7 + Math.min(0.25, overlapRatio * 0.25);
      matchType = "context";
    } else if (matchedTokens.length === 1 && queryTokens.length >= 2 && anchorTokens.length >= 2) {
      score = 0.6;
      matchType = "keyword";
    } else if (matchedTokens.length === 1 && anchorTokens.length <= 2) {
      score = 0.62;
      matchType = "shortKeyword";
    }
    if (score <= 0) {
      // 휴리스틱 폴백: 정확 토큰/부분문자열 매칭이 모두 실패해도
      // 문자/토큰 단위 유사도로 STT 띄어쓰기·조사·오타 차이를 흡수한다.
      const charSim = similarity(
        normalizedQuery.replace(/\s/g, ""),
        anchor.norm.replace(/\s/g, ""),
      );
      const tokenSim = anchorTokens.length && queryTokens.length
        ? Math.max(...anchorTokens.map((at) => Math.max(...queryTokens.map((qt) => similarity(qt, at)))))
        : 0;
      const fuzzy = Math.max(charSim, tokenSim * 0.95);
      if (fuzzy >= 0.6) {
        // 0.6→0.55 … 1.0→0.9 로 선형 매핑 (정확 매칭보다 항상 낮게)
        score = 0.55 + (fuzzy - 0.6) * 0.875;
        matchType = `fuzzy:${fuzzy.toFixed(2)}`;
      }
    }
    if (score <= 0) return null;
    const orderDistance = lastSelectedAnchorOrder < 0 ? 0 : Math.abs(anchor.order - lastSelectedAnchorOrder);
    const sequenceBoost = lastSelectedAnchorOrder < 0
      ? 0
      : anchor.order >= lastSelectedAnchorOrder && orderDistance <= 12
        ? 0.08
        : orderDistance <= 5
          ? 0.03
          : 0;
    return {
      anchor,
      score: Math.min(1, score + sequenceBoost),
      matchType,
      matchedTokens,
      overlapRatio,
      sequenceBoost,
    };
  }

  // 디버그 전용: 프로덕션 채택 점수(STT_SCORE_THRESHOLD)에 못 미쳐 후보가 0개로 잘려
  // 박스가 하나도 안 그려지는 상황에서도, "STT가 들은 말과 가장 비슷한 단어 위치"를
  // 약하게(rejected) 표시해 어디로 인식되고 있는지 눈으로 확인하게 한다.
  // 프로덕션 매칭 로직에는 전혀 영향을 주지 않는다(별도 경로·DEBUG_MODE 전용).
  function getDebugWeakCandidates(normalizedQuery, lockedPageNo, limit = 3) {
    if (!DEBUG_MODE || !normalizedQuery) return [];
    const query = String(normalizedQuery).replace(/\s/g, "");
    if (!query) return [];
    const anchors = (pdfTextAnchors.get(lockedPageNo) || [])
      .filter((anchor) => Number(anchor.pageNo) === lockedPageNo && anchor.kind !== "line" && anchor.norm);
    return anchors
      .map((anchor) => ({ anchor, sim: similarity(query, String(anchor.norm).replace(/\s/g, "")) }))
      .filter((entry) => entry.sim > 0.2)
      .sort((left, right) => right.sim - left.sim)
      .slice(0, limit)
      .map((entry) => ({
        text: entry.anchor.text,
        score: Number(entry.sim.toFixed(2)),
        matchType: `weak:${entry.sim.toFixed(2)}`,
        rejected: true,
        lineId: entry.anchor.lineId,
        pageNo: entry.anchor.pageNo,
        xRatio: entry.anchor.xRatio,
        yRatio: entry.anchor.yRatio,
        widthRatio: entry.anchor.widthRatio,
        heightRatio: entry.anchor.heightRatio,
      }));
  }

  function selectActiveTextAnchor(transcript, isFinal = false) {
    if (lastPageChangedAt && performance.now() - lastPageChangedAt < PAGE_CHANGE_STT_GRACE_MS) return null;
    if (renderTask) return null;
    const normalized = normalizeText(transcript);
    const tokens = tokenize(normalized, true);

    // 임무 1: "세 번째 항목", "마지막 줄", "맨 위" 등 서수/지시 발화 처리.
    // PDF 본문 텍스트가 아니므로 토큰 매칭으로는 절대 잡히지 않는다 → 줄 인덱스로 직접 선택.
    const ordinal = parseOrdinalCommand(normalized);
    if (ordinal != null) {
      const lines = getCurrentLineAnchors()
        .slice()
        .sort((left, right) => (left.yRatio || 0) - (right.yRatio || 0));
      const index = ordinal === -1 ? lines.length - 1 : ordinal - 1;
      const lineAnchor = lines[index];
      if (lineAnchor) {
        activeTextAnchor = {
          ...lineAnchor,
          pageNo: currentPage,
          matchedText: ordinal === -1 ? "마지막 줄" : `${ordinal}번째 줄`,
          matchedAnchorId: lineAnchor.id,
          score: 0.99,
          selectedAt: Date.now(),
        };
        lastSelectedAnchorOrder = lineAnchor.order;
        speechAnchorEngine.update(activeTextAnchor);
        presentationStore.setState({ speechAnchor: activeTextAnchor });
        latestMatchDiagnostics = {
          transcript,
          accepted: true,
          topScore: 0.99,
          secondScore: 0,
          scoreGap: 0.99,
          reason: `서수 선택(${activeTextAnchor.matchedText})`,
          candidates: [{
            text: lineAnchor.text,
            score: 0.99,
            matchType: "ordinal",
            lineId: lineAnchor.lineId,
            pageNo: lineAnchor.pageNo,
            xRatio: lineAnchor.xRatio,
            yRatio: lineAnchor.yRatio,
            widthRatio: lineAnchor.widthRatio,
            heightRatio: lineAnchor.heightRatio,
          }],
        };
        applySpeechAnchorVisual(activeTextAnchor, { transcript });
        renderDebugPanel();
        renderSttDebugPanel();
        return activeTextAnchor;
      }
    }

    if (!tokens.length) return null;
    const lockedPageNo = currentPage;
    const anchors = (pdfTextAnchors.get(lockedPageNo) || [])
      .filter((anchor) => Number(anchor.pageNo) === lockedPageNo);
    const scoredAnchors = anchors
      .map((anchor) => scoreTextAnchor(anchor, tokens, normalized))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    const bestByLine = new Map();
    scoredAnchors.forEach((candidate) => {
      if (!bestByLine.has(candidate.anchor.lineId)) {
        bestByLine.set(candidate.anchor.lineId, candidate);
      }
    });
    const candidates = Array.from(bestByLine.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // ?숈젏?대㈃ ?섏씠吏 ?곷떒(yRatio ?묒? 寃????곗꽑
      return (a.anchor.yRatio || 0) - (b.anchor.yRatio || 0);
    });
    const best = candidates[0] || null;
    const second = candidates[1] || null;
    const scoreGap = second ? best.score - second.score : 1;
    // 媛숈? ?섏씠吏?먯꽌 ?숈씪 ?⑥뼱媛 ?щ윭 踰??깆옣???숈젏???섏삤??寃쎌슦?먮룄 留ㅼ묶??嫄곕??섏? ?딅뒗??
    // 媛숈? ?⑥뼱/臾멸뎄(norm ?숈씪)硫??곷떒 ?꾨낫瑜?梨꾪깮, ?ㅻⅨ ?띿뒪?몃겮由??숈젏???뚮쭔 ambiguity濡?嫄곕??쒕떎.
    const sameTextTie = Boolean(best && second && best.anchor.norm === second.anchor.norm);
    // 모호성 게이트 완화: 상위 매칭이 "확실히 존재"하면(매우 높은 점수이거나 2단어 이상
    // 구절이 그대로 매칭) 1·2위 점수차가 작아도 채택한다. 흔한 단어가 여러 줄에 반복돼
    // 점수차가 붙는 정당한 매칭이 "1·2위 점수 차이 부족"으로 잘리던 문제를 해결한다.
    // (동점이면 sequenceBoost가 읽기 순서상 다음 줄을 우선하므로 발표 흐름과도 일치)
    const strongMatch = Boolean(
      best &&
      best.score >= STT_SCORE_THRESHOLD &&
      (best.score >= 0.9 || (best.matchedTokens?.length || 0) >= 2),
    );
    const accepted = Boolean(
      best &&
      best.score >= STT_SCORE_THRESHOLD &&
      (sameTextTie || strongMatch || scoreGap >= STT_AMBIGUITY_GAP),
    );
    console.info("[AirNote MATCH]", {
      transcript,
      page: lockedPageNo,
      anchorCount: anchors.length,
      bestText: best?.anchor?.text ?? null,
      bestScore: best?.score ?? null,
      threshold: STT_SCORE_THRESHOLD,
      scoreGap: Number(scoreGap?.toFixed?.(3) ?? scoreGap),
      accepted,
      reason: !anchors.length ? "앵커없음(PDF 텍스트 미로드)"
        : !best ? "후보없음(토큰 불일치)"
          : best.score < STT_SCORE_THRESHOLD ? "점수미달"
            : !accepted ? "모호성(1·2위 차이부족)"
              : "채택✅",
    });
    latestMatchDiagnostics = {
      transcript,
      accepted,
      topScore: best?.score || 0,
      secondScore: second?.score || 0,
      scoreGap,
      reason: !best
        ? "후보 없음"
        : best.score < STT_SCORE_THRESHOLD
          ? "최고 점수 미달"
          : accepted
            ? (strongMatch && scoreGap < STT_AMBIGUITY_GAP ? "선택(강한 매칭·모호성 무시)" : "선택")
            : "1·2위 점수 차이 부족",
      candidates: candidates.slice(0, 5).map((candidate) => ({
        text: candidate.anchor.text,
        score: candidate.score,
        matchType: candidate.matchType,
        lineId: candidate.anchor.lineId,
        pageNo: candidate.anchor.pageNo,
        xRatio: candidate.anchor.xRatio,
        yRatio: candidate.anchor.yRatio,
        widthRatio: candidate.anchor.widthRatio,
        heightRatio: candidate.anchor.heightRatio,
      })),
    };
    // 디버그 모드: 채택 후보가 없을 때만 "근접 추정" 약한 후보를 곁들여, 미채택 상황에서도
    // STT가 어느 단어 근처로 들렸는지 박스로 보이게 한다(프로덕션 매칭에는 영향 없음).
    if (DEBUG_MODE) {
      latestMatchDiagnostics.debugCandidates = latestMatchDiagnostics.candidates.length
        ? []
        : getDebugWeakCandidates(normalized, lockedPageNo);
    }
    if (isFinal || accepted) {
      saveAnalyticsRecord("matchLogs", {
        pageNo: currentPage,
        transcript,
        normalized,
        isFinal,
        accepted,
        topScore: best?.score || 0,
        secondScore: second?.score || 0,
        scoreGap,
        reason: latestMatchDiagnostics.reason,
      });
      candidates.slice(0, 5).forEach((candidate, index) => {
        saveAnalyticsRecord("matchCandidates", {
          pageNo: currentPage,
          transcript,
          rank: index + 1,
          anchorId: candidate.anchor.id,
          lineId: candidate.anchor.lineId,
          text: candidate.anchor.text,
          score: candidate.score,
          matchType: candidate.matchType,
          selected: accepted && index === 0,
        });
      });
    }
    renderDebugPanel();
    clearSttAnchorBox();
    renderSttDebugOverlay();
    renderSttDebugPanel();
    if (!best) {
      pendingSpeechAnchorKey = "";
      pendingSpeechAnchorCount = 0;
      clearAnchorMatchBox();
      return null;
    }

    const key = `${best.anchor.pageNo}:${best.anchor.xRatio}:${best.anchor.yRatio}`;
    if (key === pendingSpeechAnchorKey) pendingSpeechAnchorCount += 1;
    else {
      pendingSpeechAnchorKey = key;
      pendingSpeechAnchorCount = 1;
    }

    if (!accepted) {
      clearAnchorMatchBox();
      return activeTextAnchor;
    }
    if (Number(best.anchor.pageNo) !== lockedPageNo || lockedPageNo !== currentPage) {
      clearAnchorMatchBox();
      return activeTextAnchor;
    }
    const lineAnchor = anchors.find((anchor) => anchor.id === best.anchor.lineId && anchor.kind === "line");
    activeTextAnchor = {
      ...(lineAnchor || best.anchor),
      pageNo: lockedPageNo,
      matchedText: best.anchor.text,
      matchedAnchorId: best.anchor.id,
      score: best.score,
      selectedAt: Date.now(),
    };
    lastSelectedAnchorOrder = best.anchor.order;
    speechAnchorEngine.update(activeTextAnchor);
    presentationStore.setState({ speechAnchor: activeTextAnchor });
    recordPresentationEvent("speech_anchor", {
      anchorId: activeTextAnchor.id,
      text: activeTextAnchor.text,
      matchedText: activeTextAnchor.matchedText,
      score: activeTextAnchor.score,
      xRatio: activeTextAnchor.xRatio,
      yRatio: activeTextAnchor.yRatio,
      widthRatio: activeTextAnchor.widthRatio,
      heightRatio: activeTextAnchor.heightRatio,
    });
    // 매칭된 글자에 박스 표시 + 앵커 무장(+ 제스처 중이면 즉시 재정렬).
    // 일반 모드에서는 포인터를 강제로 띄우지 않고, 다음 제스처 때 글자 중심을 원점으로 잡는다.
    applySpeechAnchorVisual(activeTextAnchor, { transcript });
    renderDebugPanel();
    return activeTextAnchor;
  }

  function drawUnderlineForAnchor() {
    // AirNote??STT ?듭빱留뚯쑝濡?利됱떆 諛묒쨪/?뺢킅?쒖쓣 ?ㅽ뻾?섏? ?딅뒗??
    // STT ?듭빱???ъ씤?걔룻렂쨌?뺢킅???쒖뒪泥섏쓽 ?쒖옉??蹂댁젙?먮쭔 ?ъ슜?쒕떎.
    return false;
  }

  function startSpeechRecognition(provider = "auto") {
    console.info("[AirNote STT] startSpeechRecognition 호출됨. provider=", provider,
      "micPermission=", permissionState.microphone, "speechStarted=", speechStarted);
    if (!permissionState.microphone) {
      console.warn("[AirNote STT] 중단: 마이크 권한 없음(permissionState.microphone=false)");
      showToast("마이크 권한이 없어 음성 앵커 기능을 사용할 수 없습니다.");
      return false;
    }
    if (speechStarted) {
      const currentProvider = speechController?.getProvider?.() || "none";
      const controllerRunning = Boolean(speechController?.isRunning?.());
      if (controllerRunning && !(provider === "auto" && currentProvider === "web-speech")) {
        console.info("[AirNote STT] 이미 시작됨(speechStarted=true) → 재시작 생략");
        return true;
      }
      console.warn("[AirNote STT] speechStarted 상태와 실제 컨트롤러 상태가 달라 STT를 재시작합니다.", {
        currentProvider,
        controllerRunning,
      });
      speechController?.dispose();
      speechController = null;
      speechStarted = false;
    }
    if (speechController && speechControllerProvider !== provider) {
      speechController.dispose();
      speechController = null;
    }
    speechControllerProvider = provider;
    speechController = speechController || window.AirNoteModules.createSpeechRecognitionController({
      provider,
      audioDeviceId: selectedSttDeviceId,
      localEndpoint: LOCAL_STT_ENDPOINTS[0] || AIRNOTE_STT_ENDPOINT,
      localEndpoints: LOCAL_STT_ENDPOINTS,
      onTranscript: (transcript, isFinal) => {
        latestRecognizedSpeech = {
          text: transcript || "",
          recognized_at: new Date().toISOString(),
          confidence: null,
          is_final: Boolean(isFinal),
        };
        // 이슈 1: 중간 인식(interim)은 자막/피드백만 갱신하고 좌표 매칭은 건너뛴다.
        // 발화 도중 포인터가 튀는 Jitter를 막기 위해 최종 확정 발화에서만 매칭한다.
        if (!isFinal) {
          latestSttActivity = transcript || latestSttActivity;
          renderSttDebugPanel();
          return null;
        }
        return selectActiveTextAnchor(transcript, isFinal);
      },
      onError: (error) => {
        console.warn("AirNote presentation: speech recognition failed.", error);
        latestSttError = error?.message || String(error || "알 수 없는 STT 오류");
        latestSttStatus = {
          provider: speechController?.getProvider?.() || "none",
          status: "error",
        };
        if (!speechController?.isRunning?.()) speechStarted = false;
        renderSttDebugPanel();
        renderDebugPanel();
        const permissionError = error === "not-allowed" || error === "service-not-allowed";
        const deviceError = error === "audio-capture" || error === "language-not-supported";
        const localError = error === "local-stt-unsupported" ||
          error === "local-stt-timeout" ||
          String(error?.message || error || "").toLowerCase().includes("local stt");
        if (localError) {
          showToast("Local STT unavailable. Browser fallback will be used if possible.");
        }
        if (permissionError || deviceError) {
          speechStarted = false;
          if (permissionError) permissionState.microphone = false;
          presentationStore.setState({
            permission: {
              ...presentationStore.getState().permission,
              microphone: permissionError ? "denied" : "unavailable",
            },
          });
          showToast(permissionError
            ? "마이크 권한이 없어 음성 앵커 기능을 사용할 수 없습니다."
            : "마이크 장치를 사용할 수 없어 음성 앵커 기능이 중지되었습니다.");
        }
      },
      onStatus: (status) => {
        latestSttStatus = status || latestSttStatus;
        if (status?.status === "transcribing") latestSttRequestAt = new Date().toISOString();
        if (["transcribed", "empty", "error", "disabled", "stopped"].includes(status?.status)) {
          latestSttResponseAt = new Date().toISOString();
        }
        const statusProviderMatches = !status?.provider || status.provider === speechController?.getProvider?.();
        const controllerRunning = Boolean(speechController?.isRunning?.());
        if (
          status?.status === "disabled" ||
          (status?.status === "stopped" && statusProviderMatches) ||
          (status?.status === "error" && !controllerRunning)
        ) {
          speechStarted = false;
        }
        if (status?.text) {
          latestRecognizedSpeech = {
            text: status.text,
            recognized_at: new Date().toISOString(),
            confidence: status.confidence ?? null,
            is_final: status.isFinal ?? status.status === "transcribed",
          };
        }
        if (status?.status !== "error") latestSttError = "";
        if (status?.status === "checking") latestSttActivity = "로컬 STT 서버 연결 확인 중...";
        if (status?.status === "warming") latestSttActivity = "STT 紐⑤뜽 以鍮?以?..";
        if (status?.status === "audio-ready") {
          latestSttActivity = status.audioState === "running"
            ? "마이크 오디오 엔진 준비 완료"
            : `오디오 엔진 상태: ${status.audioState || "unknown"}`;
        }
        if (status?.status === "requesting-microphone") latestSttActivity = "마이크 연결 요청 중...";
        if (status?.status === "running") {
          latestSttDeviceLabel = status.deviceLabel || latestSttDeviceLabel;
          latestSttActivity = status.deviceLabel
            ? `마이크 입력 대기 중: ${status.deviceLabel}`
            : "마이크 입력 대기 중... 말해주세요.";
        }
        if (status?.status === "capturing") {
          latestSttLevelDb = Number.isFinite(status.levelDb) ? status.levelDb : latestSttLevelDb;
          latestSttOutputLevelDb = Number.isFinite(status.estimatedOutputLevelDb)
            ? status.estimatedOutputLevelDb
            : latestSttOutputLevelDb;
          latestSttGain = Number.isFinite(status.estimatedGain) ? status.estimatedGain : latestSttGain;
          const inputText = Number.isFinite(latestSttLevelDb) ? `${latestSttLevelDb.toFixed(1)} dB` : "측정 중";
          const outputText = Number.isFinite(latestSttOutputLevelDb)
            ? `${latestSttOutputLevelDb.toFixed(1)} dB`
            : "측정 중";
          const deviceText = latestSttDeviceLabel ? ` · ${latestSttDeviceLabel}` : "";
          latestSttActivity = `음성 수집 중 · 원본 ${inputText} · 전송 ${outputText} (${latestSttGain.toFixed(1)}배)${deviceText}`;
        }
        if (status?.status === "transcribing") {
          latestSttActivity = status.provider === "web-speech" && status.text
            ? `브라우저 인식 중: ${status.text}`
            : `음성 분석 중... 청크 #${status.chunk || 0}`;
        }
        if (status?.status === "empty") {
          latestSttActivity = Number.isFinite(latestSttLevelDb) && latestSttLevelDb < -70
            ? `VAD 사이에서 음성을 찾지 못했습니다. 원본 입력 ${latestSttLevelDb.toFixed(1)} dB · 선택한 마이크를 확인해주세요.`
            : `VAD 사이에서 Whisper 결과가 비었습니다${Number.isFinite(latestSttOutputLevelDb) ? ` · 전송 ${latestSttOutputLevelDb.toFixed(1)} dB` : ""}.`;
        }
        if (status?.status === "normalized") {
          latestSttOutputLevelDb = status.outputLevelDb;
          latestSttGain = status.gain;
          latestSttActivity = `작은 음성을 자동 증폭했습니다: ${status.inputLevelDb} dB → ${status.outputLevelDb} dB (${status.gain}배)`;
        }
        if (status?.status === "noise-skipped") {
          latestSttActivity = `말소리 변화가 없어 녹음 청크를 건너뛰었습니다 · 원본 ${status.inputLevelDb} dB · 마이크 위치를 확인해주세요.`;
        }
        if (status?.status === "chunk-skipped") latestSttActivity = "수집된 음성이 너무 짧아 다음 청크를 기다리는 중...";
        if (status?.status === "transcribed") latestSttActivity = status.text || latestSttActivity;
        if (status?.status === "fallback") latestSttActivity = "로컬 STT 연결 실패. 브라우저 STT로 전환 중...";
        if (status?.status === "disabled") latestSttActivity = "사용 가능한 STT가 없어 음성 인식이 중지되었습니다.";
        renderSttDebugPanel();
        renderDebugPanel();
        if (status?.status === "checking") showToast("Local STT server checking...");
        if (status?.status === "warming") showToast("Local STT model warming up...");
        if (status?.status === "running") showToast("Local STT is running.");
        if (status?.status === "fallback") showToast("Using browser STT fallback.");
        if (status?.status === "disabled") {
          speechStarted = false;
          showToast("STT disabled. Gesture and PDF controls remain available.");
        }
        if (status?.status === "transcribed") console.info("AirNote local STT:", status.text);
      },
    });
    if (!speechController.isSupported()) {
      showToast("음성 인식을 지원하지 않는 브라우저입니다.");
      return false;
    }
    try {
      speechStarted = speechController.start();
      latestSttError = speechStarted ? "" : "음성 인식을 시작하지 못했습니다.";
      latestSttStatus = {
        provider: speechController.getProvider?.() || "none",
        status: speechStarted ? "starting" : "start-failed",
      };
      renderSttDebugPanel();
      return speechStarted;
    } catch (error) {
      speechStarted = false;
      console.warn("AirNote presentation: speech recognition start failed.", error);
      showToast("음성 인식 시작 실패");
      return false;
    }
  }

  // --- SECTION: PDF ---
  async function renderPdfPage(pageNo) {
    if (!pdfDoc || !pdfCanvas || !pdfCtx) return;

    if (renderTask) {
      window.AirNoteModules.cancelRenderTask(renderTask);
      renderTask = null;
    }

    const renderId = ++renderSequence;

    try {
      const page = await pdfDoc.getPage(pageNo);
      if (renderId !== renderSequence) return;
      const viewport = getFitViewport(page);
      pdfCanvas.width = Math.round(viewport.width);
      pdfCanvas.height = Math.round(viewport.height);
      fitSlideToPdfCanvas();
      pdfCtx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);

      const activeRenderTask = page.render({ canvasContext: pdfCtx, viewport });
      renderTask = activeRenderTask;
      await activeRenderTask.promise;
      if (renderId !== renderSequence || renderTask !== activeRenderTask) return;
      renderTask = null;

      resizeOverlayCanvases(false);
      restoreCurrentPageAnnotation();
      clearPointer();
      updatePageIndicator();
      syncAnchorMatchOverlaySize();
      const visibleAnchor = getValidSpeechAnchor();
      // 빨간 매칭 박스 시스템 폐기 — 후보 박스(showSttAnchorBox) 하나만 새 좌표계로 다시 그린다.
      if (visibleAnchor) showSttAnchorBox(visibleAnchor, { matchedText: visibleAnchor.matchedText || visibleAnchor.text });
      repositionSttAnchorBoxes();
      publishPresentationOverlay();
    } catch (error) {
      if (error?.name === "RenderingCancelledException") return;
      console.warn("AirNote presentation: PDF page render failed.", error);
      showToast("PDF 렌더링 실패");
    }
  }

  async function loadPdfFile(file, metadata = {}) {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      showToast("PDF 파일만 업로드할 수 있습니다.");
      return;
    }

    if (!window.pdfjsLib) {
      showToast("PDF.js 濡쒕뵫 ?ㅽ뙣");
      return;
    }

    try {
      currentPdfFileName = file.name;
      currentPresentationId = "";
      sessionStorage.removeItem(CURRENT_PRESENTATION_ID_KEY);
      currentPdfId = metadata.pdfId ? String(metadata.pdfId) : "";
      if (currentPdfId) sessionStorage.setItem(CURRENT_PDF_ID_KEY, currentPdfId);
      else sessionStorage.removeItem(CURRENT_PDF_ID_KEY);
      endGestureSession("pdf-change");
      activeTextAnchor = null;
      pendingSpeechAnchorKey = "";
      pendingSpeechAnchorCount = 0;
      lastSelectedAnchorOrder = -1;
      latestMatchDiagnostics = null;
      resetAnnotationState();
      slideArt?.classList.remove("has-selected-pdf");
      updateSelectedPdfLabel(file.name);
      const data = await file.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data });
      pdfDoc = await loadingTask.promise;
      totalPage = pdfDoc.numPages || 1;
      await ensureBackendPdf(file);
      currentPage = 1;
      updatePageIndicator();
      await renderPdfPage(currentPage);
      await extractPdfTextAnchors();
      if (permissionState.microphone) startSpeechRecognition();
      showToast("PDF 불러오기 완료");
    } catch (error) {
      console.warn("AirNote presentation: PDF load failed.", error);
      pdfDoc = null;
      currentPdfFileName = "";
      totalPage = 1;
      currentPage = 1;
      updatePageIndicator();
      showToast("PDF 불러오기 실패");
    }
  }

  async function loadSelectedPdfFromHome() {
    sessionStorage.removeItem(CURRENT_MOCK_PDF_KEY);

    const selectedId = sessionStorage.getItem(CURRENT_PDF_KEY);
    if (!selectedId) return;

    try {
      const record = await pdfRepository.get(selectedId);

      if (!record?.blob) return;
      const file = new File([record.blob], record.name || "presentation.pdf", {
        type: record.type || "application/pdf",
      });
      await loadPdfFile(file, { pdfId: record.pdfId });
    } catch (error) {
      console.warn("AirNote presentation: selected PDF restore failed.", error);
      showToast("전에 선택한 PDF를 불러오지 못했습니다.");
    }
  }

  function getAllStoredPdfs() {
    return pdfRepository.getAll().catch((error) => {
      console.warn("AirNote presentation: stored PDF list failed.", error);
      return [];
    });
  }

  async function loadStoredPdf(record) {
    if (!record?.blob) return;
    sessionStorage.setItem(CURRENT_PDF_KEY, record.id);
    sessionStorage.removeItem(CURRENT_MOCK_PDF_KEY);
    const file = new File([record.blob], record.name || "presentation.pdf", {
      type: record.type || "application/pdf",
    });
    await loadPdfFile(file, { pdfId: record.pdfId });
  }

  function splitFileName(name) {
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex <= 0) return { base: name, ext: "" };
    return { base: name.slice(0, dotIndex), ext: name.slice(dotIndex) };
  }

  function getDisplayNames(pdfs) {
    const seen = new Map();
    return pdfs.map((pdf) => {
      const originalName = pdf.name || "presentation.pdf";
      const count = seen.get(originalName) || 0;
      seen.set(originalName, count + 1);
      if (count === 0) return originalName;
      const { base, ext } = splitFileName(originalName);
      return `${base}(${count})${ext}`;
    });
  }

  async function renderPdfSelectModal() {
    if (!modalPdfList) return;
    const storedPdfs = await getAllStoredPdfs();
    const modalItems = storedPdfs
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .map((pdf) => ({ ...pdf, source: "stored" }));

    modalPdfList.innerHTML = "";
    if (!modalItems.length) {
      modalPdfList.innerHTML = '<p class="empty-state">아직 업로드된 발표 자료가 없습니다.</p>';
      return;
    }
    const displayNames = getDisplayNames(modalItems);
    modalItems.forEach((pdf, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "modal-file-item";
      button.innerHTML = `
        <span>PDF</span>
        <div>
          <strong></strong>
          <p>${pdf.date || "방금 업로드"}${pdf.pages ? ` · ${pdf.pages} pages` : ""}</p>
        </div>
      `;
      button.querySelector("strong").textContent = displayNames[index];
      button.addEventListener("click", async () => {
        await loadStoredPdf(pdf);
        setModalOpen(pdfSelectModal, false);
      });
      modalPdfList.append(button);
    });
  }

  async function openPdfSelectModal() {
    await renderPdfSelectModal();
    setModalOpen(pdfSelectModal, true);
  }

  function initPdfSelectModal() {
    pdfLibraryOpenBtn?.addEventListener("click", openPdfSelectModal);
    pdfModalCloseBtn?.addEventListener("click", () => setModalOpen(pdfSelectModal, false));
    pdfSelectModal?.addEventListener("click", (event) => {
      if (event.target === pdfSelectModal) setModalOpen(pdfSelectModal, false);
    });
  }

  function initFullscreenButton() {
    fullscreenBtn?.addEventListener("click", async () => {
      if (!isRunning) {
        await startPresentationSession("live");
        return;
      }
      if (document.fullscreenElement !== slideArt) {
        await enterStageFullscreen();
      } else {
        await document.exitFullscreen?.();
      }
    });
  }

  function initCalibrationModal() {
    if (!calibrationModal || !calibrationConfirmBtn) return;
    renderCalibrationState();
    if (calibrationGuideCheck && calibrationGuideConfirmBtn) {
      calibrationGuideCheck.addEventListener("change", () => {
        calibrationGuideConfirmBtn.disabled = !calibrationGuideCheck.checked;
        calibrationGuideConfirmBtn.textContent = calibrationGuideCheck.checked ? "확인" : "확인이 필요합니다";
      });
      calibrationGuideConfirmBtn.addEventListener("click", () => {
        if (!calibrationGuideCheck.checked) return;
        localStorage.setItem(getCalibrationGuideKey(), "true");
        setModalOpen(calibrationGuideModal, false);
        renderCalibrationState("안내 확인 완료. 캘리브레이션을 시작해주세요.");
        calibrationStartBtn?.focus();
      });
    }
    const cancelGuidedCalibration = () => {
      guidedCalibrationActive = false;
      guidedCalibrationToken += 1;   // 진행 중 타이머/대기 전부 무효화
      setCalibrationStep(0);
    };
    calibrationConfirmBtn.addEventListener("click", async () => {
      if (latestCalibrationState?.status === "complete") {
        setModalOpen(calibrationModal, false);
        return;
      }
      await runGuidedCalibration();
    });
    calibrationCloseBtn?.addEventListener("click", () => {
      if (latestCalibrationState?.status === "collecting") {
        showToast("캘리브레이션 샘플을 수집하고 있습니다.");
        return;
      }
      cancelGuidedCalibration();
      setModalOpen(calibrationModal, false);
    });
    calibrationModal.addEventListener("click", (event) => {
      if (event.target === calibrationModal && latestCalibrationState?.status !== "collecting") {
        cancelGuidedCalibration();
        setModalOpen(calibrationModal, false);
      }
    });
    calibrationStartBtn?.addEventListener("click", runGuidedCalibration);
    calibrationResetBtn?.addEventListener("click", () => {
      cancelGuidedCalibration();
      window.AirNoteHandPointer?.resetCalibration?.();
      setModalOpen(calibrationModal, true);
      updateCalibrationState({ status: "required" });
    });
    if (!getCalibrationData()) {
      setModalOpen(calibrationGuideModal, true);
    }
  }

  function initInitialPermissionRequest() {
    const autoRequestOnce = () => {
      if (initialPermissionRequestDone) return;
      initialPermissionRequestDone = true;
      void requestPresentationPermissions();
    };

    permissionRequestBtn?.addEventListener("click", () => {
      // ?먮룞 ?붿껌???ㅽ뙣?덇굅???ъ슜?먭? 沅뚰븳???ㅼ떆 ?덉슜??寃쎌슦瑜??꾪빐 ?섎룞 踰꾪듉? ??긽 ?ъ떆??媛?ν븯寃??붾떎.
      initialPermissionRequestDone = true;
      void requestPresentationPermissions();
    });

    window.addEventListener("airnote:handpointer-ready", () => {
      void attachPermissionStreamToHandPointer();
      // 諛쒗몴 ?섏씠吏???뱀틺 ?쒖뒪泥섍? ?듭떖?대?濡? 蹂꾨룄 踰꾪듉???꾨Ⅴ吏 ?딆븘??沅뚰븳 ?붿껌???쒖옉?쒕떎.
      // ?ъ슜?먭? 沅뚰븳??嫄곕??섎㈃ 踰꾪듉?쇰줈 ?ㅼ떆 ?붿껌?????덈떎.
      window.setTimeout(autoRequestOnce, 300);
    });

    window.addEventListener("airnote:webcam-lost", (event) => {
      markWebcamDisconnected(event.detail?.reason || "웹캠 연결이 종료되었습니다.");
    });

    window.setTimeout(() => {
      if (window.AirNoteHandPointer?.initWebcam) autoRequestOnce();
    }, 700);
  }

  function initPdfUpload() {
    if (!pdfUploadInput) return;
    pdfUploadInput.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      loadPdfFile(file);
    });
  }

  async function movePage(direction) {
    const nextPageNo = Math.min(totalPage, Math.max(1, currentPage + direction));
    if (nextPageNo === currentPage) return;
    if (isRunning) {
      commitCurrentPageDuration();
      pageMoveCount += 1;
    }
    annotationEngine.snapshotPage(currentPage);
    saveCurrentPageAnnotation();
    const fromPageNo = currentPage;
    currentPage = nextPageNo;
    presentationStore.setState({ currentPage });
    recordPresentationEvent("page_change", { direction });
    saveBackendPageAction(fromPageNo, nextPageNo, direction);
    activeTextAnchor = null;
    lastPageChangedAt = performance.now();
    speechAnchorEngine.clear();
    presentationStore.setState({ speechAnchor: null });
    clearSttAnchorBox();
    clearAnchorMatchBox({ force: true });
    pendingSpeechAnchorKey = "";
    pendingSpeechAnchorCount = 0;
    lastSelectedAnchorOrder = -1;
    latestMatchDiagnostics = null;
    endGestureSession("page-change");
    strokeDeletionTracker.reset();
    stopDrawing();
    clearPointer();
    updatePageIndicator();
    if (pdfDoc) await renderPdfPage(currentPage);
    else restoreCurrentPageAnnotation();
  }

  function nextPage() {
    return movePage(1);
  }

  function prevPage() {
    return movePage(-1);
  }

  function updateModeUI() {
    if (currentModeText) currentModeText.textContent = modeLabelMap[currentMode] || currentMode;
    modeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === currentMode);
    });
    if (drawCanvas) drawCanvas.style.cursor = "default";
  }

  function setMode(mode) {
    if (!modeLabelMap[mode]) return;
    if (mode !== currentMode) endGestureSession("mode-change");
    currentMode = mode;
    presentationStore.setState({ gesture: { ...presentationStore.getState().gesture, mode } });
    recordPresentationEvent("tool_mode_change", { mode });
    if (mode === "highlight") currentHighlightWidth = DEFAULT_HIGHLIGHT_WIDTH;
    stopDrawing();
    updateModeUI();
    showToast(`${modeLabelMap[currentMode]} 모드`);
    renderDebugPanel();
  }

  function setUnderlineMode(mode) {
    if (!["freewriting", "straight"].includes(mode) || mode === underlineMode) return;
    endGestureSession("underline-mode-change");
    if (underlineGesture) {
      handleUnderlineGesture({ phase: "end", reason: "underline-mode-change" });
    }
    underlineMode = mode;
    if (presentationSession?.recording) {
      presentationSession.underlineMode = underlineMode;
      recordPresentationEvent("underline_mode_change", { mode: underlineMode });
    }
  }

  function getCanvasPoint(event) {
    if (!drawCanvas) return null;
    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / Math.max(1, rect.width);
    const scaleY = drawCanvas.height / Math.max(1, rect.height);
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function applyToolStyle() {
    if (!drawCtx) return;
    drawCtx.globalCompositeOperation = "source-over";
    drawCtx.globalAlpha = 1;
    if (currentMode === "pen") {
      drawCtx.strokeStyle = DRAWING_COLOR;
      drawCtx.lineWidth = 4;
    }
    if (currentMode === "highlight") {
      drawCtx.strokeStyle = "#fff176";
      drawCtx.globalAlpha = 0.45;
      drawCtx.lineWidth = gestureSession?.highlightWidth || currentHighlightWidth || DEFAULT_HIGHLIGHT_WIDTH;
    }
  }

  function drawLineTo(point) {
    if (!drawCtx || !lastPoint) return;
    applyToolStyle();
    drawCtx.beginPath();
    drawCtx.moveTo(lastPoint.x, lastPoint.y);
    drawCtx.lineTo(point.x, point.y);
    drawCtx.stroke();
    drawCtx.globalAlpha = 1;
    publishPresentationOverlay();
  }

  function drawAt() {
    // 留덉슦???곗튂 吏곸젒 ?먯꽌??吏?먰븯吏 ?딅뒗?? 紐⑤뱺 ?먯꽌?????쒖뒪泥섏뿉?쒕쭔 ?ㅽ뻾?쒕떎.
    return false;
  }

  function stopDrawing() {
    isDrawing = false;
    lastPoint = null;
  }

  function drawPointer(x, y, variant = "pointer", progress = 0) {
    if (!laserPointer || !drawCanvas) return;
    const rect = drawCanvas.getBoundingClientRect();
    const left = (x / Math.max(1, drawCanvas.width)) * rect.width;
    const top = (y / Math.max(1, drawCanvas.height)) * rect.height;
    laserPointer.classList.toggle("is-stroke-preview", variant === "stroke-preview");
    laserPointer.classList.toggle("is-undo-target", variant === "undo-target");
    laserPointer.style.setProperty("--undo-progress", String(Math.max(0, Math.min(1, progress))));
    laserPointer.style.setProperty("--stroke-preview-progress", String(Math.max(0, Math.min(1, progress))));
    laserPointer.style.left = `${left}px`;
    laserPointer.style.top = `${top}px`;
    laserPointer.style.opacity = "1";
  }

  // --- SECTION: STT 앵커 → 좌표 비례 이동 ---
  // 설계: STT가 매칭한 단어를 "원점(중심)"으로 삼고, 손 제스처는 그 중심에서부터
  // 상대 변위(delta)만큼 비례 이동한다. 손이 화면 다른 곳을 가리켜도 포인터/판서는
  // 매칭된 글자를 중심으로 움직인다. (getGestureOutputPoint / mapUnderlinePoint의
  // anchored 분기가 실제 비례 계산을 수행한다.)
  //
  // 일반 모드: 음성 매칭 시점에는 좌표만 "무장(arm)"해 두고 포인터를 강제로 띄우지
  //           않는다. 사용자가 포인터/판서 제스처를 TTL(SPEECH_ANCHOR_TTL_MS) 안에
  //           실행하면 그 순간 세션 원점이 글자로 점프하고 이후 손 변위로 비례 이동.
  // 제스처 중 매칭: 이미 제스처가 실행 중이면 getGestureOutputPoint의 anchorChanged
  //           감지가 다음 프레임에 세션을 새 앵커로 재정렬한다(글자로 즉시 이동).

  // 디버그/일반 모드 공통: 매칭된 글자 박스를 표시하고 앵커를 무장한다.
  function applySpeechAnchorVisual(anchor, { transcript = "" } = {}) {
    if (!anchor) return false;
    // Point 2: 시각적 디버그 박스는 DEBUG_MODE에서만 렌더링한다(프로덕션 누출 방지).
    if (DEBUG_MODE) {
      // 후보 박스 단일 시스템으로 표시한다(채택된 앵커 = 후보 #1 is-selected ✓).
      // 중복이던 빨간 매칭 박스(showPersistentMatchBox)는 제거했다.
      showSttAnchorBox(anchor, {
        transcript,
        matchedText: anchor.matchedText || anchor.text || "",
      });
    }
    // 앵커는 무장만 한다(박스 표시 + speechAnchorEngine 보관). 활성 세션을 도중에
    // 재정렬하지 않는다 — 다음에 제스처를 "새로 시작"할 때 getGestureOutputPoint가
    // getValidSpeechAnchor()로 이 앵커를 원점으로 잡는다. (발표 중 갑작스러운 점프 방지)
    return true;
  }

  function updatePointerFromHand(x, y, isActive) {
    if (!isActive) {
      clearPointer();
      stopDrawing();
      return;
    }
    resizeOverlayCanvases(true);
    drawPointer(x, y);
  }

  function handlePointerDown(event) {
    event?.preventDefault?.();
    return false;
  }

  function handlePointerMove(event) {
    event?.preventDefault?.();
    return false;
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    if (toastTimerId) window.clearTimeout(toastTimerId);
    toastTimerId = window.setTimeout(() => toast.classList.remove("show"), 2000);
  }

  function hasActiveLogin() {
    try {
      const stored = JSON.parse(localStorage.getItem("airnoteCurrentUser") || "null");
      return localStorage.getItem("airnoteRememberLogin") === "true"
        || sessionStorage.getItem("airnoteSessionActive") === "true"
        || Boolean(stored?.userId);
    } catch {
      return false;
    }
  }

  function clearLoginState() {
    localStorage.removeItem("airnoteRememberLogin");
    localStorage.removeItem("airnoteCurrentUser");
    // 援????붿뿬遺?泥?냼
    localStorage.removeItem("airnoteCurrentUserEmail");
    localStorage.removeItem("airnoteCurrentUserName");
    localStorage.removeItem("airnoteCurrentUserPassword");
    localStorage.removeItem("airnoteCurrentUserId");
    sessionStorage.removeItem("airnoteSessionActive");
  }

  async function saveAnnotation() {
    saveCurrentPageAnnotation();
    if (!drawCanvas) return;
    const payload = {
      presentationId: currentPresentationId || null,
      fileName: currentPdfFileName,
      pageNo: currentPage,
      totalPage,
      toolType: currentMode,
      elapsedSeconds,
      annotationImageData: drawCanvas.toDataURL("image/png"),
      pdfPageImageData: pdfCanvas?.width ? pdfCanvas.toDataURL("image/png") : "",
      createdAt: new Date().toISOString(),
    };
    console.log("annotation save payload", payload);
    await saveBackendRecordImage();
    showToast("저장 완료");
  }

  function publishPresentationOverlay() {
    if (!slideArt) return;
    const rect = slideArt.getBoundingClientRect();
    window.presentationOverlay = {
      stage: slideArt,
      pdfCanvas,
      drawCanvas,
      laserPointer,
      currentPage,
      totalPage,
      width: rect.width,
      height: rect.height,
    };
  }

  // --- SECTION: INIT ---
  presentationToggleBtn?.addEventListener("click", togglePresentation);
  window.AirNoteModules.bindSharedNavigation();
  fullscreenEndBtn?.addEventListener("click", async () => {
    if (activePresentationMode === "live") {
      await finishLivePresentation();
    } else {
      await requestPresentationSummary();
    }
  });
  prevPageBtn?.addEventListener("click", prevPage);
  nextPageBtn?.addEventListener("click", nextPage);
  fullscreenClearCanvasBtn?.addEventListener("click", clearCanvas);
  expectedTimeSelect?.addEventListener("change", () => {
    expectedMinutes = Number(expectedTimeSelect.value || 20);
    updatePresentationProgress();
  });
  fullscreenPanelToggleBtn?.addEventListener("click", () => {
    const isMinimized = !fullscreenPresenterUi?.classList.contains("is-minimized");
    setPanelMinimized(isMinimized);
    if (!isMinimized) schedulePanelAutoMinimize();
  });
  fullscreenPanelLockBtn?.addEventListener("click", () => setPanelPinned(!panelPinned));
  summaryConfirmBtn?.addEventListener("click", confirmPresentationSummary);

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });
  underlineModeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) setUnderlineMode(input.value);
    });
  });
  underlineModeSelector?.addEventListener("click", (event) => {
    const label = event.target.closest?.("label");
    if (!label) return;
    const input = label.querySelector('input[name="underlineMode"]');
    if (!input || input.checked) return;
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  if (drawCanvas) {
    // 留덉슦???곗튂 吏곸젒 ?낅젰? 吏?먰븯吏 ?딅뒗?? ?ъ씤???대깽?몃뒗 ?쒖뒪泥??먯꽌? 異⑸룎?섎?濡?諛붿씤?⑺븯吏 ?딅뒗??
  }

  window.addEventListener("resize", () => {
    saveCurrentPageAnnotation();
    refreshStageLayout(true);
  });
  document.addEventListener("fullscreenchange", () => {
    refreshStageLayout(true);
    if (
      isRunning &&
      activePresentationMode === "live" &&
      document.fullscreenElement !== slideArt &&
      !sessionStopPending
    ) {
      void finishLivePresentation({ exitFullscreen: false, reason: "fullscreen-exit" });
    }
  });

  window.AirNotePresentation = {
    updateSpeechAnchor,
    updatePointerFromHand,
    beginGestureSession,
    updateGestureSession,
    endGestureSession,
    handleUnderlineGesture,
    updateGestureDiagnostics,
    updateCalibrationState,
    handleGestureEvent: (detail) => {
      latestGestureDiagnostics = detail;
      if (detail?.phase === "start" && countableGestureCommands.has(detail.command)) {
        incrementPageGestureCount();
      }
      const now = performance.now();
      const gestureKey = `${detail?.command || "none"}:${detail?.phase || "idle"}:${detail?.blockedReason || ""}`;
      const shouldRecord =
        gestureKey !== lastRecordedGestureKey ||
        detail?.phase === "fired" ||
        now - lastRecordedGestureAt >= 500;
      if (shouldRecord) {
        lastRecordedGestureAt = now;
        lastRecordedGestureKey = gestureKey;
        recordPresentationEvent("gesture_state", {
          command: detail?.command || null,
          phase: detail?.phase || null,
          confidence: detail?.confidence || 0,
          blockedReason: detail?.blockedReason || "",
        });
      }
      renderDebugPanel();
      return true;
    },
    enterPresentation: startPresentationSession,
    exitPresentation: () => {
      if (!isRunning) return;
      if (activePresentationMode === "live") finishLivePresentation();
      else requestPresentationSummary();
    },
    startPresentationSession,
    stopPresentationSession,
    stopDrawing,
    nextPage,
    prevPage,
    clearCanvas,
    setMode,
    handleGestureCommand: (command) => {
      // STT ?듭빱???ㅽ뻾 紐낅졊???꾨땲???쒖옉??蹂댁젙 ?곗씠?곕떎.
      // ???쒖뒪泥??먯꽌??handleUnderlineGesture(start/move/bridge/grace/end)?먯꽌留?泥섎━?쒕떎.
      if (command === "clear_page") return clearCanvas();
      if (command === "next_page") return nextPage();
      if (command === "previous_page") return prevPage();
      return false;
    },
    startSpeechRecognition,
    getActiveSpeechAnchor: () => getValidSpeechAnchor(),
    getActiveTextAnchor: () => getValidSpeechAnchor(),
    resizeCanvasToSlide: () => resizeOverlayCanvases(true),
    resizeOverlayCanvases,
    clearAnnotationCanvasOnly,
    getOverlay: () => window.presentationOverlay,
    getState: () => ({
      currentPage,
      totalPage,
      currentMode,
      elapsedSeconds,
      isRunning,
      expectedMinutes,
      underlineMode,
      permissionState: { ...permissionState },
      recording: Boolean(presentationSession?.recording),
      gestureAnchored: Boolean(gestureSession?.anchored),
      activeSpeechAnchor: getValidSpeechAnchor(),
      currentHighlightWidth,
      permissionStatus: presentationStore.getState().permission,
    }),
  };
  const gestureBridge = window.AirNoteModules.createGestureBridge({
    presentationApi: window.AirNotePresentation,
  });
  gestureBridge.start();

  window.addEventListener("pagehide", () => {
    if (debugHealthTimerId) window.clearInterval(debugHealthTimerId);
    speechController?.dispose();
    presentationSessionController.dispose();
    annotationEngine.dispose();
    gestureBridge.dispose();
    permissionManager.dispose();
    presentationRecorder.dispose();
    presentationStore.dispose();
    window.AirNoteHandPointer?.stopWebcam?.();
  }, { once: true });

  ensureDebugPanel();
  if (DEBUG_MODE) openAirDebugPanel();
  // 디버그 주소(?debug=1)에서는 STT 인식/좌표 박스를 기본 ON으로 켜서
  // "어떤 단어가 인식되고 좌표가 어디로 이동하는지"를 클릭 없이 바로 눈으로 확인한다.
  // 명시적으로 꺼둔 적("false")이 있으면 그 설정을 존중하고, ?sttDebug=1이면 강제 ON.
  const sttDebugInitial = DEBUG_MODE && !(
    debugParams.has("sttDebug")
    && ["0", "false", "off", "no"].includes(String(debugParams.get("sttDebug") || "").trim().toLowerCase())
  );
  setSttDebugEnabled(sttDebugInitial);
  applyOverlayLayout();
  initPdfUpload();
  initPdfSelectModal();
  initFullscreenButton();
  initCalibrationModal();
  initInitialPermissionRequest();
  loadSelectedPdfFromHome();
  updateTimerText();
  updatePresentationProgress();
  updatePresentationButton();
  updatePageIndicator();
  updateModeUI();
  resizeOverlayCanvases(true);
  renderDebugPanel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAirNotePresentation, { once: true });
  } else {
    initAirNotePresentation();
  }
})();


