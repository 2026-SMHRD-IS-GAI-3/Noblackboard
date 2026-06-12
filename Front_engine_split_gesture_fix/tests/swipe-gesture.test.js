import { describe, expect, it } from "vitest";
import { createSwipeGestureTracker } from "../js/gesture/swipeGesture.js";

describe("swipe gesture tracker", () => {
  it("combines pose and fast fingertip movement scores", () => {
    const tracker = createSwipeGestureTracker();
    tracker.update({
      point: { xRatio: 0.20, yRatio: 0.50 },
      shapeScore: 0.80,
      now: 100,
      width: 1000,
      height: 700,
    });
    const result = tracker.update({
      point: { xRatio: 0.36, yRatio: 0.51 },
      shapeScore: 0.80,
      now: 280,
      width: 1000,
      height: 700,
    });
    expect(result.fired).toBe(true);
    expect(result.motionScore).toBeGreaterThanOrEqual(0.88);
    expect(result.finalScore).toBeGreaterThanOrEqual(0.75);
  });

  it("does not fire for slow, vertical, or weak-pose movement", () => {
    const slow = createSwipeGestureTracker();
    slow.update({ point: { xRatio: 0.2, yRatio: 0.5 }, shapeScore: 0.8, now: 100, width: 1000, height: 700 });
    expect(slow.update({
      point: { xRatio: 0.36, yRatio: 0.5 },
      shapeScore: 0.8,
      now: 450,
      width: 1000,
      height: 700,
    }).fired).toBe(false);

    const vertical = createSwipeGestureTracker();
    vertical.update({ point: { xRatio: 0.2, yRatio: 0.4 }, shapeScore: 0.8, now: 100, width: 1000, height: 700 });
    expect(vertical.update({
      point: { xRatio: 0.36, yRatio: 0.7 },
      shapeScore: 0.8,
      now: 250,
      width: 1000,
      height: 700,
    }).fired).toBe(false);

    const weak = createSwipeGestureTracker();
    expect(weak.update({
      point: { xRatio: 0.2, yRatio: 0.5 },
      shapeScore: 0.4,
      now: 100,
      width: 1000,
      height: 700,
    }).tracking).toBe(false);
  });

  it("accepts per-update far-distance thresholds", () => {
    const tracker = createSwipeGestureTracker();
    tracker.update({
      point: { xRatio: 0.20, yRatio: 0.50 },
      shapeScore: 0.48,
      now: 100,
      width: 1000,
      height: 700,
      minShapeScore: 0.42,
      minFinalScore: 0.66,
      maxDurationMs: 480,
      minDistancePx: 80,
    });
    const result = tracker.update({
      point: { xRatio: 0.29, yRatio: 0.51 },
      shapeScore: 0.48,
      now: 300,
      width: 1000,
      height: 700,
      minShapeScore: 0.42,
      minFinalScore: 0.66,
      maxDurationMs: 480,
      minDistancePx: 80,
    });

    expect(result.fired).toBe(true);
    expect(result.distancePx).toBeGreaterThanOrEqual(80);
  });

  it("arms for a few frames before measuring pinch-swipe motion", () => {
    const tracker = createSwipeGestureTracker({ armFrames: 3, armMs: 100 });
    expect(tracker.update({
      point: { xRatio: 0.20, yRatio: 0.50 },
      shapeScore: 0.80,
      now: 100,
      width: 1000,
      height: 700,
    }).reason).toBe("arming_started");
    expect(tracker.update({
      point: { xRatio: 0.22, yRatio: 0.50 },
      shapeScore: 0.80,
      now: 140,
      width: 1000,
      height: 700,
    }).armed).toBe(false);

    const result = tracker.update({
      point: { xRatio: 0.36, yRatio: 0.51 },
      shapeScore: 0.80,
      now: 210,
      width: 1000,
      height: 700,
    });

    expect(result.armed).toBe(true);
    expect(result.fired).toBe(true);
    expect(result.distancePx).toBeGreaterThanOrEqual(150);
  });

  it("resets instead of firing for leftward motion", () => {
    const tracker = createSwipeGestureTracker();
    tracker.update({ point: { xRatio: 0.40, yRatio: 0.5 }, shapeScore: 0.8, now: 100, width: 1000, height: 700 });
    const result = tracker.update({
      point: { xRatio: 0.22, yRatio: 0.5 },
      shapeScore: 0.8,
      now: 200,
      width: 1000,
      height: 700,
    });
    expect(result.fired).toBe(false);
    expect(result.reason).toBe("wrong_direction");
    expect(tracker.isTracking()).toBe(false);
  });
});
