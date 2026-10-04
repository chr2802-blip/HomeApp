import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetching an address somebody else chose, from this app's own server.
 *
 * A recipe link and a push endpoint are both URLs a person handed us, and both are then
 * requested by the server — which sits on a network a browser on the other end of the
 * internet cannot reach. So every address is checked for where it actually leads before
 * anything is sent to it:
 *
 * - **By name and by number.** `localhost` is refused by name, and every address a name
 *   resolves to is checked by number, because `127.0.0.1.nip.io` or a domain somebody
 *   points at `10.0.0.5` is the same machine wearing a public-looking name.
 * - **Every hop.** Redirects are followed here, one at a time, and each one is checked
 *   before it is requested. `redirect: "follow"` checked only where the chain ended,
 *   which is after the internal address in the middle had already been asked.
 * - **Every spelling.** An IPv4 address can arrive inside an IPv6 one (`::ffff:127.0.0.1`,
 *   which a URL writes as `[::ffff:7f00:1]`), and is judged as the IPv4 address it is.
 *
 * What this cannot close is a name that resolves to a public address when checked and a
 * private one a moment later when fetched (DNS rebinding). Closing that needs the
 * connection itself pinned to the checked address; on a serverless host with no private
 * network behind it, the checks above are the ones that matter.
 */

/** How many redirects a fetch follows before giving up — a browser's own limit is 20. */
export const MAX_REDIRECTS = 5;

/** IPv4 ranges that are not the public internet: [first octet(s), prefix length]. */
const BLOCKED_V4: [number, number, number, number, number][] = [
  [0, 0, 0, 0, 8], // "this network"
  [10, 0, 0, 0, 8], // private
  [100, 64, 0, 0, 10], // carrier-grade NAT
  [127, 0, 0, 0, 8], // loopback
  [169, 254, 0, 0, 16], // link-local, and the cloud metadata address
  [172, 16, 0, 0, 12], // private
  [192, 0, 0, 0, 24], // IETF protocol assignments
  [192, 168, 0, 0, 16], // private
  [198, 18, 0, 0, 15], // benchmarking
  [224, 0, 0, 0, 3], // multicast, reserved and broadcast (224.0.0.0 and up)
];

function v4Number(address: string): number | null {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function blockedV4(address: string): boolean {
  const value = v4Number(address);
  if (value === null) return true;
  return BLOCKED_V4.some(([a, b, c, d, prefix]) => {
    const base = ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return ((value & mask) >>> 0) === ((base & mask) >>> 0);
  });
}

/** An IPv6 address as its eight 16-bit groups, or null if it is not one. */
function v6Groups(address: string): number[] | null {
  let text = address.toLowerCase();
  // A trailing dotted IPv4 (`::ffff:1.2.3.4`) is the last two groups written differently.
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted) {
    const value = v4Number(dotted[1]!);
    if (value === null) return null;
    text = `${text.slice(0, -dotted[1]!.length)}${(value >>> 16).toString(16)}:${(value & 0xffff).toString(16)}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;

  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail].map((group) =>
    /^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN,
  );
  return groups.length === 8 && groups.every((group) => !Number.isNaN(group)) ? groups : null;
}

function blockedV6(address: string): boolean {
  const groups = v6Groups(address);
  if (!groups) return true;
  const [first] = groups as [number, ...number[]];

  // An IPv4 address carried inside IPv6 is judged as the IPv4 address: mapped
  // (::ffff:a.b.c.d), compatible (::a.b.c.d) and NAT64 (64:ff9b::a.b.c.d).
  const embedded = `${groups[6]! >> 8}.${groups[6]! & 0xff}.${groups[7]! >> 8}.${groups[7]! & 0xff}`;
  const leadingZeros = groups.slice(0, 5).every((group) => group === 0);
  if (leadingZeros && (groups[5] === 0xffff || groups[5] === 0)) {
    // `::` and `::1` are themselves, not IPv4 0.0.0.0 and 0.0.0.1 — both blocked either way.
    return blockedV4(embedded);
  }
  if (first === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((group) => group === 0)) {
    return blockedV4(embedded);
  }

  if ((first & 0xffc0) === 0xfe80) return true; // link-local, fe80::/10
  if ((first & 0xfe00) === 0xfc00) return true; // unique local, fc00::/7
  if ((first & 0xff00) === 0xff00) return true; // multicast, ff00::/8
  return false;
}

/** Whether an IP address — either family, as a resolver or a URL writes it — is off-limits. */
export function isBlockedAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "");
  const family = isIP(bare);
  if (family === 4) return blockedV4(bare);
  if (family === 6) return blockedV6(bare);
  return true;
}

/**
 * Whether a URL's hostname is refused before it is even resolved: names that mean this
 * machine, and any IP literal outside the public internet. A name that merely resolves
 * somewhere private is `resolvesPublicly`'s to catch.
 */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host.endsWith(".internal")) return true;
  return isIP(host) ? isBlockedAddress(host) : false;
}

/** Thrown for an address this module will not request; callers treat it as unreachable. */
export class BlockedAddressError extends Error {
  constructor(hostname: string) {
    super(`Refusing to fetch ${hostname}: it is not on the public internet`);
    this.name = "BlockedAddressError";
  }
}

/**
 * Checks a URL and every address its name resolves to. Throws `BlockedAddressError` for
 * one that leads somewhere private, and whatever the resolver throws for a name that does
 * not resolve at all — to a caller, both are "could not reach".
 */
export async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new BlockedAddressError(url.hostname);
  if (isBlockedHost(url.hostname)) throw new BlockedAddressError(url.hostname);

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return;

  const addresses = await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new BlockedAddressError(url.hostname);
  }
}

/**
 * `fetch`, for an address somebody else chose: each hop checked by `assertPublicUrl`
 * before it is requested, at most `MAX_REDIRECTS` of them. The response is the last
 * hop's, so `response.url` is where the page really came from.
 *
 * Rejects where `fetch` would (a timeout, a refused connection), and additionally for an
 * address that leads somewhere private or a chain of redirects too long to be a page.
 */
export async function safeFetch(url: URL, init: RequestInit = {}): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);
    const response = await fetch(current, { ...init, redirect: "manual" });

    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) return response;

    // The body of a redirect is never read; let the connection go.
    await response.body?.cancel().catch(() => {});
    current = new URL(location, current);
  }
  throw new Error(`More than ${MAX_REDIRECTS} redirects`);
}
