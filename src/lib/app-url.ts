import { headers } from "next/headers";

/**
 * Where this installation is, as an address that works in somebody else's inbox.
 *
 * Every link the app has drawn until now has been relative, because a browser already
 * knows where it is. A link that leaves in an email does not have that luxury and has
 * to be absolute, which means the app has to be told — or work out — its own address.
 *
 * It works it out from the request, because that is right without anybody configuring
 * it: a person is administering the app from the address they reached it at, and that
 * is the address their invitee should be sent to. `APP_URL` overrides it for the case
 * the request cannot answer — a link built from a one-off Vercel deployment address
 * would point at a frozen snapshot of one build for ever, and mail cannot be recalled.
 */
export async function appOrigin(
  env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  const configured = env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const headerList = await headers();
  // x-forwarded-host is what a proxy rewrites Host to; behind none of them it is absent
  // and Host is the one the browser sent.
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return null;

  // Only a bare localhost is assumed to be a laptop. Everything else is https: a
  // proxy that terminates TLS forwards http to the app and says so in this header,
  // and believing it would email an http link for an https site.
  const forwarded = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwarded ?? (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");

  return `${protocol}://${host}`;
}
