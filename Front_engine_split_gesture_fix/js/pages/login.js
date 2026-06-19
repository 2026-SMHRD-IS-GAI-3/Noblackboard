import { saveLoginSession } from "../core/auth.js";
import { AirNoteApi } from "../core/api.js";
import { STORAGE_KEYS } from "../core/constants.js";
import { setModalOpen, showToast } from "../core/ui.js";

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
  if (!navigator.mediaDevices?.enumerateDevices) {
    updateSystemStatus(false);
    return;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    // enumerateDevices는 권한 없이도 호출 가능 — deviceId가 비어있어도 kind로 존재 여부 확인
    const hasCamera = Array.isArray(devices) && devices.some((device) => device.kind === "videoinput");
    updateSystemStatus(hasCamera);
  } catch (error) {
    console.warn("AirNote login: camera status check failed.", error);
    updateSystemStatus(false);
  }
}

function findUserForPasswordLookup(name, email) {
  return null;
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
    console.warn("AirNote login: backend login failed.", error);
    showToast(
      document.getElementById("loginToast"),
      error?.message || "백엔드 서버에 연결할 수 없습니다.",
      3000
    );
    return;
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
    if (message) message.textContent = "비밀번호 확인은 관리자에게 문의해주세요.";
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
