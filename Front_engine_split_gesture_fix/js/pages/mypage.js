import { bindSharedNavigation, getCurrentUser, requireActiveLogin } from "../core/auth.js";
import { AirNoteApi } from "../core/api.js";
import { SCHEMA_VERSION, STORAGE_KEYS } from "../core/constants.js";
import { readJson, writeJson } from "../core/storage.js";

const listEl = document.getElementById("presentationRecordList");
const latestDateEl = document.getElementById("latestRecordDate");
const latestDateDescEl = document.getElementById("latestRecordDateDesc");
const countEl = document.getElementById("recordCount");
const latestTimeEl = document.getElementById("latestRecordTime");
const latestTimeDescEl = document.getElementById("latestRecordTimeDesc");
const recordViewerModal = document.getElementById("recordViewerModal");
const recordViewerStage = document.getElementById("recordViewerStage");
const recordViewerImage = document.getElementById("recordViewerImage");
const recordViewerEmpty = document.getElementById("recordViewerEmpty");
const recordViewerPrev = document.getElementById("recordViewerPrev");
const recordViewerNext = document.getElementById("recordViewerNext");
const recordViewerCount = document.getElementById("recordViewerCount");

let viewerItems = [];
let viewerIndex = 0;

requireActiveLogin("../index.html");

function getRecords() {
  return readJson(localStorage, STORAGE_KEYS.presentationRecords, []);
}

const HIDDEN_PRESENTATIONS_KEY = "airnote.hiddenPresentationIds";

function getHiddenPresentationIds() {
  return readJson(localStorage, HIDDEN_PRESENTATIONS_KEY, []);
}

function addHiddenPresentationId(presentationId) {
  const ids = getHiddenPresentationIds();
  if (!ids.includes(presentationId)) {
    writeJson(localStorage, HIDDEN_PRESENTATIONS_KEY, [...ids, presentationId]);
  }
}

async function getBackendRecords() {
  const userId = getCurrentUser().userId;
  if (!userId) return null;
  try {
    const response = await AirNoteApi.listPresentations(userId);
    const details = await Promise.all((response.data || []).map(async (record) => {
      try {
        const detail = await AirNoteApi.getPresentationDetail(record.presentationId);
        return detail.data || record;
      } catch (error) {
        console.warn("AirNote mypage: presentation detail failed.", error);
        return record;
      }
    }));
    return Promise.all(details.map((record) => markImageAvailability({
      schemaVersion: SCHEMA_VERSION,
      id: `server-${record.presentationId}`,
      presentationId: record.presentationId,
      pdfId: record.pdfId,
      fileName: record.fileName || `PDF #${record.pdfId || "-"}`,
      presentationDate: record.startTime ? String(record.startTime).slice(0, 10).replaceAll("-", ".") : "-",
      elapsedSeconds: getRecordDurationSeconds(record),
      progressRate: record.endTime ? 100 : 0,
      annotationCount: record.recordImages?.length || 0,
      recordImages: record.recordImages || [],
      startTime: record.startTime,
      endTime: record.endTime,
    })));
  } catch (error) {
    console.error("AirNote mypage: backend presentation list failed.", error);
    throw error;
  }
}

function saveRecords(records) {
  writeJson(localStorage, STORAGE_KEYS.presentationRecords, records);
}

function parseTimeValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  const time = parsed.getTime();
  return Number.isFinite(time) ? time : null;
}

function normalizeDurationSeconds(value, unit = "seconds") {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  if (unit === "milliseconds") return Math.round(numeric / 1000);
  return numeric > 100000 ? Math.round(numeric / 1000) : Math.round(numeric);
}

function getRecordDurationSeconds(record = {}) {
  const storedDuration = [
    normalizeDurationSeconds(record.duration),
    normalizeDurationSeconds(record.durationSeconds),
    normalizeDurationSeconds(record.elapsedSeconds),
    normalizeDurationSeconds(record.elapsedMs, "milliseconds"),
    normalizeDurationSeconds(record.totalTime),
  ].find((value) => value !== null);

  if (storedDuration !== undefined) return storedDuration;

  const start = parseTimeValue(record.startTime || record.start_time || record.START_TIME || record.startedAt);
  const end = parseTimeValue(record.endTime || record.end_time || record.END_TIME || record.endedAt);
  if (start === null || end === null || end < start) return null;
  return Math.round((end - start) / 1000);
}

