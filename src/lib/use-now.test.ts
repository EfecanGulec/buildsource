import { describe, expect, it } from "vitest";
import { countdownText } from "./use-now";

const NOW = Date.parse("2026-11-13T12:00:00Z");
const at = (ms: number) => new Date(NOW + ms).toISOString();

describe("countdownText", () => {
  it("shows days, hours and minutes for long deadlines", () => {
    expect(countdownText(at(2 * 86400000 + 4 * 3600000 + 12 * 60000), NOW)).toBe("2d 4h 12m");
  });

  it("shows hours, minutes and seconds under a day", () => {
    expect(countdownText(at(3600000 + 5 * 60000 + 30000), NOW)).toBe("1h 5m 30s");
  });

  it("shows minutes and seconds under an hour", () => {
    expect(countdownText(at(9 * 60000 + 5000), NOW)).toBe("9m 5s");
  });

  it("shows 0s once the deadline has passed", () => {
    expect(countdownText(at(-1000), NOW)).toBe("0s");
  });

  it("shows a dash when there is no deadline", () => {
    expect(countdownText(null, NOW)).toBe("—");
  });
});
