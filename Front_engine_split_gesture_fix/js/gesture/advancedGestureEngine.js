const DEFAULTS = {
  angleThreshold: 135,
  distanceRatioPip: 1.08,
  distanceRatioDip: 1.02,
  touchDistanceRatio: 0.38,
  minCommandConfidence: 0.64,
  minSensitiveCommandConfidence: 0.72,
  underlineStartConfidence: 0.55,
  minHandConfidence: 0.35,
  minPalmFacingForSensitive: 0.24,
  minStabilityForClear: 0.42,
  defaultReferencePalmSizePx: 90,
  minCommandDistanceScale: 0.16,
  minPointerDistanceScale: 0.12,
  minAbsolutePointerPalmSizePx: 14,
  minAbsoluteCommandPalmSizePx: 18,
  farDistanceAnglePenalty: 2.2,
  farGestureDistanceScale: 0.28,
  farGesturePalmSizePx: 26,
};

const STRICT_COMMAND_ANGLE_OFFSET = 8;
const STRICT_COMMAND_DISTANCE_PIP_BONUS = 0.035;
const STRICT_COMMAND_DISTANCE_DIP_BONUS = 0.025;
const ZONE_HISTORY_SIZE = 8;
const ZONE_STABLE_MS = 240;
const ZONE_BLEND_STEP = 0.18;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function scoreThreshold(value, min, good) {
  if (min === good) return value >= good ? 1 : 0;
  return clamp((value - min) / (good - min), 0, 1);
}

