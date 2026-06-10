(() => {
  const DB_NAME = "airnote-local-pdfs";
  const STORE_NAME = "pdfs";
  const CURRENT_KEY = "airnote.currentPdfKey";
  const CURRENT_MOCK_KEY = "airnote.currentMockPdf";
  const CURRENT_USER_NAME_KEY = "airnoteCurrentUserName";

  const input = document.getElementById("homePdfInput");
  const selectBtn = document.getElementById("homePdfSelectBtn");
  const statusEl = document.getElementById("homeUploadStatus");
  const listEl = document.getElementById("recentUploadList");
  const greetingEl = document.getElementById("homeGreeting");
  const openAllUploadsBtn = document.getElementById("openAllUploadsBtn");
  const allUploadsModal = document.getElementById("allUploadsModal");
  const allUploadsCloseBtn = document.getElementById("allUploadsCloseBtn");
  const allUploadList = document.getElementById("allUploadList");

  function hasActiveLogin() {
    return localStorage.getItem("airnoteRememberLogin") === "true"
      || sessionStorage.getItem("airnoteSessionActive") === "true"
      || Boolean(localStorage.getItem("airnoteCurrentUserEmail"));
  }

  function routeAirNoteLogo(event) {
    event.preventDefault();
    window.location.href = hasActiveLogin() ? "home.html" : "../index.html";
  }

  function clearLoginState() {
    localStorage.removeItem("airnoteRememberLogin");
    localStorage.removeItem("airnoteCurrentUserEmail");
    localStorage.removeItem("airnoteCurrentUserName");
    localStorage.removeItem("airnoteCurrentUserPassword");
    localStorage.removeItem("airnoteCurrentUser");
    sessionStorage.removeItem("airnoteSessionActive");
  }

  function getCurrentUserName() {
    const storedName = localStorage.getItem(CURRENT_USER_NAME_KEY);
    if (storedName) return storedName;
    try {
      const user = JSON.parse(localStorage.getItem("airnoteCurrentUser") || "null");
      if (user?.name) return user.name;
    } catch (error) {
      console.warn("AirNote home: current user parse failed.", error);
    }
    return "발표자";
  }

  function renderGreeting() {
    if (greetingEl) greetingEl.textContent = `안녕하세요, ${getCurrentUserName()}님`;
  }

  function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function savePdf(file) {
    const db = await openDb();
    const id = `pdf-${Date.now()}`;
    const payload = {
      id,
      name: file.name,
      type: file.type || "application/pdf",
      size: file.size,
      updatedAt: new Date().toISOString(),
      blob: file,
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(payload);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    sessionStorage.setItem(CURRENT_KEY, id);
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
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function deletePdf(id) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
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

  function setModalOpen(modal, isOpen) {
    if (!modal) return;
    modal.classList.toggle("show", isOpen);
    modal.setAttribute("aria-hidden", String(!isOpen));
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
    setModalOpen(allUploadsModal, true);
  });
  allUploadsCloseBtn?.addEventListener("click", () => setModalOpen(allUploadsModal, false));
  allUploadsModal?.addEventListener("click", (event) => {
    if (event.target === allUploadsModal) setModalOpen(allUploadsModal, false);
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

  document.querySelector(".brand-row.small")?.addEventListener("click", routeAirNoteLogo);
  document.querySelector(".logout-link")?.addEventListener("click", clearLoginState);
  renderGreeting();
  renderStoredUploads();
})();
