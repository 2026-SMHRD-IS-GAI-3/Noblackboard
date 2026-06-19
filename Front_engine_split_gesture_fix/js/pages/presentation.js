import {
  bindSharedNavigation,
  hasActiveLogin,
  requireActiveLogin,
  startLocalGestureSession,
} from "../core/auth.js";
import { AirNoteApi } from "../core/api.js";
import { createPresentationStore } from "../core/store.js";
import { createAnnotationEngine } from "../presentation/annotations.js";
import { createSpeechAnchorEngine } from "../presentation/anchors.js";
import { createGestureBridge } from "../presentation/gestureBridge.js";
import { createPermissionManager } from "../presentation/permissions.js";
import { cancelRenderTask, createPresentationPdfRepository } from "../presentation/pdf.js";
import { createPresentationRecorder } from "../presentation/recorder.js";
import { createPresentationSessionController } from "../presentation/session.js";
import { createSpeechRecognitionController } from "../presentation/speechAnchor.js";
import * as presentationUi from "../presentation/ui.js";
import * as timerUtils from "../presentation/timerUtils.js";
import { getStraightenedStroke, smoothStrokePoint } from "../gesture/strokeGeometry.js";
import { createRecentStrokeDeletionTracker } from "../gesture/recentStrokeDeletion.js";
import { buildPresentationReport } from "../presentation/report.js";
import {
  getDynamicPointerGain,
  mapDynamicPointerPoint,
} from "../presentation/pointerMotion.js";

const presentationParams = new URLSearchParams(window.location.search);
const debugOrLocalMode = presentationParams.has("debug") || presentationParams.has("sttDebug") || presentationParams.has("local");
if (!hasActiveLogin() && debugOrLocalMode) {
  startLocalGestureSession();
} else {
  requireActiveLogin("../index.html");
}

window.AirNoteModules = Object.freeze({
  AirNoteApi,
  bindSharedNavigation,
  buildPresentationReport,
  createAnnotationEngine,
  createGestureBridge,
  createPermissionManager,
  cancelRenderTask,
  createPresentationPdfRepository,
  createPresentationRecorder,
  createPresentationSessionController,
  createPresentationStore,
  createRecentStrokeDeletionTracker,
  createSpeechAnchorEngine,
  createSpeechRecognitionController,
  getStraightenedStroke,
  getDynamicPointerGain,
  mapDynamicPointerPoint,
  smoothStrokePoint,
  presentationUi,
  timerUtils,
});

void import("../presentation.js").catch((error) => {
  console.error("Failed to initialize presentation page", error);
});
