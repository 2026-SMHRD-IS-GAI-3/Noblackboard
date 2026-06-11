function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function smoothStrokePoint(previous, point, {
  normalWeight = 0.42,
  fastWeight = 0.70,
  fastDistance = 60,
} = {}) {
  if (!point) return null;
  if (!previous) return { ...point };
  const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
  const weight = distance > fastDistance ? fastWeight : normalWeight;
  return {
    ...point,
    x: previous.x + (point.x - previous.x) * weight,
    y: previous.y + (point.y - previous.y) * weight,
    rawX: point.x,
    rawY: point.y,
  };
}

export function getStraightenedStroke(points, {
  canvasWidth = Infinity,
  canvasHeight = Infinity,
  slopeDamping = 0.25,
  maxSlope = 0.06,
  extensionPx = 2,
} = {}) {
  if (!points?.length) return null;
  if (points.length < 2) {
    const point = points[0];
    return {
      start: { x: point.x, y: point.y },
      end: { x: point.x + 0.01, y: point.y + 0.01 },
      mode: "raw",
    };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const xRange = Math.max(maxX - minX, 1);
  const centerX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const centerY = median(ys);
  let numerator = 0;
  let denominator = 0;

  points.forEach((point) => {
    const dx = point.x - centerX;
    numerator += dx * (point.y - centerY);
    denominator += dx * dx;
  });

  const rawSlope = denominator > 1 ? numerator / denominator : 0;
  const correctedSlope = clamp(rawSlope * slopeDamping, -maxSlope, maxSlope);
  const direction = last.x >= first.x ? 1 : -1;
  let startX = first.x - extensionPx * direction;
  let endX = last.x + extensionPx * direction;

  if (Math.abs(endX - startX) < xRange * 0.55) {
    startX = direction > 0 ? minX : maxX;
    endX = direction > 0 ? maxX : minX;
  }

  startX = clamp(startX, 0, canvasWidth);
  endX = clamp(endX, 0, canvasWidth);
  const getY = (x) => clamp(centerY + correctedSlope * (x - centerX), 0, canvasHeight);

  return {
    start: { x: startX, y: getY(startX) },
    end: { x: endX, y: getY(endX) },
    mode: "straightened",
    rawSlope,
    correctedSlope,
  };
}
