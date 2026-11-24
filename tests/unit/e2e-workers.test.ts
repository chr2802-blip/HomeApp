import { describe, expect, it } from "vitest";
import { e2eWorkerCount } from "../../e2e/helpers/servers";

/**
 * How many browser workers the suite runs. The cloud container's answer is the one that
 * cost two failed pushes to find, so it is held here rather than remembered.
 */
describe("e2eWorkerCount", () => {
  it("runs one worker per core, up to four, on an ordinary machine", () => {
    expect(e2eWorkerCount({}, 2)).toBe(2);
    expect(e2eWorkerCount({}, 16)).toBe(4);
    expect(e2eWorkerCount({}, 0)).toBe(1);
  });

  it("runs one in a Claude Code cloud container, whatever it reports", () => {
    expect(e2eWorkerCount({ CLAUDE_CODE_REMOTE: "true" }, 4)).toBe(1);
  });

  it("does what E2E_WORKERS says, there and everywhere", () => {
    expect(e2eWorkerCount({ E2E_WORKERS: "3", CLAUDE_CODE_REMOTE: "true" }, 4)).toBe(3);
    expect(e2eWorkerCount({ E2E_WORKERS: "2" }, 16)).toBe(2);
  });

  it("ignores an E2E_WORKERS that is not a whole number above zero", () => {
    expect(e2eWorkerCount({ E2E_WORKERS: "0" }, 4)).toBe(4);
    expect(e2eWorkerCount({ E2E_WORKERS: "many" }, 4)).toBe(4);
  });
});
