(() => {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  const pdfRepository = window.AirNoteCore.createPdfRepository();
  const api = window.AirNoteCore.AirNoteApi;
  const CURRENT_KEY = window.AirNoteCore.STORAGE_KEYS.currentPdf;
  const CURRENT_MOCK_KEY = window.AirNoteCore.STORAGE_KEYS.currentMockPdf;
  const CURRENT_PDF_ID_KEY = window.AirNoteCore.STORAGE_KEYS.currentPdfId;

  const input = document.getElementById("homePdfInput");
  const selectBtn = document.getElementById("homePdfSelectBtn");
  const statusEl = document.getElementById("homeUploadStatus");
  const listEl = document.getElementById("recentUploadList");
  const greetingEl = document.getElementById("homeGreeting");
  const openAllUploadsBtn = document.getElementById("openAllUploadsBtn");
  const allUploadsModal = document.getElementById("allUploadsModal");
  const allUploadsCloseBtn = document.getElementById("allUploadsCloseBtn");
  const allUploadList = document.getElementById("allUploadList");

  function getCurrentUserName() {
    return window.AirNoteCore.getCurrentUser().name || "발표자";
  }

  function renderGreeting() {
    if (greetingEl) greetingEl.textContent = `안녕하세요, ${getCurrentUserName()}님`;
  }

  function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  async function getPdfPageCount(file) {
    if (!window.pdfjsLib) throw new Error("PDF 페이지 분석 모듈을 불러오지 못했습니다.");
    const data = await file.arrayBuffer();
    const documentTask = window.pdfjsLib.getDocument({ data });
    const document = await documentTask.promise;
    const pageCount = document.numPages;
    await document.destroy();
    return pageCount;
  }

  async function savePdf(file) {
    const id = `pdf-${Date.now()}`;
    const userId = window.AirNoteCore.getCurrentUser().userId;
    if (!userId) throw new Error("로그인 정보가 없어 PDF를 서버에 저장할 수 없습니다.");
    const pageCount = await getPdfPageCount(file);
    const response = await api.uploadDocument({ userId, file, pageCount });
    const backendPdf = response.data;
    if (!backendPdf?.pdfId) throw new Error("서버가 pdfId를 반환하지 않았습니다.");
    const payload = {
      id,
      pdfId: backendPdf?.pdfId || null,
      name: file.name,
      serverFileName: backendPdf?.fileName || "",
      pageCount: backendPdf?.pageCount || pageCount,
      type: file.type || "application/pdf",
      size: file.size,
      updatedAt: new Date().toISOString(),
      blob: file,
    };

    await pdfRepository.put(payload);
    sessionStorage.setItem(CURRENT_KEY, id);
    if (payload.pdfId) sessionStorage.setItem(CURRENT_PDF_ID_KEY, String(payload.pdfId));
    return payload;
  }

  function formatFileSize(size) {
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
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

  function formatUpdatedAt(updatedAt) {
    if (!updatedAt) return "방금 업로드";
    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) return "방금 업로드";
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  }

  function createPdfArticle(pdf, displayName, tone = "red") {
    const article = document.createElement("article");
    article.className = "uploaded-pdf-item";
    article.innerHTML = `
      <b class="pdf ${tone}">PDF</b>
      <div>
        <h3></h3>
        <p>${formatUpdatedAt(pdf.updatedAt)} · ${formatFileSize(pdf.size || 0)} · 업로드 완료</p>
      </div>
      <button class="outline ${tone}" type="button">발표하기</button>
    `;
    article.querySelector("h3").textContent = displayName;
    const openPresentation = () => {
      sessionStorage.setItem(CURRENT_KEY, pdf.id);
      if (pdf.pdfId) sessionStorage.setItem(CURRENT_PDF_ID_KEY, String(pdf.pdfId));
      sessionStorage.removeItem(CURRENT_MOCK_KEY);
      window.location.href = "presentation.html";
    };
    article.querySelector("button").addEventListener("click", openPresentation);
    article.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      openPresentation();
    });
    return article;
  }

  async function getAllStoredPdfs() {
    return pdfRepository.getAll();
  }

  async function deletePdf(id) {
    await pdfRepository.delete(id);
    if (sessionStorage.getItem(CURRENT_KEY) === id) sessionStorage.removeItem(CURRENT_KEY);
  }

  async function handleDeletePdf(pdf) {
    if (!pdf?.id) return;
    if (!window.confirm("삭제하시겠습니까?")) return;
    try {
      await deletePdf(pdf.id);
      setStatus(`${pdf.name} 파일이 삭제되었습니다.`);
      await renderStoredUploads();
      await renderAllUploads();
    } catch (error) {
      console.warn("AirNote home: PDF delete failed.", error);
      setStatus("PDF 파일을 삭제하지 못했습니다.", true);
    }
  }

  function createModalPdfItem(pdf, displayName) {
    const button = document.createElement("article");
    button.className = "upload-file-card upload-modal-item";
    button.innerHTML = `
      <div class="upload-file-info">
        <span class="upload-file-icon">📄</span>
        <div class="upload-file-text">
          <strong class="upload-file-name"></strong>
          <p class="upload-file-meta">${formatUpdatedAt(pdf.updatedAt)} · ${formatFileSize(pdf.size || 0)} · 업로드 완료</p>
        </div>
      </div>
      <div class="upload-file-actions">
        <button class="outline red present-file-button" type="button" data-action="open">발표하기</button>
        <button class="outline delete-file-button" type="button" data-action="delete">삭제</button>
      </div>
    `;
    button.querySelector("strong").textContent = displayName;
    button.querySelector('[data-action="open"]').addEventListener("click", () => {
      sessionStorage.setItem(CURRENT_KEY, pdf.id);
      if (pdf.pdfId) sessionStorage.setItem(CURRENT_PDF_ID_KEY, String(pdf.pdfId));
      sessionStorage.removeItem(CURRENT_MOCK_KEY);
      window.location.href = "presentation.html";
    });
    button.querySelector('[data-action="delete"]').addEventListener("click", () => handleDeletePdf(pdf));
    return button;
  }

  async function getSortedPdfs() {
    const storedPdfs = await getAllStoredPdfs();
    return storedPdfs.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }

  async function renderStoredUploads() {
    if (!listEl) return;
    listEl.innerHTML = "";
    try {
      const sorted = await getSortedPdfs();
      if (!sorted.length) {
        listEl.innerHTML = '<p class="empty-state">아직 업로드된 발표 자료가 없습니다.</p>';
        return;
      }
      const displayNames = getDisplayNames(sorted);
      sorted.slice(0, 4).forEach((pdf, index) => {
        const article = createPdfArticle(pdf, displayNames[index], index % 2 === 0 ? "red" : "orange");
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-button";
        deleteBtn.type = "button";
        deleteBtn.textContent = "삭제";
        deleteBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          handleDeletePdf(pdf);
        });
        article.append(deleteBtn);
        listEl.append(article);
      });
    } catch (error) {
      console.warn("AirNote home: stored PDF list failed.", error);
      listEl.innerHTML = '<p class="empty-state">아직 업로드된 발표 자료가 없습니다.</p>';
    }
  }

  async function renderAllUploads() {
    if (!allUploadList) return;
    allUploadList.innerHTML = "";
    try {
      const sorted = await getSortedPdfs();
      if (!sorted.length) {
        allUploadList.innerHTML = '<p class="empty-state">아직 업로드된 발표 자료가 없습니다.</p>';
        return;
      }
      const displayNames = getDisplayNames(sorted);
      sorted.forEach((pdf, index) => allUploadList.append(createModalPdfItem(pdf, displayNames[index])));
    } catch (error) {
      console.warn("AirNote home: all uploads render failed.", error);
      allUploadList.innerHTML = '<p class="empty-state">아직 업로드된 발표 자료가 없습니다.</p>';
    }
  }

  function renderSelectedPdf(pdf) {
    if (!listEl || !pdf) return;
    renderStoredUploads();
  }

  selectBtn?.addEventListener("click", () => input?.click());
  openAllUploadsBtn?.addEventListener("click", async () => {
    await renderAllUploads();
    window.AirNoteCore.setModalOpen(allUploadsModal, true);
  });
  allUploadsCloseBtn?.addEventListener("click", () => window.AirNoteCore.setModalOpen(allUploadsModal, false));
  allUploadsModal?.addEventListener("click", (event) => {
    if (event.target === allUploadsModal) window.AirNoteCore.setModalOpen(allUploadsModal, false);
  });

  input?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      input.value = "";
      setStatus("PDF 파일만 업로드할 수 있습니다.", true);
      return;
    }
    if (file.name.length > 255) {
      input.value = "";
      setStatus("PDF 파일명은 255자 이하여야 합니다.", true);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      input.value = "";
      setStatus("PDF 파일은 최대 50MB까지 업로드할 수 있습니다.", true);
      return;
    }

    try {
      setStatus("PDF 파일을 저장하는 중입니다...");
      const saved = await savePdf(file);
      sessionStorage.removeItem(CURRENT_MOCK_KEY);
      setStatus(`${saved.name} 파일이 선택되었습니다.`);
      renderSelectedPdf(saved);
    } catch (error) {
      console.warn("AirNote home: PDF save failed.", error);
      setStatus("PDF 파일을 저장하지 못했습니다.", true);
    }
  });

  window.AirNoteCore.bindSharedNavigation();
  renderGreeting();
  renderStoredUploads();
})();
