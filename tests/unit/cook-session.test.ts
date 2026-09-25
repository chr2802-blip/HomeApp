import { describe, expect, it } from "vitest";

import { isResumable, parseCookSession, RESUME_WITHIN_MS } from "@/lib/cook-session";

/**
 * What a relaunched app will put a cook back into.
 *
 * The session is read out of the browser's storage, possibly written by an older build,
 * so anything malformed is no session at all rather than a page number from nowhere. And
 * one left behind by a dinner abandoned yesterday must not pull somebody into the kitchen
 * the next time they open the app.
 */

const NOW = Date.UTC(2026, 8, 25, 17, 0);
const MINUTE = 60_000;

describe("parseCookSession", () => {
  it("reads back what was written", () => {
    const session = { recipeId: "r1", page: 3, timers: [{ step: 2, endsAt: NOW }], savedAt: NOW };
    expect(parseCookSession(JSON.stringify(session))).toEqual(session);
  });

  it("is nothing for anything that is not a session", () => {
    for (const raw of [null, "", "not json", "null", "[]", '{"page":1}']) {
      expect(parseCookSession(raw)).toBeNull();
    }
    expect(
      parseCookSession(JSON.stringify({ recipeId: "r1", page: -1, timers: [], savedAt: NOW })),
    ).toBeNull();
  });

  it("drops a malformed timer and keeps the rest", () => {
    const raw = JSON.stringify({
      recipeId: "r1",
      page: 1,
      timers: [{ step: 0, endsAt: NOW }, { step: "x", endsAt: NOW }, null],
      savedAt: NOW,
    });
    expect(parseCookSession(raw)?.timers).toEqual([{ step: 0, endsAt: NOW }]);
  });
});

describe("isResumable", () => {
  const base = { recipeId: "r1", page: 2, timers: [] };

  it("resumes a cook who was away half an hour", () => {
    expect(isResumable({ ...base, savedAt: NOW - 30 * MINUTE }, NOW)).toBe(true);
  });

  it("does not resume a dinner abandoned hours ago", () => {
    expect(isResumable({ ...base, savedAt: NOW - RESUME_WITHIN_MS - MINUTE }, NOW)).toBe(false);
  });

  it("resumes while a long timer is still counting, however long ago it was started", () => {
    const session = {
      ...base,
      savedAt: NOW - 4 * 60 * MINUTE,
      timers: [{ step: 1, endsAt: NOW + 30 * MINUTE }],
    };
    expect(isResumable(session, NOW)).toBe(true);
  });
});
