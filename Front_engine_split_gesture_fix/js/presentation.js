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
  const CURRENT_USER_EMAIL_KEY = "airnoteCurrentUserEmail";
  const PRESENTATION_RECORDS_KEY = "airnote.presentationRecords";
  const SPEECH_ANCHOR_TTL_MS = 8000;
  const GESTURE_MOVEMENT_GAIN = 1.5;
  const POINTER_MOVEMENT_MIN_GAIN = 1.2;
  const POINTER_MOVEMENT_MAX_GAIN = 1.3;
  const MAX_PHRASE_LENGTH = 6;
  const STT_SCORE_THRESHOLD = 0.78;
  const STT_AMBIGUITY_GAP = 0.12;
  const STT_ANCHOR_BOX_TTL_MS = 6000;
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
  const DEBUG_MODE = new URLSearchParams(window.location.search).get("debug") === "1";
  const STOP_WORDS = new Set([
    "은", "는", "이", "가", "을", "를", "의", "에", "에서", "으로", "로",
    "와", "과", "도", "만", "부터", "까지", "그리고", "하지만", "그래서",
    "합니다", "입니다", "있습니다", "됩니다", "하는", "한", "그", "이것",
  ]);

  const slideArt = document.getElementById("slideArt") || document.querySelector(".slide-art");
  const pdfCanvas = document.getElementById("pdfCanvas");
  const drawCanvas = document.getElementById("drawCanvas") || document.getElementById("annotationCanvas");
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

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
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
  let savedTextAnchorPageKeys = new Set();
  let textAnchorSource = "none";
  let textAnchorLoadError = "";
  let activeTextAnchor = null;
  let activeTextAnchorSelectedAt = 0;
  let pendingSpeechAnchorKey = "";
  let pendingSpeechAnchorCount = 0;
  let speechRecognition = null;
  let speechStarted = false;
  let gestureSession = null;
  let lastSelectedAnchorOrder = -1;
  let latestMatchDiagnostics = null;
  let latestGestureDiagnostics = null;
  let latestCalibrationState = null;
  let lastSavedCalibrationKey = "";
  let currentHighlightWidth = DEFAULT_HIGHLIGHT_WIDTH;
  let debugPanel = null;
  let sttAnchorOverlay = null;
  let sttAnchorClearTimer = null;
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
  let lastRecordedGestureKey = "";
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
    scoreThreshold: STT_SCORE_THRESHOLD,
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

  const modeLabelMap = {
    pointer: "포인터",
    pen: "펜",
    highlight: "형광펜",
  };

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
    presentationToggleBtn.textContent = isRunning ? "리허설 종료" : "리허설 시작";
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
        showToast("리허설 기록이 시작되었습니다.");
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
      return stored?.userId || localStorage.getItem("airnoteCurrentUserId") || "";
    } catch {
      return localStorage.getItem("airnoteCurrentUserId") || "";
    }
  }

  function saveBackendCalibration(profile) {
    const userId = getCurrentUserId();
    if (!backendApi || !userId || !profile) return;
    const calibrationKey = `${userId}:${profile.createdAt || ""}:${profile.openPalmSampleCount || 0}:${profile.pinchSampleCount || 0}`;
    if (calibrationKey === lastSavedCalibrationKey) return;
    lastSavedCalibrationKey = calibrationKey;
    backendApi.saveUserCalibration({
      userId,
      ...profile,
    }).catch((error) => {
      console.warn("AirNote presentation: backend calibration save failed.", error);
      showToast("서버 캘리브레이션 저장에 실패했습니다.");
    });
  }

  async function startBackendPresentation() {
    const userId = getCurrentUserId();
    if (!backendApi || !userId || !currentPdfId) {
      if (!currentPdfId) showToast("PDF 서버 업로드 정보가 없어 로컬 리허설로 시작합니다.");
      return null;
    }
    try {
      const response = await backendApi.startPresentation({ userId, pdfId: currentPdfId });
      const data = response.data || {};
      currentPresentationId = data.presentationId ? String(data.presentationId) : "";
      if (currentPresentationId) sessionStorage.setItem(CURRENT_PRESENTATION_ID_KEY, currentPresentationId);
      if (data.pdfId) {
        currentPdfId = String(data.pdfId);
        sessionStorage.setItem(CURRENT_PDF_ID_KEY, currentPdfId);
      }
      return data;
    } catch (error) {
      console.warn("AirNote presentation: backend rehearsal start failed.", error);
      showToast("서버 리허설 시작 저장에 실패해 로컬로 진행합니다.");
      return null;
    }
  }

  async function endBackendPresentation() {
    if (!backendApi || !currentPresentationId) return null;
    try {
      const response = await backendApi.endPresentation(currentPresentationId);
      sessionStorage.removeItem(CURRENT_PRESENTATION_ID_KEY);
      return response.data || null;
    } catch (error) {
      console.warn("AirNote presentation: backend rehearsal end failed.", error);
      showToast("서버 리허설 종료 저장에 실패했습니다.");
      return null;
    }
  }

  async function ensureBackendPdf(file) {
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
      showToast("PDF 서버 업로드에 실패해 로컬 리허설로 진행합니다.");
      return null;
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

  async function saveBackendRecordImage() {
    if (!backendApi || !currentPresentationId || !drawCanvas) return null;
    const blob = await canvasToBlob(drawCanvas);
    if (!blob) return null;
    try {
      const response = await backendApi.saveRecordImage({
        presentationId: currentPresentationId,
        pageNo: currentPage,
        image: new File([blob], `airnote-page-${currentPage}.png`, { type: "image/png" }),
      });
      return response.data || null;
    } catch (error) {
      console.warn("AirNote presentation: backend record image save failed.", error);
      showToast("서버 이미지 저장에 실패했습니다.");
      return null;
    }
  }

  function saveBackendAnnotation(fields) {
    if (!backendApi || !currentPresentationId) return;
    backendApi.saveAnnotation({
      presentationId: currentPresentationId,
      pageNo: currentPage,
      ...fields,
    }).catch((error) => {
      console.warn("AirNote presentation: backend annotation save failed.", error);
    });
  }

  function saveBackendAnchorMatchLog({ transcript, normalized, best, second, scoreGap, accepted }) {
    if (!backendApi || !currentPresentationId || !currentPdfId || !best) return;
    backendApi.saveAnchorMatchLog({
      presentationId: currentPresentationId,
      pdfId: currentPdfId,
      pageNo: currentPage,
      sttText: transcript,
      sttNormalized: normalized,
      extractedKeywords: tokenize(normalized, true).join(","),
      sttConfidence: best.score,
      matchStatus: accepted ? "SELECTED" : "REJECTED",
      selectedAnchorId: best.anchor.id,
      topScore: best.score,
      secondScore: second?.score || 0,
      scoreGap,
      candidateCount: latestMatchDiagnostics?.candidates?.length || 0,
      thresholdScore: STT_SCORE_THRESHOLD,
      ambiguousGap: STT_AMBIGUITY_GAP,
      decisionReason: latestMatchDiagnostics?.reason || "",
      matchAlgorithm: "HYBRID",
      actionType: "UNDERLINE",
      processTimeMs: 0,
    }).then((response) => {
      if (activeTextAnchor && response.data?.matchLogId && activeTextAnchor.matchedAnchorId === best.anchor.id) {
        activeTextAnchor.matchLogId = response.data.matchLogId;
      }
    }).catch((error) => {
      console.warn("AirNote presentation: backend anchor match log save failed.", error);
    });
  }

  async function startPresentationSession(mode = "rehearsal") {
    if (isRunning || presentationSessionController.isRunning()) return true;
    activePresentationMode = mode === "live" ? "live" : "rehearsal";
    if (presentationToggleBtn) presentationToggleBtn.disabled = true;
    if (fullscreenBtn) fullscreenBtn.disabled = true;
    try {
      await requestPresentationPermissions();
      await enterStageFullscreen();
      await startBackendPresentation();
      await presentationSessionController.start();
      if (permissionState.microphone) startSpeechRecognition();
      return true;
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
      await presentationSessionController.stop(reason);
      await endBackendPresentation();
      if (!silent) showToast("발표 기록이 저장되었습니다.");
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
      return "브라우저에서 카메라와 마이크가 차단되어 있습니다. 주소창 왼쪽 사이트 설정에서 둘 다 허용으로 바꿔주세요.";
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
      return "브라우저가 권한을 차단했습니다. 주소창 왼쪽 사이트 설정에서 카메라/마이크를 허용으로 바꿔주세요.";
    }
    if (error.name === "NotFoundError") {
      return "카메라 또는 마이크 장치를 찾을 수 없습니다. 장치 연결 상태를 확인해주세요.";
    }
    if (error.name === "NotReadableError") {
      return "카메라 또는 마이크가 다른 프로그램에서 사용 중입니다. 화상회의/카메라 앱을 종료한 뒤 다시 시도해주세요.";
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
      permissionRequestBtn.textContent = "권한 확인 중";
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
        : "웹캠/마이크 권한은 localhost, 127.0.0.1 또는 HTTPS에서 실행해야 요청할 수 있습니다.";
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
        permissionRequestBtn.textContent = "웹캠·마이크 권한 다시 확인";
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

  function ensureDebugPanel() {
    if (!DEBUG_MODE || debugPanel) return;
    debugPanel = document.createElement("pre");
    debugPanel.id = "airnoteDebugPanel";
    Object.assign(debugPanel.style, {
      position: "fixed",
      right: "12px",
      bottom: "12px",
      zIndex: "2147483646",
      width: "min(460px, calc(100vw - 24px))",
      maxHeight: "42vh",
      overflow: "auto",
      margin: "0",
      padding: "12px",
      borderRadius: "10px",
      background: "rgba(7, 11, 37, 0.92)",
      color: "#d9f99d",
      font: "12px/1.45 Consolas, monospace",
      whiteSpace: "pre-wrap",
      pointerEvents: "none",
    });
    document.body.appendChild(debugPanel);
  }

  function renderDebugPanel() {
    if (!DEBUG_MODE) return;
    ensureDebugPanel();
    const anchor = getValidSpeechAnchor();
    debugPanel.textContent = JSON.stringify({
      state: {
        currentMode,
        underlineMode,
        gestureAnchored: Boolean(gestureSession?.anchored),
        apiConnected: Boolean(window.AirNoteModules?.AirNoteApi || window.AirNoteApi),
        currentPdfId,
        currentPresentationId,
        textAnchorSource,
        textAnchorPages: pdfTextAnchors.size,
        textAnchorLoadError,
      },
      gesture: latestGestureDiagnostics && {
        command: latestGestureDiagnostics.command,
        phase: latestGestureDiagnostics.phase,
        confidence: Number(latestGestureDiagnostics.confidence || 0).toFixed(3),
        blockedReason: latestGestureDiagnostics.blockedReason || "",
        pointerBlocked: Boolean(latestGestureDiagnostics.pointerBlocked),
        commandState: latestGestureDiagnostics.commandState,
        scores: latestGestureDiagnostics.scores,
      },
      calibration: latestCalibrationState && {
        status: latestCalibrationState.status,
        phase: latestCalibrationState.phase,
        samples: latestCalibrationState.sampleCounts,
      },
      speechAnchor: anchor && {
        pageNo: anchor.pageNo,
        text: anchor.text,
        matchedText: anchor.matchedText,
        kind: anchor.kind,
        order: anchor.order,
        score: anchor.score,
        xRatio: Number(anchor.xRatio || 0).toFixed(4),
        yRatio: Number(anchor.yRatio || 0).toFixed(4),
        widthRatio: Number(anchor.widthRatio || 0).toFixed(4),
        heightRatio: Number(anchor.heightRatio || 0).toFixed(4),
        selectedAt: anchor.selectedAt,
      },
      match: latestMatchDiagnostics,
      highlight: {
        width: Number(currentHighlightWidth || DEFAULT_HIGHLIGHT_WIDTH).toFixed(1),
        lineText: underlineGesture?.currentLine?.text || gestureSession?.currentLine?.text || null,
      },
      stroke: underlineGesture && {
        mode: underlineGesture.mode,
        tool: underlineGesture.tool,
        phase: underlineGesture.phase,
        anchored: underlineGesture.anchored,
        pointCount: underlineGesture.points?.length || 0,
      },
      anchoredGesture: Boolean(gestureSession?.anchored),
    }, null, 2);
  }

  function updateGestureDiagnostics(detail) {
    latestGestureDiagnostics = detail;
    renderDebugPanel();
  }

  function getCurrentUserEmail() {
    return localStorage.getItem(CURRENT_USER_EMAIL_KEY) || "example@google.com";
  }

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
          || `손 크기 ${Number(calibration.palmSizePx || 0).toFixed(1)}px 기준이 적용됩니다.`;
      }
      if (calibrationStartBtn) calibrationStartBtn.hidden = true;
      if (calibrationResetBtn) calibrationResetBtn.hidden = false;
      return;
    }

    calibrationBadge?.classList.remove("complete");
    if (calibrationBadge) calibrationBadge.textContent = "캘리브레이션 필요";
    if (calibrationStatusText) {
      calibrationStatusText.textContent = statusMessage || "손바닥과 밑줄 제스처를 등록해주세요.";
    }
    if (calibrationStartBtn) calibrationStartBtn.hidden = false;
    if (calibrationResetBtn) calibrationResetBtn.hidden = true;
  }

  async function runCalibrationRegistration() {
    setModalOpen(calibrationModal, true);
    if (calibrationErrorText) calibrationErrorText.textContent = "";
    if (calibrationConfirmBtn) {
      calibrationConfirmBtn.disabled = true;
      calibrationConfirmBtn.textContent = "권한 확인 중";
    }
    const permissions = await requestPresentationPermissions();
    if (!permissions.webcam) {
      updateCalibrationState({ status: "failed", reason: "웹캠 권한이 허용되지 않았습니다." });
      return false;
    }
    if (!window.AirNoteHandPointer?.startCalibration?.()) {
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
      const progress = Math.min(100, Math.max(0, (1 - Number(detail.remainingMs || 0) / 2000) * 100));
      if (calibrationStartBtn) {
        calibrationStartBtn.disabled = true;
        calibrationStartBtn.textContent = isPalm ? "손바닥 등록 중" : "밑줄 제스처 등록 중";
      }
      if (calibrationModalBadge) {
        calibrationModalBadge.textContent = isPalm ? "1/2 손바닥 등록" : "2/2 핀치 등록";
        calibrationModalBadge.classList.remove("complete");
      }
      if (calibrationPhaseTitle) calibrationPhaseTitle.textContent = isPalm ? "손바닥을 펴주세요" : "엄지와 검지를 붙여주세요";
      if (calibrationPhaseGuide) {
        calibrationPhaseGuide.textContent = isPalm
          ? "손 전체가 화면 중앙에 보이도록 하고 2초간 안정적으로 유지해주세요."
          : "엄지와 검지 끝을 붙인 상태로 손을 움직이지 말고 2초간 유지해주세요.";
      }
      if (calibrationProgressBar) calibrationProgressBar.style.width = `${progress}%`;
      if (calibrationSampleText) calibrationSampleText.textContent = `수집된 샘플 ${count || 0}개`;
      if (calibrationErrorText) calibrationErrorText.textContent = "";
      if (calibrationConfirmBtn) {
        calibrationConfirmBtn.disabled = true;
        calibrationConfirmBtn.textContent = "샘플 수집 중";
      }
      renderCalibrationState(
        `${isPalm ? "손바닥을 펴고" : "엄지와 검지를 붙이고"} 유지해주세요. 샘플 ${count || 0}개`
      );
    } else if (detail.status === "complete") {
      saveBackendCalibration(detail.profile);
      if (calibrationStartBtn) {
        calibrationStartBtn.disabled = false;
        calibrationStartBtn.textContent = "캘리브레이션 시작";
      }
      calibrationModalBadge?.classList.add("complete");
      if (calibrationModalBadge) calibrationModalBadge.textContent = "등록 완료";
      if (calibrationPhaseTitle) calibrationPhaseTitle.textContent = "캘리브레이션 완료";
      if (calibrationPhaseGuide) calibrationPhaseGuide.textContent = "저장된 손 크기와 핀치 기준이 이후 발표에 자동 적용됩니다.";
      if (calibrationProgressBar) calibrationProgressBar.style.width = "100%";
      if (calibrationSampleText) {
        calibrationSampleText.textContent = `손바닥 ${detail.sampleCounts?.openPalm || 0}개 · 핀치 ${detail.sampleCounts?.pinch || 0}개`;
      }
      if (calibrationErrorText) calibrationErrorText.textContent = "";
      if (calibrationConfirmBtn) {
        calibrationConfirmBtn.disabled = false;
        calibrationConfirmBtn.textContent = "완료";
      }
      renderCalibrationState("실측 캘리브레이션이 완료되었습니다.");
      showToast("캘리브레이션이 저장되었습니다.");
    } else if (detail.status === "failed") {
      if (calibrationStartBtn) {
        calibrationStartBtn.disabled = false;
        calibrationStartBtn.textContent = "다시 시도";
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
      laserPointer.style.zIndex = "3";
      laserPointer.style.pointerEvents = "none";
    }
    overlayLayoutApplied = true;
  }
  function resizeOverlayCanvases(preserveAnnotation = true) {
    applyOverlayLayout();
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
      fileName: currentPdfFileName || "선택된 발표 자료 없음",
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
    const records = getStoredPresentationRecords();
    localStorage.setItem(PRESENTATION_RECORDS_KEY, JSON.stringify([summary, ...records]));
  }

  function showPresentationSummary() {
    stopTimer();
    commitCurrentPageDuration();
    pageEnteredAt = 0;
    updateTimerText();
    const summary = getPresentationSummary();
    renderPresentationSummary(summary);
    if (summaryConfirmBtn) summaryConfirmBtn.dataset.summary = JSON.stringify(summary);
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

  function showSttAnchorBox(anchor, { transcript = "", matchedText = "" } = {}) {
    if (!anchor || Number(anchor.pageNo || currentPage) !== currentPage) return;
    const overlay = ensureSttAnchorOverlay();
    if (!overlay) return;
    clearSttAnchorBox();
    const box = document.createElement("div");
    box.className = "stt-anchor-box";
    const x = clampRatio(anchor.xRatio);
    const y = clampRatio(anchor.yRatio);
    const width = clampRatio(anchor.widthRatio || 0.04);
    const height = clampRatio(anchor.heightRatio || 0.025);
    box.style.left = `${x * 100}%`;
    box.style.top = `${y * 100}%`;
    box.style.width = `${Math.max(0.018, width) * 100}%`;
    box.style.height = `${Math.max(0.018, height) * 100}%`;
    box.title = `STT: ${transcript || matchedText || anchor.text || ""}`;
    box.dataset.label = matchedText || anchor.matchedText || anchor.text || "";
    overlay.appendChild(box);
    sttAnchorClearTimer = window.setTimeout(clearSttAnchorBox, STT_ANCHOR_BOX_TTL_MS);
  }

  function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function getValidSpeechAnchor(now = performance.now()) {
    const anchor = speechAnchorEngine.getActive(currentPage);
    if (!anchor || !activeTextAnchorSelectedAt || now - activeTextAnchorSelectedAt > SPEECH_ANCHOR_TTL_MS) return null;
    return anchor;
  }

  function updateSpeechAnchor(anchor) {
    if (!anchor) {
      activeTextAnchor = null;
      activeTextAnchorSelectedAt = 0;
      speechAnchorEngine.clear();
      presentationStore.setState({ speechAnchor: null });
      clearSttAnchorBox();
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
    activeTextAnchorSelectedAt = performance.now();
    speechAnchorEngine.update(activeTextAnchor);
    presentationStore.setState({ speechAnchor: activeTextAnchor });
    recordPresentationEvent("speech_anchor", activeTextAnchor);
    showSttAnchorBox(activeTextAnchor, { matchedText: activeTextAnchor.matchedText || activeTextAnchor.text });
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

  function endGestureSession(reason = "ended") {
    gestureSession = null;
    presentationStore.setState({ gesture: { active: false, mode: currentMode, reason } });
    stopDrawing();
    if (reason !== "mode-change") clearPointer();
  }

  function beginGestureSession(mode, handPoint) {
    if (!handPoint || !drawCanvas) return null;
    const normalizedMode = modeLabelMap[mode] ? mode : currentMode;
    const anchor = getValidSpeechAnchor();
    const anchorPoint = getAnchorStartPoint(anchor);
    gestureSession = {
      mode: normalizedMode,
      pageNo: currentPage,
      anchored: Boolean(anchorPoint),
      anchor,
      anchorPoint,
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
    return gestureSession;
  }

  function getGestureOutputPoint(handPoint) {
    if (!drawCanvas || !handPoint) return null;
    const handX = clampRatio(handPoint.xRatio);
    const handY = clampRatio(handPoint.yRatio);

    // 검지 하나 제스처는 UI에서 선택한 도구와 무관하게 항상 포인터다.
    // STT 앵커가 유효하면 포인터 시작점을 앵커 중심으로 보정하고,
    // 이후 손 이동량은 기존 상대 좌표 감도 1.5배를 유지한다.
    if (!gestureSession || gestureSession.pageNo !== currentPage || gestureSession.mode !== "pointer") {
      beginGestureSession("pointer", { xRatio: handX, yRatio: handY });
    }
    if (!gestureSession) return null;

    let xRatio = handX;
    let yRatio = handY;
    if (gestureSession.anchored && gestureSession.anchorPoint) {
      xRatio = gestureSession.anchorPoint.xRatio + (handX - gestureSession.startHand.xRatio) * GESTURE_MOVEMENT_GAIN;
      yRatio = gestureSession.anchorPoint.yRatio + (handY - gestureSession.startHand.yRatio) * GESTURE_MOVEMENT_GAIN;
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

    // 검지는 무조건 포인터만 표시한다.
    // 펜/형광펜 선택은 엄지+검지 판서 제스처의 스타일 선택일 뿐이다.
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
        + (handX - underlineGesture.startHand.xRatio) * GESTURE_MOVEMENT_GAIN;
      yRatio = underlineGesture.anchorPoint.yRatio
        + (handY - underlineGesture.startHand.yRatio) * GESTURE_MOVEMENT_GAIN;
    }

    xRatio = clampRatio(xRatio);
    yRatio = clampRatio(yRatio);

    // 형광펜은 STT 앵커 또는 fallback 좌표 주변의 텍스트 줄 중심으로 보정한다.
    // 주변 텍스트가 없을 때만 기본 18px 굵기를 사용한다.
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

    // 엄지+검지 제스처는 선택된 도구가 펜/형광펜일 때만 판서한다.
    // 포인터 모드에서는 검지 포인터만 사용하고, pinch가 들어와도 선을 만들지 않는다.
    if (detail.phase === "start" && currentMode === "pointer") {
      underlineGesture = null;
      activeStrokeSnapshot = null;
      stopDrawing();
      return false;
    }

    if (detail.phase === "start") {
      clearPointer();
      endGestureSession("stroke-start");
      resizeOverlayCanvases(true);
      const tool = currentMode === "highlight" ? "highlight" : "pen";
      const anchor = getValidSpeechAnchor();
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
            matchLogId: underlineGesture.anchor?.matchLogId || undefined,
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

  function normalizeText(value = "") {
    return String(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeToken(token) {
    const suffixes = ["으로", "에서", "부터", "까지", "은", "는", "이", "가", "을", "를", "의", "에", "도", "와", "과", "로"];
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

  function createBackendTextAnchorPayload(anchor) {
    const pdfId = Number(currentPdfId);
    if (!Number.isFinite(pdfId) || !anchor?.text) return null;
    const xRatio = clampRatio(anchor.xRatio);
    const yRatio = clampRatio(anchor.yRatio);
    const widthRatio = clampRatio(anchor.widthRatio);
    const heightRatio = clampRatio(anchor.heightRatio);
    return {
      pdfId,
      pageNo: Number(anchor.pageNo),
      textOriginal: anchor.text,
      textNormalized: anchor.norm || normalizeText(anchor.text),
      keywords: (anchor.tokens?.length ? anchor.tokens : tokenize(anchor.text, true)).join(","),
      xRatio,
      yRatio,
      widthRatio,
      heightRatio,
      startXRatio: xRatio,
      startYRatio: yRatio,
      endXRatio: clampRatio(xRatio + widthRatio),
      endYRatio: clampRatio(yRatio + heightRatio),
      coordSystem: "PDF_RATIO",
      extractSource: "PDFJS",
      confidence: 1,
      anchorLevel: String(anchor.kind || "phrase").toUpperCase(),
      sortOrder: Math.round(Number(anchor.order || 0) * 1000),
      useYn: "Y",
    };
  }

  async function saveFrontendTextAnchors(pageNo, anchors = []) {
    if (!backendApi?.saveTextAnchor || !currentPdfId || !anchors.length) return;
    const pageKey = `${currentPdfId}:${pageNo}`;
    if (savedTextAnchorPageKeys.has(pageKey)) return;
    savedTextAnchorPageKeys.add(pageKey);
    const payloads = anchors
      .filter((anchor) => !anchor.backendAnchor)
      .map(createBackendTextAnchorPayload)
      .filter(Boolean);
    let failedCount = 0;
    for (let index = 0; index < payloads.length; index += 20) {
      const chunk = payloads.slice(index, index + 20);
      const results = await Promise.allSettled(chunk.map((payload) => backendApi.saveTextAnchor(payload)));
      failedCount += results.filter((result) => result.status === "rejected").length;
    }
    if (failedCount > 0) {
      console.warn(`AirNote presentation: ${failedCount} PDF text anchors failed to save.`);
    }
  }

  async function loadFrontendPdfTextAnchors(targetMap = new Map(), onlyMissingPages = false) {
    if (!pdfDoc) return targetMap;
    for (let pageNo = 1; pageNo <= totalPage; pageNo += 1) {
      if (onlyMissingPages && (targetMap.get(pageNo) || []).length > 0) continue;
      const anchors = await extractFrontendTextAnchorsForPage(pageNo);
      targetMap.set(pageNo, anchors);
      saveFrontendTextAnchors(pageNo, anchors).catch((error) => {
        console.warn("AirNote presentation: PDF text anchor save failed.", error);
      });
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
    savedTextAnchorPageKeys = new Set();
    textAnchorSource = "none";
    textAnchorLoadError = "";
    activeTextAnchor = null;
    activeTextAnchorSelectedAt = 0;
    clearSttAnchorBox();
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
      showToast("PDF 텍스트 앵커 생성 실패");
      renderDebugPanel();
    }
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
      score = 0.62 + Math.min(0.23, overlapRatio * 0.23);
      matchType = "context";
    } else if (matchedTokens.length === 1 && queryTokens.length >= 2 && anchorTokens.length >= 2) {
      score = 0.48;
      matchType = "keyword";
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

  function selectActiveTextAnchor(transcript, isFinal = false) {
    const normalized = normalizeText(transcript);
    const tokens = tokenize(normalized, true);
    if (!tokens.length) return null;
    const anchors = pdfTextAnchors.get(currentPage) || [];
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
    const candidates = Array.from(bestByLine.values()).sort((a, b) => b.score - a.score);
    const best = candidates[0] || null;
    const second = candidates[1] || null;
    const scoreGap = second ? best.score - second.score : 1;
    const accepted = Boolean(best && best.score >= STT_SCORE_THRESHOLD && scoreGap >= STT_AMBIGUITY_GAP);
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
          : scoreGap < STT_AMBIGUITY_GAP
            ? "1·2위 점수 차이 부족"
            : "선택",
      candidates: candidates.slice(0, 5).map((candidate) => ({
        text: candidate.anchor.text,
        score: candidate.score,
        matchType: candidate.matchType,
        lineId: candidate.anchor.lineId,
      })),
    };
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
    if (!best) {
      pendingSpeechAnchorKey = "";
      pendingSpeechAnchorCount = 0;
      return null;
    }

    const key = `${best.anchor.pageNo}:${best.anchor.xRatio}:${best.anchor.yRatio}`;
    if (key === pendingSpeechAnchorKey) pendingSpeechAnchorCount += 1;
    else {
      pendingSpeechAnchorKey = key;
      pendingSpeechAnchorCount = 1;
    }

    if (!accepted || (!isFinal && pendingSpeechAnchorCount < 2)) return activeTextAnchor;
    const lineAnchor = anchors.find((anchor) => anchor.id === best.anchor.lineId && anchor.kind === "line");
    activeTextAnchor = {
      ...(lineAnchor || best.anchor),
      matchedText: best.anchor.text,
      matchedAnchorId: best.anchor.id,
      score: best.score,
      selectedAt: Date.now(),
    };
    activeTextAnchorSelectedAt = performance.now();
    lastSelectedAnchorOrder = best.anchor.order;
    speechAnchorEngine.update(activeTextAnchor);
    presentationStore.setState({ speechAnchor: activeTextAnchor });
    saveBackendAnchorMatchLog({ transcript, normalized, best, second, scoreGap, accepted: true });
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
    showSttAnchorBox(activeTextAnchor, { transcript, matchedText: best.anchor.text });
    renderDebugPanel();
    return activeTextAnchor;
  }

  function drawUnderlineForAnchor() {
    // AirNote는 STT 앵커만으로 즉시 밑줄/형광펜을 실행하지 않는다.
    // STT 앵커는 포인터·펜·형광펜 제스처의 시작점 보정에만 사용한다.
    return false;
  }

  function startSpeechRecognition() {
    if (!permissionState.microphone) {
      showToast("마이크 권한이 없어 음성 앵커 기능을 사용할 수 없습니다.");
      return false;
    }
    if (speechStarted) return true;
    const savedLocalSttEndpoint = localStorage.getItem("airnote.localSttEndpoint");
    speechController = speechController || window.AirNoteModules.createSpeechRecognitionController({
      provider: "auto",
      localEndpoint: savedLocalSttEndpoint || "http://localhost:5000",
      localEndpoints: savedLocalSttEndpoint
        ? [savedLocalSttEndpoint]
        : ["http://localhost:5000", "http://127.0.0.1:8000"],
      onTranscript: (transcript, isFinal) => selectActiveTextAnchor(transcript, isFinal),
      onError: (error) => {
        console.warn("AirNote presentation: speech recognition failed.", error);
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
      showToast("음성 인식 미지원 브라우저입니다.");
      return false;
    }
    try {
      speechStarted = speechController.start();
      return speechStarted;
    } catch (error) {
      speechStarted = false;
      console.warn("AirNote presentation: speech recognition start failed.", error);
      showToast("음성 인식 시작 실패");
      return false;
    }
  }

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
      const visibleAnchor = getValidSpeechAnchor();
      if (visibleAnchor) showSttAnchorBox(visibleAnchor, { matchedText: visibleAnchor.matchedText || visibleAnchor.text });
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
      showToast("PDF.js 로딩 실패");
      return;
    }

    try {
      currentPdfFileName = file.name;
      currentPdfId = metadata.pdfId ? String(metadata.pdfId) : "";
      if (currentPdfId) sessionStorage.setItem(CURRENT_PDF_ID_KEY, currentPdfId);
      else sessionStorage.removeItem(CURRENT_PDF_ID_KEY);
      endGestureSession("pdf-change");
      activeTextAnchor = null;
      activeTextAnchorSelectedAt = 0;
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
      startSpeechRecognition();
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
      showToast("홈에서 선택한 PDF를 불러오지 못했습니다.");
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
        <span>📄</span>
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
    calibrationConfirmBtn.addEventListener("click", async () => {
      if (latestCalibrationState?.status === "complete") {
        setModalOpen(calibrationModal, false);
        return;
      }
      await runCalibrationRegistration();
    });
    calibrationCloseBtn?.addEventListener("click", () => {
      if (latestCalibrationState?.status === "collecting") {
        showToast("캘리브레이션 샘플을 수집하고 있습니다.");
        return;
      }
      setModalOpen(calibrationModal, false);
    });
    calibrationModal.addEventListener("click", (event) => {
      if (event.target === calibrationModal && latestCalibrationState?.status !== "collecting") {
        setModalOpen(calibrationModal, false);
      }
    });
    calibrationStartBtn?.addEventListener("click", runCalibrationRegistration);
    calibrationResetBtn?.addEventListener("click", () => {
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
      // 자동 요청이 실패했거나 사용자가 권한을 다시 허용한 경우를 위해 수동 버튼은 항상 재시도 가능하게 둔다.
      initialPermissionRequestDone = true;
      void requestPresentationPermissions();
    });

    window.addEventListener("airnote:handpointer-ready", () => {
      void attachPermissionStreamToHandPointer();
      // 발표 페이지는 웹캠 제스처가 핵심이므로, 별도 버튼을 누르지 않아도 권한 요청을 시작한다.
      // 사용자가 권한을 거부하면 버튼으로 다시 요청할 수 있다.
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
    saveCurrentPageAnnotation();
    const fromPageNo = currentPage;
    currentPage = nextPageNo;
    presentationStore.setState({ currentPage });
    recordPresentationEvent("page_change", { direction });
    saveBackendPageAction(fromPageNo, nextPageNo, direction);
    activeTextAnchor = null;
    activeTextAnchorSelectedAt = 0;
    clearSttAnchorBox();
    pendingSpeechAnchorKey = "";
    pendingSpeechAnchorCount = 0;
    lastSelectedAnchorOrder = -1;
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
    // 마우스/터치 직접 판서는 지원하지 않는다. 모든 판서는 손 제스처에서만 실행한다.
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
    return localStorage.getItem("airnoteRememberLogin") === "true"
      || sessionStorage.getItem("airnoteSessionActive") === "true"
      || Boolean(localStorage.getItem("airnoteCurrentUserEmail"));
  }

  function clearLoginState() {
    localStorage.removeItem("airnoteRememberLogin");
    localStorage.removeItem("airnoteCurrentUserEmail");
    localStorage.removeItem("airnoteCurrentUserName");
    localStorage.removeItem("airnoteCurrentUserPassword");
    localStorage.removeItem("airnoteCurrentUser");
    sessionStorage.removeItem("airnoteSessionActive");
  }

  async function saveAnnotation() {
    saveCurrentPageAnnotation();
    if (!drawCanvas) return;
    const payload = {
      presentationId: 1,
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
    // 마우스/터치 직접 입력은 지원하지 않는다. 포인터 이벤트는 제스처 판서와 충돌하므로 바인딩하지 않는다.
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
      // STT 앵커는 실행 명령이 아니라 시작점 보정 데이터다.
      // 손 제스처 판서는 handleUnderlineGesture(start/move/bridge/grace/end)에서만 처리한다.
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
