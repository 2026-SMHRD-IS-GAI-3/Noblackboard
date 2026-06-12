const DEFAULTS = Object.freeze({
  minSegmentPx: 42,
  minTotalDistancePx: 150,
  maxDurationMs: 1400,
  maxVerticalSpanPx: 130,
  minDirectionChanges: 1,
  jitterPx: 5,
  lostGraceMs: 220,
});

export function createPalmEraseGestureTracker(options = {}) {
  const config = { ...DEFAULTS, ...options };
  let state = null;
  let lastSeenAt = 0;

  function reset() {
    state = null;
    lastSeenAt = 0;
  }

  function update({
    point,
    openPalm = false,
    now = performance.now(),
    width = 1280,
    height = 720,
  } = {}) {
    if (!point || !openPalm) {
      if (state && now - lastSeenAt <= config.lostGraceMs) {
        return { tracking: true, fired: false, reason: "open_palm_grace" };
      }
      reset();
      return { tracking: false, fired: false, reason: "open_palm_lost" };
    }

    lastSeenAt = now;
    const current = {
      x: point.xRatio * width,
      y: point.yRatio * height,
    };

    if (!state || now - state.startedAt > config.maxDurationMs) {
      state = {
        startedAt: now,
        last: current,
        direction: 0,
        segmentDistance: 0,
        totalDistance: 0,
        directionChanges: 0,
        minY: current.y,
        maxY: current.y,
      };
      return { tracking: true, fired: false, reason: "tracking_started" };
    }

    const deltaX = current.x - state.last.x;
    const absoluteX = Math.abs(deltaX);
    state.last = current;
    state.minY = Math.min(state.minY, current.y);
    state.maxY = Math.max(state.maxY, current.y);

    if (absoluteX < config.jitterPx) {
      return {
        tracking: true,
        fired: false,
        reason: "jitter_ignored",
        directionChanges: state.directionChanges,
        totalDistancePx: state.totalDistance,
      };
    }

    const direction = Math.sign(deltaX);
    if (!state.direction) {
      state.direction = direction;
      state.segmentDistance = absoluteX;
    } else if (direction === state.direction) {
      state.segmentDistance += absoluteX;
    } else {
      if (state.segmentDistance >= config.minSegmentPx) state.directionChanges += 1;
      state.direction = direction;
      state.segmentDistance = absoluteX;
    }
    state.totalDistance += absoluteX;

    const verticalSpanPx = state.maxY - state.minY;
    if (verticalSpanPx > config.maxVerticalSpanPx) {
      reset();
      return { tracking: false, fired: false, reason: "vertical_span" };
    }

    const elapsedMs = now - state.startedAt;
    const fired =
      state.directionChanges >= config.minDirectionChanges &&
      state.totalDistance >= config.minTotalDistancePx &&
      state.segmentDistance >= config.minSegmentPx;

    const result = {
      tracking: !fired,
      fired,
      reason: fired ? "palm_scrub_detected" : "tracking",
      elapsedMs,
      directionChanges: state.directionChanges,
      totalDistancePx: state.totalDistance,
      verticalSpanPx,
    };
    if (fired) reset();
    return result;
  }

  return { update, reset };
}
