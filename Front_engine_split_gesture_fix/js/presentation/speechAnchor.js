const DEFAULT_LOCAL_ENDPOINT = "http://127.0.0.1:8000";
// 이슈 3: 청크를 1.5초로 낮춰 "세 번째 항목" 같은 짧은 명령의 반응 지연을 줄인다.
// (긴 판서 문장용으로 3초가 필요하면 createSpeechRecognitionController({ chunkMs }) /
//  createLocalWhisperSttController({ chunkMs })로 호출부에서 선택적으로 덮어쓸 수 있다.)
const DEFAULT_LOCAL_CHUNK_MS = 1500;
const DEFAULT_LOCAL_TIMEOUT_MS = 30000;
// 이슈 4: "저기"·"여기"처럼 0.2~0.3초짜리 초단발 명령어가 noise로 폐기되지 않도록
// 영구 완화한다. 최소 길이는 0.2초로 낮추고, 에너지 게이트(peak·dynamic)는 현재 대비
// 약 10~12% 낮춘다. 단, 잡음 오트리거를 막는 핵심 변별자인 crest factor(말소리/잡음 구분)는
// 그대로 유지해 균형을 잡는다.
const MIN_AUDIO_SECONDS = 0.2;
const TARGET_AUDIO_RMS = 0.06;
const MAX_AUDIO_GAIN = 96;
const MIN_NORMALIZABLE_RMS = 0.00003;
const MIN_SPEECH_PEAK = 0.0004;        // 0.00045 → 0.0004 (≈11% 완화)
const MIN_SPEECH_CREST_FACTOR = 1.6;   // 잡음 변별자 — 유지(민감도 과다 방지)
const MIN_SPEECH_DYNAMIC_DB = 4.5;     // 5 → 4.5 (10% 완화)
const OVERLAP_SECONDS = 0.25;          // 청크 경계 단어 잘림 방지 오버랩
const TARGET_SAMPLE_RATE = 16000;      // Whisper 내부 처리 SR — 업로드 전 다운샘플
const WARMUP_TIMEOUT_MS = 60000;       // GPU 모델 로딩 최대 대기
const MAX_PENDING_QUEUE = 3;           // 처리 지연 시 최대 버퍼 청크 수

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

function extractTailSamples(chunks, targetSamples) {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  if (total <= targetSamples) return chunks.map((c) => c.slice());
  const startSample = total - targetSamples;
  const result = [];
  let seen = 0;
  for (const chunk of chunks) {
    const end = seen + chunk.length;
    if (end > startSample) result.push(chunk.slice(Math.max(0, startSample - seen)));
    seen = end;
  }
  return result;
}

function downsampleFloat32(input, inputRate, outputRate) {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    output[i] = input[idx] + frac * ((input[idx + 1] ?? input[idx]) - input[idx]);
  }
  return output;
}