function formatRecordDuration(totalSeconds) {
  if (!Number.isFinite(Number(totalSeconds)) || Number(totalSeconds) < 0) return "-";
  const seconds = Math.round(Number(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function getStoredElapsedText(record = {}) {
  const value = record.elapsedTime || record.elapsedText;
  if (!value || ["진행 중", "완료"].includes(value)) return "-";
  return value;
}

function getRecordDate(record) {
  return record.presentationDate || record.date || "-";
}

function getRecordElapsed(record) {
  const durationSeconds = getRecordDurationSeconds(record);
  if (durationSeconds !== null) return formatRecordDuration(durationSeconds);
  return getStoredElapsedText(record);
}

function getRecordProgress(record) {
  const value = record.progressRate ?? record.progressPercent;
  return Number.isFinite(Number(value)) ? `${Number(value)}%` : "0%";
}

async function markImageAvailability(record) {
  const images = record.recordImages || [];
  await Promise.all(images.map(async (image) => {
    image.resolvedUrl = AirNoteApi.resolveAssetUrl(image.imageUrl);
    try {
      const response = await fetch(image.resolvedUrl, { method: "HEAD" });
      image.fileAvailable = response.ok;
    } catch {
      image.fileAvailable = false;
    }
  }));
  return record;
}

function renderMetrics(records) {
  const latest = records[0];
  if (latestDateEl) latestDateEl.textContent = latest ? getRecordDate(latest) : "-";
  if (latestDateDescEl) latestDateDescEl.textContent = latest ? "가장 최근 발표 날짜" : "저장된 발표 기록이 없습니다.";
  if (countEl) countEl.textContent = `${records.length}건`;
  if (latestTimeEl) latestTimeEl.textContent = latest ? getRecordElapsed(latest) : "-";
  if (latestTimeDescEl) latestTimeDescEl.textContent = latest ? "가장 최근 발표 시간" : "저장된 발표 기록이 없습니다.";
}

function deleteRecord(id, presentationId) {
  if (!window.confirm("삭제하시겠습니까?")) return;
  saveRecords(getRecords().filter((record) => record.id !== id));
  if (presentationId) addHiddenPresentationId(presentationId);
  renderRecords();
}

function toViewerImageItem(image, fallbackPageNo = 1) {
  if (!image) return null;
  if (typeof image === "string") {
    return { type: "image", src: AirNoteApi.resolveAssetUrl(image), pageNo: fallbackPageNo };
  }
  const rawSrc = image.resolvedUrl
    || image.imageUrl
    || image.captureImage
    || image.savedImage
    || image.annotationImage
    || image.recordImage
    || image.previewImage
    || image.src
    || image.url;
  if (!rawSrc) return null;
  return {
    type: "image",
    src: AirNoteApi.resolveAssetUrl(rawSrc),
    pageNo: Number(image.pageNo || image.page || fallbackPageNo) || fallbackPageNo,
  };
}

function collectViewerItemsFromArray(items, fallbackPageNo = 1) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => toViewerImageItem(item, index + fallbackPageNo)).filter(Boolean);
}

function normalizeRecordViewerItems(record = {}) {
  const candidates = [
    collectViewerItemsFromArray(record.recordImages),
    collectViewerItemsFromArray(record.images),
    collectViewerItemsFromArray(record.captures),
    collectViewerItemsFromArray(record.annotationImages),
    collectViewerItemsFromArray(record.savedImages),
    collectViewerItemsFromArray(record.pages),
    collectViewerItemsFromArray(record.annotations),
    [
      toViewerImageItem(record.captureImage),
      toViewerImageItem(record.imageUrl),
      toViewerImageItem(record.savedImage),
      toViewerImageItem(record.annotationImage),
      toViewerImageItem(record.recordImage),
      toViewerImageItem(record.previewImage),
    ].filter(Boolean),
  ].flat();

  const seen = new Set();
  return candidates
    .filter((item) => item.src && !seen.has(item.src) && seen.add(item.src))
    .sort((a, b) => (a.pageNo || 0) - (b.pageNo || 0));
}

function setViewerOpen(open) {
  if (!recordViewerModal) return;
  recordViewerModal.classList.toggle("is-open", open);
  recordViewerModal.setAttribute("aria-hidden", open ? "false" : "true");
  document.body.classList.toggle("record-viewer-open", open);
  if (!open) {
    viewerItems = [];
    viewerIndex = 0;
    if (recordViewerImage) {
      recordViewerImage.removeAttribute("src");
      recordViewerImage.style.aspectRatio = "";
    }
    if (recordViewerStage) recordViewerStage.style.aspectRatio = "";
  }
}

function renderRecordViewer() {
  const item = viewerItems[viewerIndex];
  const hasItem = Boolean(item?.src);
  if (recordViewerEmpty) recordViewerEmpty.hidden = hasItem;
  if (recordViewerImage) {
    recordViewerImage.hidden = !hasItem;
    if (hasItem) recordViewerImage.src = item.src;
    else {
      recordViewerImage.removeAttribute("src");
      recordViewerImage.style.aspectRatio = "";
    }
  }
  if (recordViewerPrev) {
    recordViewerPrev.hidden = viewerItems.length <= 1;
    recordViewerPrev.disabled = viewerIndex <= 0;
  }
  if (recordViewerNext) {
    recordViewerNext.hidden = viewerItems.length <= 1;
    recordViewerNext.disabled = viewerIndex >= viewerItems.length - 1;
  }
  if (recordViewerCount) {
    recordViewerCount.hidden = viewerItems.length <= 1;
    recordViewerCount.textContent = hasItem ? `${viewerIndex + 1} / ${viewerItems.length}` : "0 / 0";
  }
}

function openRecordViewer(record) {
  viewerItems = normalizeRecordViewerItems(record);
  viewerIndex = 0;
  setViewerOpen(true);
  renderRecordViewer();
}

function closeRecordViewer() {
  setViewerOpen(false);
}

function createRecordArticle(record) {
  const article = document.createElement("article");
  article.className = "presentation-record";
  article.dataset.recordId = record.id || "";
  article.innerHTML = `
    <div class="record-left-group">
      <p class="record-info-row">
        <span class="record-icon-box file"><span class="record-line-icon icon-mask icon-record-file" aria-hidden="true"></span></span>
        <span class="record-info-label">발표 자료명:</span>
        <strong class="record-info-value record-file-name"></strong>
      </p>
      <p class="record-info-row">
        <span class="record-icon-box time"><span class="record-line-icon icon-mask icon-record-time" aria-hidden="true"></span></span>
        <span class="record-info-label">발표 시간:</span>
        <span class="record-info-value">${getRecordElapsed(record)}</span>
      </p>
    </div>
    <div class="record-middle-group">
      <div class="record-middle-top">
        <p class="record-info-row">
          <span class="record-icon-box date"><span class="record-line-icon icon-mask icon-record-date" aria-hidden="true"></span></span>
          <span class="record-info-label">발표 날짜:</span>
          <span class="record-info-value">${getRecordDate(record)}</span>
        </p>
        <p class="record-info-row">
          <span class="record-icon-box progress"><span class="record-line-icon icon-mask icon-record-progress" aria-hidden="true"></span></span>
          <span class="record-info-label">발표 경과율:</span>
          <span class="record-info-value">${getRecordProgress(record)}</span>
        </p>
      </div>
      <p class="record-info-row">
        <span class="record-icon-box annotation"><span class="record-line-icon icon-mask icon-record-annotations" aria-hidden="true"></span></span>
        <span class="record-info-label">저장된 판서:</span>
        <span class="record-info-value">${record.annotationCount || 0}개</span>
      </p>
    </div>
    <div class="record-actions">
      <button class="delete-button delete-record-button view-record-button" type="button">확인</button>
      <button class="delete-button delete-record-button" type="button"><span class="button-icon icon-mask icon-record-delete" aria-hidden="true"></span>삭제</button>
    </div>
  `;
  article.querySelector("strong").textContent = record.fileName || "선택된 발표 자료 없음";
  if (record.recordImages?.some((image) => image.fileAvailable === false)) {
    const status = document.createElement("p");
    status.className = "record-info-row";
    status.textContent = "이미지 상태: 파일 없음";
    article.querySelector(".record-middle-group")?.append(status);
  }
  article.querySelector(".view-record-button")?.addEventListener("click", () => openRecordViewer(record));
  article.querySelector(".delete-record-button:not(.view-record-button)")?.addEventListener("click", () => deleteRecord(record.id, record.presentationId));
  article.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    openRecordViewer(record);
  });
  return article;
}

