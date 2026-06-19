import { API_BASE_URL } from "./constants.js";

const DEFAULT_TIMEOUT_MS = 8000;

export class AirNoteApiError extends Error {
  constructor(message, { code = "API_ERROR", status = 0, data = null, cause } = {}) {
    super(message, { cause });
    this.name = "AirNoteApiError";
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

function getBaseUrl() {
  const queryParam = new URLSearchParams(window.location.search).get("apiBaseUrl");
  if (queryParam) localStorage.setItem("airnote.apiBaseUrl", queryParam);
  return (window.AIRNOTE_API_BASE_URL || localStorage.getItem("airnote.apiBaseUrl") || API_BASE_URL).replace(/\/$/, "");
}

function toUrl(path) {
  return `${getBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function recordDebugApiState(update) {
  if (typeof window === "undefined") return;
  window.AirNoteDebugApiState = {
    ...(window.AirNoteDebugApiState || {}),
    ...update,
    at: new Date().toISOString(),
  };
}

function resolveAssetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = new URL(getBaseUrl(), window.location.origin);
  return new URL(path, base.origin).href;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  let payload;
  try {
    payload = contentType.includes("application/json")
      ? await response.json()
      : { success: response.ok, message: await response.text(), data: null };
  } catch (cause) {
    throw new AirNoteApiError("서버 응답을 JSON으로 해석하지 못했습니다.", {
      code: "INVALID_RESPONSE",
      status: response.status,
      cause,
    });
  }
  if (!response.ok || payload.success === false) {
    throw new AirNoteApiError(payload.message || `AirNote API request failed: ${response.status}`, {
      code: payload.errorCode || "REQUEST_FAILED",
      status: response.status,
      data: payload.data ?? null,
    });
  }
  return { ...payload, data: payload.data ?? null };
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
  const url = toUrl(path);
  recordDebugApiState({ url, method, status: null, ok: null, error: "", networkError: false, jsonParseError: false });
  try {
    const response = await fetch(url, {
      method,
      signal: timeout.signal,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    recordDebugApiState({ url, method, status: response.status, ok: response.ok });
    return parseResponse(response);
  } catch (error) {
    recordDebugApiState({
      url,
      method,
      status: error?.status || 0,
      ok: false,
      error: error?.message || String(error),
      networkError: !(error instanceof AirNoteApiError),
      jsonParseError: error?.code === "INVALID_RESPONSE",
    });
    if (error?.name === "AbortError") {
      throw new AirNoteApiError("서버 응답 시간이 초과되었습니다.", { code: "TIMEOUT", cause: error });
    }
    if (error instanceof AirNoteApiError) throw error;
    throw new AirNoteApiError("백엔드 서버에 연결할 수 없습니다.", { code: "NETWORK_ERROR", cause: error });
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
  const url = toUrl(path);
  recordDebugApiState({ url, method: "POST", status: null, ok: null, error: "", networkError: false, jsonParseError: false });
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: timeout.signal,
      body: formData,
    });
    recordDebugApiState({ url, method: "POST", status: response.status, ok: response.ok });
    return parseResponse(response);
  } catch (error) {
    recordDebugApiState({
      url,
      method: "POST",
      status: error?.status || 0,
      ok: false,
      error: error?.message || String(error),
      networkError: !(error instanceof AirNoteApiError),
      jsonParseError: error?.code === "INVALID_RESPONSE",
    });
    if (error?.name === "AbortError") {
      throw new AirNoteApiError("파일 전송 시간이 초과되었습니다.", { code: "TIMEOUT", cause: error });
    }
    if (error instanceof AirNoteApiError) throw error;
    throw new AirNoteApiError("백엔드 서버에 연결할 수 없습니다.", { code: "NETWORK_ERROR", cause: error });
  } finally {
    timeout.clear();
  }
}

export async function apiUrlEncoded(path, fields, { signal, timeoutMs } = {}) {
  const body = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) body.set(key, String(value));
  });
  const timeout = createTimeoutSignal(signal, timeoutMs);
  const url = toUrl(path);
  recordDebugApiState({ url, method: "POST", status: null, ok: null, error: "", networkError: false, jsonParseError: false });
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: timeout.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
    });
    recordDebugApiState({ url, method: "POST", status: response.status, ok: response.ok });
    return parseResponse(response);
  } catch (error) {
    recordDebugApiState({
      url,
      method: "POST",
      status: error?.status || 0,
      ok: false,
      error: error?.message || String(error),
      networkError: !(error instanceof AirNoteApiError),
      jsonParseError: error?.code === "INVALID_RESPONSE",
    });
    if (error?.name === "AbortError") {
      throw new AirNoteApiError("서버 응답 시간이 초과되었습니다.", { code: "TIMEOUT", cause: error });
    }
    if (error instanceof AirNoteApiError) throw error;
    throw new AirNoteApiError("백엔드 서버에 연결할 수 없습니다.", { code: "NETWORK_ERROR", cause: error });
  } finally {
    timeout.clear();
  }
}

function requirePositiveId(name, value) {
  if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
    throw new AirNoteApiError(`${name} 값이 올바르지 않습니다.`, { code: "INVALID_ARGUMENT" });
  }
}

export const AirNoteApi = Object.freeze({
  getBaseUrl,
  resolveAssetUrl,
  register(user) {
    return apiJson("/api/users/register", { method: "POST", body: user, timeoutMs: 10000 });
  },
  login(credentials) {
    return apiJson("/api/users/login", { method: "POST", body: credentials });
  },
  saveUserCalibration(calibration) {
    requirePositiveId("userId", calibration?.userId);
    return apiJson("/api/users/calibration", { method: "POST", body: calibration });
  },
  uploadDocument({ userId, file, pageCount }) {
    requirePositiveId("userId", userId);
    requirePositiveId("pageCount", pageCount);
    if (!(file instanceof Blob)) {
      throw new AirNoteApiError("업로드할 PDF 파일이 없습니다.", { code: "INVALID_ARGUMENT" });
    }
    return apiForm("/api/documents/upload", { userId, file, pageCount }, { timeoutMs: 60000 });
  },
  startPresentation({ userId, pdfId }) {
    requirePositiveId("userId", userId);
    requirePositiveId("pdfId", pdfId);
    return apiJson("/api/presentations/start", { method: "POST", body: { userId, pdfId } });
  },
  endPresentation(presentationId) {
    requirePositiveId("presentationId", presentationId);
    return apiJson(`/api/presentations/end?presentationId=${encodeURIComponent(presentationId)}`, { method: "POST" });
  },
  listPresentations(userId) {
    requirePositiveId("userId", userId);
    return apiJson(`/api/presentations?userId=${encodeURIComponent(userId)}`);
  },
  getPresentationDetail(presentationId) {
    requirePositiveId("presentationId", presentationId);
    return apiJson(`/api/presentations/detail?presentationId=${encodeURIComponent(presentationId)}`);
  },
  listTextAnchors({ pdfId, pageNo }) {
    requirePositiveId("pdfId", pdfId);
    requirePositiveId("pageNo", pageNo);
    return apiJson(`/api/text-anchors?pdfId=${encodeURIComponent(pdfId)}&pageNo=${encodeURIComponent(pageNo)}`);
  },
  saveAnnotation(fields) {
    requirePositiveId("presentationId", fields?.presentationId);
    requirePositiveId("pageNo", fields?.pageNo);
    return apiUrlEncoded("/api/annotations", fields);
  },
  savePageAction(fields) {
    requirePositiveId("presentationId", fields?.presentationId);
    requirePositiveId("fromPageNo", fields?.fromPageNo);
    requirePositiveId("toPageNo", fields?.toPageNo);
    return apiUrlEncoded("/api/page-actions", fields);
  },
  saveRecordImage({ presentationId, pageNo, image }) {
    requirePositiveId("presentationId", presentationId);
    requirePositiveId("pageNo", pageNo);
    return apiForm("/api/records/save-image", { presentationId, pageNo, image }, { timeoutMs: 30000 });
  },
  listRecordImages(presentationId) {
    requirePositiveId("presentationId", presentationId);
    return apiJson(`/api/records/images?presentationId=${encodeURIComponent(presentationId)}`);
  },
});
