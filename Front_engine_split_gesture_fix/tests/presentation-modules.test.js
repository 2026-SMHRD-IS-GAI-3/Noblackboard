import { describe, expect, it, vi } from "vitest";
import { createSpeechAnchorEngine } from "../js/presentation/anchors.js";
import { createAnnotationEngine } from "../js/presentation/annotations.js";
import { createGestureBridge } from "../js/presentation/gestureBridge.js";
import { cancelRenderTask } from "../js/presentation/pdf.js";
import { createPermissionManager } from "../js/presentation/permissions.js";
import { createPresentationRecorder } from "../js/presentation/recorder.js";
import { createPresentationSessionController } from "../js/presentation/session.js";
import {
  createLocalWhisperSttController,
  createSpeechRecognitionController,
} from "../js/presentation/speechAnchor.js";
import { createPdfRepository } from "../js/repositories/pdfRepository.js";

function createTrack(kind) {
  const listeners = new Map();
  return {
    kind,
    readyState: "live",
    stop: vi.fn(),
    addEventListener: vi.fn((type, listener) => listeners.set(type, listener)),
    dispatch(type) {
      listeners.get(type)?.();
    },
  };
}

function createStream({ video = 0, audio = 0 } = {}) {
  const videoTracks = Array.from({ length: video }, () => createTrack("video"));
  const audioTracks = Array.from({ length: audio }, () => createTrack("audio"));
  return {
    getTracks: () => [...videoTracks, ...audioTracks],
    getVideoTracks: () => videoTracks,
    getAudioTracks: () => audioTracks,
  };
}

function createCanvas({ hasInk = true } = {}) {
  const context = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: hasInk ? new Uint8ClampedArray([0, 0, 0, 255]) : new Uint8ClampedArray([0, 0, 0, 0]),
    })),
  };
  return {
    width: 100,
    height: 80,
    style: {},
    getContext: vi.fn(() => context),
    getBoundingClientRect: vi.fn(() => ({ width: 100, height: 80 })),
    toDataURL: vi.fn(() => "data:image/png;base64,annotation"),
    context,
  };
}

describe("permission manager", () => {
  it("reports media permissions as unavailable when getUserMedia is missing", async () => {
    const manager = createPermissionManager({ mediaDevices: {} });
    const result = await manager.request();
    expect(result.webcam).toBe("unavailable");
    expect(result.microphone).toBe("unavailable");
    expect(result.videoStream).toBe(null);
    expect(manager.getState()).toEqual({ webcam: "unavailable", microphone: "unavailable" });
  });

  it("keeps webcam available when microphone is denied", async () => {
    const videoStream = createStream({ video: 1 });
    const mediaDevices = {
      getUserMedia: vi.fn()
        .mockRejectedValueOnce(new Error("combined denied"))
        .mockResolvedValueOnce(videoStream)
        .mockRejectedValueOnce(new Error("microphone denied")),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const manager = createPermissionManager({ mediaDevices });
    const result = await manager.request();
    expect(result.webcam).toBe("granted");
    expect(result.microphone).toBe("denied");
    expect(result.videoStream).toBe(videoStream);
    manager.dispose();
  });

  it("resets camera and microphone state when stopped", async () => {
    const stream = createStream({ video: 1, audio: 1 });
    const mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(stream),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const manager = createPermissionManager({ mediaDevices });
    await manager.request();
    manager.stop();
    expect(manager.getState()).toEqual({ webcam: "unknown", microphone: "unknown" });
  });

  it("disables only webcam state when the active camera track ends", async () => {
    const stream = createStream({ video: 1, audio: 1 });
    const mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(stream),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const manager = createPermissionManager({ mediaDevices });
    await manager.request();
    stream.getVideoTracks()[0].dispatch("ended");
    expect(manager.getState()).toEqual({ webcam: "unavailable", microphone: "granted" });
    manager.dispose();
  });
});

describe("presentation session controller", () => {
  it("runs lifecycle callbacks once per active session", async () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    const controller = createPresentationSessionController({ onStart, onStop });
    await controller.start();
    await controller.start();
    expect(controller.isRunning()).toBe(true);
    expect(onStart).toHaveBeenCalledOnce();
    await controller.stop("user");
    await controller.stop("user");
    expect(controller.isRunning()).toBe(false);
    expect(onStop).toHaveBeenCalledOnce();
  });
});

describe("annotation engine", () => {
  it("stores, restores, and deletes page annotations", () => {
    const drawCanvas = createCanvas();
    const pointerElement = { style: {} };
    class ImageStub {
      set src(value) {
        this.value = value;
        this.onload();
      }
    }
    const engine = createAnnotationEngine({ drawCanvas, pointerElement });
    expect(engine.savePage(2)).toBe(true);
    expect(engine.count()).toBe(1);
    const restored = vi.fn();
    expect(engine.restorePage(2, { ImageCtor: ImageStub, onRestored: restored })).toBe(true);
    expect(drawCanvas.context.drawImage).toHaveBeenCalled();
    expect(restored).toHaveBeenCalledWith(true);
    expect(engine.deletePage(2)).toBe(true);
    expect(engine.count()).toBe(0);
  });
});

