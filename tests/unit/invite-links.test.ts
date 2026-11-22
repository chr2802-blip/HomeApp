import { describe, expect, it } from "vitest";
import { generateLinkToken, hashLinkToken, linkProblem } from "@/lib/invite-links";
import { isJoinPath, joinPath } from "@/lib/invite-link-options";

const now = new Date("2026-11-22T12:00:00Z");
const later = new Date("2026-11-29T12:00:00Z");

describe("invitation links", () => {
  it("makes a token nobody guesses, safe in an address", () => {
    const token = generateLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateLinkToken()).not.toBe(token);
  });

  it("hashes the token, ignoring the whitespace a paste brings", () => {
    expect(hashLinkToken("abc")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashLinkToken(" abc\n")).toBe(hashLinkToken("abc"));
  });

  it("says why a link cannot be used, or nothing when it can", () => {
    expect(linkProblem(null, now)).toBe("unknown");
    expect(linkProblem({ expiresAt: now, uses: 0, maxUses: 5 }, now)).toBe("expired");
    expect(linkProblem({ expiresAt: later, uses: 5, maxUses: 5 }, now)).toBe("usedUp");
    expect(linkProblem({ expiresAt: later, uses: 4, maxUses: 5 }, now)).toBeNull();
  });

  it("tells a made link from words in an action's note", () => {
    expect(isJoinPath(joinPath("x"))).toBe(true);
    expect(isJoinPath("Saved.")).toBe(false);
    expect(isJoinPath(undefined)).toBe(false);
  });
});
