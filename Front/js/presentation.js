(() => {
  function initAirNotePresentation() {
  const PDFJS_VERSION = "3.11.174";
  const PDF_DB_NAME = "airnote-local-pdfs";
  const PDF_STORE_NAME = "pdfs";
  const CURRENT_PDF_KEY = "airnote.currentPdfKey";
  const CURRENT_MOCK_PDF_KEY = "airnote.currentMockPdf";
  const CURRENT_USER_EMAIL_KEY = "airnoteCurrentUserEmail";
  const PRESENTATION_RECORDS_KEY = "airnote.presentationRecords";

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
  const calibrationModal = document.getElementById("calibrationModal");
  const calibrationConfirmCheck = document.getElementById("calibrationConfirmCheck");
  const calibrationConfirmBtn = document.getElementById("calibrationConfirmBtn");
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
  const clearCanvasBtn = document.getElementById("clearCanvasBtn");
  const fullscreenClearCanvasBtn = document.getElementById("fullscreenClearCanvasBtn");
  const saveBtn = document.getElementById("saveBtn");
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
  const fullscreenPresenterUi = document.querySelector(".fullscreen-presenter-ui");
  const presentationSummaryModal = document.getElementById("presentationSummaryModal");
  const presentationSummaryList = document.getElementById("presentationSummaryList");
  const summaryConfirmBtn = document.getElementById("summaryConfirmBtn");

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
  let renderTask = null;
  let currentMode = "pointer";
  let isDrawing = false;
  let lastPoint = null;
  let toastTimerId = null;
  let calibrationTimerId = null;
  let expectedMinutes = Number(expectedTimeSelect?.value || 20);
  let pdfTextAnchors = new Map();
  let activeTextAnchor = null;
  let speechRecognition = null;
  let speechStarted = false;
  const annotationsByPage = new Map();

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
    document.body.classList.toggle("presentation-mode", isRunning);

    if (isRunning) {
      elapsedSeconds = 0;
      presentationStartedAt = new Date();
      updateTimerText();
      startTimer();
    } else {
      stopTimer();
      presentationStartedAt = null;
      clearPointer();
    }

    updatePresentationButton();
    window.requestAnimationFrame(() => {
      if (pdfDoc) renderPdfPage(currentPage);
      else resizeOverlayCanvases(true);
    });
  }

  async function exitNativeFullscreen() {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen?.();
    } catch (error) {
      console.warn("AirNote presentation: fullscreen exit failed.", error);
    }
  }

  function togglePresentation() {
    if (isRunning) {
      showPresentationSummary();
      return;
    }
    setPresentationRunning(true);
  }

  function updatePageIndicator() {
    if (pageIndicator) pageIndicator.textContent = `${currentPage} / ${totalPage}`;
    if (fullscreenPageIndicator) fullscreenPageIndicator.textContent = `${currentPage} / ${totalPage}`;
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPage;
  }

  function setModalOpen(modal, isOpen) {
    if (!modal) return;
    modal.classList.toggle("show", isOpen);
    modal.setAttribute("aria-hidden", String(!isOpen));
  }

  function getCurrentUserEmail() {
    return localStorage.getItem(CURRENT_USER_EMAIL_KEY) || "example@google.com";
  }

  function getCalibrationKey() {
    return `airnoteCalibration:${getCurrentUserEmail()}`;
  }

  function getCalibrationGuideKey() {
    return `airnoteCalibrationGuideRead:${getCurrentUserEmail()}`;
  }

  function getCalibrationData() {
    const raw = localStorage.getItem(getCalibrationKey());
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.completed ? parsed : null;
    } catch (error) {
      console.warn("AirNote presentation: calibration data parse failed.", error);
      return null;
    }
  }

  function saveCalibrationComplete() {
    const calibrationData = {
      completed: true,
      completedAt: new Date().toISOString(),
      palmRegistered: true,
      underlineRegistered: true,
    };
    localStorage.setItem(getCalibrationKey(), JSON.stringify(calibrationData));
    return calibrationData;
  }

  function renderCalibrationState(statusMessage = "") {
    const calibration = getCalibrationData();
    if (calibration) {
      calibrationBadge?.classList.add("complete");
      if (calibrationBadge) calibrationBadge.textContent = "캘리브레이션 완료";
      if (calibrationStatusText) {
        calibrationStatusText.textContent = statusMessage || "저장된 손 제스처 기준이 적용됩니다.";
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

  function runCalibrationRegistration() {
    if (calibrationTimerId) window.clearTimeout(calibrationTimerId);
    if (calibrationStartBtn) {
      calibrationStartBtn.disabled = true;
      calibrationStartBtn.textContent = "손바닥 등록 중";
    }
    renderCalibrationState("손바닥을 펴고 2초간 유지해주세요.");

    calibrationTimerId = window.setTimeout(() => {
      if (calibrationStartBtn) calibrationStartBtn.textContent = "밑줄 제스처 등록 중";
      renderCalibrationState("엄지와 검지를 붙인 상태로 2초간 유지해주세요.");

      calibrationTimerId = window.setTimeout(() => {
        saveCalibrationComplete();
        if (calibrationStartBtn) {
          calibrationStartBtn.disabled = false;
          calibrationStartBtn.textContent = "캘리브레이션 시작";
        }
        renderCalibrationState("캘리브레이션이 완료되었습니다.");
        showToast("캘리브레이션 완료");
      }, 2000);
    }, 2000);
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
      drawCanvas.style.pointerEvents = "auto";
      drawCanvas.style.touchAction = "none";
    }

    if (laserPointer) {
      laserPointer.style.position = "absolute";
      laserPointer.style.zIndex = "3";
      laserPointer.style.pointerEvents = "none";
    }
  }
  function resizeOverlayCanvases(preserveAnnotation = true) {
    applyOverlayLayout();
    if (pdfCanvas?.width && pdfCanvas?.height) {
      resizeOneCanvas(drawCanvas, drawCtx, pdfCanvas.width, pdfCanvas.height, preserveAnnotation);
      clearPointer();
      publishPresentationOverlay();
      return;
    }

    if (!slideArt) return;
    const rect = slideArt.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    resizeOneCanvas(pdfCanvas, pdfCtx, width, height, false);
    resizeOneCanvas(drawCanvas, drawCtx, width, height, preserveAnnotation);
    clearPointer();
    publishPresentationOverlay();
  }

  function clearAnnotationCanvasOnly() {
    if (!drawCanvas || !drawCtx) return;
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  }

  function saveCurrentPageAnnotation() {
    if (!drawCanvas?.width || !drawCanvas?.height) return;
    if (!hasCanvasInk()) {
      annotationsByPage.delete(currentPage);
      return;
    }
    annotationsByPage.set(currentPage, {
      dataUrl: drawCanvas.toDataURL("image/png"),
      width: drawCanvas.width,
      height: drawCanvas.height,
    });
  }

  function hasCanvasInk() {
    if (!drawCanvas || !drawCtx) return false;
    try {
      const data = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height).data;
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] !== 0) return true;
      }
    } catch (error) {
      console.warn("AirNote presentation: annotation blank check failed.", error);
      return true;
    }
    return false;
  }

  function restoreCurrentPageAnnotation() {
    clearAnnotationCanvasOnly();
    const saved = annotationsByPage.get(currentPage);
    if (!saved || !drawCanvas || !drawCtx) {
      publishPresentationOverlay();
      return;
    }
    const image = new Image();
    image.onload = () => {
      drawCtx.drawImage(image, 0, 0, saved.width, saved.height, 0, 0, drawCanvas.width, drawCanvas.height);
      publishPresentationOverlay();
    };
    image.src = saved.dataUrl;
  }

  function resetAnnotationState() {
    annotationsByPage.clear();
    clearAnnotationCanvasOnly();
  }

  function clearCanvas() {
    clearAnnotationCanvasOnly();
    annotationsByPage.delete(currentPage);
    stopDrawing();
    publishPresentationOverlay();
  }

  function getAnnotationCount() {
    saveCurrentPageAnnotation();
    return Array.from(annotationsByPage.values()).filter((item) => item?.dataUrl).length;
  }

  function formatDate(date = new Date()) {
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  }

  function getPresentationSummary() {
    const now = new Date();
    const progressPercent = getProgressPercent();
    const annotationCount = getAnnotationCount();
    const annotationImages = Array.from(annotationsByPage.entries())
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
    presentationSummaryList.innerHTML = `
      <p><strong>발표 자료명</strong><span>${summary.fileName}</span></p>
      <p><strong>발표 날짜</strong><span>${summary.presentationDate || summary.date}</span></p>
      <p><strong>발표 시간</strong><span>${summary.elapsedTime || summary.elapsedText}</span></p>
      <p><strong>발표 경과율</strong><span>${summary.progressRate ?? summary.progressPercent}%</span></p>
      <p><strong>저장된 판서</strong><span>${summary.annotationCount}개</span></p>
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
    updateTimerText();
    const summary = getPresentationSummary();
    renderPresentationSummary(summary);
    if (summaryConfirmBtn) summaryConfirmBtn.dataset.summary = JSON.stringify(summary);
    setModalOpen(presentationSummaryModal, true);
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
    setPresentationRunning(false);
    await exitNativeFullscreen();
    showToast("발표 기록 저장 완료");
  }

  function clearPointer() {
    if (!laserPointer) return;
    laserPointer.style.opacity = "0";
  }

  function fitSlideToPdfCanvas() {
    if (!slideArt || !pdfCanvas?.width || !pdfCanvas?.height) return;
    slideArt.classList.add("has-pdf");
    slideArt.style.aspectRatio = `${pdfCanvas.width} / ${pdfCanvas.height}`;
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

  function tokenize(value = "") {
    return normalizeText(value).split(" ").filter((token) => token.length > 1);
  }

  function makeAnchor(pageNo, text, rect, viewport) {
    const safeWidth = Math.max(1, viewport.width);
    const safeHeight = Math.max(1, viewport.height);
    return {
      pageNo,
      text: text.trim(),
      norm: normalizeText(text),
      tokens: tokenize(text),
      xRatio: rect.x / safeWidth,
      yRatio: rect.y / safeHeight,
      widthRatio: rect.width / safeWidth,
      heightRatio: rect.height / safeHeight,
    };
  }

  function createTextAnchorsFromItems(pageNo, textItems, viewport) {
    const lineMap = new Map();
    textItems.forEach((item) => {
      const rawText = item.str?.trim();
      if (!rawText) return;
      const transformed = window.pdfjsLib.Util.transform(viewport.transform, item.transform);
      const x = transformed[4];
      const y = transformed[5];
      const width = Math.max(1, item.width * viewport.scale);
      const height = Math.max(8, Math.abs(transformed[3]) || item.height * viewport.scale || 12);
      const lineKey = Math.round(y / 8);
      const line = lineMap.get(lineKey) || { text: "", items: [], x: Infinity, y: y - height, right: 0, bottom: y };
      line.text = `${line.text} ${rawText}`.trim();
      line.items.push({ text: rawText, x, y: y - height, width, height });
      line.x = Math.min(line.x, x);
      line.y = Math.min(line.y, y - height);
      line.right = Math.max(line.right, x + width);
      line.bottom = Math.max(line.bottom, y);
      lineMap.set(lineKey, line);
    });

    const anchors = [];
    Array.from(lineMap.values()).forEach((line) => {
      if (line.text.length > 1) {
        anchors.push(makeAnchor(pageNo, line.text, {
          x: line.x,
          y: line.y,
          width: line.right - line.x,
          height: line.bottom - line.y,
        }, viewport));
      }
      line.items.forEach((item) => {
        if (item.text.length > 1) {
          anchors.push(makeAnchor(pageNo, item.text, item, viewport));
        }
      });
    });
    return anchors;
  }

  async function extractPdfTextAnchors() {
    pdfTextAnchors = new Map();
    activeTextAnchor = null;
    if (!pdfDoc) return;
    try {
      for (let pageNo = 1; pageNo <= totalPage; pageNo += 1) {
        const page = await pdfDoc.getPage(pageNo);
        const viewport = getFitViewport(page);
        const textContent = await page.getTextContent();
        pdfTextAnchors.set(pageNo, createTextAnchorsFromItems(pageNo, textContent.items || [], viewport));
      }
    } catch (error) {
      console.warn("AirNote presentation: PDF text anchor extraction failed.", error);
      showToast("PDF 텍스트 앵커 생성 실패");
    }
  }

  function scoreTextAnchor(anchor, queryTokens, normalizedQuery) {
    if (!anchor?.norm || !queryTokens.length) return 0;
    let matches = 0;
    queryTokens.forEach((token) => {
      if (anchor.norm.includes(token)) matches += 1;
    });
    const tokenScore = matches / queryTokens.length;
    const phraseScore = normalizedQuery.includes(anchor.norm) || anchor.norm.includes(normalizedQuery) ? 0.35 : 0;
    return tokenScore + phraseScore;
  }

  function selectActiveTextAnchor(transcript) {
    const normalized = normalizeText(transcript);
    const tokens = tokenize(normalized);
    if (!tokens.length) return null;
    const anchors = pdfTextAnchors.get(currentPage) || [];
    const candidates = anchors
      .map((anchor) => ({ anchor, score: scoreTextAnchor(anchor, tokens, normalized) }))
      .filter((item) => item.score >= 0.35)
      .sort((a, b) => b.score - a.score);
    activeTextAnchor = candidates[0]?.anchor || null;
    return activeTextAnchor;
  }

  function drawUnderlineForAnchor(anchor = activeTextAnchor) {
    if (!anchor || anchor.pageNo !== currentPage || !drawCtx || !drawCanvas) return false;
    const x = anchor.xRatio * drawCanvas.width;
    const width = Math.max(24, anchor.widthRatio * drawCanvas.width);
    const y = (anchor.yRatio + anchor.heightRatio) * drawCanvas.height + 6;
    drawCtx.save();
    drawCtx.globalCompositeOperation = "source-over";
    drawCtx.strokeStyle = "#8b5cf6";
    drawCtx.globalAlpha = 0.9;
    drawCtx.lineWidth = Math.max(5, drawCanvas.width * 0.004);
    drawCtx.lineCap = "round";
    drawCtx.beginPath();
    drawCtx.moveTo(x, y);
    drawCtx.lineTo(x + width, y);
    drawCtx.stroke();
    drawCtx.restore();
    saveCurrentPageAnnotation();
    publishPresentationOverlay();
    return true;
  }

  function startSpeechRecognition() {
    if (speechStarted) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("음성 인식 미지원 브라우저입니다.");
      return;
    }
    try {
      speechRecognition = speechRecognition || new SpeechRecognition();
      speechRecognition.lang = "ko-KR";
      speechRecognition.continuous = true;
      speechRecognition.interimResults = true;
      speechRecognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .slice(event.resultIndex)
          .map((result) => result[0]?.transcript || "")
          .join(" ");
        if (transcript) selectActiveTextAnchor(transcript);
      };
      speechRecognition.onerror = (event) => {
        speechStarted = false;
        console.warn("AirNote presentation: speech recognition failed.", event.error);
        showToast("음성 인식 연결 실패");
      };
      speechRecognition.onend = () => {
        speechStarted = false;
      };
      speechRecognition.start();
      speechStarted = true;
    } catch (error) {
      speechStarted = false;
      console.warn("AirNote presentation: speech recognition start failed.", error);
      showToast("음성 인식 시작 실패");
    }
  }

  async function renderPdfPage(pageNo) {
    if (!pdfDoc || !pdfCanvas || !pdfCtx) return;

    if (renderTask) {
      try {
        renderTask.cancel();
      } catch (error) {
        console.warn("AirNote presentation: previous PDF render cancel failed.", error);
      }
      renderTask = null;
    }

    try {
      const page = await pdfDoc.getPage(pageNo);
      const viewport = getFitViewport(page);
      pdfCanvas.width = Math.round(viewport.width);
      pdfCanvas.height = Math.round(viewport.height);
      fitSlideToPdfCanvas();
      pdfCtx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);

      renderTask = page.render({ canvasContext: pdfCtx, viewport });
      await renderTask.promise;
      renderTask = null;

      resizeOverlayCanvases(false);
      restoreCurrentPageAnnotation();
      clearPointer();
      updatePageIndicator();
      publishPresentationOverlay();
    } catch (error) {
      if (error?.name === "RenderingCancelledException") return;
      console.warn("AirNote presentation: PDF page render failed.", error);
      showToast("PDF 렌더링 실패");
    }
  }

  async function loadPdfFile(file) {
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
      resetAnnotationState();
      slideArt?.classList.remove("has-selected-pdf");
      updateSelectedPdfLabel(file.name);
      const data = await file.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data });
      pdfDoc = await loadingTask.promise;
      totalPage = pdfDoc.numPages || 1;
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

  function openPdfDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(PDF_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PDF_STORE_NAME)) {
          db.createObjectStore(PDF_STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function loadSelectedPdfFromHome() {
    sessionStorage.removeItem(CURRENT_MOCK_PDF_KEY);

    const selectedId = sessionStorage.getItem(CURRENT_PDF_KEY);
    if (!selectedId) return;

    try {
      const db = await openPdfDb();
      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction(PDF_STORE_NAME, "readonly");
        const request = tx.objectStore(PDF_STORE_NAME).get(selectedId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!record?.blob) return;
      const file = new File([record.blob], record.name || "presentation.pdf", {
        type: record.type || "application/pdf",
      });
      await loadPdfFile(file);
    } catch (error) {
      console.warn("AirNote presentation: selected PDF restore failed.", error);
      showToast("홈에서 선택한 PDF를 불러오지 못했습니다.");
    }
  }

  function getAllStoredPdfs() {
    return openPdfDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_STORE_NAME, "readonly");
      const request = tx.objectStore(PDF_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    })).catch((error) => {
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
    await loadPdfFile(file);
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
    fullscreenBtn?.addEventListener("click", () => {
      const target = document.documentElement;
      if (!document.fullscreenElement) {
        target.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });
  }

  function initCalibrationModal() {
    if (!calibrationModal || !calibrationConfirmCheck || !calibrationConfirmBtn) return;
    renderCalibrationState();

    if (!getCalibrationData()) {
      setModalOpen(calibrationModal, true);
    }

    calibrationConfirmCheck.addEventListener("change", () => {
      calibrationConfirmBtn.disabled = !calibrationConfirmCheck.checked;
      calibrationConfirmBtn.textContent = calibrationConfirmCheck.checked ? "확인" : "확인이 필요합니다";
    });

    calibrationConfirmBtn.addEventListener("click", () => {
      if (!calibrationConfirmCheck.checked) return;
      localStorage.setItem(getCalibrationGuideKey(), "true");
      setModalOpen(calibrationModal, false);
      renderCalibrationState("안내 확인 완료. 캘리브레이션을 시작해주세요.");
      calibrationStartBtn?.focus();
    });

    calibrationStartBtn?.addEventListener("click", runCalibrationRegistration);
    calibrationResetBtn?.addEventListener("click", () => {
      localStorage.removeItem(getCalibrationKey());
      renderCalibrationState("다시 등록을 시작합니다.");
      runCalibrationRegistration();
    });
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
    saveCurrentPageAnnotation();
    currentPage = nextPageNo;
    activeTextAnchor = null;
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
    if (drawCanvas) drawCanvas.style.cursor = currentMode === "pointer" ? "default" : "crosshair";
  }

  function setMode(mode) {
    if (!modeLabelMap[mode]) return;
    currentMode = mode;
    stopDrawing();
    updateModeUI();
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
      drawCtx.strokeStyle = "#5429f2";
      drawCtx.lineWidth = 4;
    }
    if (currentMode === "highlight") {
      drawCtx.strokeStyle = "#fff176";
      drawCtx.globalAlpha = 0.45;
      drawCtx.lineWidth = 18;
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

  function drawAt(x, y) {
    if (!drawCanvas || !drawCtx || currentMode === "pointer") return;
    const point = { x, y };
    if (!lastPoint) {
      lastPoint = point;
      return;
    }
    drawLineTo(point);
    lastPoint = point;
  }

  function stopDrawing() {
    isDrawing = false;
    lastPoint = null;
  }

  function drawPointer(x, y) {
    if (!laserPointer || !drawCanvas) return;
    const rect = drawCanvas.getBoundingClientRect();
    const left = (x / Math.max(1, drawCanvas.width)) * rect.width;
    const top = (y / Math.max(1, drawCanvas.height)) * rect.height;
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
    if (!drawCanvas || currentMode === "pointer") return;
    event.preventDefault();
    resizeOverlayCanvases(true);
    isDrawing = true;
    const point = getCanvasPoint(event);
    if (!point) return;
    lastPoint = point;
  }

  function handlePointerMove(event) {
    if (!isDrawing) return;
    event.preventDefault();
    const point = getCanvasPoint(event);
    if (!point) return;
    drawAt(point.x, point.y);
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

  function saveAnnotation() {
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
  document.querySelector(".brand-row.small")?.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.href = hasActiveLogin() ? "home.html" : "../index.html";
  });
  document.querySelector(".logout-link")?.addEventListener("click", clearLoginState);
  fullscreenEndBtn?.addEventListener("click", showPresentationSummary);
  prevPageBtn?.addEventListener("click", prevPage);
  nextPageBtn?.addEventListener("click", nextPage);
  clearCanvasBtn?.addEventListener("click", clearCanvas);
  fullscreenClearCanvasBtn?.addEventListener("click", clearCanvas);
  saveBtn?.addEventListener("click", saveAnnotation);
  expectedTimeSelect?.addEventListener("change", () => {
    expectedMinutes = Number(expectedTimeSelect.value || 20);
    updatePresentationProgress();
  });
  fullscreenPanelToggleBtn?.addEventListener("click", () => {
    const isMinimized = fullscreenPresenterUi?.classList.toggle("is-minimized");
    fullscreenPanelToggleBtn.textContent = isMinimized ? "최대화" : "최소화";
    fullscreenPanelToggleBtn.setAttribute("aria-expanded", String(!isMinimized));
  });
  summaryConfirmBtn?.addEventListener("click", confirmPresentationSummary);

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  if (drawCanvas) {
    drawCanvas.addEventListener("pointerdown", handlePointerDown);
    drawCanvas.addEventListener("pointermove", handlePointerMove);
    drawCanvas.addEventListener("pointerup", stopDrawing);
    drawCanvas.addEventListener("pointerleave", stopDrawing);
    drawCanvas.addEventListener("pointercancel", stopDrawing);
  }

  window.addEventListener("resize", () => {
    saveCurrentPageAnnotation();
    if (pdfDoc) renderPdfPage(currentPage);
    else resizeOverlayCanvases(true);
  });

  window.AirNotePresentation = {
    updatePointerFromHand,
    enterPresentation: () => { if (!isRunning) setPresentationRunning(true); },
    exitPresentation: () => { if (isRunning) showPresentationSummary(); },
    drawAt,
    stopDrawing,
    nextPage,
    prevPage,
    clearCanvas,
    setMode,
    drawUnderlineForActiveAnchor: () => drawUnderlineForAnchor(activeTextAnchor),
    handleGestureCommand: (command) => {
      if (command === "underline") return drawUnderlineForAnchor(activeTextAnchor);
      if (command === "clear_page") return clearCanvas();
      if (command === "next_page") return nextPage();
      if (command === "previous_page") return prevPage();
      return false;
    },
    startSpeechRecognition,
    getActiveTextAnchor: () => activeTextAnchor,
    resizeCanvasToSlide: () => resizeOverlayCanvases(true),
    resizeOverlayCanvases,
    clearAnnotationCanvasOnly,
    getOverlay: () => window.presentationOverlay,
    getState: () => ({ currentPage, totalPage, currentMode, elapsedSeconds, isRunning, expectedMinutes }),
  };

  applyOverlayLayout();
  initPdfUpload();
  initPdfSelectModal();
  initFullscreenButton();
  initCalibrationModal();
  loadSelectedPdfFromHome();
  updateTimerText();
  updatePresentationProgress();
  updatePresentationButton();
  updatePageIndicator();
  updateModeUI();
  resizeOverlayCanvases(true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAirNotePresentation, { once: true });
  } else {
    initAirNotePresentation();
  }
})();


