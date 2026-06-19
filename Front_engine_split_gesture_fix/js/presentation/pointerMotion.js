export function getDynamicPointerGain(distanceRatio, {
  minGain = 1.8,
  maxGain = 1.8,
  accelerationStart = 0.025,
  fullGainDistance = 0.22,
} = {}) {
  if (!Number.isFinite(distanceRatio) || distanceRatio <= accelerationStart) return minGain;
  const span = Math.max(0.001, fullGainDistance - accelerationStart);
  const progress = Math.max(0, Math.min(1, (distanceRatio - accelerationStart) / span));
  const easedProgress = progress * progress * (3 - 2 * progress);
  return minGain + (maxGain - minGain) * easedProgress;
}

export function mapDynamicPointerPoint(startPoint, handPoint, options = {}) {
  const startX = Number(startPoint?.xRatio) || 0;
  const startY = Number(startPoint?.yRatio) || 0;
  const handX = Number(handPoint?.xRatio) || 0;
  const handY = Number(handPoint?.yRatio) || 0;
  const deltaX = handX - startX;
  const deltaY = handY - startY;
  const gain = getDynamicPointerGain(Math.hypot(deltaX, deltaY), options);

  return {
    xRatio: startX + deltaX * gain,
    yRatio: startY + deltaY * gain,
    gain,
  };
}
