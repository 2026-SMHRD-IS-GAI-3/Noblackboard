export function normalizeAnchorText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createSpeechAnchorEngine({
  ttlMs = 8000,
  scoreThreshold = 0.78,
  ambiguityGap = 0.12,
  now = () => performance.now(),
} = {}) {
  let active = null;
  let selectedAt = 0;

  return {
    select(candidates = []) {
      const sorted = [...candidates].sort((a, b) => b.score - a.score);
      const best = sorted[0];
      const second = sorted[1];
      if (!best || best.score < scoreThreshold || (second && best.score - second.score < ambiguityGap)) {
        return active;
      }
      active = { ...best.anchor, score: best.score, selectedAt: Date.now() };
      selectedAt = now();
      return active;
    },
    update(anchor) {
      active = anchor ? { ...anchor, selectedAt: anchor.selectedAt || Date.now() } : null;
      selectedAt = active ? now() : 0;
      return active;
    },
    getActive(pageNo) {
      if (!active || now() - selectedAt > ttlMs || (pageNo && active.pageNo !== pageNo)) return null;
      return active;
    },
    clear() {
      active = null;
      selectedAt = 0;
    },
  };
}
