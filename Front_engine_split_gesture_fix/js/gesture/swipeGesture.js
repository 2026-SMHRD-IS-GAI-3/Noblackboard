const DEFAULTS = Object.freeze({
  minShapeScore: 0.52,
  minFinalScore: 0.75,
  minDistancePx: 150,
  maxDurationMs: 300,
  maxVerticalDriftPx: 110,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreThreshold(value, min, good) {
  if (min === good) return value >= good ? 1 : 0;
  return clamp((value - min) / (good - min), 0, 1);
}

export function createSwipeGestureTracker(options = {}) {
  const config = { ...DEFAULTS, ...options };
  let start = null;

  function reset() {
    start = null;
  }

  function update({
    point,
    shapeScore = 0,
    now = performance.now(),
    width = 1280,
    height = 720,
    minDistancePx = config.minDistancePx,
    maxVerticalDriftPx = config.maxVerticalDriftPx,
  } = {}) {
    if (!point || shapeScore < config.minShapeScore) {
      reset();
      return { tracking: false, fired: false, reason: "shape_below_threshold" };
    }

    if (!start) {
      start = { ...point, at: now, shapeScore };
      return {
        tracking: true,
        fired: false,
        reason: "tracking_started",
        shapeScore,
        motionScore: 0,
        finalScore: shapeScore * 0.5,
      };
    }

    const elapsedMs = Math.max(0, now - start.at);
    const deltaX = point.xRatio - start.xRatio;
    const deltaY = Math.abs(point.yRatio - start.yRatio);
    const distancePx = deltaX * width;
    const verticalDriftPx = deltaY * height;

    if (elapsedMs > config.maxDurationMs) {
      start = { ...point, at: now, shapeScore };
      return {
        tracking: true,
        fired: false,
        reason: "tracking_restarted_after_timeout",
        elapsedMs,
        distancePx,
        verticalDriftPx,
        shapeScore,
        motionScore: 0,
        finalScore: shapeScore * 0.5,
      };
    }

    if (distancePx < -minDistancePx * 0.35 || verticalDriftPx > maxVerticalDriftPx) {
      reset();
      return {
        tracking: false,
        fired: false,
        reason: distancePx < 0 ? "wrong_direction" : "vertical_drift",
        elapsedMs,
        distancePx,
        verticalDriftPx,
      };
    }

    const motionScore = Math.min(
      scoreThreshold(distancePx, minDistancePx * 0.55, minDistancePx),
      scoreThreshold(maxVerticalDriftPx - verticalDriftPx, 0, maxVerticalDriftPx * 0.65),
      scoreThreshold(config.maxDurationMs - elapsedMs, 0, config.maxDurationMs * 0.45),
    );
    const averagedShapeScore = (start.shapeScore + shapeScore) / 2;
    const finalScore = averagedShapeScore * 0.5 + motionScore * 0.5;
    const fired =
      distancePx >= minDistancePx &&
      verticalDriftPx <= maxVerticalDriftPx &&
      elapsedMs <= config.maxDurationMs &&
      finalScore >= config.minFinalScore;

    if (fired) reset();

    return {
      tracking: !fired,
      fired,
      reason: fired ? "score_threshold_met" : "tracking",
      elapsedMs,
      deltaX,
      deltaY,
      distancePx,
      verticalDriftPx,
      shapeScore: averagedShapeScore,
      motionScore,
      finalScore,
    };
  }

  return {
    update,
    reset,
    isTracking: () => Boolean(start),
    getState: () => (start ? { ...start } : null),
  };
}