function distance3D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function vector(a, b) {
  return {
    x: b.x - a.x,
    y: b.y - a.y,
    z: (b.z || 0) - (a.z || 0),
  };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function angle3D(a, b, c) {
  const ab = vector(b, a);
  const cb = vector(b, c);
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const lengths = Math.hypot(ab.x, ab.y, ab.z) * Math.hypot(cb.x, cb.y, cb.z);
  if (!lengths) return 0;
  return Math.acos(clamp(dot / lengths, -1, 1)) * (180 / Math.PI);
}

function detectScreenZone(point) {
  const horizontal = point.x < 0.33 ? "left" : point.x > 0.67 ? "right" : "center";
  const vertical = point.y < 0.33 ? "top" : point.y > 0.67 ? "bottom" : "middle";
  if (vertical === "middle" && horizontal === "center") return "center";
  if (vertical === "middle") return horizontal;
  if (horizontal === "center") return vertical;
  return `${vertical}_${horizontal}`;
}

function getZoneModifier(zone, blend = 1) {
  const level = zone === "center" ? "center" : zone.includes("_") ? "corner" : "edge";
  const base = level === "corner"
    ? {
        angleRelax: 5,
        partialHandThreshold: 0.76,
        sensitiveConfidenceBoost: 0.06,
        pointerDistanceScaleBonus: -0.04,
        stabilityRelax: 0.1,
        smoothingBoost: 0.08,
      }
    : level === "edge"
      ? {
          angleRelax: 3,
          partialHandThreshold: 0.82,
          sensitiveConfidenceBoost: 0.04,
          pointerDistanceScaleBonus: -0.025,
          stabilityRelax: 0.06,
          smoothingBoost: 0.04,
        }
      : {
          angleRelax: 0,
          partialHandThreshold: 0.86,
          sensitiveConfidenceBoost: 0,
          pointerDistanceScaleBonus: 0,
          stabilityRelax: 0,
          smoothingBoost: 0,
        };

  return {
    level,
    angleRelax: base.angleRelax * blend,
    partialHandThreshold: 0.86 + (base.partialHandThreshold - 0.86) * blend,
    sensitiveConfidenceBoost: base.sensitiveConfidenceBoost * blend,
    pointerDistanceScaleBonus: base.pointerDistanceScaleBonus * blend,
    stabilityRelax: base.stabilityRelax * blend,
    smoothingBoost: base.smoothingBoost * blend,
  };
}

export function createAdvancedGestureEngine({
  getCalibrationProfile = () => null,
  getViewport = () => ({ width: 1280, height: 720 }),
  config = {},
} = {}) {
  const constants = { ...DEFAULTS, ...config };
  let lastContext = null;
  const zoneTracker = {
    stableZone: "center",
    candidateZone: "center",
    candidateSince: 0,
    history: [],
    blend: 0,
  };

  function reset() {
    lastContext = null;
    zoneTracker.stableZone = "center";
    zoneTracker.candidateZone = "center";
    zoneTracker.candidateSince = 0;
    zoneTracker.history = [];
    zoneTracker.blend = 0;
  }

  function updateScreenZone(palmCenter, now) {
    zoneTracker.history.push({ x: palmCenter.x, y: palmCenter.y });
    if (zoneTracker.history.length > ZONE_HISTORY_SIZE) zoneTracker.history.shift();
    const averagePoint = {
      x: average(zoneTracker.history.map((point) => point.x)),
      y: average(zoneTracker.history.map((point) => point.y)),
    };
    const detectedZone = detectScreenZone(averagePoint);
    if (detectedZone !== zoneTracker.candidateZone) {
      zoneTracker.candidateZone = detectedZone;
      zoneTracker.candidateSince = now;
    }
    if (now - zoneTracker.candidateSince >= ZONE_STABLE_MS && zoneTracker.stableZone !== detectedZone) {
      zoneTracker.stableZone = detectedZone;
      zoneTracker.blend = 0;
    }
    zoneTracker.blend = clamp(zoneTracker.blend + ZONE_BLEND_STEP, 0, 1);
    return {
      rawZone: detectScreenZone(palmCenter),
      candidateZone: detectedZone,
      stableZone: zoneTracker.stableZone,
      blend: zoneTracker.blend,
      ...getZoneModifier(zoneTracker.stableZone, zoneTracker.blend),
    };
  }

  function getContext(hand, now, handConfidence = 1) {
    const [wrist, indexMcp, middleMcp, ringMcp, pinkyMcp] = [hand[0], hand[5], hand[9], hand[13], hand[17]];
    const palmCenter = {
      x: average([wrist.x, indexMcp.x, middleMcp.x, ringMcp.x, pinkyMcp.x]),
      y: average([wrist.y, indexMcp.y, middleMcp.y, ringMcp.y, pinkyMcp.y]),
      z: average([wrist.z || 0, indexMcp.z || 0, middleMcp.z || 0, ringMcp.z || 0, pinkyMcp.z || 0]),
    };
    const palmSize = Math.max(distance3D(wrist, middleMcp), 0.001);
    const palmSize2D = Math.max(distance2D(wrist, middleMcp), 0.001);
    const fingerSpread = (
      distance3D(hand[8], hand[12]) +
      distance3D(hand[12], hand[16]) +
      distance3D(hand[16], hand[20])
    ) / palmSize;
    const viewport = getViewport();
    const screenPalmCenter = { x: (1 - palmCenter.x) * viewport.width, y: palmCenter.y * viewport.height };
    const pointerPoint = { x: (1 - hand[8].x) * viewport.width, y: hand[8].y * viewport.height };
    const palmSizePx = distance2D(
      { x: wrist.x * viewport.width, y: wrist.y * viewport.height },
      { x: middleMcp.x * viewport.width, y: middleMcp.y * viewport.height },
    );
    const palmNormal = cross(vector(wrist, indexMcp), vector(wrist, pinkyMcp));
    const normalLength = Math.max(Math.hypot(palmNormal.x, palmNormal.y, palmNormal.z), 0.001);
    const normalizedNormal = {
      x: palmNormal.x / normalLength,
      y: palmNormal.y / normalLength,
      z: palmNormal.z / normalLength,
    };
    const zValues = hand.map((point) => point.z || 0);
    const depthSpread = Math.max(...zValues) - Math.min(...zValues);
    const depthPenalty = clamp(depthSpread / (palmSize * 1.8), 0, 1);
    const palmFacingScore = clamp(Math.abs(normalizedNormal.z) * 0.72 + (1 - depthPenalty) * 0.28, 0, 1);
    const palmMove = lastContext ? distance2D(lastContext.screenPalmCenter, screenPalmCenter) : 0;
    const pointerMove = lastContext ? distance2D(lastContext.pointerPoint, pointerPoint) : 0;
    const stabilityScore = clamp(1 - palmMove / 95, 0, 1);
    const inFrameRatio = hand.filter((point) =>
      point.x >= 0.02 && point.x <= 0.98 && point.y >= 0.02 && point.y <= 0.98
    ).length / hand.length;
    const zone = updateScreenZone(palmCenter, now);
    const profile = getCalibrationProfile();
    const minPalmFacingScore = profile?.palmFacingScore
      ? clamp(profile.palmFacingScore * 0.55, 0.12, constants.minPalmFacingForSensitive)
      : constants.minPalmFacingForSensitive;
    const referencePalmSizePx = profile?.palmSizePx || constants.defaultReferencePalmSizePx;
    const distanceScale = clamp(palmSizePx / Math.max(referencePalmSizePx, 1), 0, 2);

    const context = {
      palmCenter,
      screenPalmCenter,
      pointerPoint,
      palmSize,
      palmSize2D,
      palmSizePx,
      fingerSpread,
      palmNormal: normalizedNormal,
      palmFacingScore,
      depthSpread,
      stabilityScore,
      inFrameRatio,
      screenZone: zone.stableZone,
      rawScreenZone: zone.rawZone,
      candidateScreenZone: zone.candidateZone,
      zoneLevel: zone.level,
      zoneBlend: zone.blend,
      zoneModifier: zone,
      partialHandThreshold: zone.partialHandThreshold,
      minPalmFacingScore,
      confidence: handConfidence,
      lowConfidence: handConfidence > 0 && handConfidence < constants.minHandConfidence,
      partialHand: inFrameRatio < zone.partialHandThreshold,
      angleUnstable: palmFacingScore < minPalmFacingScore,
      referencePalmSizePx,
      distanceScale,
      farGestureMode: distanceScale < constants.farGestureDistanceScale || palmSizePx < constants.farGesturePalmSizePx,
      tooFarForCommands:
        distanceScale < constants.minCommandDistanceScale ||
        palmSizePx < constants.minAbsoluteCommandPalmSizePx,
      tooFarForPointer:
        distanceScale < Math.max(0.08, constants.minPointerDistanceScale + zone.pointerDistanceScaleBonus) ||
        palmSizePx < constants.minAbsolutePointerPalmSizePx,
      fastMotion: pointerMove > 120,
      palmMove,
      pointerMove,
      timestamp: now,
    };
    lastContext = context;
    return context;
  }

  function getThresholds(context) {
    const profile = getCalibrationProfile();
    const calibratedPalmSizePx = profile?.palmSizePx || context.palmSizePx || 90;
    const palmFacingPenalty = 1 - context.palmFacingScore;
    const farPenalty = context.distanceScale < 0.72
      ? (0.72 - context.distanceScale) * constants.farDistanceAnglePenalty
      : 0;
    const minCommandConfidence = context.lowConfidence || context.partialHand
      ? 0.76
      : constants.minCommandConfidence;
    const sensitiveBoost = context.zoneModifier?.sensitiveConfidenceBoost || 0;

    return {
      angleThreshold: clamp(
        constants.angleThreshold -
          (profile ? 7 : 0) +
          palmFacingPenalty * 10 +
          farPenalty -
          (context.zoneModifier?.angleRelax || 0),
        126,
        154,
      ),
      distanceRatioPip: constants.distanceRatioPip,
      distanceRatioDip: constants.distanceRatioDip,
      touchDistanceRatio: clamp(
        (profile?.touchDistanceRatio || constants.touchDistanceRatio) *
          (context.angleUnstable ? 0.9 : 1) *
          (context.tooFarForCommands ? 0.82 : 1),
        0.22,
        0.48,
      ),
      touchRatio: clamp(
        (profile?.touchDistanceRatio || constants.touchDistanceRatio) *
          (context.angleUnstable ? 0.9 : 1) *
          (context.tooFarForCommands ? 0.82 : 1),
        0.22,
        0.48,
      ),
      swipeMinDistance: clamp(Math.max(70.2, calibratedPalmSizePx * 1.15, getViewport().width * 0.105), 62, 145),
      swipeMaxVerticalDrift: clamp(Math.max(64, calibratedPalmSizePx * 0.88), 55, 120),
      minCommandConfidence,
      minSensitiveCommandConfidence: Math.max(
        minCommandConfidence,
        constants.minSensitiveCommandConfidence + sensitiveBoost * 0.6,
      ),
      minSensitiveConfidence: Math.max(
        minCommandConfidence,
        constants.minSensitiveCommandConfidence + sensitiveBoost * 0.6,
      ),
      underlineStartConfidence: constants.underlineStartConfidence,
      previousPageHoldMs: 1000,
      previousHoldMs: 1000,
      openPalmHoldMs: 1000,
      clearHoldMs: 1000,
      pointerAllowed: !context.tooFarForPointer,
      commandDistanceAllowed: !context.tooFarForCommands,
      openPalmSpreadRatio: profile?.fingerSpread
        ? clamp(profile.fingerSpread * 0.72, 0.62, 1.6)
        : 0.85,
      partialHandThreshold: context.partialHandThreshold,
      screenZone: context.screenZone,
      zoneLevel: context.zoneLevel,
      zoneBlend: context.zoneBlend,
      smoothingBoost: context.zoneModifier?.smoothingBoost || 0,
    };
  }

  function getFingerStates(hand, thresholds) {
    const wrist = hand[0];
    const palmSize = Math.max(distance3D(wrist, hand[9]), 0.001);

    function getFingerState(mcpIndex, pipIndex, dipIndex, tipIndex) {
      const [mcp, pip, dip, tip] = [hand[mcpIndex], hand[pipIndex], hand[dipIndex], hand[tipIndex]];
      const anglePip = angle3D(mcp, pip, dip);
      const angleDip = angle3D(pip, dip, tip);
      const wristToTip = distance3D(wrist, tip);
      const wristToPip = distance3D(wrist, pip);
      const wristToDip = distance3D(wrist, dip);
      const tipPipRatio = wristToTip / Math.max(wristToPip, 0.001);
      const tipDipRatio = wristToTip / Math.max(wristToDip, 0.001);
      const commandAngle = thresholds.angleThreshold + STRICT_COMMAND_ANGLE_OFFSET;
      const commandPip = thresholds.distanceRatioPip + STRICT_COMMAND_DISTANCE_PIP_BONUS;
      const commandDip = thresholds.distanceRatioDip + STRICT_COMMAND_DISTANCE_DIP_BONUS;
      const angleScore = Math.min(
        scoreThreshold(anglePip, thresholds.angleThreshold - 10, commandAngle),
        scoreThreshold(angleDip, thresholds.angleThreshold - 14, commandAngle),
      );
      const distanceScore = Math.min(
        scoreThreshold(tipPipRatio, thresholds.distanceRatioPip * 0.96, commandPip),
        scoreThreshold(tipDipRatio, thresholds.distanceRatioDip * 0.96, commandDip),
      );
      const verticalDeltaRatio = (pip.y - tip.y) / palmSize;
      const verticalScore = scoreThreshold(verticalDeltaRatio, 0.02, 0.20);
      const rawScore = clamp(Math.max(
        angleScore * 0.58 + distanceScore * 0.34 + verticalScore * 0.08,
        verticalScore * 0.72 + angleScore * 0.20 + distanceScore * 0.08,
      ), 0, 1);
      const foldedByDistance =
        tipPipRatio < thresholds.distanceRatioPip * 0.90 ||
        tipDipRatio < thresholds.distanceRatioDip * 0.90;
      const score = foldedByDistance ? Math.min(rawScore, 0.38) : rawScore;
      const strictExtended =
        anglePip > thresholds.angleThreshold &&
        angleDip > thresholds.angleThreshold - 4 &&
        wristToTip > wristToPip * thresholds.distanceRatioPip * 0.98 &&
        wristToTip > wristToDip * thresholds.distanceRatioDip * 0.98;
      const relaxedExtended =
        !foldedByDistance &&
        verticalScore >= 0.62 &&
        anglePip > thresholds.angleThreshold - 18 &&
        angleDip > thresholds.angleThreshold - 24 &&
        tipPipRatio > thresholds.distanceRatioPip * 0.95 &&
        tipDipRatio > thresholds.distanceRatioDip * 0.95;
      const extended = strictExtended || relaxedExtended;
      const commandExtended =
        (
          anglePip > commandAngle &&
          angleDip > commandAngle - 4 &&
          wristToTip > wristToPip * commandPip * 0.98 &&
          wristToTip > wristToDip * commandDip * 0.98
        ) || (extended && score >= 0.62);
      return { extended, commandExtended, score };
    }

    const thumbMcp = hand[2];
    const thumbIp = hand[3];
    const thumbTip = hand[4];
    const palmCenter = {
      x: average([hand[0].x, hand[5].x, hand[9].x, hand[13].x, hand[17].x]),
      y: average([hand[0].y, hand[5].y, hand[9].y, hand[13].y, hand[17].y]),
      z: average([hand[0].z || 0, hand[5].z || 0, hand[9].z || 0, hand[13].z || 0, hand[17].z || 0]),
    };
    const nearestFingerPipRatio = Math.min(
      distance3D(thumbTip, hand[6]),
      distance3D(thumbTip, hand[10]),
      distance3D(thumbTip, hand[14]),
      distance3D(thumbTip, hand[18]),
    ) / palmSize;
    const palmCenterDistanceRatio = distance3D(thumbTip, palmCenter) / palmSize;
    const clearOfPalmScore = clamp(
      scoreThreshold(nearestFingerPipRatio, 0.46, 0.92) * 0.58 +
      scoreThreshold(palmCenterDistanceRatio, 0.52, 1.05) * 0.42,
      0,
      1,
    );
    const thumbTuckedAcrossFist =
      clearOfPalmScore < 0.32 ||
      (nearestFingerPipRatio < 0.58 && palmCenterDistanceRatio < 0.72);
    const thumbAngle = angle3D(thumbMcp, thumbIp, thumbTip);
    const wristTipRatio = distance3D(wrist, thumbTip) / Math.max(distance3D(wrist, thumbIp), 0.001);
    const mcpTipRatio = distance3D(thumbMcp, thumbTip) / palmSize;
    const spreadRatio = distance3D(thumbTip, hand[5]) / palmSize;
    const angleScore = scoreThreshold(thumbAngle, 104, 154);
    const lengthScore = scoreThreshold(mcpTipRatio, 0.26, 0.52);
    const wristScore = scoreThreshold(wristTipRatio, 0.84, 1.08);
    const spreadScore = scoreThreshold(spreadRatio, 0.34, 0.72);
    const tipAboveIpRatio = (thumbIp.y - thumbTip.y) / palmSize;
    const ipAboveMcpRatio = (thumbMcp.y - thumbIp.y) / palmSize;
    const tipAboveMcpRatio = (thumbMcp.y - thumbTip.y) / palmSize;
    const tipAbovePalmRatio = (hand[9].y - thumbTip.y) / palmSize;
    const thumbUpScore = clamp(
      scoreThreshold(tipAboveIpRatio, 0.04, 0.34) * 0.22 +
      scoreThreshold(ipAboveMcpRatio, -0.06, 0.18) * 0.16 +
      scoreThreshold(tipAboveMcpRatio, 0.12, 0.62) * 0.32 +
      scoreThreshold(tipAbovePalmRatio, 0.08, 0.62) * 0.18 +
      lengthScore * 0.12,
      0,
      1,
    );
    const sideScore = clamp(
      angleScore * 0.25 + lengthScore * 0.36 + wristScore * 0.12 + spreadScore * 0.27,
      0,
      1,
    );
    const pinchVisibilityScore = clamp(
      angleScore * 0.38 + lengthScore * 0.42 + wristScore * 0.20,
      0,
      1,
    );
    const thumbScore = Math.max(sideScore, thumbUpScore * 0.94);
    const thumbUpIntent =
      thumbUpScore >= 0.50 &&
      mcpTipRatio >= 0.32 &&
      tipAboveMcpRatio >= 0.22 &&
      tipAbovePalmRatio >= 0.14 &&
      thumbAngle >= 98 &&
      (clearOfPalmScore >= 0.24 || tipAboveMcpRatio >= 0.42);
    const thumbSideIntent =
      sideScore >= 0.52 &&
      spreadRatio >= 0.56 &&
      mcpTipRatio >= 0.38 &&
      clearOfPalmScore >= 0.38;
    const thumbExtended =
      (!thumbTuckedAcrossFist && thumbScore >= 0.40) ||
      thumbUpIntent ||
      thumbSideIntent;
    const thumbCommand =
      (!thumbTuckedAcrossFist && thumbScore >= 0.52 && clearOfPalmScore >= 0.34) ||
      (thumbUpIntent && thumbUpScore >= 0.54) ||
      thumbSideIntent;

    const index = getFingerState(5, 6, 7, 8);
    const middle = getFingerState(9, 10, 11, 12);
    const ring = getFingerState(13, 14, 15, 16);
    const pinky = getFingerState(17, 18, 19, 20);
    return {
      palmSize,
      thumb: thumbExtended,
      thumbCommand,
      thumbScore,
      thumbAngle,
      thumbMcpTipRatio: mcpTipRatio,
      thumbSpreadRatio: spreadRatio,
      thumbUpScore,
      thumbUpIntent,
      thumbSideIntent,
      thumbSideSpreadScore: sideScore,
      thumbPinchVisibilityScore: pinchVisibilityScore,
      thumbTuckedAcrossFist,
      thumbClearOfPalmScore: clearOfPalmScore,
      thumbTipAboveMcpRatio: tipAboveMcpRatio,
      index: index.extended,
      middle: middle.extended,
      ring: ring.extended,
      pinky: pinky.extended,
      indexCommand: index.commandExtended,
      middleCommand: middle.commandExtended,
      ringCommand: ring.commandExtended,
      pinkyCommand: pinky.commandExtended,
      indexScore: index.score,
      middleScore: middle.score,
      ringScore: ring.score,
      pinkyScore: pinky.score,
    };
  }

  function score(hand, context, thresholds) {
    const fingers = getFingerStates(hand, thresholds);
    const palmSize = fingers.palmSize;
    const thumbIndexDistance3D = distance3D(hand[4], hand[8]);
    const thumbIndexDistance2D = distance2D(hand[4], hand[8]);
    const thumbIndexRatio3D = thumbIndexDistance3D / Math.max(palmSize, 0.001);
    const thumbIndexRatio2D = thumbIndexDistance2D / Math.max(context.palmSize2D || palmSize, 0.001);
    const thumbIndexRatio = Math.min(thumbIndexRatio3D, thumbIndexRatio2D);
    const indexMiddleDistance = distance3D(hand[8], hand[12]);
    const indexMiddleRatio = indexMiddleDistance / palmSize;
    const touchThreshold = thresholds.touchDistanceRatio;
    const relaxedTouchThreshold = touchThreshold * 1.2;
    const middleTouchThreshold = palmSize * clamp(thresholds.touchDistanceRatio * 1.32, 0.32, 0.62);
    const pinchPoseReady =
      fingers.indexScore >= 0.58 &&
      fingers.thumbPinchVisibilityScore >= 0.42 &&
      !fingers.thumbTuckedAcrossFist;
    const thumbIndexTouch = thumbIndexRatio < touchThreshold && pinchPoseReady;
    const relaxedThumbIndexTouch = thumbIndexRatio < relaxedTouchThreshold && pinchPoseReady;
    const indexMiddleTouch = indexMiddleDistance < middleTouchThreshold;
    const nonThumbScores = [fingers.indexScore, fingers.middleScore, fingers.ringScore, fingers.pinkyScore];
    const maxNonThumbScore = Math.max(...nonThumbScores);
    const nonThumbOpenCount = nonThumbScores.filter((value) => value >= 0.72).length;
    const strongNonThumbOpenCount = nonThumbScores.filter((value) => value >= 0.84).length;
    const nonThumbCommandCount = [
      fingers.indexCommand,
      fingers.middleCommand,
      fingers.ringCommand,
      fingers.pinkyCommand,
    ].filter(Boolean).length;
    const twoFingerReady =
      (fingers.indexCommand || fingers.index || fingers.indexScore >= 0.55) &&
      (fingers.middleCommand || fingers.middle || fingers.middleScore >= 0.45) &&
      fingers.ringScore < 0.85 &&
      fingers.pinkyScore < 0.85;
    const rawPinkyOnly =
      (fingers.pinkyCommand || fingers.pinky || fingers.pinkyScore >= 0.44) &&
      !fingers.indexCommand &&
      !fingers.middleCommand &&
      Math.max(fingers.indexScore, fingers.middleScore) < 0.84 &&
      fingers.ringScore < 0.96;
    const intentionalIndexMiddleTouch = indexMiddleTouch && twoFingerReady;
    const thumbUpIntent =
      fingers.thumbUpIntent &&
      fingers.thumbUpScore >= 0.54 &&
      fingers.thumbTipAboveMcpRatio >= 0.22 &&
      fingers.thumbMcpTipRatio >= 0.32 &&
      (fingers.thumbClearOfPalmScore >= 0.24 || fingers.thumbTipAboveMcpRatio >= 0.42);
    const thumbSideIntent =
      fingers.thumbSideIntent &&
      fingers.thumbSideSpreadScore >= 0.54 &&
      fingers.thumbSpreadRatio >= 0.58 &&
      fingers.thumbMcpTipRatio >= 0.38 &&
      fingers.thumbClearOfPalmScore >= 0.38;
    const thumbFallbackIntent =
      fingers.thumbCommand &&
      fingers.thumbScore >= 0.64 &&
      fingers.thumbClearOfPalmScore >= 0.40 &&
      (fingers.thumbSpreadRatio >= 0.58 || fingers.thumbTipAboveMcpRatio >= 0.32);
    const thumbGestureIntent = thumbUpIntent || thumbSideIntent || thumbFallbackIntent;
    const tuckedThumbFistLike = fingers.thumbTuckedAcrossFist && !thumbUpIntent && !thumbSideIntent;
    const closedFistLike =
      tuckedThumbFistLike ||
      (
        !thumbGestureIntent &&
        nonThumbOpenCount === 0 &&
        strongNonThumbOpenCount === 0 &&
        context.fingerSpread < thresholds.openPalmSpreadRatio * 0.72
      );
    const rawThumbOnly =
      thumbGestureIntent &&
      !thumbIndexTouch &&
      !intentionalIndexMiddleTouch &&
      !closedFistLike &&
      nonThumbCommandCount <= 1 &&
      nonThumbOpenCount <= 1 &&
      strongNonThumbOpenCount === 0 &&
      maxNonThumbScore < 0.86;
    const rawOpenPalm =
      fingers.index &&
      fingers.middle &&
      fingers.ring &&
      fingers.pinky &&
      context.fingerSpread >= thresholds.openPalmSpreadRatio * 0.78;
    const touchScore = clamp(1 - thumbIndexRatio / Math.max(touchThreshold, 0.001), 0, 1);
    const relaxedTouchScore = clamp(1 - thumbIndexRatio / Math.max(relaxedTouchThreshold, 0.001), 0, 1);
    const middleTouchScore = clamp(1 - indexMiddleDistance / Math.max(middleTouchThreshold, 0.001), 0, 1);
    const environmentScore = clamp(
      context.palmFacingScore * 0.45 +
      context.stabilityScore * 0.30 +
      context.inFrameRatio * 0.25,
      0,
      1,
    );
    const thumbFoldScore = rawThumbOnly
      ? clamp(fingers.thumbScore * 0.66 + (1 - maxNonThumbScore * 0.45) * 0.34, 0.50, 1)
      : fingers.thumb || fingers.thumbScore >= 0.42
        ? clamp(fingers.thumbScore * 0.72, 0.30, 0.54)
        : 0;
    const underlineBlocked =
      context.lowConfidence ||
      (context.partialHand && relaxedTouchScore < 0.34) ||
      (context.angleUnstable && relaxedTouchScore < 0.48);
    const previousBlocked =
      (context.partialHand && fingers.thumbScore < 0.62) ||
      (context.angleUnstable && context.palmFacingScore < 0.08);
    const swipeBlocked = context.lowConfidence || context.partialHand;
    const clearBlocked =
      context.lowConfidence ||
      context.partialHand ||
      context.angleUnstable ||
      context.tooFarForCommands ||
      context.fastMotion ||
      context.stabilityScore < constants.minStabilityForClear;
    const extendedCount = [fingers.thumb, fingers.index, fingers.middle, fingers.ring, fingers.pinky].filter(Boolean).length;
    const openPalmSpreadScore = clamp(Math.min(
      extendedCount / 5,
      context.fingerSpread / Math.max(thresholds.openPalmSpreadRatio, 0.001),
    ), 0, 1);
    const indexMiddleSeparationScore = clamp(
      scoreThreshold(indexMiddleRatio, 0.08, 0.22) *
        (1 - scoreThreshold(indexMiddleRatio, 0.78, 1.05)),
      0,
      1,
    );
    const nonSwipeFingerScore = clamp(1 - Math.max(fingers.ringScore, fingers.pinkyScore) * 0.55, 0, 1);
    const thumbAwayFromIndexScore = scoreThreshold(
      thumbIndexRatio,
      touchThreshold * 1.08,
      touchThreshold * 1.9,
    );
    const swipeShapeScore =
      fingers.indexScore >= 0.45 && fingers.middleScore >= 0.42
        ? clamp(
            fingers.indexScore * 0.30 +
              fingers.middleScore * 0.30 +
              indexMiddleSeparationScore * 0.20 +
              nonSwipeFingerScore * 0.10 +
              thumbAwayFromIndexScore * 0.10,
            0,
            1,
          )
        : 0;
    const pinkyOnlyScore = rawPinkyOnly
      ? clamp(
          fingers.pinkyScore * 0.72 +
            (1 - Math.max(fingers.indexScore, fingers.middleScore)) * 0.20 +
            (1 - fingers.ringScore) * 0.08,
          0,
          1,
        )
      : 0;
    const candidates = {
      mode_toggle: {
        score: pinkyOnlyScore,
        blockedBy: context.partialHand ? "partial_hand" : "",
      },
      clear_page: {
        score: rawOpenPalm ? clamp(openPalmSpreadScore * 0.44 + environmentScore * 0.56, 0, 1) : 0,
        blockedBy: clearBlocked ? "clear_quality_guard" : "",
      },
      next_page: {
        score: swipeShapeScore > 0
          ? clamp(swipeShapeScore * 0.88 + context.inFrameRatio * 0.12, 0, 1)
          : 0,
        blockedBy: swipeBlocked ? "swipe_quality_guard" : "",
      },
      underline: {
        score: relaxedThumbIndexTouch
          ? clamp(
              (thumbIndexTouch ? 0.54 : 0.45) +
                Math.max(touchScore, relaxedTouchScore * 0.74) * 0.32 +
                environmentScore * 0.14,
              0,
              1,
            )
          : 0,
        blockedBy: underlineBlocked ? "underline_quality_guard" : "",
      },
      previous_page: {
        score: rawThumbOnly ? clamp(0.18 + thumbFoldScore * 0.62 + environmentScore * 0.20, 0, 1) : 0,
        blockedBy: previousBlocked ? "previous_quality_guard" : "",
      },
      pointer: {
        score: clamp(context.inFrameRatio * 0.40 + context.stabilityScore * 0.25 + context.palmFacingScore * 0.35, 0, 1),
        blockedBy: context.partialHand ? "partial_hand" : context.tooFarForPointer ? "too_far" : "",
      },
    };

    return {
      ...fingers,
      mode_toggle: candidates.mode_toggle.blockedBy ? 0 : candidates.mode_toggle.score,
      pointer: fingers.index ? candidates.pointer.score : 0,
      previous: candidates.previous_page.blockedBy ? 0 : candidates.previous_page.score,
      underline: candidates.underline.blockedBy ? 0 : candidates.underline.score,
      next: candidates.next_page.blockedBy ? 0 : candidates.next_page.score,
      clear: candidates.clear_page.blockedBy ? 0 : candidates.clear_page.score,
      thumbIndexRatio,
      thumbIndexRatio3D,
      thumbIndexRatio2D,
      indexMiddleRatio,
      indexMiddleSeparationScore,
      swipeShapeScore,
      pinchPoseReady,
      thumbIntentScore: fingers.thumbScore,
      nonThumbClosed: 1 - maxNonThumbScore,
      twoFinger: twoFingerReady,
      relaxedPinch: relaxedThumbIndexTouch,
      strongPinch: thumbIndexRatio <= touchThreshold * 0.82,
      rawThumbOnly,
      rawUnderlinePinch: thumbIndexTouch,
      rawUnderlineStartPinch: relaxedThumbIndexTouch,
      rawTwoFingerSwipeReady: swipeShapeScore >= 0.52,
      rawOpenPalm,
      rawPinkyOnly,
      closedFistLike,
      maxNonThumbScore,
      candidates,
      context,
    };
  }

  function select(scores, thresholds) {
    const priority = [
      ["mode_toggle", 0.42],
      ["clear_page", thresholds.minSensitiveCommandConfidence],
      ["next_page", Math.max(thresholds.minCommandConfidence, 0.54)],
      ["underline", thresholds.underlineStartConfidence || 0.55],
      ["previous_page", 0.42],
    ];
    let blockedReason = "";
    for (const [command, minimum] of priority) {
      const candidate = scores.candidates[command];
      if (candidate.score > 0 && candidate.blockedBy) blockedReason = `${command}:${candidate.blockedBy}`;
      if (candidate.score >= minimum && !candidate.blockedBy) {
        return { command, confidence: candidate.score, blockedReason: "" };
      }
    }
    return {
      command: null,
      confidence: scores.candidates.pointer.score,
      blockedReason,
    };
  }

  function evaluate(hand, now = performance.now(), handConfidence = 1) {
    const context = getContext(hand, now, handConfidence);
    const thresholds = getThresholds(context);
    const scores = score(hand, context, thresholds);
    return { context, thresholds, scores, exclusive: select(scores, thresholds) };
  }

  return { evaluate, reset, getContext, getThresholds, score, select };
}
