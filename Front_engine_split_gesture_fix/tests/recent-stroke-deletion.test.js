import { describe, expect, it } from "vitest";
import {
  createRecentStrokeDeletionTracker,
  findRecentStroke,
  getDistanceToStroke,
} from "../js/gesture/recentStrokeDeletion.js";

const stroke = {
  id: "stroke-1",
  createdAt: 100,
  points: [
    { xRatio: 0.1, yRatio: 0.5 },
    { xRatio: 0.9, yRatio: 0.5 },
  ],
};

describe("recent stroke deletion", () => {
  it("measures the pointer distance to a stroke segment", () => {
    expect(getDistanceToStroke({ x: 500, y: 520 }, stroke, 1000, 1000)).toBe(20);
  });

  it("only selects strokes created within three seconds and inside 50px", () => {
    expect(findRecentStroke([stroke], { x: 500, y: 540 }, {
      now: 3000,
      width: 1000,
      height: 1000,
    })?.stroke.id).toBe("stroke-1");
    expect(findRecentStroke([stroke], { x: 500, y: 560 }, {
      now: 3000,
      width: 1000,
      height: 1000,
    })).toBeNull();
    expect(findRecentStroke([stroke], { x: 500, y: 500 }, {
      now: 3201,
      width: 1000,
      height: 1000,
    })).toBeNull();
  });

  it("deletes after an 800ms hold and requires leaving before another deletion", () => {
    const tracker = createRecentStrokeDeletionTracker();
    const input = {
      pageNo: 1,
      strokes: [stroke],
      point: { x: 500, y: 520 },
      width: 1000,
      height: 1000,
    };
    expect(tracker.update({ ...input, now: 1000 }).progress).toBe(0);
    expect(tracker.update({ ...input, now: 1400 }).progress).toBe(0.5);
    expect(tracker.update({ ...input, now: 1800 }).deleteStrokeId).toBe("stroke-1");
    expect(tracker.update({ ...input, now: 1900 }).reason).toBe("leave_required");
    tracker.update({ ...input, point: { x: 500, y: 700 }, now: 2000 });
    expect(tracker.update({ ...input, now: 2100 }).active).toBe(true);
  });
});
