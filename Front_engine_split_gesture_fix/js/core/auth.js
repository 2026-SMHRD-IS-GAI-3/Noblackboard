import { STORAGE_KEYS } from "./constants.js";
import { readJson, removeKeys, writeJson } from "./storage.js";

export function hasActiveLogin() {
  return localStorage.getItem(STORAGE_KEYS.rememberLogin) === "true"
    || sessionStorage.getItem(STORAGE_KEYS.sessionActive) === "true"
    || Boolean(readJson(localStorage, STORAGE_KEYS.currentUser, null)?.userId);
}

export function getCurrentUser() {
  return readJson(localStorage, STORAGE_KEYS.currentUser, { userId: null, name: "", email: "" });
}

export function saveLoginSession(user, remember = false) {
  sessionStorage.removeItem("airnoteLocalGestureMode");
  const safeUser = {
    userId: user.userId ?? user.user_id ?? user.id ?? null,
    name: user.name ?? "",
    email: user.email ?? "",
  };
  writeJson(localStorage, STORAGE_KEYS.currentUser, safeUser);
  if (safeUser.userId !== null && safeUser.userId !== undefined) {
    localStorage.setItem(STORAGE_KEYS.currentUserId, String(safeUser.userId));
  } else {
    localStorage.removeItem(STORAGE_KEYS.currentUserId);
  }
  localStorage.setItem(STORAGE_KEYS.currentUserEmail, safeUser.email);
  localStorage.setItem(STORAGE_KEYS.currentUserName, safeUser.name);
  // 구 키 제거 (마이그레이션)
  removeKeys(localStorage, [
    STORAGE_KEYS.legacyCurrentUserPassword,
  ]);
  if (remember) localStorage.setItem(STORAGE_KEYS.rememberLogin, "true");
  else localStorage.removeItem(STORAGE_KEYS.rememberLogin);
  sessionStorage.setItem(STORAGE_KEYS.sessionActive, "true");
}

export function startLocalGestureSession() {
  clearLoginState();
  saveLoginSession({
    name: "로컬 제스처 테스트",
    email: "local-gesture@airnote.test",
  });
  sessionStorage.removeItem(STORAGE_KEYS.currentPdfId);
  sessionStorage.removeItem(STORAGE_KEYS.currentPresentationId);
  sessionStorage.setItem("airnoteLocalGestureMode", "true");
}

export function clearLoginState() {
  removeKeys(localStorage, [
    STORAGE_KEYS.rememberLogin,
    STORAGE_KEYS.currentUser,
    // 구 키 (마이그레이션 잔여분 청소)
    STORAGE_KEYS.currentUserId,
    STORAGE_KEYS.currentUserEmail,
    STORAGE_KEYS.currentUserName,
    STORAGE_KEYS.legacyCurrentUserPassword,
  ]);
  sessionStorage.removeItem(STORAGE_KEYS.sessionActive);
  sessionStorage.removeItem(STORAGE_KEYS.currentPdfId);
  sessionStorage.removeItem(STORAGE_KEYS.currentPresentationId);
  sessionStorage.removeItem("airnoteLocalGestureMode");
}

export function requireActiveLogin(loginHref = "../index.html") {
  if (hasActiveLogin()) return true;
  window.location.replace(loginHref);
  return false;
}

export function bindSharedNavigation({ homeHref = "home.html", loginHref = "../index.html" } = {}) {
  document.querySelector(".brand-row.small")?.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.href = hasActiveLogin() ? homeHref : loginHref;
  });
  document.querySelector(".logout-link")?.addEventListener("click", clearLoginState);
}
