function toEntries(values) {
  if (values instanceof Map) return Array.from(values.entries());
  return Object.entries(values || {});
}

function normalizePageMetric(values, totalPage) {
  const normalized = new Map();
  for (let pageNo = 1; pageNo <= Math.max(1, totalPage); pageNo += 1) {
    normalized.set(pageNo, 0);
  }
  toEntries(values).forEach(([pageNo, value]) => {
    normalized.set(Number(pageNo), Math.max(0, Number(value) || 0));
  });
  return normalized;
}

function findLargestPage(metric) {
  let bestPageNo = 1;
  let bestValue = -1;
  metric.forEach((value, pageNo) => {
    if (value > bestValue) {
      bestPageNo = pageNo;
      bestValue = value;
    }
  });
  return { pageNo: bestPageNo, value: Math.max(0, bestValue) };
}

export function buildPresentationReport({
  totalPage = 1,
  pageDurationsMs = {},
  pageMoveCount = 0,
  gestureCounts = {},
} = {}) {
  const durations = normalizePageMetric(pageDurationsMs, totalPage);
  const gestures = normalizePageMetric(gestureCounts, totalPage);
  const longest = findLargestPage(durations);
  const mostGestures = findLargestPage(gestures);

  return {
    pageDurations: Array.from(durations, ([pageNo, durationMs]) => ({
      pageNo,
      durationMs,
      durationSeconds: Math.round(durationMs / 1000),
    })),
    pageMoveCount: Math.max(0, Number(pageMoveCount) || 0),
    longestPage: {
      pageNo: longest.pageNo,
      durationMs: longest.value,
      durationSeconds: Math.round(longest.value / 1000),
    },
    mostGesturePage: {
      pageNo: mostGestures.pageNo,
      count: mostGestures.value,
    },
  };
}