recordViewerImage?.addEventListener("load", () => {
  if (!recordViewerImage.naturalWidth || !recordViewerImage.naturalHeight) return;
  const ratio = `${recordViewerImage.naturalWidth} / ${recordViewerImage.naturalHeight}`;
  recordViewerImage.style.aspectRatio = ratio;
  if (recordViewerStage) recordViewerStage.style.aspectRatio = ratio;
});

recordViewerPrev?.addEventListener("click", () => {
  if (viewerIndex <= 0) return;
  viewerIndex -= 1;
  renderRecordViewer();
});

recordViewerNext?.addEventListener("click", () => {
  if (viewerIndex >= viewerItems.length - 1) return;
  viewerIndex += 1;
  renderRecordViewer();
});

recordViewerModal?.addEventListener("click", (event) => {
  if (event.target.closest("[data-record-viewer-close]")) closeRecordViewer();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && recordViewerModal?.classList.contains("is-open")) {
    closeRecordViewer();
  }
});

async function renderRecords() {
  let records;
  try {
    const backendRecords = await getBackendRecords();
    const hiddenIds = getHiddenPresentationIds();
    const raw = backendRecords || getRecords().map((record) => ({
      schemaVersion: record.schemaVersion || SCHEMA_VERSION,
      ...record,
    }));
    records = raw.filter((record) => !record.presentationId || !hiddenIds.includes(record.presentationId));
  } catch (error) {
    renderMetrics([]);
    if (listEl) {
      listEl.innerHTML = `<p class="empty-state">${error.message || "발표 기록을 불러오지 못했습니다."}</p>`;
    }
    return;
  }
  renderMetrics(records);
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!records.length) {
    listEl.innerHTML = '<p class="empty-state">아직 저장된 발표 기록이 없습니다.</p>';
    return;
  }
  records.forEach((record) => listEl.append(createRecordArticle(record)));
}

bindSharedNavigation();
renderRecords();
