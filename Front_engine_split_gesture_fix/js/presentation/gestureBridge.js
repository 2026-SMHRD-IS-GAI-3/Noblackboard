export function createGestureBridge({ presentationApi, eventTarget = window } = {}) {
  const onCalibration = (event) => presentationApi?.updateCalibrationState?.(event.detail);
  const onDiagnostics = (event) => presentationApi?.updateGestureDiagnostics?.(event.detail);
  return {
    start() {
      eventTarget.addEventListener("airnote:calibration-state", onCalibration);
      eventTarget.addEventListener("airnote:gesture-diagnostics", onDiagnostics);
    },
    dispose() {
      eventTarget.removeEventListener("airnote:calibration-state", onCalibration);
      eventTarget.removeEventListener("airnote:gesture-diagnostics", onDiagnostics);
    },
  };
}
