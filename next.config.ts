import type { NextConfig } from "next";

/**
 * Sent on every response. These are the headers that cost nothing to set and close
 * whole classes of attack; a Content-Security-Policy is deliberately not here, because
 * a useful one needs per-request nonces threaded through the app and a half-written
 * one gives the appearance of protection without the substance.
 */
const securityHeaders = [
  // The app is never meant to be framed. Recipe videos are iframes we host, not the
  // other way round.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },

  // Stops a response being reinterpreted as a type it does not claim to be.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Full URLs can carry list and recipe ids, so send them only to ourselves.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Nothing here needs a camera, a microphone or a location.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },

  // Two years, so a stolen session cookie cannot be captured over plain HTTP.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
