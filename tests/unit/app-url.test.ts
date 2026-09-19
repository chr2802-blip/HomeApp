import { beforeEach, describe, expect, it, vi } from "vitest";

const headerStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => headerStore.get(name.toLowerCase()) ?? null,
  }),
}));

const { appOrigin } = await import("@/lib/app-url");

beforeEach(() => headerStore.clear());

describe("appOrigin", () => {
  it("uses the address the request arrived at", async () => {
    headerStore.set("host", "home.example");

    expect(await appOrigin({})).toBe("https://home.example");
  });

  it("prefers the host a proxy rewrote, which is the public one", async () => {
    headerStore.set("host", "internal-7.vercel.internal");
    headerStore.set("x-forwarded-host", "home.example");

    expect(await appOrigin({})).toBe("https://home.example");
  });

  it("believes a proxy that says the request came in over http", async () => {
    headerStore.set("host", "home.example");
    headerStore.set("x-forwarded-proto", "http");

    expect(await appOrigin({})).toBe("http://home.example");
  });

  it("takes the first protocol when a chain of proxies each added one", async () => {
    headerStore.set("host", "home.example");
    headerStore.set("x-forwarded-proto", "https, http");

    expect(await appOrigin({})).toBe("https://home.example");
  });

  it("assumes http only for a bare localhost", async () => {
    headerStore.set("host", "localhost:3000");
    expect(await appOrigin({})).toBe("http://localhost:3000");

    headerStore.set("host", "localhost.example.com");
    expect(await appOrigin({})).toBe("https://localhost.example.com");
  });

  it("lets APP_URL override the request, since an emailed link cannot be recalled", async () => {
    headerStore.set("host", "some-one-off-deployment.vercel.app");

    expect(await appOrigin({ APP_URL: "https://home.example" })).toBe("https://home.example");
  });

  it("drops a trailing slash from APP_URL, which a pasted address usually has", async () => {
    expect(await appOrigin({ APP_URL: "https://home.example/" })).toBe("https://home.example");
  });

  it("answers null rather than guessing when there is no address to be had", async () => {
    expect(await appOrigin({})).toBeNull();
  });
});
