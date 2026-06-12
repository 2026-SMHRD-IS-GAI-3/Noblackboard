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
  minCommandDistanceScale: 0.08,
  minPointerDistanceScale: 0.06,
  minAbsolutePointerPalmSizePx: 8,
  minAbsoluteCommandPalmSizePx: 10,
  farDistanceAnglePenalty: 2.2,
  distanceCompensationEnabled: true,
  farGestureEnterDistanceScale: 0.34,
  farGestureExitDistanceScale: 0.42,
  farGestureEnterPalmSizePx: 30,
  farGestureExitPalmSizePx: 36,
  farTouchRatioMultiplier: 1.16,
  farUnderlineStartMultiplier: 1.18,
  farUnderlineContinueMultiplier: 1.8,
  farUnderlineConfirmMs: 400,
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
  const distanceTracker = {
    active: false,
  };

  function reset() {
    lastContext = null;
    zoneTracker.stableZone = "center";
    zoneTracker.candidateZone = "center";
    zoneTracker.candidateSince = 0;
    zoneTracker.history = [];
    zoneTracker.blend = 0;
    distanceTracker.active = false;
  }

  function updateDistanceCompensation(distanceScale, palmSizePx) {
    if (!constants.distanceCompensationEnabled) {
      distanceTracker.active = false;
      return {
        enabled: false,
        active: false,
        mode: "standard",
        reason: "disabled",
      };
    }

    const shouldEnter =
      distanceScale <= constants.farGestureEnterDistanceScale ||
      palmSizePx <= constants.farGestureEnterPalmSizePx;
    const shouldExit =
      distanceScale >= constants.farGestureExitDistanceScale &&
      palmSizePx >= constants.farGestureExitPalmSizePx;

    if (!distanceTracker.active && shouldEnter) distanceTracker.active = true;
    else if (distanceTracker.active && shouldExit) distanceTracker.active = false;

    return {
      enabled: true,
      active: distanceTracker.active,
      mode: distanceTracker.active ? "far" : "standard",
      reason: distanceTracker.active ? "small_hand" : "normal_hand",
      enterDistanceScale: constants.farGestureEnterDistanceScale,
      exitDistanceScale: constants.farGestureExitDistanceScale,
      enterPalmSizePx: constants.farGestureEnterPalmSizePx,
      exitPalmSizePx: constants.farGestureExitPalmSizePx,
    };
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
    const rawZoneModifier = getZoneModifier(zone.rawZone, 1);
    const effectiveZoneModifier = {
      level: zone.level,
      angleRelax: Math.max(zone.angleRelax || 0, rawZoneModifier.angleRelax || 0),
      partialHandThreshold: Math.min(zone.partialHandThreshold, rawZoneModifier.partialHandThreshold),
      sensitiveConfidenceBoost: Math.max(zone.sensitiveConfidenceBoost || 0, rawZoneModifier.sensitiveConfidenceBoost || 0),
      pointerDistanceScaleBonus: Math.min(zone.pointerDistanceScaleBonus || 0, rawZoneModifier.pointerDistanceScaleBonus || 0),
      stabilityRelax: Math.max(zone.stabilityRelax || 0, rawZoneModifier.stabilityRelax || 0),
      smoothingBoost: Math.max(zone.smoothingBoost || 0, rawZoneModifier.smoothingBoost || 0),
    };
    const effectivePartialHandThreshold = Math.min(
      effectiveZoneModifier.partialHandThreshold,
    );
    const profile = getCalibrationProfile();
    const minPalmFacingScore = profile?.palmFacingScore
      ? clamp(profile.palmFacingScore * 0.55, 0.12, constants.minPalmFacingForSensitive)
      : constants.minPalmFacingForSensitive;
    const referencePalmSizePx = profile?.palmSizePx || constants.defaultReferencePalmSizePx;
    const distanceScale = clamp(palmSizePx / Math.max(referencePalmSizePx, 1), 0, 2);
    const distanceCompensation = updateDistanceCompensation(distanceScale, palmSizePx);

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
      zoneModifier: effectiveZoneModifier,
      rawZoneModifier,
      partialHandThreshold: effectivePartialHandThreshold,
      minPalmFacingScore,
      confidence: handConfidence,
      lowConfidence: handConfidence > 0 && handConfidence < constants.minHandConfidence,
      partialHand: inFrameRatio < effectivePartialHandThreshold,
      angleUnstable: palmFacingScore < minPalmFacingScore,
      referencePalmSizePx,
      distanceScale,
      distanceCompensation,
      farGestureMode: distanceCompensation.active,
      tooFarForCommands:
        distanceScale < constants.minCommandDistanceScale &&
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
    const sensitiveBoost = context.zoneModifier?.sensitiveConfidenceBoost || 0;
    const farMode = context.distanceCompensation?.active === true;
    const ultraFarMode =
      farMode &&
      (
        context.distanceScale <= constants.minCommandDistanceScale * 1.8 ||
        context.palmSizePx <= constants.minAbsoluteCommandPalmSizePx * 1.8
      );
    const minCommandConfidence = context.lowConfidence || context.partialHand
      ? (ultraFarMode ? 0.64 : farMode ? 0.70 : 0.76)
      : (ultraFarMode ? 0.52 : farMode ? 0.58 : constants.minCommandConfidence);
    const baseTouchRatio = profile?.touchDistanceRatio || constants.touchDistanceRatio;
    const touchRatio = clamp(
      baseTouchRatio *
        (context.angleUnstable ? 0.9 : 1) *
        (farMode ? constants.farTouchRatioMultiplier : 1),
      0.22,
      0.48,
    );

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
      touchDistanceRatio: touchRatio,
      touchRatio,
      swipeMinDistance: ultraFarMode
        ? clamp(getViewport().width * 0.045, 48, 72)
        : farMode
        ? clamp(Math.max(76, calibratedPalmSizePx * 0.72, getViewport().width * 0.07), 76, 110)
        : clamp(Math.max(92, calibratedPalmSizePx * 1.05, getViewport().width * 0.09), 88, 145),
      swipeMaxVerticalDrift: ultraFarMode
        ? clamp(getViewport().height * 0.15, 76, 120)
        : farMode
        ? clamp(Math.max(78, calibratedPalmSizePx * 0.92), 70, 132)
        : clamp(Math.max(64, calibratedPalmSizePx * 0.88), 55, 120),
      swipeMinShapeScore: ultraFarMode ? 0.36 : farMode ? 0.44 : 0.52,
      swipeMinFinalScore: ultraFarMode ? 0.60 : farMode ? 0.68 : 0.75,
      swipeMaxDurationMs: ultraFarMode ? 620 : farMode ? 460 : 340,
      pinchSwipeMinDistance: ultraFarMode
        ? clamp(getViewport().width * 0.04, 46, 68)
        : farMode
        ? clamp(getViewport().width * 0.065, 72, 98)
        : clamp(getViewport().width * 0.085, 96, 125),
      pinchSwipeIntentDistance: ultraFarMode ? 14 : farMode ? 20 : 28,
      pinchSwipeDecisionMs: ultraFarMode ? 135 : farMode ? 115 : 105,
      pinchSwipeMinShapeScore: ultraFarMode ? 0.34 : farMode ? 0.42 : 0.48,
      pinchSwipeMinFinalScore: ultraFarMode ? 0.58 : farMode ? 0.66 : 0.72,
      pinchSwipeMaxDurationMs: ultraFarMode ? 650 : farMode ? 480 : 380,
      minCommandConfidence,
      minSensitiveCommandConfidence: Math.max(
        minCommandConfidence,
        constants.minSensitiveCommandConfidence + sensitiveBoost * 0.6,
      ),
      minSensitiveConfidence: Math.max(
        minCommandConfidence,
        constants.minSensitiveCommandConfidence + sensitiveBoost * 0.6,
      ),
      underlineStartConfidence: farMode
        ? Math.max(0.42, constants.underlineStartConfidence - 0.04)
        : constants.underlineStartConfidence,
      underlineStartTouchMultiplier: farMode ? 1.02 : 0.92,
      underlineContinueTouchMultiplier: farMode ? constants.farUnderlineContinueMultiplier : 1.55,
      underlineConfirmMs: farMode ? constants.farUnderlineConfirmMs : 450,
      distanceCompensationMode: context.distanceCompensation?.mode || "standard",
      ultraFarMode,
      previousPageHoldMs: 520,
      previousHoldMs: 520,
      openPalmHoldMs: 1000,
      clearHoldMs: 1000,
      pointerAllowed: true,
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
      const fingerPathLength =
        distance3D(mcp, pip) +
        distance3D(pip, dip) +
        distance3D(dip, tip);
      const directReachRatio = distance3D(mcp, tip) / palmSize;
      const straightness = distance3D(mcp, tip) / Math.max(fingerPathLength, 0.001);
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
      return {
        extended,
        commandExtended,
        score,
        directReachRatio,
        straightness,
      };
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
      indexDirectReachRatio: index.directReachRatio,
      middleDirectReachRatio: middle.directReachRatio,
      ringDirectReachRatio: ring.directReachRatio,
      pinkyDirectReachRatio: pinky.directReachRatio,
      indexStraightness: index.straightness,
      middleStraightness: middle.straightness,
      ringStraightness: ring.straightness,
      pinkyStraightness: pinky.straightness,
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
    const indexMiddleDistance2D = distance2D(hand[8], hand[12]);
    const indexMiddleRatio = indexMiddleDistance / palmSize;
    const indexMiddleRatio2D =
      indexMiddleDistance2D / Math.max(context.palmSize2D, 0.001);
    const touchThreshold = thresholds.touchDistanceRatio;
    const farMode = context.distanceCompensation?.active === true;
    const startTouchThreshold = clamp(
      touchThreshold * (thresholds.underlineStartTouchMultiplier || 0.92),
      0.24,
      0.44,
    );
    const relaxedTouchThreshold = startTouchThreshold;
    const writingTouchThreshold = clamp(
      touchThreshold * (farMode ? 1.02 : 0.94),
      0.24,
      0.46,
    );
    const sideWritingTouchThreshold = clamp(
      writingTouchThreshold * (farMode ? 1.14 : 1.10),
      0.28,
      0.48,
    );
    const middleTouchThreshold = palmSize * clamp(thresholds.touchDistanceRatio * 1.32, 0.32, 0.62);
    const extendedPinchPoseReady =
      fingers.indexScore >= (farMode ? 0.48 : 0.58) &&
      fingers.thumbPinchVisibilityScore >= (farMode ? 0.32 : 0.42) &&
      !fingers.thumbTuckedAcrossFist;
    const pinchCenter = {
      x: (hand[4].x + hand[8].x) / 2,
      y: (hand[4].y + hand[8].y) / 2,
    };
    const pinchCenterPalmRatio = distance2D(pinchCenter, context.palmCenter) /
      Math.max(context.palmSize2D, 0.001);
    const indexReachRatio = distance2D(hand[5], hand[8]) /
      Math.max(context.palmSize2D, 0.001);
    const thumbReachRatio = distance2D(hand[2], hand[4]) /
      Math.max(context.palmSize2D, 0.001);
    const writingPinchPoseReady =
      thumbIndexRatio2D < writingTouchThreshold &&
      pinchCenterPalmRatio >= (farMode ? 0.62 : 0.68) &&
      indexReachRatio >= (farMode ? 0.48 : 0.52) &&
      thumbReachRatio >= (farMode ? 0.38 : 0.42) &&
      fingers.indexScore >= (farMode ? 0.06 : 0.10);
    const nearSidePinchIntent =
      thumbIndexRatio2D < sideWritingTouchThreshold &&
      pinchCenterPalmRatio >= (farMode ? 0.44 : 0.48) &&
      indexReachRatio >= (farMode ? 0.32 : 0.36) &&
      thumbReachRatio >= (farMode ? 0.26 : 0.30) &&
      fingers.thumbPinchVisibilityScore >= 0.08;
    const pinchApproachIntent =
      thumbIndexRatio2D < sideWritingTouchThreshold * 1.22 &&
      pinchCenterPalmRatio >= (farMode ? 0.40 : 0.44) &&
      indexReachRatio >= (farMode ? 0.28 : 0.32) &&
      thumbReachRatio >= (farMode ? 0.22 : 0.26);
    const sidePinchPoseReady =
      nearSidePinchIntent &&
      (
        fingers.indexScore >= 0.015 ||
        fingers.indexDirectReachRatio >= (farMode ? 0.46 : 0.50)
      );
    const pinchPoseReady =
      extendedPinchPoseReady ||
      writingPinchPoseReady ||
      sidePinchPoseReady;
    const thumbIndexTouch = thumbIndexRatio < touchThreshold && pinchPoseReady;
    const relaxedThumbIndexTouch =
      thumbIndexRatio2D < (
        sidePinchPoseReady
          ? sideWritingTouchThreshold
          : writingPinchPoseReady
            ? writingTouchThreshold
            : relaxedTouchThreshold
      ) &&
      pinchPoseReady;
    const indexMiddleTouch = indexMiddleDistance < middleTouchThreshold;
    const indexMiddleSwipeTouch =
      indexMiddleRatio2D <= (farMode ? 0.52 : 0.46);
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
      !nearSidePinchIntent &&
      !intentionalIndexMiddleTouch &&
      !closedFistLike &&
      nonThumbCommandCount <= 1 &&
      nonThumbOpenCount <= 1 &&
      strongNonThumbOpenCount === 0 &&
      maxNonThumbScore < 0.86;
    const openFingerCount = nonThumbScores.filter((value) => value >= 0.62).length;
    const weakestFingerScore = Math.min(...nonThumbScores);
    const averageOpenFingerScore =
      nonThumbScores.reduce((sum, value) => sum + value, 0) / nonThumbScores.length;
    const openReachCount = [
      [fingers.indexDirectReachRatio, fingers.indexStraightness],
      [fingers.middleDirectReachRatio, fingers.middleStraightness],
      [fingers.ringDirectReachRatio, fingers.ringStraightness],
      [fingers.pinkyDirectReachRatio, fingers.pinkyStraightness],
    ].filter(([reach, straightness]) =>
      reach >= (farMode ? 0.66 : 0.72) &&
      straightness >= (farMode ? 0.58 : 0.62)
    ).length;
    const fingertipSpanRatio = Math.max(
      distance2D(hand[8], hand[12]),
      distance2D(hand[8], hand[16]),
      distance2D(hand[8], hand[20]),
      distance2D(hand[12], hand[16]),
      distance2D(hand[12], hand[20]),
      distance2D(hand[16], hand[20]),
    ) / Math.max(context.palmSize2D, 0.001);
    const clusteredFingertips =
      fingertipSpanRatio < (farMode ? 0.34 : 0.40) &&
      openReachCount < 3;
    const closeFingerOpenPalm =
      openFingerCount === 4 &&
      openReachCount >= 3 &&
      averageOpenFingerScore >= 0.72 &&
      context.fingerSpread >= thresholds.openPalmSpreadRatio * 0.46;
    const rawOpenPalm =
      openFingerCount >= 3 &&
      openReachCount >= 3 &&
      !clusteredFingertips &&
      (
        context.fingerSpread >= thresholds.openPalmSpreadRatio * 0.62 ||
        closeFingerOpenPalm
      ) &&
      !thumbIndexTouch;
    const touchScore = clamp(1 - thumbIndexRatio / Math.max(touchThreshold, 0.001), 0, 1);
    const activeRelaxedTouchThreshold = sidePinchPoseReady
      ? sideWritingTouchThreshold
      : writingPinchPoseReady
        ? writingTouchThreshold
        : relaxedTouchThreshold;
    const relaxedTouchScore = clamp(
      1 - thumbIndexRatio / Math.max(activeRelaxedTouchThreshold, 0.001),
      0,
      1,
    );
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
    const commandDistanceBlocked = context.tooFarForCommands;
    const edgePartialTolerance =
      context.partialHand &&
      context.rawScreenZone !== "center" &&
      context.inFrameRatio >= 0.22;
    const partialHandBlocksUnderline =
      context.partialHand &&
      !(
        edgePartialTolerance &&
        relaxedTouchScore >= (farMode ? 0.14 : 0.20) &&
        pinchCenterPalmRatio >= (
          sidePinchPoseReady
            ? (farMode ? 0.46 : 0.50)
            : (farMode ? 0.54 : 0.58)
        )
      );
    const partialHandBlocksClear =
      context.partialHand &&
      !(
        edgePartialTolerance &&
        context.inFrameRatio >= (openFingerCount >= 3 ? 0.54 : 0.66)
      );
    const underlineBlocked =
      context.lowConfidence ||
      commandDistanceBlocked ||
      partialHandBlocksUnderline ||
      (
        context.angleUnstable &&
        !writingPinchPoseReady &&
        !sidePinchPoseReady &&
        relaxedTouchScore < (farMode ? 0.36 : 0.48)
      );
    const previousBlocked =
      commandDistanceBlocked ||
      (context.partialHand && fingers.thumbScore < 0.62) ||
      (context.angleUnstable && context.palmFacingScore < 0.08);
    const strongOpenPalmShape =
      openFingerCount === 4 &&
      weakestFingerScore >= 0.56 &&
      (
        context.fingerSpread >= thresholds.openPalmSpreadRatio * 0.68 ||
        closeFingerOpenPalm
      );
    const clearBlocked =
      context.lowConfidence ||
      partialHandBlocksClear ||
      (context.angleUnstable && !strongOpenPalmShape) ||
      commandDistanceBlocked ||
      context.stabilityScore < Math.max(
        strongOpenPalmShape ? 0.16 : 0.22,
        constants.minStabilityForClear -
          (strongOpenPalmShape ? 0.18 : 0.08) -
          (context.zoneModifier?.stabilityRelax || 0),
      );
    const extendedCount = [fingers.thumb, fingers.index, fingers.middle, fingers.ring, fingers.pinky].filter(Boolean).length;
    const openPalmSpreadScore = clamp(Math.min(
      extendedCount / 5,
      context.fingerSpread / Math.max(thresholds.openPalmSpreadRatio, 0.001),
    ), 0, 1);
    const openPalmShapeScore = clamp(
      (openFingerCount / 4) * 0.48 +
        averageOpenFingerScore * 0.38 +
        openPalmSpreadScore * 0.14,
      0,
      1,
    );
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
    const forwardTwoFingerReady =
      fingers.indexDirectReachRatio >= (farMode ? 0.58 : 0.64) &&
      fingers.middleDirectReachRatio >= (farMode ? 0.56 : 0.62) &&
      fingers.indexStraightness >= (farMode ? 0.62 : 0.66) &&
      fingers.middleStraightness >= (farMode ? 0.60 : 0.64) &&
      fingers.ringScore < 0.72 &&
      fingers.pinkyScore < 0.72;
    const forwardTwoFingerScore = forwardTwoFingerReady && indexMiddleSwipeTouch
      ? clamp(
          scoreThreshold(fingers.indexDirectReachRatio, 0.54, 1.02) * 0.28 +
            scoreThreshold(fingers.middleDirectReachRatio, 0.52, 1.0) * 0.28 +
            scoreThreshold(fingers.indexStraightness, 0.58, 0.9) * 0.17 +
            scoreThreshold(fingers.middleStraightness, 0.56, 0.88) * 0.17 +
            nonSwipeFingerScore * 0.10 +
            (farMode ? 0.08 : 0),
          0,
          1,
        )
      : 0;
    const standardSwipeShapeScore =
      indexMiddleSwipeTouch &&
      fingers.indexScore >= (farMode ? 0.34 : 0.45) &&
      fingers.middleScore >= (farMode ? 0.32 : 0.42)
        ? clamp(
            (farMode ? 0.10 : 0) +
              fingers.indexScore * 0.30 +
              fingers.middleScore * 0.30 +
              indexMiddleSeparationScore * 0.20 +
              nonSwipeFingerScore * 0.10 +
              thumbAwayFromIndexScore * 0.10,
            0,
            1,
          )
        : 0;
    const swipeShapeScore = Math.max(standardSwipeShapeScore, forwardTwoFingerScore);
    const twoFingerSwipeGuard =
      forwardTwoFingerReady &&
      indexMiddleSwipeTouch &&
      !relaxedThumbIndexTouch;
    const swipeBlocked =
      context.lowConfidence ||
      commandDistanceBlocked ||
      (
        context.partialHand &&
        !(
          forwardTwoFingerReady &&
          context.inFrameRatio >= (farMode ? 0.56 : 0.66)
        )
      );
    const pinchSwipeShapeScore = relaxedThumbIndexTouch
      ? clamp(
          (thumbIndexTouch ? 0.62 : 0.52) +
            Math.max(touchScore, relaxedTouchScore * 0.8) * 0.28 +
            context.inFrameRatio * 0.10,
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
        blockedBy: commandDistanceBlocked ? "too_far" : context.partialHand ? "partial_hand" : "",
      },
      clear_page: {
        score: rawOpenPalm && !twoFingerSwipeGuard
          ? clamp(openPalmShapeScore * 0.58 + environmentScore * 0.42, 0, 1)
          : 0,
        blockedBy: commandDistanceBlocked
          ? "too_far"
          : twoFingerSwipeGuard
            ? "two_finger_swipe_guard"
            : clearBlocked
              ? "clear_quality_guard"
              : "",
      },
      next_page: {
        score: swipeShapeScore > 0 && !pinchApproachIntent
          ? clamp(swipeShapeScore * 0.88 + context.inFrameRatio * 0.12, 0, 1)
          : 0,
        blockedBy: commandDistanceBlocked
          ? "too_far"
          : pinchApproachIntent
            ? "pinch_approach_guard"
            : rawOpenPalm
              ? "open_palm_guard"
              : swipeBlocked
                ? "swipe_quality_guard"
                : "",
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
        blockedBy: commandDistanceBlocked
          ? "too_far"
          : underlineBlocked
            ? "underline_quality_guard"
            : "",
      },
      previous_page: {
        score: rawThumbOnly ? clamp(0.18 + thumbFoldScore * 0.62 + environmentScore * 0.20, 0, 1) : 0,
        blockedBy: commandDistanceBlocked ? "too_far" : previousBlocked ? "previous_quality_guard" : "",
      },
      pointer: {
        score: clamp(context.inFrameRatio * 0.40 + context.stabilityScore * 0.25 + context.palmFacingScore * 0.35, 0, 1),
        blockedBy: context.partialHand ? "partial_hand" : "",
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
      indexMiddleRatio2D,
      indexMiddleSwipeTouch,
      indexMiddleSeparationScore,
      swipeShapeScore,
      standardSwipeShapeScore,
      forwardTwoFingerReady,
      forwardTwoFingerScore,
      twoFingerSwipeGuard,
      pinchSwipeShapeScore,
      pinchPoseReady,
      extendedPinchPoseReady,
      writingPinchPoseReady,
      sidePinchPoseReady,
      nearSidePinchIntent,
      pinchApproachIntent,
      pinchCenterPalmRatio,
      indexReachRatio,
      thumbReachRatio,
      writingTouchThreshold,
      sideWritingTouchThreshold,
      startTouchThreshold,
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
      openFingerCount,
      weakestFingerScore,
      averageOpenFingerScore,
      openReachCount,
      fingertipSpanRatio,
      clusteredFingertips,
      closeFingerOpenPalm,
      openPalmShapeScore,
      strongOpenPalmShape,
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
