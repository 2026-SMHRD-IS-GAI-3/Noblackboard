import { bindSharedNavigation, getCurrentUser } from "./auth.js";
import { AirNoteApi } from "./api.js";
import { STORAGE_KEYS } from "./constants.js";
import { setModalOpen, showToast } from "./ui.js";
import { createPdfRepository } from "../repositories/pdfRepository.js";

window.AirNoteCore = Object.freeze({
  AirNoteApi,
  STORAGE_KEYS,
  bindSharedNavigation,
  createPdfRepository,
  getCurrentUser,
  setModalOpen,
  showToast,
});
