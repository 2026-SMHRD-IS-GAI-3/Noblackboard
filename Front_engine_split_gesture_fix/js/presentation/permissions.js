const PERMISSION_STATUS = Object.freeze({
  unknown: "unknown",
  granted: "granted",
  denied: "denied",
  unavailable: "unavailable",
});

const CAMERA_VIDEO_CONSTRAINTS_FALLBACKS = Object.freeze([
  {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    aspectRatio: { ideal: 16 / 9 },
    frameRate: { ideal: 30, max: 30 },
  },
  {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    aspectRatio: { ideal: 16 / 9 },
    frameRate: { ideal: 30, max: 30 },
  },
  {
    width: { ideal: 960 },
    height: { ideal: 540 },
    aspectRatio: { ideal: 16 / 9 },
    frameRate: { ideal: 30, max: 30 },
  },
  true,
]);

export function createPermissionManager({ mediaDevices = null } = {}) {
  let videoStream = null;
  let state = { webcam: PERMISSION_STATUS.unknown, microphone: PERMISSION_STATUS.unknown };
  const listeners = new Set();

  const publish = () => listeners.forEach((listener) => listener({ ...state }));
  const stopTracks = (stream) => stream?.getTracks?.().forEach((track) => track.stop());
  const getMediaDevices = () => mediaDevices || globalThis.navigator?.mediaDevices;

  async function requestCameraStream(audio = false) {
    const currentMediaDevices = getMediaDevices();
    let lastError = null;
    for (const video of CAMERA_VIDEO_CONSTRAINTS_FALLBACKS) {
      try {
        return await currentMediaDevices.getUserMedia({ video, audio });
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Camera unavailable");
  }

  async function requestOne(kind) {
    const currentMediaDevices = getMediaDevices();
    if (!currentMediaDevices?.getUserMedia) return { status: PERMISSION_STATUS.unavailable, stream: null, error: null };
    try {
      const stream = kind === "webcam"
        ? await requestCameraStream(false)
        : await currentMediaDevices.getUserMedia({ video: false, audio: true });
      return { status: PERMISSION_STATUS.granted, stream, error: null };
    } catch (error) {
      return { status: PERMISSION_STATUS.denied, stream: null, error };
    }
  }

  async function request() {
    const currentMediaDevices = getMediaDevices();
    if (!currentMediaDevices?.getUserMedia) {
      state = { webcam: PERMISSION_STATUS.unavailable, microphone: PERMISSION_STATUS.unavailable };
      publish();
      return { ...state, videoStream: null };
    }
    let errors = { webcam: null, microphone: null };
    try {
      const stream = await currentMediaDevices.getUserMedia({
        video: CAMERA_VIDEO_CONSTRAINTS_FALLBACKS[0],
        audio: true,
      });
      stopTracks(videoStream);
      stream.getAudioTracks().forEach((track) => track.stop());
      videoStream = typeof MediaStream === "function"
        ? new MediaStream(stream.getVideoTracks())
        : stream;
      state = { webcam: PERMISSION_STATUS.granted, microphone: PERMISSION_STATUS.granted };
    } catch (error) {
      const [webcam, microphone] = await Promise.all([requestOne("webcam"), requestOne("microphone")]);
      stopTracks(videoStream);
      videoStream = webcam.stream;
      stopTracks(microphone.stream);
      errors = { webcam: webcam.error || error, microphone: microphone.error || error };
      state = { webcam: webcam.status, microphone: microphone.status };
    }
    videoStream?.getVideoTracks?.().forEach((track) => {
      track.addEventListener?.("ended", () => {
        state = { ...state, webcam: PERMISSION_STATUS.unavailable };
        publish();
      }, { once: true });
    });
    publish();
    return { ...state, videoStream, errors };
  }

  const onDeviceChange = () => publish();
  getMediaDevices()?.addEventListener?.("devicechange", onDeviceChange);

  return {
    request,
    getState: () => ({ ...state }),
    getVideoStream: () => videoStream,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop() {
      stopTracks(videoStream);
      videoStream = null;
      state = { webcam: PERMISSION_STATUS.unknown, microphone: PERMISSION_STATUS.unknown };
      publish();
    },
    dispose() {
      this.stop();
      listeners.clear();
      getMediaDevices()?.removeEventListener?.("devicechange", onDeviceChange);
    },
  };
}

export { PERMISSION_STATUS };
