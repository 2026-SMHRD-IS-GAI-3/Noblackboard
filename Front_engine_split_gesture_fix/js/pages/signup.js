import { AirNoteApi } from "../core/api.js";

document.getElementById("signupForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const checked = document.getElementById("termsAgree")?.checked;
  const message = document.getElementById("termsMessage");
  const name = document.getElementById("signupName")?.value.trim();
  const email = document.getElementById("signupEmail")?.value.trim();
  const password = document.getElementById("signupPassword")?.value;
  if (!checked) {
    if (message) message.textContent = "회원가입을 진행하려면 이용약관 동의가 필요합니다.";
    return;
  }
  if (!name || !email || !password) {
    if (message) message.textContent = "이름, 이메일, 비밀번호를 모두 입력해주세요.";
    return;
  }
  if (name.length > 50 || email.length > 100 || password.length > 100) {
    if (message) message.textContent = "이름은 50자, 이메일과 비밀번호는 100자 이하여야 합니다.";
    return;
  }
  if (message) message.textContent = "";
  try {
    await AirNoteApi.register({ name, email, password });
  } catch (error) {
    console.warn("AirNote signup: backend register failed.", error);
    if (message) message.textContent = error?.message || "회원가입 정보를 서버에 저장하지 못했습니다.";
    return;
  }
  window.location.href = "../index.html";
});