describe("pdf helpers", () => {
  it("cancels render tasks without surfacing completed-task errors", () => {
    const cancel = vi.fn(() => {
      throw new Error("already complete");
    });
    expect(() => cancelRenderTask({ cancel })).not.toThrow();
    expect(cancel).toHaveBeenCalledOnce();
    expect(() => cancelRenderTask(null)).not.toThrow();
  });
});

describe("pdf repository", () => {
  it("uses memory fallback when IndexedDB is unavailable", async () => {
    const repository = createPdfRepository({ indexedDB: null });
    const saved = await repository.put({ id: "pdf-1", name: "demo.pdf", blob: new Blob(["pdf"]) });
    expect(saved.schemaVersion).toBe(1);
    expect(repository.isFallback()).toBe(true);
    await expect(repository.get("pdf-1")).resolves.toMatchObject({ id: "pdf-1", name: "demo.pdf" });
    await expect(repository.getAll()).resolves.toHaveLength(1);
    await expect(repository.delete("pdf-1")).resolves.toBe(true);
    await expect(repository.getAll()).resolves.toHaveLength(0);
  });
});

describe("gesture bridge", () => {
  it("forwards calibration and diagnostics events to the presentation API", () => {
    const eventTarget = new EventTarget();
    const presentationApi = {
      updateCalibrationState: vi.fn(),
      updateGestureDiagnostics: vi.fn(),
    };
    const bridge = createGestureBridge({ presentationApi, eventTarget });
    bridge.start();
    eventTarget.dispatchEvent(new CustomEvent("airnote:calibration-state", {
      detail: { status: "ready" },
    }));
    eventTarget.dispatchEvent(new CustomEvent("airnote:gesture-diagnostics", {
      detail: { confidence: 0.9 },
    }));
    expect(presentationApi.updateCalibrationState).toHaveBeenCalledWith({ status: "ready" });
    expect(presentationApi.updateGestureDiagnostics).toHaveBeenCalledWith({ confidence: 0.9 });
    bridge.dispose();
  });
});

describe("speech anchor engine", () => {
  it("rejects ambiguous candidates and expires the active anchor", () => {
    let current = 0;
    const engine = createSpeechAnchorEngine({ ttlMs: 100, now: () => current });
    expect(engine.select([
      { score: 0.9, anchor: { pageNo: 1, text: "첫 문장" } },
      { score: 0.85, anchor: { pageNo: 1, text: "둘째 문장" } },
    ])).toBeNull();
    engine.update({ pageNo: 1, text: "선택 문장" });
    expect(engine.getActive(1)?.text).toBe("선택 문장");
    current = 101;
    expect(engine.getActive(1)).toBeNull();
  });
});

describe("speech recognition controller", () => {
  function createRecognitionStub() {
    return class RecognitionStub {
      static instances = [];
      constructor() {
        this.start = vi.fn();
        this.stop = vi.fn();
        RecognitionStub.instances.push(this);
      }
    };
  }

  it("does not restart after a permanent permission error", () => {
    vi.useFakeTimers();
    const Recognition = createRecognitionStub();
    const onError = vi.fn();
    const controller = createSpeechRecognitionController({ Recognition, onError, baseRetryMs: 10 });
    expect(controller.start()).toBe(true);
    const instance = Recognition.instances[0];
    instance.onerror({ error: "not-allowed" });
    instance.onend();
    vi.runAllTimers();
    expect(instance.start).toHaveBeenCalledTimes(1);
    expect(controller.isRunning()).toBe(false);
    expect(onError).toHaveBeenCalledWith("not-allowed");
    vi.useRealTimers();
  });

  it("restarts transient endings and resets retry state after results", () => {
    vi.useFakeTimers();
    const Recognition = createRecognitionStub();
    const controller = createSpeechRecognitionController({ Recognition, baseRetryMs: 10, maxRetries: 2 });
    controller.start();
    const instance = Recognition.instances[0];
    instance.onend();
    vi.advanceTimersByTime(10);
    expect(instance.start).toHaveBeenCalledTimes(2);
    instance.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "인공지능" } }] });
    instance.onend();
    vi.advanceTimersByTime(10);
    expect(instance.start).toHaveBeenCalledTimes(3);
    controller.stop();
    vi.useRealTimers();
  });
});

