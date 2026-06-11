export const STORAGE_KEYS = Object.freeze({
  signupUsers: "airnoteSignupUsers",
  currentUser: "airnoteCurrentUser",
  currentUserId: "airnoteCurrentUserId",
  currentUserEmail: "airnoteCurrentUserEmail",
  currentUserName: "airnoteCurrentUserName",
  legacyCurrentUserPassword: "airnoteCurrentUserPassword",
  rememberLogin: "airnoteRememberLogin",
  sessionActive: "airnoteSessionActive",
  presentationRecords: "airnote.presentationRecords",
  lastPresentationSession: "airnote.lastPresentationSession",
  currentPdf: "airnote.currentPdfKey",
  currentMockPdf: "airnote.currentMockPdf",
  currentPdfId: "airnote.currentPdfId",
  currentPresentationId: "airnote.currentPresentationId",
});

export const API_BASE_URL = "http://localhost:8090/AirNote_Backend";

export const DATABASES = Object.freeze({
  pdf: { name: "airnote-local-pdfs", version: 1, store: "pdfs" },
  analytics: { name: "airnote-analytics", version: 1 },
  presentation: { name: "airnote-presentations", version: 1, annotationStore: "annotations" },
});

export const SCHEMA_VERSION = 1;
