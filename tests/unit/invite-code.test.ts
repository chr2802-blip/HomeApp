import { describe, expect, it } from "vitest";
import {
  generateInviteCode,
  hashInviteCode,
  inviteCodeMatches,
  normalizeInviteCode,
} from "@/lib/invite-code";

describe("generateInviteCode", () => {
  it("produces a dashed 8-character code", () => {
    expect(generateInviteCode()).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("avoids characters that are easy to misread out loud", () => {
    const codes = Array.from({ length: 200 }, generateInviteCode).join("");
    expect(codes).not.toMatch(/[OI10]/);
  });

  it("does not repeat itself", () => {
    const codes = new Set(Array.from({ length: 200 }, generateInviteCode));
    expect(codes.size).toBeGreaterThan(190);
  });
});

describe("normalizeInviteCode", () => {
  it("strips dashes, spaces and case", () => {
    expect(normalizeInviteCode("k7p2-qw4m")).toBe("K7P2QW4M");
    expect(normalizeInviteCode(" K7P2 QW4M ")).toBe("K7P2QW4M");
  });
});

describe("hashInviteCode", () => {
  it("is stable and hides the code", () => {
    const hash = hashInviteCode("K7P2-QW4M");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashInviteCode("K7P2-QW4M"));
    expect(hash).not.toContain("K7P2");
  });

  it("ignores formatting differences", () => {
    expect(hashInviteCode("k7p2qw4m")).toBe(hashInviteCode("K7P2-QW4M"));
  });

  it("differs for different codes", () => {
    expect(hashInviteCode("K7P2-QW4M")).not.toBe(hashInviteCode("K7P2-QW4N"));
  });
});

describe("inviteCodeMatches", () => {
  const code = "K7P2-QW4M";
  const hash = hashInviteCode(code);

  it("accepts the code however it is typed", () => {
    expect(inviteCodeMatches(code, hash)).toBe(true);
    expect(inviteCodeMatches("k7p2qw4m", hash)).toBe(true);
    expect(inviteCodeMatches(" K7P2-QW4M ", hash)).toBe(true);
  });

  it("rejects a wrong code", () => {
    expect(inviteCodeMatches("K7P2-QW4N", hash)).toBe(false);
    expect(inviteCodeMatches("", hash)).toBe(false);
  });

  it("returns false instead of throwing when the stored hash is malformed", () => {
    expect(inviteCodeMatches(code, "short")).toBe(false);
    expect(inviteCodeMatches(code, "")).toBe(false);
  });
});
