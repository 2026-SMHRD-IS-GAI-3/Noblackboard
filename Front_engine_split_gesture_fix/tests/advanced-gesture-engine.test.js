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

function createWritingPinch(scale = 1) {
  const hand = createOpenHand(scale);
  const transform = (x, y) => point(
    0.5 + (x - 0.5) * scale,
    0.62 + (y - 0.62) * scale,
  );
  hand[2] = transform(0.36, 0.66);
  hand[3] = transform(0.43, 0.57);
  hand[4] = transform(0.525, 0.505);
  hand[6] = transform(0.42, 0.56);
  hand[7] = transform(0.50, 0.54);
  hand[8] = transform(0.53, 0.50);
  for (const [tip, pip] of [[12, 10], [16, 14], [20, 18]]) {
    hand[tip] = point(hand[pip].x, hand[pip].y + 0.08 * scale);
  }
  return hand;
}

function createAlmostClosedWritingPinch(scale = 1) {
  const hand = createWritingPinch(scale);
  hand[4] = {
    ...hand[8],
    x: hand[8].x + 0.075 * scale,
  };
  return hand;
}

function createRaisedSideWritingPinch(scale = 1) {
  const hand = createWritingPinch(scale).map((landmark) => ({
    ...landmark,
    y: landmark.y - 0.40,
  }));
  for (const index of [0, 5, 9, 13, 17]) {
    hand[index] = {
      ...hand[index],
      z: (index - 9) * 0.025 * scale,
    };
  }
  return hand;
}

function createSidewaysCompactWritingPinch(scale = 1) {
  const hand = createWritingPinch(scale);
  const transform = (x, y) => point(
    0.5 + (x - 0.5) * scale,
    0.62 + (y - 0.62) * scale,
  );
  hand[5] = transform(0.43, 0.63);
  hand[6] = transform(0.48, 0.57);
  hand[7] = transform(0.55, 0.54);
  hand[8] = transform(0.59, 0.51);
  hand[2] = transform(0.37, 0.68);
  hand[3] = transform(0.47, 0.57);
  hand[4] = transform(0.585, 0.515);
  return hand;
}

function createNoisySidewaysWritingPinch(scale = 1) {
  const hand = createSidewaysCompactWritingPinch(scale);
  hand[4] = {
    ...hand[4],
    x: hand[8].x - 0.065 * scale,
    z: (hand[8].z || 0) + 0.16 * scale,
  };
  return hand;
}

function createSeparatedWritingPose(scale = 1) {
  const hand = createWritingPinch(scale);
  hand[4] = {
    ...hand[4],
    x: hand[4].x - 0.12 * scale,
  };
  return hand;
}

