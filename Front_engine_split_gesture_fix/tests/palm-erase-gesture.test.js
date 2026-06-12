import { describe, expect, it } from "vitest";
import { createPalmEraseGestureTracker } from "../js/gesture/palmEraseGesture.js";

const frame = { width: 1000, height: 700, openPalm: true };

describe("palm erase gesture", () => {
  it("fires after an open palm scrubs right and back left", () => {
    const tracker = createPalmEraseGestureTracker();
    tracker.update({ ...frame, point: { xRatio: 0.35, yRatio: 0.5 }, now: 100 });
    tracker.update({ ...frame, point: { xRatio: 0.46, yRatio: 0.51 }, now: 350 });
    const result = tracker.update({
      ...frame,
      point: { xRatio: 0.35, yRatio: 0.5 },
      now: 650,
    });

    expect(result.fired).toBe(true);
    expect(result.directionChanges).toBe(1);
    expect(result.totalDistancePx).toBeGreaterThanOrEqual(150);
  });

  it("does not fire for a one-way swipe or small hand jitter", () => {
    const swipe = createPalmEraseGestureTracker();
    swipe.update({ ...frame, point: { xRatio: 0.2, yRatio: 0.5 }, now: 100 });
    const oneWay = swipe.update({
      ...frame,
      point: { xRatio: 0.4, yRatio: 0.5 },
      now: 350,
    });
    expect(oneWay.fired).toBe(false);

    const jitter = createPalmEraseGestureTracker();
    jitter.update({ ...frame, point: { xRatio: 0.5, yRatio: 0.5 }, now: 100 });
    jitter.update({ ...frame, point: { xRatio: 0.503, yRatio: 0.5 }, now: 200 });
    const small = jitter.update({
      ...frame,
      point: { xRatio: 0.497, yRatio: 0.5 },
      now: 300,
    });
    expect(small.fired).toBe(false);
  });

  it("rejects a mostly vertical movement", () => {
    const tracker = createPalmEraseGestureTracker();
    tracker.update({ ...frame, point: { xRatio: 0.4, yRatio: 0.2 }, now: 100 });
    const result = tracker.update({
      ...frame,
      point: { xRatio: 0.5, yRatio: 0.65 },
      now: 350,
    });

    expect(result.fired).toBe(false);
    expect(result.reason).toBe("vertical_span");
  });
});
