import { STORAGE_KEYS } from "./constants.js";
import { readJson, removeKeys, writeJson } from "./storage.js";

export function hasActiveLogin() {
  return localStorage.getItem(STORAGE_KEYS.rememberLogin) === "true"
    || sessionStorage.getItem(STORAGE_KEYS.sessionActive) === "true"
    || Boolean(localStorage.getItem(STORAGE_KEYS.currentUserId))
    || Boolean(localStorage.getItem(STORAGE_KEYS.currentUserEmail));
}

export function getCurrentUser() {
  const stored = readJson(localStorage, STORAGE_KEYS.currentUser, null);
  if (stored) return { userId: stored.userId || null, name: stored.name, email: stored.email };
  return {
    userId: localStorage.getItem(STORAGE_KEYS.currentUserId) || null,
    name: localStorage.getItem(STORAGE_KEYS.currentUserName) || "",
    email: localStorage.getItem(STORAGE_KEYS.currentUserEmail) || "",
  };
}

export function saveLoginSession(user, remember = false) {
  const safeUser = { userId: user.userId ?? user.user_id ?? user.id ?? null, name: user.name, email: user.email };
  if (safeUser.userId) localStorage.setItem(STORAGE_KEYS.currentUserId, String(safeUser.userId));
  localStorage.setItem(STORAGE_KEYS.currentUserEmail, safeUser.email);
  localStorage.setItem(STORAGE_KEYS.currentUserName, safeUser.name);
  writeJson(localStorage, STORAGE_KEYS.currentUser, safeUser);
  localStorage.removeItem(STORAGE_KEYS.legacyCurrentUserPassword);
  if (remember) localStorage.setItem(STORAGE_KEYS.rememberLogin, "true");
  else localStorage.removeItem(STORAGE_KEYS.rememberLogin);
  sessionStorage.setItem(STORAGE_KEYS.sessionActive, "true");
}

export function startLocalGestureSession() {
  localStorage.removeItem(STORAGE_KEYS.currentUserId);
  saveLoginSession({
    name: "로컬 제스처 테스트",
    email: "local-gesture@airnote.test",
  });
  sessionStorage.setItem("airnoteLocalGestureMode", "true");
}

export function clearLoginState() {
  removeKeys(localStorage, [
    STORAGE_KEYS.rememberLogin,
    STORAGE_KEYS.currentUserId,
    STORAGE_KEYS.currentUserEmail,
    STORAGE_KEYS.currentUserName,
    STORAGE_KEYS.legacyCurrentUserPassword,
    STORAGE_KEYS.currentUser,
  ]);
  sessionStorage.removeItem(STORAGE_KEYS.sessionActive);
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
