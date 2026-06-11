const DEFAULTS = Object.freeze({
  recentMs: 3000,
  hitRadiusPx: 50,
  holdMs: 800,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1,
  );
  return Math.hypot(
    point.x - (start.x + dx * ratio),
    point.y - (start.y + dy * ratio),
  );
}

export function getDistanceToStroke(point, stroke, width, height) {
  const points = (stroke?.points || []).map((item) => ({
    x: item.xRatio * width,
    y: item.yRatio * height,
  }));
  if (!point || !points.length) return Infinity;
  if (points.length === 1) return Math.hypot(point.x - points[0].x, point.y - points[0].y);
  let minimum = Infinity;
  for (let index = 1; index < points.length; index += 1) {
    minimum = Math.min(minimum, distanceToSegment(point, points[index - 1], points[index]));
  }
  return minimum;
}

export function findRecentStroke(strokes, point, {
  now = performance.now(),
  width = 1,
  height = 1,
  recentMs = DEFAULTS.recentMs,
  hitRadiusPx = DEFAULTS.hitRadiusPx,
} = {}) {
  let nearest = null;
  for (const stroke of strokes || []) {
    const ageMs = now - Number(stroke.createdAt || 0);
    if (ageMs < 0 || ageMs > recentMs) continue;
    const distancePx = getDistanceToStroke(point, stroke, width, height);
    if (distancePx > hitRadiusPx || (nearest && distancePx >= nearest.distancePx)) continue;
    nearest = { stroke, distancePx, ageMs };
  }
  return nearest;
}

export function createRecentStrokeDeletionTracker(options = {}) {
  const config = { ...DEFAULTS, ...options };
  let target = null;
  let lockedUntilLeave = false;

  function reset() {
    target = null;
    lockedUntilLeave = false;
  }

  function update({
    pageNo,
    strokes,
    point,
    now = performance.now(),
    width = 1,
    height = 1,
  } = {}) {
    const nearest = findRecentStroke(strokes, point, {
      now,
      width,
      height,
      recentMs: config.recentMs,
      hitRadiusPx: config.hitRadiusPx,
    });

    if (!nearest) {
      target = null;
      lockedUntilLeave = false;
      return { active: false, progress: 0, deleteStrokeId: null };
    }

    if (lockedUntilLeave) {
      return {
        active: false,
        progress: 0,
        deleteStrokeId: null,
        reason: "leave_required",
      };
    }

    if (!target || target.pageNo !== pageNo || target.strokeId !== nearest.stroke.id) {
      target = { pageNo, strokeId: nearest.stroke.id, startedAt: now };
    }

    const heldMs = Math.max(0, now - target.startedAt);
    const progress = clamp(heldMs / config.holdMs, 0, 1);
    if (heldMs < config.holdMs) {
      return {
        active: true,
        progress,
        heldMs,
        targetStrokeId: target.strokeId,
        distancePx: nearest.distancePx,
        deleteStrokeId: null,
      };
    }

    const deleteStrokeId = target.strokeId;
    target = null;
    lockedUntilLeave = true;
    return {
      active: true,
      progress: 1,
      heldMs,
      targetStrokeId: deleteStrokeId,
      distancePx: nearest.distancePx,
      deleteStrokeId,
    };
  }

  return {
    update,
    reset,
    getState: () => ({
      target: target ? { ...target } : null,
      lockedUntilLeave,
    }),
  };
}
