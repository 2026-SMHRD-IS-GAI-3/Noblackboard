export function createPresentationSessionController({ stage, onStart, onStop } = {}) {
  let running = false;
  return {
    async start() {
      if (running) return true;
      if (stage && document.fullscreenElement !== stage) {
        await stage.requestFullscreen?.().catch(() => false);
      }
      running = true;
      await onStart?.();
      return true;
    },
    async stop(reason = "user") {
      if (!running) return false;
      running = false;
      await onStop?.(reason);
      return true;
    },
    isRunning: () => running,
    dispose() {
      if (running) this.stop("dispose");
    },
  };
}
