const DEFAULTS = Object.freeze({
  requiredFrames: 1,
  lostGraceMs: 280,
  releaseGraceMs: 90,
  newStrokeOnlyMs: 500,
  continueTouchMultiplier: 1.75,
  bridgeMinRatio: 0.14,
  bridgeMaxRatio: 0.30,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distanceRatio(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot((a.xRatio || 0) - (b.xRatio || 0), (a.yRatio || 0) - (b.yRatio || 0));
}

export function createFreeWritingEngine(options = {}) {
  const config = { ...DEFAULTS, ...(options.config || {}) };
  const emitPhase = options.emitPhase || (() => false);
  const emitState = options.emitState || (() => {});

  const state = {
    active: false,
    inGrace: false,
    pinchFrames: 0,
    locked: false,
    lastSeenAt: 0,
    lastPoint: null,
    lastDrawnPoint: null,
    startedAt: 0,
    strokeId: 0,
    lastPhase: "idle",
  };

  function getBridgeMaxRatio(context) {
    const palmScale = clamp((context?.palmSize || 0.12) / 0.12, 0.75, 1.45);
    return clamp(config.bridgeMinRatio * palmScale, config.bridgeMinRatio, config.bridgeMaxRatio);
  }

  function markPhase(phase, point, now) {
    state.lastPhase = phase;
    if (["start", "move", "bridge"].includes(phase)) {
      state.lastSeenAt = now;
      state.lastPoint = point ? { ...point } : state.lastPoint;
      state.lastDrawnPoint = point ? { ...point } : state.lastDrawnPoint;
    }
  }

  function start(point, payload, now) {
    state.strokeId += 1;
    const handled = emitPhase("start", point, {
      ...payload,
      engine: "freewriting",
      strokeId: state.strokeId,
    });
    if (handled) {
      state.active = true;
      state.inGrace = false;
      state.locked = true;
      state.startedAt = now;
      markPhase("start", point, now);
    }
    return Boolean(handled);
  }

  function move(phase, point, payload, now, bridgeDistance = 0, bridgeMaxRatio = 0) {
    const handled = emitPhase(phase, point, {
      ...payload,
      engine: "freewriting",
      strokeId: state.strokeId,
      bridgeDistance,
      bridgeMaxRatio,
      strokeDurationMs: state.startedAt ? now - state.startedAt : 0,
    });
    if (handled) {
      state.active = true;
      state.inGrace = false;
      markPhase(phase, point, now);
    }
    return Boolean(handled);
  }

  function end(reason, point, payload, now) {
    if (!state.active && !state.inGrace && !state.locked) {
      reset();
      return false;
    }
    const handled = emitPhase("end", point || state.lastPoint, {
      ...payload,
      engine: "freewriting",
      strokeId: state.strokeId,
      reason,
      strokeDurationMs: state.startedAt ? now - state.startedAt : 0,
    });
    reset();
    return Boolean(handled);
  }

  function update(input = {}) {
    const now = input.now || performance.now();
    const thresholds = input.thresholds || {};
    const point = input.point || null;
    const enabled = Boolean(input.enabled && point);
    const rawDistanceRatio = Number.isFinite(input.thumbIndexRatio) ? input.thumbIndexRatio : Infinity;
    const touchRatio = Math.max(Number(thresholds.touchRatio) || 0.5, 0.38);
    const continueTouchMultiplier = Math.max(
      Number(thresholds.underlineContinueTouchMultiplier) || config.continueTouchMultiplier,
      1,
    );
    const looseTouch = rawDistanceRatio <= touchRatio * continueTouchMultiplier;
    const intent = enabled && (Boolean(input.pinchIntent) || (state.active && looseTouch));
    const payload = {
      confidence: input.confidence || 0,
      thresholds,
      scores: input.scores || null,
      strokeMode: input.strokeMode || "freewriting",
      tool: input.tool || "pen",
      thumbIndexRatio: rawDistanceRatio,
      touchRatio,
      continueTouchMultiplier,
    };

    if (!enabled) {
      const fired = end(input.reason || "engine_disabled", point, payload, now);
      return { claimed: fired, fired, phase: "end", active: false, reason: "engine_disabled" };
    }

    if (intent) {
      state.pinchFrames += 1;
      const canStart = state.pinchFrames >= config.requiredFrames;
      if (!state.active && canStart) {
        const fired = start(point, payload, now);
        return { claimed: true, fired, phase: "start", active: state.active, reason: "pinch_start" };
      }

      if (state.active) {
        if (state.inGrace) {
          const gapMs = now - (state.lastSeenAt || now);
          const bridgeDistance = distanceRatio(state.lastPoint, point);
          const bridgeMaxRatio = getBridgeMaxRatio(input.context);
          if (gapMs <= config.lostGraceMs && bridgeDistance <= bridgeMaxRatio) {
            const fired = move("bridge", point, payload, now, bridgeDistance, bridgeMaxRatio);
            return { claimed: true, fired, phase: "bridge", active: state.active, reason: "pinch_bridge" };
          }
          const restartOnly = gapMs > config.newStrokeOnlyMs;
          end(
            bridgeDistance > bridgeMaxRatio
              ? `bridge_distance_over:${bridgeDistance.toFixed(3)}>${bridgeMaxRatio.toFixed(3)}`
              : restartOnly
                ? "new_stroke_after_gap"
                : "lost_too_long",
            state.lastPoint || point,
            payload,
            now
          );
          const fired = start(point, payload, now);
          return { claimed: true, fired, phase: "restart", active: state.active, reason: "pinch_restart" };
        }
        const fired = move("move", point, payload, now, 0, getBridgeMaxRatio(input.context));
        return { claimed: true, fired, phase: "move", active: state.active, reason: "pinch_move" };
      }

      return { claimed: true, fired: false, phase: "prepare", active: false, reason: "pinch_prepare" };
    }

    state.pinchFrames = 0;
    if (state.active) {
      const gapMs = now - (state.lastSeenAt || now);
      const releaseLike = rawDistanceRatio > touchRatio * continueTouchMultiplier;
      const graceMs = releaseLike ? config.releaseGraceMs : config.lostGraceMs;
      if (gapMs <= graceMs) {
        state.inGrace = true;
        state.lastPhase = "grace";
        emitState({
          command: "pinch_stroke",
          phase: "grace",
          engine: "freewriting",
          handPoint: point,
          confidence: payload.confidence,
          thresholds,
          gapMs,
          thumbIndexRatio: rawDistanceRatio,
        });
        return { claimed: true, fired: false, phase: "grace", active: true, reason: releaseLike ? "release_grace" : "lost_grace" };
      }
      const fired = end(releaseLike ? "pinch_released" : "lost_hand", state.lastPoint || point, payload, now);
      return { claimed: true, fired, phase: "end", active: false, reason: "pinch_end" };
    }

    state.inGrace = false;
    state.locked = false;
    return { claimed: false, fired: false, phase: "idle", active: false, reason: "idle" };
  }

  function reset(reason = "reset") {
    state.active = false;
    state.inGrace = false;
    state.pinchFrames = 0;
    state.locked = false;
    state.lastSeenAt = 0;
    state.lastPoint = null;
    state.lastDrawnPoint = null;
    state.startedAt = 0;
    state.lastPhase = reason;
  }

  function markLost(now = performance.now(), detail = {}) {
    if (!state.active) return false;
    state.inGrace = true;
    state.lastPhase = "grace";
    emitState({
      command: "pinch_stroke",
      phase: "grace",
      engine: "freewriting",
      gapMs: Math.max(0, now - (state.lastSeenAt || now)),
      ...detail,
    });
    return true;
  }

  return {
    name: "freewriting",
    update,
    markLost,
    reset,
    isActive: () => Boolean(state.active || state.inGrace),
    getState: () => ({ ...state }),
  };
}
