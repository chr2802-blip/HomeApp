import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BROADCAST_TIMEOUT_MS,
  TOKEN_TTL_SECONDS,
  broadcastListsChanged,
  realtimeConfig,
  realtimeToken,
  type RealtimeConfig,
} from "@/lib/realtime";
import { homeTopic, LIST_CHANGED } from "@/lib/realtime-topic";

const config: RealtimeConfig = {
  url: "https://ref.supabase.co",
  publishableKey: "sb_publishable_x",
  secretKey: "sb_secret_x",
  jwtSecret: "a-jwt-secret",
};

const env = {
  SUPABASE_URL: "https://ref.supabase.co/",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  SUPABASE_SECRET_KEY: "sb_secret_x",
  SUPABASE_JWT_SECRET: "a-jwt-secret",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("realtimeConfig", () => {
  it("is all four settings, with the URL's trailing slash dropped", () => {
    expect(realtimeConfig(env)).toEqual(config);
  });

  // Half a configuration is none: a token nobody can verify, or a socket nobody tells.
  it.each(Object.keys(env))("is off without %s", (missing) => {
    expect(realtimeConfig({ ...env, [missing]: " " })).toBeNull();
  });
});

describe("realtimeToken", () => {
  const now = new Date("2026-09-26T10:00:00Z");
  const { token, expiresAt } = realtimeToken(config, "user-1", ["h1", "h2"], now);
  const [header, payload, signature] = token.split(".");

  it("is an HS256 JWT signed with the project's JWT secret", () => {
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "HS256", typ: "JWT" });
    const expected = createHmac("sha256", config.jwtSecret).update(`${header}.${payload}`).digest("base64url");
    expect(signature).toBe(expected);
  });

  it("carries the claims Realtime and the policy read, and expires soon", () => {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    const issuedAt = now.getTime() / 1000;
    expect(claims).toEqual({
      sub: "user-1",
      role: "authenticated",
      aud: "authenticated",
      iat: issuedAt,
      exp: issuedAt + TOKEN_TTL_SECONDS,
      homes: ["h1", "h2"],
    });
    expect(expiresAt).toBe(claims.exp);
    expect(TOKEN_TTL_SECONDS).toBeLessThanOrEqual(60 * 60);
  });
});

describe("broadcastListsChanged", () => {
  it("sends one private nudge per list, naming nothing but the list", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await broadcastListsChanged(config, "h1", ["l1", "l2"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ref.supabase.co/realtime/v1/api/broadcast");
    expect(init.headers).toMatchObject({ apikey: config.secretKey });
    expect(JSON.parse(String(init.body))).toEqual({
      messages: [
        { topic: "home:h1", event: LIST_CHANGED, payload: { listId: "l1" }, private: true },
        { topic: "home:h1", event: LIST_CHANGED, payload: { listId: "l2" }, private: true },
      ],
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(BROADCAST_TIMEOUT_MS).toBeLessThan(10_000);
  });

  it("sends nothing for no lists", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await broadcastListsChanged(config, "h1", []);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // The write has already happened; a phone that misses the nudge finds out at its poll.
  it("never throws, whether Realtime refuses or cannot be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    await expect(broadcastListsChanged(config, "h1", ["l1"])).resolves.toBeUndefined();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await expect(broadcastListsChanged(config, "h1", ["l1"])).resolves.toBeUndefined();
  });
});

describe("the topic and the policy that guards it", () => {
  // The migration reads the home id back out of the topic by position, so the two have to
  // agree on the prefix — a renamed topic would lock every phone out, silently.
  const sql = readFileSync(
    "prisma/migrations/20260926120000_realtime_home_channels/migration.sql",
    "utf8",
  );
  const prefix = homeTopic("");

  it("matches the prefix the policy checks", () => {
    expect(sql).toContain(`LIKE '${prefix}%'`);
    expect(sql).toContain(`substr((SELECT realtime.topic()), ${prefix.length + 1})`);
  });

  it("reads the same claim the token carries", () => {
    expect(sql).toContain("-> 'homes'");
  });

  it("lets phones listen and never send", () => {
    expect(sql).toContain("FOR SELECT TO authenticated");
    expect(sql).not.toMatch(/FOR (INSERT|ALL)/);
  });
});
