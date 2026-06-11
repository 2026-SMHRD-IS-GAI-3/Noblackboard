import { describe, expect, it } from "vitest";
import { buildPresentationReport } from "../js/presentation/report.js";

describe("presentation report", () => {
  it("summarizes page duration, movement, and gesture metrics", () => {
    const report = buildPresentationReport({
      totalPage: 3,
      pageDurationsMs: new Map([[1, 12000], [2, 45000], [3, 8000]]),
      pageMoveCount: 4,
      gestureCounts: new Map([[1, 1], [2, 2], [3, 5]]),
    });

    expect(report.pageMoveCount).toBe(4);
    expect(report.longestPage).toEqual({ pageNo: 2, durationMs: 45000, durationSeconds: 45 });
    expect(report.mostGesturePage).toEqual({ pageNo: 3, count: 5 });
    expect(report.pageDurations).toHaveLength(3);
  });

  it("fills pages without activity with zero values", () => {
    const report = buildPresentationReport({ totalPage: 2 });
    expect(report.pageDurations).toEqual([
      { pageNo: 1, durationMs: 0, durationSeconds: 0 },
      { pageNo: 2, durationMs: 0, durationSeconds: 0 },
    ]);
    expect(report.mostGesturePage).toEqual({ pageNo: 1, count: 0 });
  });
});
