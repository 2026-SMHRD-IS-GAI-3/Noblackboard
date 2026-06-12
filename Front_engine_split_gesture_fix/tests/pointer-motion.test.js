import { describe, expect, it } from "vitest";
import {
  getDynamicPointerGain,
  mapDynamicPointerPoint,
} from "../js/presentation/pointerMotion.js";

describe("dynamic pointer motion", () => {
  it("keeps small movements at a minimum 1.2x speed", () => {
    expect(getDynamicPointerGain(0.02)).toBe(1.2);
    expect(mapDynamicPointerPoint(
      { xRatio: 0.5, yRatio: 0.5 },
      { xRatio: 0.52, yRatio: 0.5 },
    )).toMatchObject({
      xRatio: 0.524,
      yRatio: 0.5,
      gain: 1.2,
    });
  });

  it("accelerates larger movements up to 1.3x", () => {
    const medium = getDynamicPointerGain(0.12);
    const large = mapDynamicPointerPoint(
      { xRatio: 0.5, yRatio: 0.5 },
      { xRatio: 0.75, yRatio: 0.5 },
    );

    expect(medium).toBeGreaterThan(1.2);
    expect(medium).toBeLessThan(1.3);
    expect(large.gain).toBe(1.3);
    expect(large.xRatio).toBeCloseTo(0.825, 5);
  });
});
