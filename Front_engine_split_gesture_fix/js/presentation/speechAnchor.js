const DEFAULT_LOCAL_ENDPOINT = "http://localhost:5000";
const DEFAULT_LOCAL_CHUNK_MS = 3000;
const DEFAULT_LOCAL_TIMEOUT_MS = 20000;
const MIN_AUDIO_SECONDS = 0.6;

function getRuntimeWindow() {
  return typeof window !== "undefined" ? window : globalThis;
}

function normalizeEndpoint(endpoint = DEFAULT_LOCAL_ENDPOINT) {
  return String(endpoint || DEFAULT_LOCAL_ENDPOINT).replace(/\/+$/, "");
}

function encodeWavFromFloat32Chunks(chunks, sampleRate) {
  const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  function writeString(offset, value) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, totalSamples * 2, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let index = 0; index < chunk.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[index]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function createWebSpeechController({
  Recognition = getRuntimeWindow().SpeechRecognition || getRuntimeWindow().webkitSpeechRecognition,
  onTranscript,
  onError,
  maxRetries = 5,
  baseRetryMs = 350,
} = {}) {
  const runtime = getRuntimeWindow();
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
    runtime.clearTimeout?.(restartTimer);
    restartTimer = null;
  }

  function scheduleRestart() {
    if (!running || terminalError || retryCount >= maxRetries || restartTimer) return;
    const delay = Math.min(5000, baseRetryMs * (2 ** retryCount));
    retryCount += 1;
    restartTimer = runtime.setTimeout(() => {
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

export function createLocalWhisperSttController({
  localEndpoint = DEFAULT_LOCAL_ENDPOINT,
  localEndpoints,
  chunkMs = DEFAULT_LOCAL_CHUNK_MS,
  requestTimeoutMs = DEFAULT_LOCAL_TIMEOUT_MS,
  mediaDevices = getRuntimeWindow().navigator?.mediaDevices,
  AudioContext = getRuntimeWindow().AudioContext || getRuntimeWindow().webkitAudioContext,
  fetchImpl = getRuntimeWindow().fetch?.bind(getRuntimeWindow()),
  onTranscript,
  onError,
  onStatus,
} = {}) {
  const runtime = getRuntimeWindow();
  const endpoints = [...new Set(
    (Array.isArray(localEndpoints) && localEndpoints.length ? localEndpoints : [localEndpoint])
      .map(normalizeEndpoint),
  )];
  let endpoint = endpoints[0];
  let stream = null;
  let audioContext = null;
  let source = null;
  let processor = null;
  let chunkTimer = null;
  let abortController = null;
  let running = false;
  let busy = false;
  let pendingBlob = null;
  let chunkSeq = 0;
  let sessionId = 0;
  let pcmChunks = [];
  let pcmTotalSamples = 0;
  let pcmSampleRate = 48000;

  const publish = (status, detail = {}) => onStatus?.({ provider: "local-whisper", status, ...detail });
  const resetPcm = () => {
    pcmChunks = [];
    pcmTotalSamples = 0;
  };
  const stopTracks = () => stream?.getTracks?.().forEach((track) => track.stop());

  async function requestJson(url, options = {}) {
    if (!fetchImpl) throw new Error("fetch unavailable");
    const response = await fetchImpl(url, options);
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = json.detail || json.message || json.error || `HTTP ${response.status}`;
      throw new Error(typeof detail === "string" ? detail : detail.message || JSON.stringify(detail));
    }
    return json;
  }

  async function ensureServer() {
    const errors = [];
    for (const candidate of endpoints) {
      publish("checking", { endpoint: candidate });
      const healthController = new AbortController();
      const timeoutId = runtime.setTimeout?.(() => healthController.abort(), 3000);
      try {
        await requestJson(`${candidate}/health`, {
          signal: healthController.signal,
          cache: "no-store",
        });
        publish("warming", { endpoint: candidate });
        await requestJson(`${candidate}/warmup`, { method: "POST" });
        endpoint = candidate;
        return;
      } catch (error) {
        errors.push(error?.name === "AbortError"
          ? `${candidate}: server is not responding`
          : `${candidate}: ${error.message || error}`);
      } finally {
        runtime.clearTimeout?.(timeoutId);
      }
    }
    throw new Error(`local STT health check failed: ${errors.join(" | ")}`);
  }

  function buildAndResetWavBlob() {
    if (!pcmChunks.length || pcmTotalSamples < pcmSampleRate * MIN_AUDIO_SECONDS) {
      resetPcm();
      return null;
    }
    const chunks = pcmChunks;
    const sampleRate = pcmSampleRate;
    resetPcm();
    return encodeWavFromFloat32Chunks(chunks, sampleRate);
  }

  function flushChunk() {
    const blob = buildAndResetWavBlob();
    if (!blob || blob.size === 0) {
      publish("chunk-skipped", { reason: "too_small" });
      return;
    }
    if (busy) {
      pendingBlob = blob;
      publish("chunk-pending", { byteSize: blob.size });
      return;
    }
    void sendBlob(blob, sessionId);
  }

  async function sendBlob(blob, activeSessionId) {
    if (!blob?.size) return;
    busy = true;
    const requestStartedAt = performance.now?.() || Date.now();
    const currentChunk = ++chunkSeq;
    const controller = new AbortController();
    abortController = controller;
    const timeoutId = runtime.setTimeout?.(() => controller.abort(), requestTimeoutMs);

    try {
      publish("transcribing", { chunk: currentChunk, byteSize: blob.size });
      const formData = new FormData();
      formData.append("audio", blob, `speech_${currentChunk}.wav`);
      const response = await fetchImpl(`${endpoint}/stt`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = result.detail || result.message || result.error || `HTTP ${response.status}`;
        throw new Error(typeof detail === "string" ? detail : detail.message || JSON.stringify(detail));
      }
      if (activeSessionId !== sessionId) return;

      const text = String(result.text || "").replace(/\s+/g, " ").trim();
      const elapsedMs = Math.round((performance.now?.() || Date.now()) - requestStartedAt);
      if (!text) {
        publish("empty", { chunk: currentChunk, elapsedMs });
        return;
      }
      publish("transcribed", { chunk: currentChunk, elapsedMs, text });
      onTranscript?.(text, true);
    } catch (error) {
      if (activeSessionId === sessionId) {
        publish("error", { error });
        onError?.(error?.name === "AbortError" ? "local-stt-timeout" : error);
      }
    } finally {
      runtime.clearTimeout?.(timeoutId);
      if (abortController === controller) abortController = null;
      if (activeSessionId !== sessionId) return;
      busy = false;
      if (running && pendingBlob) {
        const nextBlob = pendingBlob;
        pendingBlob = null;
        void sendBlob(nextBlob, activeSessionId);
      }
    }
  }

  function startPcmCapture() {
    audioContext = new AudioContext();
    pcmSampleRate = audioContext.sampleRate || pcmSampleRate;
    source = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      if (!running) return;
      const input = event.inputBuffer.getChannelData(0);
      const copied = new Float32Array(input.length);
      copied.set(input);
      pcmChunks.push(copied);
      pcmTotalSamples += copied.length;
      event.outputBuffer?.getChannelData?.(0)?.fill?.(0);
    };
    source.connect(processor);
    processor.connect(audioContext.destination);
    chunkTimer = runtime.setInterval?.(() => {
      if (running) flushChunk();
    }, chunkMs);
  }

  async function startAsync() {
    try {
      await ensureServer();
      if (!running) return;
      publish("requesting-microphone");
      stream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (!running) {
        stopTracks();
        return;
      }
      chunkSeq = 0;
      pendingBlob = null;
      resetPcm();
      startPcmCapture();
      publish("running", { chunkMs, endpoint: `${endpoint}/stt` });
    } catch (error) {
      running = false;
      publish("error", { error });
      onError?.(error);
      cleanup(false);
    }
  }

  function cleanup(flush = true) {
    const shouldFlush = flush && running;
    if (shouldFlush) flushChunk();
    running = false;
    if (!shouldFlush) sessionId += 1;
    if (!shouldFlush && abortController) {
      abortController.abort();
      abortController = null;
    }
    if (chunkTimer) runtime.clearInterval?.(chunkTimer);
    chunkTimer = null;
    try {
      processor?.disconnect?.();
    } catch {
      // ignore disconnect failures
    }
    try {
      source?.disconnect?.();
    } catch {
      // ignore disconnect failures
    }
    try {
      audioContext?.close?.();
    } catch {
      // ignore close failures
    }
    stopTracks();
    processor = null;
    source = null;
    audioContext = null;
    stream = null;
    busy = false;
    pendingBlob = null;
    resetPcm();
    publish("stopped");
  }

  return {
    start() {
      if (running) return true;
      if (!this.isSupported()) {
        onError?.("local-stt-unsupported");
        return false;
      }
      running = true;
      sessionId += 1;
      void startAsync();
      return true;
    },
    stop() {
      cleanup(true);
    },
    dispose() {
      cleanup(false);
    },
    isSupported: () => Boolean(fetchImpl && mediaDevices?.getUserMedia && AudioContext),
    isRunning: () => running,
  };
}

export function createSpeechRecognitionController({
  provider = "auto",
  localEndpoint = DEFAULT_LOCAL_ENDPOINT,
  Recognition = getRuntimeWindow().SpeechRecognition || getRuntimeWindow().webkitSpeechRecognition,
  onTranscript,
  onError,
  onStatus,
  maxRetries = 5,
  baseRetryMs = 350,
  ...localOptions
} = {}) {
  let activeProvider = null;
  let localController = null;
  let webController = null;

  const createWeb = () => {
    webController = webController || createWebSpeechController({
      Recognition,
      onTranscript,
      onError,
      maxRetries,
      baseRetryMs,
    });
    return webController;
  };

  const startWebFallback = () => {
    if (provider !== "auto" || activeProvider === "web-speech") return false;
    const web = createWeb();
    if (!web.isSupported()) {
      activeProvider = null;
      onStatus?.({ provider: "none", status: "disabled" });
      return false;
    }
    activeProvider = "web-speech";
    onStatus?.({ provider: "web-speech", status: "fallback" });
    return web.start();
  };

  const createLocal = () => {
    localController = localController || createLocalWhisperSttController({
      localEndpoint,
      onTranscript,
      onStatus,
      onError: (error) => {
        onError?.(error);
        if (!startWebFallback()) onStatus?.({ provider: "none", status: "disabled", error });
      },
      ...localOptions,
    });
    return localController;
  };

  return {
    start() {
      if (provider === "web-speech") {
        activeProvider = "web-speech";
        return createWeb().start();
      }
      const local = createLocal();
      if (local.isSupported()) {
        activeProvider = "local-whisper";
        return local.start();
      }
      if (provider === "local-whisper") {
        onError?.("local-stt-unsupported");
        return false;
      }
      return startWebFallback();
    },
    stop() {
      localController?.stop();
      webController?.stop();
      activeProvider = null;
    },
    dispose() {
      localController?.dispose();
      webController?.dispose();
      localController = null;
      webController = null;
      activeProvider = null;
    },
    isSupported: () => {
      if (provider === "web-speech") return createWeb().isSupported();
      if (provider === "local-whisper") return createLocal().isSupported();
      return createLocal().isSupported() || createWeb().isSupported();
    },
    isRunning: () => (
      activeProvider === "local-whisper"
        ? Boolean(localController?.isRunning())
        : activeProvider === "web-speech"
          ? Boolean(webController?.isRunning())
          : false
    ),
    getProvider: () => activeProvider,
  };
}
