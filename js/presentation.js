document.addEventListener("DOMContentLoaded", () => {
  const PDFJS_VERSION = "3.11.174";

  const slideArt = document.getElementById("slideArt") || document.querySelector(".slide-art");
  const pdfCanvas = document.getElementById("pdfCanvas");
  const annotationCanvas = document.getElementById("annotationCanvas");
  const pointerCanvas = document.getElementById("pointerCanvas");
  const pdfCtx = pdfCanvas ? pdfCanvas.getContext("2d") : null;
  const annotationCtx = annotationCanvas ? annotationCanvas.getContext("2d") : null;
  const pointerCtx = pointerCanvas ? pointerCanvas.getContext("2d") : null;

  const pdfUploadInput = document.getElementById("pdfUploadInput");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const pageIndicator = document.getElementById("pageIndicator");
  const presentationToggleBtn = document.getElementById("presentationToggleBtn");
  const timerText = document.getElementById("timerText");
  const currentModeText = document.getElementById("currentModeText");
  const clearCanvasBtn = document.getElementById("clearCanvasBtn");
  const saveBtn = document.getElementById("saveBtn");
  const toast = document.getElementById("toast");
  const modeButtons = document.querySelectorAll("[data-mode]");

  if (!slideArt || !annotationCanvas || !annotationCtx) {
    console.warn("AirNote presentation: slide or annotation canvas element is missing.");
  }

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
  } else {
    console.warn("AirNote presentation: PDF.js was not loaded. PDF upload will be disabled.");
  }

  let isRunning = false;
  let timerId = null;
  let elapsedSeconds = 0;
  let pdfDoc = null;
  let currentPage = 1;
  let totalPage = 1;
  let pdfScale = 1.5;
  let currentPdfFileName = "";
  let renderTask = null;
  let currentMode = "pointer";
  let isDrawing = false;
  let lastPoint = null;
  let toastTimerId = null;

  const modeLabelMap = {
    pointer: "\uD3EC\uC778\uD130",
    pen: "\uD39C",
    highlight: "\uD615\uAD11\uD39C",
  };

  function formatTime(totalSeconds) {
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function updateTimerText() {
    if (timerText) timerText.textContent = formatTime(elapsedSeconds);
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
    presentationToggleBtn.textContent = isRunning ? "\uBC1C\uD45C \uC885\uB8CC" : "\uBC1C\uD45C \uC2DC\uC791";
  }

  function togglePresentation() {
    isRunning = !isRunning;
    if (isRunning) startTimer();
    else stopTimer();
    updatePresentationButton();
  }

  function updatePageIndicator() {
    if (pageIndicator) pageIndicator.textContent = `${currentPage} / ${totalPage}`;
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPage;
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

  // Overlay canvases must use the PDF canvas internal size, not only CSS size.
  function resizeOverlayCanvases(preserveAnnotation = true) {
    if (pdfDoc && pdfCanvas?.width && pdfCanvas?.height) {
      resizeOneCanvas(annotationCanvas, annotationCtx, pdfCanvas.width, pdfCanvas.height, preserveAnnotation);
      resizeOneCanvas(pointerCanvas, pointerCtx, pdfCanvas.width, pdfCanvas.height, false);
      clearPointer();
      return;
    }

    if (!slideArt) return;
    const rect = slideArt.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    resizeOneCanvas(pdfCanvas, pdfCtx, width, height, false);
    resizeOneCanvas(annotationCanvas, annotationCtx, width, height, preserveAnnotation);
    resizeOneCanvas(pointerCanvas, pointerCtx, width, height, false);
    clearPointer();
  }

  function resizeCanvasToSlide() {
    resizeOverlayCanvases(true);
  }

  function clearAnnotationCanvasOnly() {
    if (!annotationCanvas || !annotationCtx) return;
    annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  }

  function clearCanvas() {
    clearAnnotationCanvasOnly();
    stopDrawing();
  }

  function clearPointer() {
    if (!pointerCanvas || !pointerCtx) return;
    pointerCtx.clearRect(0, 0, pointerCanvas.width, pointerCanvas.height);
  }

  function fitSlideToPdfCanvas() {
    if (!slideArt || !pdfCanvas?.width || !pdfCanvas?.height) return;
    slideArt.classList.add("has-pdf");
    slideArt.style.aspectRatio = `${pdfCanvas.width} / ${pdfCanvas.height}`;
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
      const viewport = page.getViewport({ scale: pdfScale });
      pdfCanvas.width = Math.round(viewport.width);
      pdfCanvas.height = Math.round(viewport.height);
      fitSlideToPdfCanvas();
      pdfCtx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);

      renderTask = page.render({ canvasContext: pdfCtx, viewport });
      await renderTask.promise;
      renderTask = null;

      resizeOverlayCanvases(false);
      clearAnnotationCanvasOnly();
      clearPointer();
      updatePageIndicator();
    } catch (error) {
      if (error?.name === "RenderingCancelledException") return;
      console.warn("AirNote presentation: PDF page render failed.", error);
      showToast("PDF \uB80C\uB354\uB9C1 \uC2E4\uD328");
    }
  }

  async function loadPdfFile(file) {
    if (!file) return;
    if (!window.pdfjsLib) {
      showToast("PDF.js \uB85C\uB529 \uC2E4\uD328");
      return;
    }

    try {
      currentPdfFileName = file.name;
      const data = await file.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data });
      pdfDoc = await loadingTask.promise;
      totalPage = pdfDoc.numPages || 1;
      currentPage = 1;
      updatePageIndicator();
      await renderPdfPage(currentPage);
      showToast("PDF \uBD88\uB7EC\uC624\uAE30 \uC644\uB8CC");
    } catch (error) {
      console.warn("AirNote presentation: PDF load failed.", error);
      pdfDoc = null;
      currentPdfFileName = "";
      totalPage = 1;
      currentPage = 1;
      updatePageIndicator();
      showToast("PDF \uBD88\uB7EC\uC624\uAE30 \uC2E4\uD328");
    }
  }

  function initPdfUpload() {
    if (!pdfUploadInput) {
      console.warn("AirNote presentation: #pdfUploadInput element is missing.");
      return;
    }

    pdfUploadInput.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      loadPdfFile(file);
    });
  }

  async function movePage(direction) {
    const nextPageNo = Math.min(totalPage, Math.max(1, currentPage + direction));
    if (nextPageNo === currentPage) return;
    currentPage = nextPageNo;
    stopDrawing();
    clearPointer();
    updatePageIndicator();
    if (pdfDoc) await renderPdfPage(currentPage);
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
    if (annotationCanvas) annotationCanvas.style.cursor = currentMode === "pointer" ? "default" : "crosshair";
  }

  function setMode(mode) {
    if (!modeLabelMap[mode]) {
      console.warn(`AirNote presentation: unsupported mode '${mode}'.`);
      return;
    }
    currentMode = mode;
    stopDrawing();
    updateModeUI();
  }

  function getCanvasPoint(event) {
    if (!annotationCanvas) return null;
    const rect = annotationCanvas.getBoundingClientRect();
    const scaleX = annotationCanvas.width / Math.max(1, rect.width);
    const scaleY = annotationCanvas.height / Math.max(1, rect.height);
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function applyToolStyle() {
    if (!annotationCtx) return;
    annotationCtx.globalCompositeOperation = "source-over";
    annotationCtx.globalAlpha = 1;
    if (currentMode === "pen") {
      annotationCtx.strokeStyle = "#5429f2";
      annotationCtx.lineWidth = 4;
    }
    if (currentMode === "highlight") {
      annotationCtx.strokeStyle = "#fff176";
      annotationCtx.globalAlpha = 0.45;
      annotationCtx.lineWidth = 18;
    }
  }

  function drawLineTo(point) {
    if (!annotationCtx || !lastPoint) return;
    applyToolStyle();
    annotationCtx.beginPath();
    annotationCtx.moveTo(lastPoint.x, lastPoint.y);
    annotationCtx.lineTo(point.x, point.y);
    annotationCtx.stroke();
    annotationCtx.globalAlpha = 1;
  }

  function drawAt(x, y) {
    if (!annotationCanvas || !annotationCtx || currentMode === "pointer") return;
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
    if (!pointerCanvas || !pointerCtx) return;
    pointerCtx.clearRect(0, 0, pointerCanvas.width, pointerCanvas.height);
    pointerCtx.save();
    pointerCtx.beginPath();
    pointerCtx.arc(x, y, 11, 0, Math.PI * 2);
    pointerCtx.fillStyle = "rgba(84, 41, 242, 0.22)";
    pointerCtx.fill();
    pointerCtx.lineWidth = 3;
    pointerCtx.strokeStyle = "#ef4444";
    pointerCtx.stroke();
    pointerCtx.beginPath();
    pointerCtx.arc(x, y, 3.5, 0, Math.PI * 2);
    pointerCtx.fillStyle = "#ef4444";
    pointerCtx.fill();
    pointerCtx.restore();
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
    if (!annotationCanvas || currentMode === "pointer") return;
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

  function saveAnnotation() {
    if (!annotationCanvas) return;
    const payload = {
      presentationId: 1,
      fileName: currentPdfFileName,
      pageNo: currentPage,
      totalPage,
      toolType: currentMode,
      elapsedSeconds,
      annotationImageData: annotationCanvas.toDataURL("image/png"),
      pdfPageImageData: pdfCanvas?.width ? pdfCanvas.toDataURL("image/png") : "",
      createdAt: new Date().toISOString(),
    };
    console.log("annotation save payload", payload);
    showToast("\uC800\uC7A5 \uC644\uB8CC");

    // Backend connection example for later use.
    // fetch("/api/presentations/annotations", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(payload),
    // });
  }

  presentationToggleBtn?.addEventListener("click", togglePresentation);
  prevPageBtn?.addEventListener("click", prevPage);
  nextPageBtn?.addEventListener("click", nextPage);
  clearCanvasBtn?.addEventListener("click", clearCanvas);
  saveBtn?.addEventListener("click", saveAnnotation);

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  if (annotationCanvas) {
    annotationCanvas.addEventListener("pointerdown", handlePointerDown);
    annotationCanvas.addEventListener("pointermove", handlePointerMove);
    annotationCanvas.addEventListener("pointerup", stopDrawing);
    annotationCanvas.addEventListener("pointerleave", stopDrawing);
    annotationCanvas.addEventListener("pointercancel", stopDrawing);
  }

  window.addEventListener("resize", () => resizeOverlayCanvases(true));

  window.AirNotePresentation = {
    updatePointerFromHand,
    drawAt,
    stopDrawing,
    nextPage,
    prevPage,
    clearCanvas,
    setMode,
    resizeCanvasToSlide,
    resizeOverlayCanvases,
    clearAnnotationCanvasOnly,
    getState: () => ({ currentPage, totalPage, currentMode, elapsedSeconds, isRunning }),
  };

  initPdfUpload();
  updateTimerText();
  updatePresentationButton();
  updatePageIndicator();
  updateModeUI();
  resizeOverlayCanvases(true);
});