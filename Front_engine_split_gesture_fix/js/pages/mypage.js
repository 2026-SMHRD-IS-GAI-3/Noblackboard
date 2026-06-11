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

requireActiveLogin("../index.html");

function getRecords() {
  return readJson(localStorage, STORAGE_KEYS.presentationRecords, []);
}

async function getBackendRecords() {
  const userId = getCurrentUser().userId;
  if (!userId) return null;
  try {
    const response = await AirNoteApi.listPresentations(userId);
    return (response.data || []).map((record) => ({
      schemaVersion: SCHEMA_VERSION,
      id: `server-${record.presentationId}`,
      presentationId: record.presentationId,
      pdfId: record.pdfId,
      fileName: record.fileName || `PDF #${record.pdfId || "-"}`,
      presentationDate: record.startTime ? String(record.startTime).slice(0, 10).replaceAll("-", ".") : "-",
      elapsedTime: record.endTime ? "완료" : "진행 중",
      progressRate: record.endTime ? 100 : 0,
      annotationCount: record.recordImages?.length || 0,
      recordImages: record.recordImages || [],
      startTime: record.startTime,
      endTime: record.endTime,
    }));
  } catch (error) {
    console.warn("AirNote mypage: backend presentation list failed, using local records.", error);
    return null;
  }
}

function saveRecords(records) {
  writeJson(localStorage, STORAGE_KEYS.presentationRecords, records);
}

function getRecordDate(record) {
  return record.presentationDate || record.date || "-";
}

function getRecordElapsed(record) {
  return record.elapsedTime || record.elapsedText || "00:00";
}

function getRecordProgress(record) {
  const value = record.progressRate ?? record.progressPercent;
  return Number.isFinite(Number(value)) ? `${Number(value)}%` : "0%";
}

function renderMetrics(records) {
  const latest = records[0];
  if (latestDateEl) latestDateEl.textContent = latest ? getRecordDate(latest) : "-";
  if (latestDateDescEl) latestDateDescEl.textContent = latest ? "가장 최근 발표 날짜" : "저장된 발표 기록이 없습니다.";
  if (countEl) countEl.textContent = `${records.length}건`;
  if (latestTimeEl) latestTimeEl.textContent = latest ? getRecordElapsed(latest) : "-";
  if (latestTimeDescEl) latestTimeDescEl.textContent = latest ? "가장 최근 발표 시간" : "저장된 발표 기록이 없습니다.";
}

function deleteRecord(id) {
  if (!window.confirm("삭제하시겠습니까?")) return;
  saveRecords(getRecords().filter((record) => record.id !== id));
  renderRecords();
}

function createRecordArticle(record) {
  const article = document.createElement("article");
  article.className = "presentation-record";
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
      <button class="delete-button delete-record-button" type="button"><span class="button-icon icon-mask icon-record-delete" aria-hidden="true"></span>삭제</button>
    </div>
  `;
  article.querySelector("strong").textContent = record.fileName || "선택된 발표 자료 없음";
  article.querySelector("button").addEventListener("click", () => deleteRecord(record.id));
  return article;
}

async function renderRecords() {
  const backendRecords = await getBackendRecords();
  const records = backendRecords || getRecords().map((record) => ({ schemaVersion: record.schemaVersion || SCHEMA_VERSION, ...record }));
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
