import { describe, expect, it } from "vitest";
import { createAdvancedGestureEngine } from "../js/gesture/advancedGestureEngine.js";

function point(x, y, z = 0) {
  return { x, y, z };
}

function createOpenHand(scale = 1, centerX = 0.5, centerY = 0.62) {
  const sx = (x) => centerX + (x - 0.5) * scale;
  const sy = (y) => centerY + (y - 0.62) * scale;
  return [
    point(sx(0.50), sy(0.82)),
    point(sx(0.42), sy(0.73)),
    point(sx(0.36), sy(0.66)),
    point(sx(0.30), sy(0.59)),
    point(sx(0.24), sy(0.53)),
    point(sx(0.43), sy(0.65)),
    point(sx(0.42), sy(0.52)),
    point(sx(0.41), sy(0.39)),
    point(sx(0.40), sy(0.26)),
    point(sx(0.50), sy(0.63)),
    point(sx(0.50), sy(0.48)),
    point(sx(0.50), sy(0.33)),
    point(sx(0.50), sy(0.18)),
    point(sx(0.57), sy(0.65)),
    point(sx(0.59), sy(0.52)),
    point(sx(0.60), sy(0.39)),
    point(sx(0.61), sy(0.27)),
    point(sx(0.64), sy(0.69)),
    point(sx(0.68), sy(0.58)),
    point(sx(0.71), sy(0.48)),
    point(sx(0.74), sy(0.39)),
  ];
}

function createPinch(scale = 1) {
  const hand = createOpenHand(scale);
  hand[4] = { ...hand[8], x: hand[8].x + 0.002 * scale };
  for (const [tip, pip] of [[12, 10], [16, 14], [20, 18]]) {
    hand[tip] = point(hand[pip].x, hand[pip].y + 0.08 * scale);
  }
  return hand;
}

function createScreenPinchWithDepthNoise(scale = 1) {
  const hand = createPinch(scale);
  hand[4] = { ...hand[4], z: (hand[8].z || 0) + 0.18 * scale };
  return hand;
}

function createLoosePinch(scale = 1) {
  const hand = createOpenHand(scale);
  hand[4] = { ...hand[8], x: hand[8].x + 0.086 * scale };
  for (const [tip, pip] of [[12, 10], [16, 14], [20, 18]]) {
    hand[tip] = point(hand[pip].x, hand[pip].y + 0.08 * scale);
  }
  return hand;
}

function createBentIndexNearThumb(scale = 1) {
  const hand = createOpenHand(scale);
  hand[8] = point(hand[6].x + 0.01 * scale, hand[6].y + 0.07 * scale);
  hand[4] = { ...hand[8], x: hand[8].x + 0.002 * scale };
  return hand;
}

function createHorizontalSwipeHand(scale = 1) {
  const hand = createOpenHand(scale);
  const horizontalFinger = (mcpIndex, pipIndex, dipIndex, tipIndex, y) => {
    const mcp = hand[mcpIndex];
    hand[pipIndex] = point(mcp.x + 0.06 * scale, y);
    hand[dipIndex] = point(mcp.x + 0.13 * scale, y);
    hand[tipIndex] = point(mcp.x + 0.20 * scale, y);
  };
  horizontalFinger(5, 6, 7, 8, hand[5].y);
  horizontalFinger(9, 10, 11, 12, hand[9].y + 0.035 * scale);
  for (const [tip, pip] of [[16, 14], [20, 18]]) {
    hand[tip] = point(hand[pip].x, hand[pip].y + 0.08 * scale);
  }
  hand[4] = point(hand[5].x - 0.15 * scale, hand[5].y + 0.04 * scale);
  return hand;
}

function createThumbsUp(scale = 1) {
  const hand = createOpenHand(scale);
  hand[4] = point(0.36, 0.29);
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
    hand[tip] = point(hand[pip].x, hand[pip].y + 0.10 * scale);
  }
  return hand;
}

function createPinkyOnly(scale = 1) {
  const hand = createOpenHand(scale);
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14]]) {
    hand[tip] = point(hand[pip].x, hand[pip].y + 0.10 * scale);
  }
  return hand;
}

