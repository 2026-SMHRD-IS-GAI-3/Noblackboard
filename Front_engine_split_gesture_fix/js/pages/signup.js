import { AirNoteApi } from "../core/api.js";
import { STORAGE_KEYS } from "../core/constants.js";
import { readJson, writeJson } from "../core/storage.js";

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
  const users = readJson(localStorage, STORAGE_KEYS.signupUsers, [])
    .filter((user) => user.email !== email);
  users.push({ name, email, password });
  writeJson(localStorage, STORAGE_KEYS.signupUsers, users);
  AirNoteApi.register({ name, email, password }).catch((error) => {
    console.warn("AirNote signup: backend register failed, local signup preserved.", error);
  });
  window.location.href = "../index.html";
});
