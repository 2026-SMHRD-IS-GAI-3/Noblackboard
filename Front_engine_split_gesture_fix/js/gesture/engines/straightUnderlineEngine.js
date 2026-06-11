import { createFreeWritingEngine } from "./freeWritingEngine.js";

export function createStraightUnderlineEngine(options = {}) {
  const base = createFreeWritingEngine({
    ...options,
    config: {
      requiredFrames: 1,
      lostGraceMs: 220,
      releaseGraceMs: 90,
      newStrokeOnlyMs: 500,
      continueTouchMultiplier: 1.75,
      bridgeMinRatio: 0.14,
      bridgeMaxRatio: 0.24,
      ...(options.config || {}),
    },
  });

  const rawUpdate = base.update;
  const rawMarkLost = base.markLost;
  base.name = "straight";
  base.update = (input = {}) => rawUpdate({ ...input, strokeMode: "straight" });
  base.markLost = (now, detail = {}) => rawMarkLost(now, { ...detail, engine: "straight" });
  return base;
}
