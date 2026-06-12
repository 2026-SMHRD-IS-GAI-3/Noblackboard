import { saveLoginSession, startLocalGestureSession } from "../core/auth.js";
import { AirNoteApi } from "../core/api.js";
import { STORAGE_KEYS } from "../core/constants.js";
import { readJson } from "../core/storage.js";
import { setModalOpen, showToast } from "../core/ui.js";

const TEST_USER = { name: "테스트", email: "air@note" };
const TEST_PASSWORD = "airnote0619";

function getSignupUsers() {
  return readJson(localStorage, STORAGE_KEYS.signupUsers, []);
}

function updateSystemStatus(cameraConnected) {
  const percent = cameraConnected ? 100 : 0;
  document.getElementById("systemStatusTitle").textContent = cameraConnected ? "정상 연결" : "연결 필요";
  document.getElementById("systemStatusMessage").textContent =
    cameraConnected ? "카메라가 연결되어 있습니다." : "카메라 연결이 필요합니다.";
  document.getElementById("systemStatusPercent").textContent = `${percent}%`;
  document.getElementById("systemStatusBar").style.setProperty("--progress", `${percent}%`);
  document.getElementById("cameraStatusBadge").textContent = cameraConnected ? "ON" : "OFF";
  document.querySelector(".status-panel")?.classList.toggle("is-connected", cameraConnected);
  document.querySelector(".status-panel")?.classList.toggle("is-disconnected", !cameraConnected);
}

async function checkCameraStatus() {
  if (!navigator.mediaDevices) {
    updateSystemStatus(false);
    return;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices?.();
    const hasCamera = Array.isArray(devices) && devices.some((device) => device.kind === "videoinput");
    if (hasCamera) {
      updateSystemStatus(true);
      return;
    }
    if (!navigator.mediaDevices.getUserMedia) {
      updateSystemStatus(false);
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    stream.getTracks().forEach((track) => track.stop());
    updateSystemStatus(true);
  } catch (error) {
    console.warn("AirNote login: camera status check failed.", error);
    updateSystemStatus(false);
  }
}

function findUserForPasswordLookup(name, email) {
  if (name === TEST_USER.name && email === TEST_USER.email) {
    return { ...TEST_USER, password: TEST_PASSWORD };
  }
  return getSignupUsers().find((user) => user.name === name && user.email === email) || null;
}

document.getElementById("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("loginEmail")?.value.trim();
  const password = document.getElementById("loginPassword")?.value;
  const remember = document.getElementById("rememberLogin")?.checked;
  let user = null;

  if (!email || !password) {
    showToast(
      document.getElementById("loginToast"),
      "이메일과 비밀번호를 모두 입력해주세요.",
      2600
    );
    return;
  }

  try {
    const response = await AirNoteApi.login({ email, password });
    user = response.data;
  } catch (error) {
    console.warn("AirNote login: backend login failed, using local fallback.", error);
    user = email === TEST_USER.email && password === TEST_PASSWORD
      ? TEST_USER
      : getSignupUsers().find((candidate) => candidate.email === email && candidate.password === password);
  }

  if (user) {
    saveLoginSession(user, remember);
    window.location.href = "pages/home.html";
    return;
  }

  showToast(
    document.getElementById("loginToast"),
    "이메일 또는 비밀번호가 일치하지 않습니다. 입력한 정보를 다시 확인해주세요.",
    2600
  );
});

document.getElementById("localGestureTestBtn")?.addEventListener("click", () => {
  startLocalGestureSession();
  sessionStorage.removeItem(STORAGE_KEYS.currentPdfId);
  sessionStorage.removeItem(STORAGE_KEYS.currentPresentationId);
  window.location.href = "pages/presentation.html?local=1";
});

const forgotPasswordModal = document.getElementById("forgotPasswordModal");
document.getElementById("forgotPasswordBtn")?.addEventListener("click", () => setModalOpen(forgotPasswordModal, true));
document.getElementById("forgotPasswordCloseBtn")?.addEventListener("click", () => setModalOpen(forgotPasswordModal, false));
forgotPasswordModal?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget) setModalOpen(forgotPasswordModal, false);
});

document.getElementById("togglePasswordViewBtn")?.addEventListener("click", () => {
  const preview = document.getElementById("passwordPreview");
  const button = document.getElementById("togglePasswordViewBtn");
  if (!preview || !button) return;
  if (!preview.hidden) {
    preview.hidden = true;
    button.textContent = "비밀번호 확인";
    return;
  }
  const name = document.getElementById("forgotName")?.value.trim();
  const email = document.getElementById("forgotEmail")?.value.trim();
  const message = document.getElementById("forgotPasswordMessage");
  const user = findUserForPasswordLookup(name, email);
  if (!user) {
    if (message) message.textContent = "입력한 정보와 일치하는 계정을 찾을 수 없습니다.";
    preview.hidden = true;
    button.textContent = "비밀번호 확인";
    return;
  }
  if (message) message.textContent = "";
  preview.textContent = `확인된 비밀번호: ${user.password}`;
  preview.hidden = false;
  button.textContent = "비밀번호 숨기기";
});

localStorage.removeItem(STORAGE_KEYS.legacyCurrentUserPassword);
updateSystemStatus(false);
checkCameraStatus();
