import { describe, expect, it, vi } from "vitest";
import { createFreeWritingEngine } from "../js/gesture/engines/freeWritingEngine.js";
import { createStraightUnderlineEngine } from "../js/gesture/engines/straightUnderlineEngine.js";

function createInput(overrides = {}) {
  return {
    enabled: true,
    pinchIntent: false,
    rawPinch: false,
    thumbIndexRatio: 0.7,
    point: { xRatio: 0.4, yRatio: 0.5 },
    now: 100,
    confidence: 0.8,
    thresholds: { touchRatio: 0.38 },
    context: { palmSize: 0.12 },
    strokeMode: "freewriting",
    tool: "pen",
    ...overrides,
  };
}

describe.each([
  ["freewriting", createFreeWritingEngine],
  ["straight", createStraightUnderlineEngine],
])("%s gesture engine", (_name, createEngine) => {
  it("does not claim a stroke when thumb and index are separated", () => {
    const emitPhase = vi.fn(() => true);
    const engine = createEngine({ emitPhase });
    const result = engine.update(createInput());
    expect(result.claimed).toBe(false);
    expect(emitPhase).not.toHaveBeenCalled();
  });

  it("bridges a short hand loss and ends after a long loss", () => {
    const phases = [];
    const engine = createEngine({
      emitPhase: (phase) => {
        phases.push(phase);
        return true;
      },
    });

    engine.update(createInput({
      pinchIntent: true,
      rawPinch: true,
      thumbIndexRatio: 0.2,
      now: 100,
    }));
    expect(engine.isActive()).toBe(true);
    expect(engine.markLost(180, { reason: "hand_lost" })).toBe(true);

    const bridge = engine.update(createInput({
      pinchIntent: true,
      rawPinch: true,
      thumbIndexRatio: 0.2,
      point: { xRatio: 0.43, yRatio: 0.5 },
      now: 220,
    }));
    expect(bridge.phase).toBe("bridge");
    expect(phases).toContain("bridge");

    engine.markLost(300, { reason: "hand_lost" });
    const restart = engine.update(createInput({
      pinchIntent: true,
      rawPinch: true,
      thumbIndexRatio: 0.2,
      point: { xRatio: 0.9, yRatio: 0.9 },
      now: 900,
    }));
    expect(restart.phase).toBe("restart");
    expect(phases.filter((phase) => phase === "start")).toHaveLength(2);
  });

  it("uses strict touch release when configured for presentation strokes", () => {
    const phases = [];
    const engine = createEngine({
      config: { continueTouchMultiplier: 1 },
      emitPhase: (phase) => {
        phases.push(phase);
        return true;
      },
    });

    engine.update(createInput({
      pinchIntent: true,
      rawPinch: true,
      thumbIndexRatio: 0.2,
      now: 100,
    }));

    const grace = engine.update(createInput({
      pinchIntent: false,
      rawPinch: false,
      thumbIndexRatio: 0.42,
      now: 130,
    }));
    expect(grace.phase).toBe("grace");
    expect(engine.isActive()).toBe(true);

    const end = engine.update(createInput({
      pinchIntent: false,
      rawPinch: false,
      thumbIndexRatio: 0.42,
      now: 250,
    }));
    expect(end.phase).toBe("end");
    expect(engine.isActive()).toBe(false);
    expect(phases).toEqual(["start", "end"]);
  });
});
