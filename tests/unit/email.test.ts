import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mailConfigured, sendEmail } from "@/lib/email";

const CONFIGURED = { RESEND_API_KEY: "re_test_key", EMAIL_FROM: "HomeHub <hub@example.com>" };

const MESSAGE = {
  to: "newcomer@example.com",
  subject: "Alex invited you to The Flat on HomeHub",
  text: "plain words",
  html: "<p>plain words</p>",
};

/** Nothing here should ever reach the network; a test that does is a test that failed. */
function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  // A failed send writes one JSON line. The tests assert on it where that is the
  // point, and it is silenced here so the ones that only care about the outcome do
  // not print a wall of red.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mailConfigured", () => {
  it("needs both a key and a sender", () => {
    expect(mailConfigured(CONFIGURED)).toBe(true);
    expect(mailConfigured({ RESEND_API_KEY: "re_test_key" })).toBe(false);
    expect(mailConfigured({ EMAIL_FROM: "hub@example.com" })).toBe(false);
    expect(mailConfigured({})).toBe(false);
  });

  it("treats blank as unset, which is what an untouched .env line holds", () => {
    expect(mailConfigured({ RESEND_API_KEY: "  ", EMAIL_FROM: "hub@example.com" })).toBe(false);
  });
});

describe("sendEmail", () => {
  it("posts the message and reports it sent", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ id: "abc" }), { status: 200 }));

    expect(await sendEmail(MESSAGE, CONFIGURED)).toEqual({ sent: true });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "HomeHub <hub@example.com>",
      to: ["newcomer@example.com"],
      subject: MESSAGE.subject,
      text: MESSAGE.text,
      // Both copies go: some clients show only one, and so do some people.
      html: MESSAGE.html,
    });
  });

  it("sends nothing at all when the installation has no mail configured", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 200 }));

    expect(await sendEmail(MESSAGE, {})).toEqual({
      sent: false,
      reason: "Email is not configured on this installation.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("names the key when the server rejects it, so it does not read as a bug", async () => {
    stubFetch(new Response("unauthorised", { status: 401 }));

    expect(await sendEmail(MESSAGE, CONFIGURED)).toEqual({
      sent: false,
      reason: "The mail server rejected this installation's key.",
    });
  });

  it("distinguishes a refused address from a rate limit", async () => {
    stubFetch(new Response("bad address", { status: 422 }));
    expect(await sendEmail(MESSAGE, CONFIGURED)).toMatchObject({
      reason: "The mail server refused the address it was given.",
    });

    stubFetch(new Response("slow down", { status: 429 }));
    expect(await sendEmail(MESSAGE, CONFIGURED)).toMatchObject({
      reason: "The mail server is rate-limiting this installation.",
    });
  });

  it("does not throw when the network does", async () => {
    stubFetch(new TypeError("fetch failed"));

    expect(await sendEmail(MESSAGE, CONFIGURED)).toEqual({
      sent: false,
      reason: "The mail server could not be reached.",
    });
  });

  it("logs the failed recipient as one JSON line, and not the message body", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(new Response("no such sending domain", { status: 403 }));

    await sendEmail(MESSAGE, CONFIGURED);

    const line = JSON.parse(logged.mock.calls[0]![0] as string);
    expect(line).toMatchObject({ level: "error", event: "email_failed", to: MESSAGE.to });
    // Which address failed is the whole question when somebody says it never arrived.
    // What the message said is not, and a body in the logs is a body kept for ever.
    expect(line.detail).toContain("no such sending domain");
    expect(JSON.stringify(line)).not.toContain(MESSAGE.html);
  });
});
