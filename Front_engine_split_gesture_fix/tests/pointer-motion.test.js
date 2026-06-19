import { describe, expect, it } from "vitest";
import {
  getDynamicPointerGain,
  mapDynamicPointerPoint,
} from "../js/presentation/pointerMotion.js";

describe("dynamic pointer motion", () => {
  it("keeps small movements at a minimum 1.8x speed", () => {
    expect(getDynamicPointerGain(0.02)).toBe(1.8);
    expect(mapDynamicPointerPoint(
      { xRatio: 0.5, yRatio: 0.5 },
      { xRatio: 0.52, yRatio: 0.5 },
    )).toMatchObject({
      xRatio: 0.536,
      yRatio: 0.5,
      gain: 1.8,
    });
  });

  it("uses the configured fixed 1.8x pointer speed for larger movements", () => {
    const medium = getDynamicPointerGain(0.12);
    const large = mapDynamicPointerPoint(
      { xRatio: 0.5, yRatio: 0.5 },
      { xRatio: 0.75, yRatio: 0.5 },
    );

    expect(medium).toBe(1.8);
    expect(large.gain).toBe(1.8);
    expect(large.xRatio).toBeCloseTo(0.95, 5);
  });
});