function moveHand(hand, deltaX = 0, deltaY = 0) {
  return hand.map((landmark) => ({
    ...landmark,
    x: landmark.x + deltaX,
    y: landmark.y + deltaY,
  }));
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

function createForwardFacingTwoFingerSwipeHand(scale = 1) {
  const hand = createOpenHand(scale);
  const extendTowardCamera = (mcpIndex, pipIndex, dipIndex, tipIndex, xOffset) => {
    const mcp = hand[mcpIndex];
    hand[pipIndex] = point(
      mcp.x + xOffset * scale,
      mcp.y - 0.03 * scale,
      -0.07 * scale,
    );
    hand[dipIndex] = point(
      mcp.x + xOffset * 1.45 * scale,
      mcp.y - 0.045 * scale,
      -0.14 * scale,
    );
    hand[tipIndex] = point(
      mcp.x + xOffset * 1.75 * scale,
      mcp.y - 0.04 * scale,
      -0.22 * scale,
    );
  };
  extendTowardCamera(5, 6, 7, 8, 0.025);
  extendTowardCamera(9, 10, 11, 12, 0.02);
  for (const [tip, pip] of [[16, 14], [20, 18]]) {
    hand[tip] = point(hand[pip].x, hand[pip].y + 0.09 * scale);
  }
  return hand;
}

function createSeparatedTwoFingerPose(scale = 1) {
  const hand = createForwardFacingTwoFingerSwipeHand(scale);
  hand[12] = {
    ...hand[12],
    x: hand[12].x + 0.14 * scale,
  };
  return hand;
}

function createWritingPinchWithForwardMiddle(scale = 1) {
  const hand = createWritingPinch(scale);
  const mcp = hand[9];
  hand[10] = point(mcp.x + 0.02 * scale, mcp.y - 0.03 * scale, -0.07 * scale);
  hand[11] = point(mcp.x + 0.03 * scale, mcp.y - 0.045 * scale, -0.14 * scale);
  hand[12] = point(mcp.x + 0.04 * scale, mcp.y - 0.04 * scale, -0.22 * scale);
  return hand;
}

function createOpenHandWithBentPinky(scale = 1) {
  const hand = createOpenHand(scale);
  hand[20] = point(
    hand[18].x + 0.02 * scale,
    hand[18].y - 0.035 * scale,
  );
  return hand;
}

function createNarrowOpenPalm(scale = 1) {
  const hand = createOpenHand(scale);
  for (const index of [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
    hand[index] = {
      ...hand[index],
      x: 0.5 + (hand[index].x - 0.5) * 0.52,
    };
  }
  return hand;
}

function createClusteredFingertipsPose(scale = 1) {
  const hand = createOpenHand(scale);
  const clusteredTips = [
    [8, 0.535, 0.49],
    [12, 0.55, 0.48],
    [16, 0.565, 0.49],
    [20, 0.575, 0.505],
  ];
  for (const [tipIndex, x, y] of clusteredTips) {
    hand[tipIndex] = point(
      0.5 + (x - 0.5) * scale,
      0.62 + (y - 0.62) * scale,
      -0.08 * scale,
    );
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

  it("rejects a loose near-pinch before contact", () => {
    const result = createEngine(null, { underlineStartConfidence: 0.46 }).evaluate(createLoosePinch(), 100, 0.95);
    expect(result.scores.thumbIndexRatio / result.thresholds.touchRatio).toBeGreaterThan(1.18);
    expect(result.scores.thumbIndexRatio / result.thresholds.touchRatio).toBeLessThan(1.2);
    expect(result.scores.rawUnderlinePinch).toBe(false);
    expect(result.scores.rawUnderlineStartPinch).toBe(false);
    expect(result.scores.underline).toBe(0);
    expect(result.exclusive.command).not.toBe("underline");
  });

  it("rejects thumb contact caused by a folded index finger", () => {
    const result = createEngine().evaluate(createBentIndexNearThumb(), 100, 0.95);
    expect(result.scores.thumbIndexRatio).toBeLessThan(result.thresholds.touchRatio);
    expect(result.scores.pinchPoseReady).toBe(false);
    expect(result.scores.writingPinchPoseReady).toBe(false);
    expect(result.scores.rawUnderlinePinch).toBe(false);
    expect(result.exclusive.command).not.toBe("underline");
  });

  it.each([1, 0.45])("recognizes a bent writing pinch at scale %s", (scale) => {
    const result = createEngine().evaluate(createWritingPinch(scale), 100, 0.95);

    expect(result.scores.writingPinchPoseReady).toBe(true);
    expect(result.scores.rawUnderlineStartPinch).toBe(true);
    expect(result.scores.candidates.underline.blockedBy).toBe("");
    expect(result.exclusive.command).toBe("underline");
  });

  it.each([1, 0.45])("recognizes a compact sideways writing pinch at scale %s", (scale) => {
    const result = createEngine().evaluate(createSidewaysCompactWritingPinch(scale), 100, 0.95);

    expect(result.scores.sidePinchPoseReady).toBe(true);
    expect(result.scores.rawUnderlineStartPinch).toBe(true);
    expect(result.scores.candidates.underline.blockedBy).toBe("");
    expect(result.exclusive.command).toBe("underline");
  });

  it.each([1, 0.45])("keeps a noisy sideways pinch out of the thumb-only gesture at scale %s", (scale) => {
    const result = createEngine().evaluate(createNoisySidewaysWritingPinch(scale), 100, 0.95);

    expect(result.scores.nearSidePinchIntent).toBe(true);
    expect(result.scores.sidePinchPoseReady).toBe(true);
    expect(result.scores.rawThumbOnly).toBe(false);
    expect(result.scores.rawUnderlineStartPinch).toBe(true);
    expect(result.scores.candidates.underline.blockedBy).toBe("");
    expect(result.exclusive.command).toBe("underline");
  });

  it.each([1, 0.45])("keeps writing active when the middle finger looks forward at scale %s", (scale) => {
    const result = createEngine().evaluate(createWritingPinchWithForwardMiddle(scale), 100, 0.95);

    expect(result.scores.forwardTwoFingerReady).toBe(true);
    expect(result.scores.rawUnderlineStartPinch).toBe(true);
    expect(result.scores.twoFingerSwipeGuard).toBe(false);
    expect(result.scores.candidates.underline.blockedBy).toBe("");
    expect(result.scores.candidates.next_page.blockedBy).toBe("pinch_approach_guard");
    expect(result.exclusive.command).toBe("underline");
  });

  it("requires thumb and index to close tighter before starting a writing stroke", () => {
    const result = createEngine().evaluate(createAlmostClosedWritingPinch(), 100, 0.95);

    expect(result.scores.thumbIndexRatio).toBeGreaterThan(result.scores.startTouchThreshold);
    expect(result.scores.rawUnderlineStartPinch).toBe(false);
    expect(result.exclusive.command).not.toBe("underline");
  });

  it.each([1, 0.45])("rejects a separated writing-like pose at scale %s", (scale) => {
    const result = createEngine().evaluate(createSeparatedWritingPose(scale), 100, 0.95);

    expect(result.scores.writingPinchPoseReady).toBe(false);
    expect(result.scores.rawUnderlineStartPinch).toBe(false);
    expect(result.exclusive.command).not.toBe("underline");
  });

  it.each([1, 0.45])("keeps a raised side-on writing pinch available at scale %s", (scale) => {
    const result = createEngine(null, {
      minPalmFacingForSensitive: 0.95,
    }).evaluate(createRaisedSideWritingPinch(scale), 100, 0.95);

    expect(result.context.rawScreenZone).toContain("top");
    expect(result.context.angleUnstable).toBe(true);
    expect(result.scores.writingPinchPoseReady).toBe(true);
    expect(result.scores.candidates.underline.blockedBy).toBe("");
    expect(result.exclusive.command).toBe("underline");
  });

  it.each([
    ["left", -0.34],
    ["right", 0.34],
  ])("allows a writing pinch to start immediately at the %s edge", (side, deltaX) => {
    const result = createEngine().evaluate(
      moveHand(createWritingPinch(), deltaX, 0),
      100,
      0.95,
    );

    expect(result.context.rawScreenZone).toContain(side);
    expect(result.context.screenZone).toBe("center");
    expect(result.context.partialHandThreshold).toBeLessThan(0.86);
    expect(result.context.partialHand).toBe(false);
    expect(result.scores.rawUnderlineStartPinch).toBe(true);
    expect(result.exclusive.command).toBe("underline");
  });

  it.each([
    ["left", -0.54],
    ["right", 0.50],
  ])("keeps side-edge writing pinch available when part of the hand is clipped on the %s", (side, deltaX) => {
    const result = createEngine().evaluate(
      moveHand(createWritingPinch(), deltaX, 0),
      100,
      0.95,
    );

    expect(result.context.rawScreenZone).toContain(side);
    expect(result.context.inFrameRatio).toBeLessThan(0.86);
    expect(result.scores.rawUnderlineStartPinch).toBe(true);
    expect(result.scores.candidates.underline.blockedBy).toBe("");
  });

  it.each([1, 0.45])("scores a horizontal two-finger swipe pose at scale %s", (scale) => {
    const result = createEngine().evaluate(createHorizontalSwipeHand(scale), 100, 0.95);
    expect(result.scores.indexMiddleSwipeTouch).toBe(true);
    expect(result.scores.swipeShapeScore).toBeGreaterThanOrEqual(0.52);
    expect(result.scores.rawTwoFingerSwipeReady).toBe(true);
    expect(result.scores.candidates.next_page.blockedBy).toBe("");
  });

  it.each([1, 0.45])("keeps a camera-facing two-finger swipe pose at scale %s", (scale) => {
    const result = createEngine().evaluate(createForwardFacingTwoFingerSwipeHand(scale), 100, 0.95);

    expect(result.scores.forwardTwoFingerReady).toBe(true);
    expect(result.scores.indexMiddleSwipeTouch).toBe(true);
    expect(result.scores.twoFingerSwipeGuard).toBe(true);
    expect(result.scores.swipeShapeScore).toBeGreaterThanOrEqual(
      result.thresholds.swipeMinShapeScore,
    );
    expect(result.scores.candidates.next_page.blockedBy).toBe("");
    expect(result.scores.candidates.underline.blockedBy).toBe("");
    expect(result.scores.candidates.clear_page.blockedBy).toBe("two_finger_swipe_guard");
    expect(result.scores.underline).toBe(0);
    expect(result.scores.clear).toBe(0);
  });

  it.each([1, 0.45])("does not swipe when index and middle fingertips are separated at scale %s", (scale) => {
    const result = createEngine().evaluate(createSeparatedTwoFingerPose(scale), 100, 0.95);

    expect(result.scores.indexMiddleSwipeTouch).toBe(false);
    expect(result.scores.swipeShapeScore).toBe(0);
    expect(result.scores.candidates.next_page.score).toBe(0);
    expect(result.exclusive.command).not.toBe("next_page");
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

  it("keeps open palm assigned to clear instead of swipe after entering the frame", () => {
    const engine = createEngine({ palmSizePx: 200, fingerSpread: 1.4, touchDistanceRatio: 0.38 });
    engine.evaluate(createOpenHand(1), 100, 0.95);
    const result = engine.evaluate(createOpenHand(0.45), 140, 0.95);

    expect(result.scores.rawOpenPalm).toBe(true);
    expect(result.scores.candidates.next_page.blockedBy).toBe("open_palm_guard");
    expect(result.scores.candidates.clear_page.blockedBy).toBe("");
    expect(result.exclusive.command).toBe("clear_page");
  });

  it("keeps a mostly open palm eligible when the pinky landmark bends slightly", () => {
    const result = createEngine().evaluate(createOpenHandWithBentPinky(), 100, 0.95);

    expect(result.scores.openFingerCount).toBeGreaterThanOrEqual(3);
    expect(result.scores.rawOpenPalm).toBe(true);
    expect(result.scores.candidates.clear_page.blockedBy).toBe("");
    expect(result.exclusive.command).toBe("clear_page");
  });

  it("recognizes an open palm when the extended fingers are close together", () => {
    const result = createEngine().evaluate(createNarrowOpenPalm(), 100, 0.95);

    expect(result.scores.openFingerCount).toBeGreaterThanOrEqual(3);
    expect(result.scores.rawOpenPalm).toBe(true);
    expect(result.scores.candidates.clear_page.blockedBy).toBe("");
    expect(result.exclusive.command).toBe("clear_page");
  });

  it("rejects clustered fingertips as an eraser palm", () => {
    const result = createEngine().evaluate(createClusteredFingertipsPose(), 100, 0.95);

    expect(result.scores.clusteredFingertips).toBe(true);
    expect(result.scores.rawOpenPalm).toBe(false);
    expect(result.scores.clear).toBe(0);
    expect(result.exclusive.command).not.toBe("clear_page");
  });

  it("uses pixel palm calibration for distance scale", () => {
    const engine = createEngine({ palmSizePx: 90, touchDistanceRatio: 0.38 });
    const near = engine.evaluate(createOpenHand(1), 100, 0.95);
    engine.reset();
    const far = engine.evaluate(createOpenHand(0.45), 200, 0.95);
    expect(near.context.distanceScale).toBeGreaterThan(far.context.distanceScale);
    expect(far.context.palmSizePx).toBeGreaterThan(14);
  });

  it("keeps remote-distance gesture compensation available", () => {
    const engine = createEngine({ palmSizePx: 200, touchDistanceRatio: 0.38 });
    const pointer = engine.evaluate(createOpenHand(0.3), 100, 0.95);
    engine.reset();
    const pinch = engine.evaluate(createPinch(0.3), 200, 0.95);

    expect(pointer.thresholds.pointerAllowed).toBe(true);
    expect(pointer.scores.candidates.pointer.blockedBy).toBe("");
    expect(pinch.context.distanceCompensation.mode).toBe("far");
    expect(pinch.thresholds.commandDistanceAllowed).toBe(true);
    expect(pinch.thresholds.touchRatio).toBeGreaterThan(0.38);
    expect(pinch.thresholds.underlineConfirmMs).toBe(400);
    expect(pinch.thresholds.swipeMinDistance).toBeLessThan(120);
    expect(pinch.thresholds.swipeMaxDurationMs).toBeGreaterThan(400);
    expect(pinch.scores.pinchSwipeShapeScore).toBeGreaterThanOrEqual(
      pinch.thresholds.pinchSwipeMinShapeScore,
    );
    expect(pinch.thresholds.previousHoldMs).toBe(520);
  });

  it("keeps commands available at presenter distance when the hand is still visible enough", () => {
    const engine = createEngine({ palmSizePx: 400, touchDistanceRatio: 0.38 });
    const result = engine.evaluate(createOpenHand(0.14), 100, 0.95);

    expect(result.context.distanceScale).toBeLessThan(0.16);
    expect(result.context.palmSizePx).toBeGreaterThan(18);
    expect(result.context.tooFarForCommands).toBe(false);
    expect(result.scores.candidates.clear_page.blockedBy).not.toBe("too_far");
  });

  it("uses ultra-far thresholds while a very small hand is still detected", () => {
    const engine = createEngine({ palmSizePx: 400, touchDistanceRatio: 0.38 });
    const result = engine.evaluate(createForwardFacingTwoFingerSwipeHand(0.075), 100, 0.95);

    expect(result.context.palmSizePx).toBeGreaterThanOrEqual(10);
    expect(result.context.tooFarForCommands).toBe(false);
    expect(result.thresholds.ultraFarMode).toBe(true);
    expect(result.thresholds.swipeMinDistance).toBeLessThan(76);
    expect(result.thresholds.swipeMinShapeScore).toBeLessThan(0.44);
  });

  it("blocks commands only when the hand is beyond the hard distance guard", () => {
    const engine = createEngine({ palmSizePx: 400, touchDistanceRatio: 0.38 });
    const result = engine.evaluate(createLoosePinch(0.025), 100, 0.95);

    expect(result.context.tooFarForCommands).toBe(true);
    expect(result.thresholds.commandDistanceAllowed).toBe(false);
    expect(result.scores.candidates.pointer.blockedBy).toBe("");
    expect(result.scores.candidates.underline.blockedBy).toBe("too_far");
    expect(result.scores.candidates.next_page.blockedBy).toBe("too_far");
    expect(result.scores.candidates.previous_page.blockedBy).toBe("too_far");
    expect(result.scores.candidates.clear_page.blockedBy).toBe("too_far");
    expect(result.scores.candidates.mode_toggle.blockedBy).toBe("too_far");
  });

  it("switches distance compensation with a hysteresis gap", () => {
    const engine = createEngine({ palmSizePx: 200, touchDistanceRatio: 0.38 });
    const far = engine.evaluate(createOpenHand(0.2), 100, 0.95);
    const boundary = engine.evaluate(createOpenHand(0.4), 200, 0.95);
    const near = engine.evaluate(createOpenHand(1), 300, 0.95);

    expect(far.context.distanceCompensation.active).toBe(true);
    expect(boundary.context.distanceCompensation.active).toBe(true);
    expect(near.context.distanceCompensation.active).toBe(false);
  });

  it("can disable distance compensation from configuration", () => {
    const result = createEngine(
      { palmSizePx: 400, touchDistanceRatio: 0.38 },
      { distanceCompensationEnabled: false },
    ).evaluate(createLoosePinch(0.2), 100, 0.95);

    expect(result.context.distanceCompensation.mode).toBe("standard");
    expect(result.context.distanceCompensation.reason).toBe("disabled");
    expect(result.thresholds.touchRatio).toBeCloseTo(0.38, 5);
    expect(result.thresholds.underlineConfirmMs).toBe(450);
  });
});