function normalizeAudioChunks(chunks) {
  let squareSum = 0;
  let peak = 0;
  let sampleCount = 0;
  const frameRmsValues = [];

  for (const chunk of chunks) {
    let frameSquareSum = 0;
    sampleCount += chunk.length;
    for (let index = 0; index < chunk.length; index += 1) {
      const sample = chunk[index];
      squareSum += sample * sample;
      frameSquareSum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    frameRmsValues.push(Math.sqrt(frameSquareSum / Math.max(1, chunk.length)));
  }

  const rms = Math.sqrt(squareSum / Math.max(1, sampleCount));
  const inputLevelDb = 20 * Math.log10(Math.max(rms, 0.000001));
  const sortedFrameRms = [...frameRmsValues].sort((left, right) => left - right);
  const noiseFloorRms = sortedFrameRms[Math.floor(sortedFrameRms.length * 0.2)] || rms;
  const maxFrameRms = sortedFrameRms[sortedFrameRms.length - 1] || rms;
  const dynamicDb = 20 * Math.log10(
    Math.max(maxFrameRms, 0.000001) / Math.max(noiseFloorRms, 0.000001),
  );
  const crestFactor = peak / Math.max(rms, 0.000001);
  const speechLike = peak >= MIN_SPEECH_PEAK &&
    crestFactor >= MIN_SPEECH_CREST_FACTOR &&
    dynamicDb >= MIN_SPEECH_DYNAMIC_DB;

  if (!speechLike) {
    return {
      chunks,
      gain: 1,
      inputLevelDb,
      outputLevelDb: inputLevelDb,
      speechLike: false,
      peak,
      crestFactor,
      dynamicDb,
    };
  }
  if (rms < MIN_NORMALIZABLE_RMS || rms >= TARGET_AUDIO_RMS || peak <= 0) {
    return {
      chunks,
      gain: 1,
      inputLevelDb,
      outputLevelDb: inputLevelDb,
      speechLike: true,
      peak,
      crestFactor,
      dynamicDb,
    };
  }

  const targetGain = TARGET_AUDIO_RMS / rms;
  const clippingSafeGain = 0.95 / peak;
  const gain = Math.max(1, Math.min(MAX_AUDIO_GAIN, targetGain, clippingSafeGain));
  if (gain <= 1.01) {
    // 음성은 감지됐으나 증폭이 불필요한 경우. speechLike/peak 등을 반드시 포함해야
    // 호출부가 노이즈로 오판해 폐기하거나 toFixed에서 크래시하지 않는다.
    return {
      chunks,
      gain: 1,
      inputLevelDb,
      outputLevelDb: inputLevelDb,
      speechLike: true,
      peak,
      crestFactor,
      dynamicDb,
    };
  }

  const normalized = chunks.map((chunk) => {
    const output = new Float32Array(chunk.length);
    for (let index = 0; index < chunk.length; index += 1) {
      output[index] = Math.max(-1, Math.min(1, chunk[index] * gain));
    }
    return output;
  });
  return {
    chunks: normalized,
    gain,
    inputLevelDb,
    outputLevelDb: inputLevelDb + 20 * Math.log10(gain),
    speechLike: true,
    peak,
    crestFactor,
    dynamicDb,
  };
}

function estimateNormalizedLevel(rms, peak) {
  const inputLevelDb = 20 * Math.log10(Math.max(rms, 0.000001));
  if (rms < MIN_NORMALIZABLE_RMS || rms >= TARGET_AUDIO_RMS || peak <= 0) {
    return { gain: 1, inputLevelDb, outputLevelDb: inputLevelDb };
  }
  const gain = Math.max(1, Math.min(
    MAX_AUDIO_GAIN,
    TARGET_AUDIO_RMS / rms,
    0.95 / peak,
  ));
  return {
    gain,
    inputLevelDb,
    outputLevelDb: inputLevelDb + 20 * Math.log10(gain),
  };
}

function createWebSpeechController({
  Recognition = getRuntimeWindow().SpeechRecognition || getRuntimeWindow().webkitSpeechRecognition,
  onTranscript,
  onError,
  onStatus,
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
      if (final.trim()) {
        onStatus?.({ provider: "web-speech", status: "transcribed", text: final.trim(), isFinal: true });
        onTranscript?.(final.trim(), true);
      } else if (interim.trim()) {
        onStatus?.({ provider: "web-speech", status: "transcribing", text: interim.trim(), isFinal: false });
        onTranscript?.(interim.trim(), false);
      }
    };
    recognition.onerror = (event) => {
      const error = event.error || event;
      if (terminalErrors.has(error)) {
        terminalError = true;
        running = false;
        clearRestartTimer();
      }
      onStatus?.({ provider: "web-speech", status: "error", error });
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
        onStatus?.({ provider: "web-speech", status: "running" });
      } catch (error) {
        running = false;
        onStatus?.({ provider: "web-speech", status: "error", error });
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
      onStatus?.({ provider: "web-speech", status: "stopped" });
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
  audioDeviceId = "",
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
  let pendingQueue = [];
  let chunkSeq = 0;
  let sessionId = 0;
  let pcmChunks = [];
  let pcmTotalSamples = 0;
  let pcmSampleRate = 48000;
  let droppedChunkCount = 0;

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
      const warmupController = new AbortController();
      const healthTimeoutId = runtime.setTimeout?.(() => healthController.abort(), 3000);
      let warmupTimeoutId = null;
      try {
        await requestJson(`${candidate}/health`, {
          signal: healthController.signal,
          cache: "no-store",
        });
        publish("warming", { endpoint: candidate });
        warmupTimeoutId = runtime.setTimeout?.(() => warmupController.abort(), WARMUP_TIMEOUT_MS);
        await requestJson(`${candidate}/warmup`, { method: "POST", signal: warmupController.signal });
        endpoint = candidate;
        return;
      } catch (error) {
        errors.push(error?.name === "AbortError"
          ? `${candidate}: server is not responding`
          : `${candidate}: ${error.message || error}`);
      } finally {
        runtime.clearTimeout?.(healthTimeoutId);
        runtime.clearTimeout?.(warmupTimeoutId);
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
    const normalized = normalizeAudioChunks(chunks);
    if (!normalized.speechLike) {
      const safe = (value, digits) => Number(Number(value ?? 0).toFixed(digits));
      droppedChunkCount += 1;
      if (droppedChunkCount === 1 || droppedChunkCount % 8 === 0) {
        console.warn(
          `[AirNote STT] 음성으로 인식되지 않아 청크 폐기 (누적 ${droppedChunkCount}회). ` +
          `peak=${safe(normalized.peak, 5)}(>=${MIN_SPEECH_PEAK}), ` +
          `crest=${safe(normalized.crestFactor, 2)}(>=${MIN_SPEECH_CREST_FACTOR}), ` +
          `dynamicDb=${safe(normalized.dynamicDb, 1)}(>=${MIN_SPEECH_DYNAMIC_DB}) — ` +
          "마이크 게인이 낮거나 너무 작게 말하면 게이트에 걸립니다.",
        );
      }
      publish("noise-skipped", {
        inputLevelDb: safe(normalized.inputLevelDb, 1),
        peak: safe(normalized.peak, 5),
        crestFactor: safe(normalized.crestFactor, 1),
        dynamicDb: safe(normalized.dynamicDb, 1),
      });
      return null;
    }
    if (normalized.gain > 1) {
      publish("normalized", {
        gain: Number(normalized.gain.toFixed(1)),
        inputLevelDb: Number(normalized.inputLevelDb.toFixed(1)),
        outputLevelDb: Number(normalized.outputLevelDb.toFixed(1)),
      });
    }
    droppedChunkCount = 0;
    // 오버랩: 경계 단어 잘림 방지 — 마지막 OVERLAP_SECONDS 분량을 다음 청크 시작에 넘긴다.
    const overlapChunks = extractTailSamples(normalized.chunks, Math.floor(sampleRate * OVERLAP_SECONDS));
    for (const c of overlapChunks) {
      pcmChunks.push(c);
      pcmTotalSamples += c.length;
    }
    // 16kHz 다운샘플: Whisper 내부 SR이 16kHz이므로 업로드 전 변환해 대역폭을 3배 줄인다.
    const outputRate = sampleRate > TARGET_SAMPLE_RATE ? TARGET_SAMPLE_RATE : sampleRate;
    const outputChunks = outputRate < sampleRate
      ? normalized.chunks.map((c) => downsampleFloat32(c, sampleRate, outputRate))
      : normalized.chunks;
    return encodeWavFromFloat32Chunks(outputChunks, outputRate);
  }

  function flushChunk() {
    const blob = buildAndResetWavBlob();
    if (!blob || blob.size === 0) {
      publish("chunk-skipped", { reason: "too_small_or_noise" });
      return;
    }
    if (busy) {
      if (pendingQueue.length >= MAX_PENDING_QUEUE) {
        const dropped = pendingQueue.shift();
        console.warn(
          `[AirNote STT] 처리 지연으로 청크 드롭 (큐 상한 ${MAX_PENDING_QUEUE}). byteSize=${dropped.size}`,
        );
        publish("chunk-dropped", { byteSize: dropped.size, queueLen: pendingQueue.length });
      }
      pendingQueue.push(blob);
      publish("chunk-pending", { byteSize: blob.size, queueLen: pendingQueue.length });
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
        publish("empty", {
          chunk: currentChunk,
          elapsedMs,
          transcribeMode: result.transcribe_mode || "unknown",
        });
        return;
      }
      publish("transcribed", {
        chunk: currentChunk,
        elapsedMs,
        text,
        transcribeMode: result.transcribe_mode || "unknown",
      });
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
      if (running && pendingQueue.length > 0) {
        void sendBlob(pendingQueue.shift(), activeSessionId);
      }
    }
  }

  function attachResumeOnGesture() {
    // await 체인을 거치며 사용자 제스처 활성화가 만료되면 resume()이 무시되어
    // AudioContext가 suspended로 남고 onaudioprocess가 영영 불리지 않는다.
    // 다음 사용자 입력(클릭/터치/키)에서 한 번 더 resume을 시도해 자동 복구한다.
    const runtimeDoc = runtime.document;
    if (!runtimeDoc?.addEventListener) return;
    const resume = () => {
      audioContext?.resume?.().then(() => {
        if (audioContext?.state === "running") {
          publish("audio-resumed", { audioState: audioContext.state });
        }
      }).catch(() => {});
      runtimeDoc.removeEventListener("pointerdown", resume, true);
      runtimeDoc.removeEventListener("keydown", resume, true);
    };
    runtimeDoc.addEventListener("pointerdown", resume, true);
    runtimeDoc.addEventListener("keydown", resume, true);
  }

  async function ensureAudioContext() {
    audioContext = audioContext || new AudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume?.().catch(() => {});
    }
    if (audioContext.state === "suspended") {
      // resume이 거부됨(제스처 만료). 캡처가 시작돼도 소리가 들어오지 않으므로
      // 조용히 실패하지 말고 명확히 알리고, 다음 제스처에서 복구를 건다.
      console.warn(
        "[AirNote STT] AudioContext가 suspended 상태입니다. 마이크 입력이 캡처되지 않습니다. " +
        "화면을 한 번 클릭하면 자동으로 재개됩니다.",
      );
      publish("audio-suspended", { audioState: audioContext.state });
      attachResumeOnGesture();
    }
    publish("audio-ready", {
      audioState: audioContext.state || "unknown",
      sampleRate: audioContext.sampleRate,
    });
    return audioContext;
  }

  function startPcmCapture() {
    pcmSampleRate = audioContext.sampleRate || pcmSampleRate;
    source = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    let sampleEvents = 0;
    processor.onaudioprocess = (event) => {
      if (!running) return;
      const input = event.inputBuffer.getChannelData(0);
      const copied = new Float32Array(input.length);
      copied.set(input);
      let squareSum = 0;
      let peak = 0;
      for (let index = 0; index < input.length; index += 1) {
        const absolute = Math.abs(input[index]);
        squareSum += input[index] * input[index];
        peak = Math.max(peak, absolute);
      }
      const rms = Math.sqrt(squareSum / Math.max(1, input.length));
      const levelDb = 20 * Math.log10(Math.max(rms, 0.000001));
      const normalizedEstimate = estimateNormalizedLevel(rms, peak);
      pcmChunks.push(copied);
      pcmTotalSamples += copied.length;
      sampleEvents += 1;
      if (sampleEvents === 1 || sampleEvents % 24 === 0) {
        publish("capturing", {
          sampleEvents,
          sampleCount: pcmTotalSamples,
          seconds: Number((pcmTotalSamples / pcmSampleRate).toFixed(2)),
          levelDb: Number(levelDb.toFixed(1)),
          estimatedGain: Number(normalizedEstimate.gain.toFixed(1)),
          estimatedOutputLevelDb: Number(normalizedEstimate.outputLevelDb.toFixed(1)),
          peak: Number(peak.toFixed(4)),
        });
      }
      event.outputBuffer?.getChannelData?.(0)?.fill?.(0);
    };
    source.connect(processor);
    processor.connect(audioContext.destination);
    // 워치독: 캡처 시작 후에도 onaudioprocess가 한 번도 안 불리거나(=suspended/장치문제)
    // 입력이 줄곧 무음이면 조용히 실패하므로 콘솔에 한 번 경고한다.
    let capturePeak = 0;
    const baseOnAudioProcess = processor.onaudioprocess;
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      for (let index = 0; index < input.length; index += 1) {
        const absolute = Math.abs(input[index]);
        if (absolute > capturePeak) capturePeak = absolute;
      }
      baseOnAudioProcess(event);
    };
    let watchdogFired = false;
    const captureStartedAt = performance.now?.() || 0;
    const watchdog = runtime.setInterval?.(() => {
      if (!running || watchdogFired) {
        runtime.clearInterval?.(watchdog);
        return;
      }
      const elapsed = (performance.now?.() || 0) - captureStartedAt;
      if (elapsed < chunkMs * 2) return;
      watchdogFired = true;
      runtime.clearInterval?.(watchdog);
      if (sampleEvents === 0) {
        console.warn(
          "[AirNote STT] 마이크에서 오디오 프레임이 전혀 들어오지 않습니다. " +
          `AudioContext.state=${audioContext?.state}. suspended이면 화면을 클릭하세요.`,
        );
        publish("capture-stalled", { reason: "no_audio_events", audioState: audioContext?.state });
      } else if (capturePeak < MIN_SPEECH_PEAK) {
        console.warn(
          `[AirNote STT] 마이크 입력이 사실상 무음입니다(peak=${capturePeak.toFixed(5)}). ` +
          "OS 음소거 또는 다른 입력 장치 선택 여부를 확인하세요.",
        );
        publish("capture-silent", { reason: "input_near_silent", peak: Number(capturePeak.toFixed(5)) });
      }
    }, chunkMs);
    chunkTimer = runtime.setInterval?.(() => {
      if (running) flushChunk();
    }, chunkMs);
  }

  async function startAsync() {
    try {
      console.info("[AirNote STT] startAsync: AudioContext 준비 시작…");
      await ensureAudioContext();
      console.info("[AirNote STT] startAsync: 서버 health/warmup 확인 시작…", { endpoints });
      await ensureServer();
      console.info("[AirNote STT] startAsync: 서버 OK →", endpoint, "/ 마이크 요청…");
      if (!running) return;
      publish("requesting-microphone");
      stream = await mediaDevices.getUserMedia({
        audio: {
          ...(audioDeviceId ? { deviceId: { exact: audioDeviceId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
      if (!running) {
        stopTracks();
        return;
      }
      chunkSeq = 0;
      pendingQueue = [];
      resetPcm();
      startPcmCapture();
      const audioTrack = stream.getAudioTracks?.()[0];
      console.info("[AirNote STT] startAsync: 캡처 시작됨 ✅ device=", audioTrack?.label || "(이름없음)",
        "audioState=", audioContext?.state);
      publish("running", {
        chunkMs,
        endpoint: `${endpoint}/stt`,
        deviceLabel: audioTrack?.label || "",
        settings: audioTrack?.getSettings?.() || {},
      });
    } catch (error) {
      running = false;
      console.warn("[AirNote STT] startAsync 실패:", error?.message || error);
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
    pendingQueue = [];
    resetPcm();
    publish("stopped");
  }

  return {
    start() {
      console.info("[AirNote STT] local controller.start() 진입. running=", running,
        "supported=", this.isSupported());
      if (running) return true;
      if (!this.isSupported()) {
        console.warn("[AirNote STT] 미지원 환경: fetch/getUserMedia/AudioContext 중 일부 없음.", {
          fetch: Boolean(fetchImpl),
          getUserMedia: Boolean(mediaDevices?.getUserMedia),
          AudioContext: Boolean(AudioContext),
        });
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
      onStatus,
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
