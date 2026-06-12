const DEFAULTS = Object.freeze({
  minShapeScore: 0.52,
  minFinalScore: 0.75,
  minDistancePx: 150,
  maxDurationMs: 300,
  maxVerticalDriftPx: 110,
  armFrames: 0,
  armMs: 0,
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
  let arming = null;

  function reset() {
    start = null;
    arming = null;
  }

  function update({
    point,
    shapeScore = 0,
    now = performance.now(),
    width = 1280,
    height = 720,
    minDistancePx = config.minDistancePx,
    maxVerticalDriftPx = config.maxVerticalDriftPx,
    minShapeScore = config.minShapeScore,
    minFinalScore = config.minFinalScore,
    maxDurationMs = config.maxDurationMs,
    armFrames = config.armFrames,
    armMs = config.armMs,
  } = {}) {
    if (!point || shapeScore < minShapeScore) {
      reset();
      return { tracking: false, fired: false, reason: "shape_below_threshold" };
    }

    if ((armFrames > 0 || armMs > 0) && !start) {
      if (!arming) {
        arming = {
          point: { ...point },
          at: now,
          frames: 1,
          shapeScore,
        };
        return {
          tracking: true,
          armed: false,
          fired: false,
          reason: "arming_started",
          shapeScore,
          motionScore: 0,
          finalScore: shapeScore * 0.5,
        };
      }

      arming.frames += 1;
      arming.shapeScore = Math.max(arming.shapeScore, shapeScore);
      const elapsedArmingMs = Math.max(0, now - arming.at);
      const readyByFrames = armFrames > 0 && arming.frames >= armFrames;
      const readyByTime = armMs > 0 && elapsedArmingMs >= armMs;
      if (!readyByFrames && !readyByTime) {
        return {
          tracking: true,
          armed: false,
          fired: false,
          reason: "arming",
          elapsedMs: elapsedArmingMs,
          shapeScore: arming.shapeScore,
          motionScore: 0,
          finalScore: arming.shapeScore * 0.5,
        };
      }

      start = {
        ...arming.point,
        at: arming.at,
        shapeScore: arming.shapeScore,
      };
      arming = null;
    }

    if (!start) {
      start = { ...point, at: now, shapeScore };
      return {
        tracking: true,
        armed: true,
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

    if (elapsedMs > maxDurationMs) {
      start = { ...point, at: now, shapeScore };
      arming = null;
      return {
        tracking: true,
        armed: true,
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
        armed: false,
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
      scoreThreshold(maxDurationMs - elapsedMs, 0, maxDurationMs * 0.45),
    );
    const averagedShapeScore = (start.shapeScore + shapeScore) / 2;
    const finalScore = averagedShapeScore * 0.5 + motionScore * 0.5;
    const fired =
      distancePx >= minDistancePx &&
      verticalDriftPx <= maxVerticalDriftPx &&
      elapsedMs <= maxDurationMs &&
      finalScore >= minFinalScore;

    if (fired) reset();

    return {
      tracking: !fired,
      armed: true,
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
    isTracking: () => Boolean(start || arming),
    getState: () => (start ? { ...start } : null),
  };
}
