import { afterEach, describe, expect, it, vi } from "vitest";
import { lookup } from "node:dns/promises";
import { MAX_REDIRECTS, isBlockedAddress, isBlockedHost, safeFetch } from "@/lib/safe-fetch";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
const resolve = vi.mocked(lookup) as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.unstubAllGlobals();
  resolve.mockReset();
});

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "100.64.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "0.0.0.0",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "fc00::1",
    "ff02::1",
    // IPv4 wearing IPv6, every way a URL or a resolver writes it.
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "[::ffff:7f00:1]",
    "::ffff:a9fe:a9fe",
    "64:ff9b::a9fe:a9fe",
    "not an address",
  ])("refuses %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::6810:84e5", "::ffff:93.184.216.34"])(
    "lets %s through",
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    },
  );
});

describe("isBlockedHost", () => {
  it("refuses the names that mean this machine, and private literals in a URL", () => {
    for (const url of [
      "http://localhost/",
      "http://app.localhost/",
      "http://printer.local/",
      "http://metadata.google.internal/",
      "http://[::ffff:127.0.0.1]/",
      "http://2130706433/",
      "http://0x7f.1/",
    ]) {
      expect(isBlockedHost(new URL(url).hostname), url).toBe(true);
    }
  });

  it("does not judge an ordinary name by how it is spelled", () => {
    expect(isBlockedHost("fd-recipes.example")).toBe(false);
    expect(isBlockedHost("example.com")).toBe(false);
  });
});

describe("safeFetch", () => {
  const page = (status: number, headers: Record<string, string> = {}) =>
    new Response(status >= 300 && status < 400 ? null : "ok", { status, headers });

  it("refuses a public-looking name that resolves somewhere private, before asking it", async () => {
    resolve.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(safeFetch(new URL("https://innocent.example/"))).rejects.toThrow(/public internet/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a name with any one private address among public ones", async () => {
    resolve.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "::1", family: 6 },
    ]);
    vi.stubGlobal("fetch", vi.fn());

    await expect(safeFetch(new URL("https://split.example/"))).rejects.toThrow(/public internet/);
  });

  it("checks a redirect before following it, rather than where the chain ended", async () => {
    resolve.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page(302, { location: "http://169.254.169.254/latest/meta-data" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(safeFetch(new URL("https://example.com/r"))).rejects.toThrow(/public internet/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ redirect: "manual" });
  });

  it("follows an ordinary redirect, relative to where it came from", async () => {
    resolve.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page(301, { location: "/recipe" }))
      .mockResolvedValueOnce(page(200));
    vi.stubGlobal("fetch", fetchMock);

    const response = await safeFetch(new URL("https://example.com/old"));
    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[1]![0])).toBe("https://example.com/recipe");
  });

  it("gives up on a chain longer than a page needs", async () => {
    resolve.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    vi.stubGlobal("fetch", vi.fn(async () => page(302, { location: "/again" })));

    await expect(safeFetch(new URL("https://example.com/loop"))).rejects.toThrow(
      new RegExp(`${MAX_REDIRECTS} redirects`),
    );
  });

  it("passes a resolver failure on, which a caller reads as unreachable", async () => {
    resolve.mockRejectedValue(Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }));
    vi.stubGlobal("fetch", vi.fn());

    await expect(safeFetch(new URL("https://recipes.invalid/"))).rejects.toThrow(/ENOTFOUND/);
  });
});
