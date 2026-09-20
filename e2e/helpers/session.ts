import { SignJWT } from "jose";

/**
 * The secret the app server is started with, and the one this file signs with. Kept
 * here rather than in the Playwright config so the two cannot drift: a cookie signed
 * with anything else is simply not a session.
 */
export const E2E_AUTH_SECRET = "e2e-auth-secret-that-is-long-enough-to-sign-with";

// Both mirror `createSession` in src/lib/auth.ts. They are not imported from there
// because that function writes through next/headers, which only exists in a request.
const COOKIE = "homehub_session";
const MAX_AGE = 60 * 60 * 24 * 30;

/**
 * A session for somebody, as the login action would have left it — so a spec that is
 * not about logging in can start as that person instead of typing their password.
 *
 * Signing it here rather than filling the form saves two page loads and a bcrypt
 * comparison on every test, which is most of what the browser suite used to spend its
 * time on. Nothing is skipped in the process: the app verifies this cookie with the
 * same `jwtVerify` it applies to a real one, and the login form itself is still driven
 * by hand in `auth.spec.ts`, which is the spec that is about it.
 */
export async function sessionCookie(userId: string, url: string, tokenVersion = 0) {
  // `ver` mirrors SESSION_VERSION_CLAIM in src/lib/auth.ts: the app refuses a cookie
  // naming a version the account has moved past, which is how changing a password ends
  // the sessions opened under the old one. A seeded account has never changed one, so
  // zero is right unless a spec says otherwise.
  const token = await new SignJWT({ sub: userId, ver: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(new TextEncoder().encode(E2E_AUTH_SECRET));

  return {
    name: COOKIE,
    value: token,
    url,
    httpOnly: true,
    sameSite: "Lax" as const,
    // The server runs as production does, so its own cookie is marked secure. Chromium
    // counts 127.0.0.1 as a trustworthy origin, which is why that works over http.
    secure: true,
  };
}
