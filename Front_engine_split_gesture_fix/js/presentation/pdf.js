import { createPdfRepository } from "../repositories/pdfRepository.js";

export function createPresentationPdfRepository(options) {
  return createPdfRepository(options);
}

export function cancelRenderTask(task) {
  if (!task) return;
  try {
    task.cancel();
  } catch {
    // A completed PDF.js render task cannot be cancelled.
  }
}