function createEngine(profile = null, config = {}) {
  return createAdvancedGestureEngine({
    getCalibrationProfile: () => profile,
    getViewport: () => ({ width: 1280, height: 720 }),
    config,
  });
}

describe("advanced gesture engine", () => {
  it.each([1, 0.45])("recognizes pinch at scale %s", (scale) => {
    const result = createEngine().evaluate(createPinch(scale), 100, 0.95);
    expect(result.scores.rawUnderlinePinch).toBe(true);
    expect(result.scores.underline).toBeGreaterThanOrEqual(0.55);
    expect(result.exclusive.command).toBe("underline");
  });

  it("recognizes screen-space pinch even when landmark depth is noisy", () => {
    const result = createEngine().evaluate(createScreenPinchWithDepthNoise(), 100, 0.95);
    expect(result.scores.thumbIndexRatio3D).toBeGreaterThan(result.thresholds.touchRatio);
    expect(result.scores.thumbIndexRatio2D).toBeLessThan(result.thresholds.touchRatio);
    expect(result.scores.rawUnderlinePinch).toBe(true);
    expect(result.exclusive.command).toBe("underline");
  });

  it("recognizes near-pinch as freewriting intent", () => {
    const result = createEngine(null, { underlineStartConfidence: 0.46 }).evaluate(createLoosePinch(), 100, 0.95);
    expect(result.scores.thumbIndexRatio / result.thresholds.touchRatio).toBeGreaterThan(1.18);
    expect(result.scores.thumbIndexRatio / result.thresholds.touchRatio).toBeLessThan(1.2);
    expect(result.scores.rawUnderlinePinch).toBe(false);
    expect(result.scores.rawUnderlineStartPinch).toBe(true);
    expect(result.scores.underline).toBeGreaterThanOrEqual(0.46);
    expect(result.exclusive.command).toBe("underline");
  });

  it("rejects thumb contact caused by a folded index finger", () => {
    const result = createEngine().evaluate(createBentIndexNearThumb(), 100, 0.95);
    expect(result.scores.thumbIndexRatio).toBeLessThan(result.thresholds.touchRatio);
    expect(result.scores.pinchPoseReady).toBe(false);
    expect(result.scores.rawUnderlinePinch).toBe(false);
    expect(result.exclusive.command).not.toBe("underline");
  });

  it.each([1, 0.45])("scores a horizontal two-finger swipe pose at scale %s", (scale) => {
    const result = createEngine().evaluate(createHorizontalSwipeHand(scale), 100, 0.95);
    expect(result.scores.swipeShapeScore).toBeGreaterThanOrEqual(0.52);
    expect(result.scores.rawTwoFingerSwipeReady).toBe(true);
    expect(result.scores.candidates.next_page.blockedBy).toBe("");
  });

  it.each([1, 0.45])("keeps thumb intent at scale %s", (scale) => {
    const result = createEngine().evaluate(createThumbsUp(scale), 100, 0.95);
    expect(result.scores.thumbUpScore).toBeGreaterThan(0.45);
    expect(result.scores.previous).toBeGreaterThan(0);
  });

  it("recognizes pinky-only as gesture control toggle", () => {
    const result = createEngine().evaluate(createPinkyOnly(), 100, 0.95);
    expect(result.scores.rawPinkyOnly).toBe(true);
    expect(result.scores.mode_toggle).toBeGreaterThanOrEqual(0.42);
    expect(result.exclusive.command).toBe("mode_toggle");
  });

  it("uses pixel palm calibration for distance scale", () => {
    const engine = createEngine({ palmSizePx: 90, touchDistanceRatio: 0.38 });
    const near = engine.evaluate(createOpenHand(1), 100, 0.95);
    engine.reset();
    const far = engine.evaluate(createOpenHand(0.45), 200, 0.95);
    expect(near.context.distanceScale).toBeGreaterThan(far.context.distanceScale);
    expect(far.context.palmSizePx).toBeGreaterThan(14);
  });
});
