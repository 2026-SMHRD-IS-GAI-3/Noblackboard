export function createSpeechRecognitionController({
  Recognition = window.SpeechRecognition || window.webkitSpeechRecognition,
  onTranscript,
  onError,
  maxRetries = 5,
  baseRetryMs = 350,
} = {}) {
  let recognition = null;
  let running = false;
  let retryCount = 0;
  let restartTimer = null;
  let terminalError = false;
  const terminalErrors = new Set([
    "not-allowed",
    "service-not-allowed",
    "audio-capture",
    "language-not-supported",
  ]);

  function clearRestartTimer() {
    window.clearTimeout(restartTimer);
    restartTimer = null;
  }

  function scheduleRestart() {
    if (!running || terminalError || retryCount >= maxRetries || restartTimer) return;
    const delay = Math.min(5000, baseRetryMs * (2 ** retryCount));
    retryCount += 1;
    restartTimer = window.setTimeout(() => {
      restartTimer = null;
      if (!running || terminalError) return;
      try {
        recognition.start();
      } catch (error) {
        onError?.(error);
        scheduleRestart();
      }
    }, delay);
  }

  function ensureRecognition() {
    if (!Recognition || recognition) return recognition;
    recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      retryCount = 0;
      let interim = "";
      let final = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) final += ` ${result[0]?.transcript || ""}`;
        else interim += ` ${result[0]?.transcript || ""}`;
      }
      if (final.trim()) onTranscript?.(final.trim(), true);
      else if (interim.trim()) onTranscript?.(interim.trim(), false);
    };
    recognition.onerror = (event) => {
      const error = event.error || event;
      if (terminalErrors.has(error)) {
        terminalError = true;
        running = false;
        clearRestartTimer();
      }
      onError?.(error);
    };
    recognition.onend = () => {
      scheduleRestart();
    };
    return recognition;
  }

  return {
    start() {
      const instance = ensureRecognition();
      if (!instance || running) return Boolean(instance);
      running = true;
      terminalError = false;
      retryCount = 0;
      try {
        instance.start();
      } catch (error) {
        running = false;
        onError?.(error);
        return false;
      }
      return true;
    },
    stop() {
      running = false;
      terminalError = false;
      clearRestartTimer();
      try {
        recognition?.stop();
      } catch {
        // Recognition may already be stopped.
      }
    },
    dispose() {
      this.stop();
      recognition = null;
    },
    isSupported: () => Boolean(Recognition),
    isRunning: () => running,
  };
}
