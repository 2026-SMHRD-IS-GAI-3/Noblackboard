import { describe, expect, it } from "vitest";
import { getStraightenedStroke, smoothStrokePoint } from "../js/gesture/strokeGeometry.js";

describe("stroke geometry", () => {
  it("uses the reference free-writing smoothing weights", () => {
    expect(smoothStrokePoint({ x: 0, y: 0 }, { x: 10, y: 0 })).toMatchObject({ x: 4.2, y: 0 });
    expect(smoothStrokePoint({ x: 0, y: 0 }, { x: 100, y: 0 })).toMatchObject({ x: 70, y: 0 });
  });

  it("dampens a noisy underline into the reference straight geometry", () => {
    const line = getStraightenedStroke([
      { x: 100, y: 300 },
      { x: 200, y: 325 },
      { x: 300, y: 290 },
      { x: 400, y: 320 },
    ], { canvasWidth: 800, canvasHeight: 600 });

    expect(line.mode).toBe("straightened");
    expect(Math.abs(line.correctedSlope)).toBeLessThanOrEqual(0.06);
    expect(line.start.x).toBe(98);
    expect(line.end.x).toBe(402);
  });
});