describe("local whisper STT controller", () => {
  const jsonResponse = (body, ok = true, status = 200) => ({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  });

  class AudioContextStub {
    static processors = [];

    constructor() {
      this.sampleRate = 48000;
      this.destination = {};
    }

    createMediaStreamSource() {
      return { connect: vi.fn(), disconnect: vi.fn() };
    }

    createScriptProcessor() {
      const processor = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        onaudioprocess: null,
      };
      AudioContextStub.processors.push(processor);
      return processor;
    }

    close = vi.fn();
  }

  it("posts WAV chunks to the local STT server and emits final transcripts", async () => {
    AudioContextStub.processors = [];
    const onTranscript = vi.fn();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, text: "인공지능 발표" }));
    const mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    };
    const controller = createLocalWhisperSttController({
      AudioContext: AudioContextStub,
      fetchImpl,
      mediaDevices,
      onTranscript,
      chunkMs: 10000,
    });

    expect(controller.start()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const processor = AudioContextStub.processors[0];
    expect(processor).toBeTruthy();
    for (let frame = 0; frame < 8; frame += 1) {
      const samples = new Float32Array(4096);
      const amplitude = frame >= 2 && frame <= 5 ? 0.2 : 0.005;
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = Math.sin(index * 0.13) * amplitude;
      }
      processor.onaudioprocess({
        inputBuffer: { getChannelData: () => samples },
        outputBuffer: { getChannelData: () => new Float32Array(4096) },
      });
    }

    controller.stop();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(String(fetchImpl.mock.calls[2][0])).toBe("http://127.0.0.1:8000/stt");
    expect(onTranscript).toHaveBeenCalledWith("인공지능 발표", true);
  });

  it("skips very quiet steady noise instead of amplifying hallucinations", async () => {
    AudioContextStub.processors = [];
    const statuses = [];
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const controller = createLocalWhisperSttController({
      AudioContext: AudioContextStub,
      fetchImpl,
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
          getAudioTracks: () => [],
        }),
      },
      onStatus: (status) => statuses.push(status),
      chunkMs: 10000,
    });

    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    for (let index = 0; index < 8; index += 1) {
      AudioContextStub.processors[0].onaudioprocess({
        inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.00028) },
        outputBuffer: { getChannelData: () => new Float32Array(4096) },
      });
    }
    controller.stop();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(statuses.some((status) => status.status === "noise-skipped")).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("normalizes quiet audio when it contains speech-like level changes", async () => {
    AudioContextStub.processors = [];
    const statuses = [];
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, text: "" }));
    const controller = createLocalWhisperSttController({
      AudioContext: AudioContextStub,
      fetchImpl,
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
          getAudioTracks: () => [],
        }),
      },
      onStatus: (status) => statuses.push(status),
      chunkMs: 10000,
    });

    controller.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    for (let frame = 0; frame < 8; frame += 1) {
      const samples = new Float32Array(4096);
      const amplitude = frame >= 3 && frame <= 5 ? 0.003 : 0.0001;
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = Math.sin(index * 0.17) * amplitude;
      }
      AudioContextStub.processors[0].onaudioprocess({
        inputBuffer: { getChannelData: () => samples },
        outputBuffer: { getChannelData: () => new Float32Array(4096) },
      });
    }
    controller.stop();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const normalized = statuses.find((status) => status.status === "normalized");
    expect(normalized?.gain).toBeGreaterThan(20);
    expect(normalized?.outputLevelDb).toBeGreaterThan(-30);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("reports local STT server failures", async () => {
    const onError = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({ message: "down" }, false, 503));
    const controller = createLocalWhisperSttController({
      AudioContext: AudioContextStub,
      fetchImpl,
      mediaDevices: { getUserMedia: vi.fn() },
      onError,
    });

    expect(controller.start()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onError).toHaveBeenCalled();
    expect(controller.isRunning()).toBe(false);
  });

  it("falls back to the legacy local STT port", async () => {
    AudioContextStub.processors = [];
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error("port 5000 unavailable"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const controller = createLocalWhisperSttController({
      AudioContext: AudioContextStub,
      fetchImpl,
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
      localEndpoints: ["http://localhost:5000", "http://127.0.0.1:8000"],
    });

    expect(controller.start()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(String(fetchImpl.mock.calls[0][0])).toBe("http://localhost:5000/health");
    expect(String(fetchImpl.mock.calls[1][0])).toBe("http://127.0.0.1:8000/health");
    expect(String(fetchImpl.mock.calls[2][0])).toBe("http://127.0.0.1:8000/warmup");
    expect(controller.isRunning()).toBe(true);
    controller.dispose();
  });
});

describe("presentation recorder", () => {
  it("limits events and persists schema metadata", () => {
    const recorder = createPresentationRecorder({ maxEvents: 3 });
    recorder.start({ fileName: "demo.pdf" });
    recorder.record("pointer");
    recorder.record("pointer");
    recorder.record("pointer");
    const session = recorder.stop();
    expect(session.schemaVersion).toBe(1);
    expect(session.recording).toBe(false);
    expect(session.truncated).toBe(true);
    expect(session.events.length).toBeLessThanOrEqual(3);
  });
});
