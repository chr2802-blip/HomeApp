/**
 * Stand-ins for the per-request Next.js APIs the server actions depend on. The stores
 * are plain module state that tests can reset and inspect, which lets the real auth,
 * session and rate-limit code run unchanged outside a request.
 */

export const cookieStore = new Map<string, string>();
export const headerStore = new Map<string, string>();

/** Thrown in place of Next's redirect(), which normally unwinds the request. */
export class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT: ${url}`);
    this.name = "RedirectError";
  }
}

type CookieInit = { name: string; value: string } & Record<string, unknown>;

export const cookiesMock = {
  get(name: string) {
    const value = cookieStore.get(name);
    return value === undefined ? undefined : { name, value };
  },
  set(nameOrInit: string | CookieInit, value?: string) {
    if (typeof nameOrInit === "object") cookieStore.set(nameOrInit.name, nameOrInit.value);
    else cookieStore.set(nameOrInit, value ?? "");
  },
  delete(name: string) {
    cookieStore.delete(name);
  },
  getAll() {
    return [...cookieStore].map(([name, value]) => ({ name, value }));
  },
};

export const headersMock = {
  get(name: string) {
    return headerStore.get(name.toLowerCase()) ?? null;
  },
};

export function resetRequestState() {
  cookieStore.clear();
  headerStore.clear();
  // A stable client address, so rate-limit keys are predictable per test.
  headerStore.set("x-forwarded-for", "203.0.113.10");
}

/** Simulates a different client, which gets its own rate-limit bucket. */
export function setClientIp(ip: string) {
  headerStore.set("x-forwarded-for", ip);
}

export function hasSessionCookie() {
  return cookieStore.has("homehub_session");
}
