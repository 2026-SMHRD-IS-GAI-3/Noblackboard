import { API_BASE_URL } from "./constants.js";

const DEFAULT_TIMEOUT_MS = 2500;

function getBaseUrl() {
  return (window.AIRNOTE_API_BASE_URL || localStorage.getItem("airnote.apiBaseUrl") || API_BASE_URL).replace(/\/$/, "");
}

function toUrl(path) {
  return `${getBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { success: response.ok, message: await response.text(), data: null };
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `AirNote API request failed: ${response.status}`);
  }
  return payload;
}

function createTimeoutSignal(signal, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (signal || typeof AbortController !== "function") return { signal, clear: () => {} };
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => window.clearTimeout(timerId),
  };
}

export async function apiJson(path, { method = "GET", body, signal, timeoutMs } = {}) {
  const timeout = createTimeoutSignal(signal, timeoutMs);
  try {
  const response = await fetch(toUrl(path), {
    method,
    signal: timeout.signal,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse(response);
  } finally {
    timeout.clear();
  }
}

export async function apiForm(path, fields, { signal, timeoutMs } = {}) {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  const timeout = createTimeoutSignal(signal, timeoutMs);
  try {
  const response = await fetch(toUrl(path), {
    method: "POST",
    signal: timeout.signal,
    body: formData,
  });
  return parseResponse(response);
  } finally {
    timeout.clear();
  }
}

export const AirNoteApi = Object.freeze({
  getBaseUrl,
  register(user) {
    return apiJson("/api/users/register", { method: "POST", body: user, timeoutMs: 10000 });
  },
  login(credentials) {
    return apiJson("/api/users/login", { method: "POST", body: credentials });
  },
  saveUserCalibration(calibration) {
    return apiJson("/api/users/calibration", { method: "POST", body: calibration });
  },
  uploadDocument({ userId, file, pageCount }) {
    return apiForm("/api/documents/upload", { userId, file, pageCount });
  },
  startPresentation({ userId, pdfId }) {
    return apiJson("/api/presentations/start", { method: "POST", body: { userId, pdfId } });
  },
  endPresentation(presentationId) {
    return apiJson(`/api/presentations/end?presentationId=${encodeURIComponent(presentationId)}`, { method: "POST" });
  },
  listPresentations(userId) {
    return apiJson(`/api/presentations?userId=${encodeURIComponent(userId)}`);
  },
  getPresentationDetail(presentationId) {
    return apiJson(`/api/presentations/detail?presentationId=${encodeURIComponent(presentationId)}`);
  },
  listTextAnchors({ pdfId, pageNo }) {
    return apiJson(`/api/text-anchors?pdfId=${encodeURIComponent(pdfId)}&pageNo=${encodeURIComponent(pageNo)}`);
  },
  saveTextAnchor(anchor) {
    return apiJson("/api/text-anchors", { method: "POST", body: anchor });
  },
  saveAnchorMatchLog(fields) {
    return apiForm("/api/anchor-match/logs", fields);
  },
  saveAnnotation(fields) {
    return apiForm("/api/annotations", fields);
  },
  savePageAction(fields) {
    return apiForm("/api/page-actions", fields);
  },
  saveRecordImage({ presentationId, pageNo, image }) {
    return apiForm("/api/records/save-image", { presentationId, pageNo, image });
  },
  listRecordImages(presentationId) {
    return apiJson(`/api/records/images?presentationId=${encodeURIComponent(presentationId)}`);
  },
});
