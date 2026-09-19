import { describe, expect, it } from "vitest";
import { inviteLink, inviteMessage } from "@/lib/invite-email";

const EXPIRES = new Date("2026-03-04T12:00:00Z");

function message(overrides: Partial<Parameters<typeof inviteMessage>[0]> = {}) {
  return inviteMessage({
    email: "newcomer@example.com",
    code: "K7P2-QW4M",
    link: "https://home.example/accept-invite?email=newcomer%40example.com&code=K7P2-QW4M",
    homeName: "The Flat",
    invitedBy: "Alex",
    expiresAt: EXPIRES,
    ...overrides,
  });
}

describe("inviteLink", () => {
  it("carries both halves the accept form asks for", () => {
    const url = new URL(inviteLink("https://home.example", "newcomer@example.com", "K7P2-QW4M"));

    expect(url.origin).toBe("https://home.example");
    expect(url.pathname).toBe("/accept-invite");
    expect(url.searchParams.get("email")).toBe("newcomer@example.com");
    expect(url.searchParams.get("code")).toBe("K7P2-QW4M");
  });

  it("escapes an address a query string would otherwise misread", () => {
    const link = inviteLink("https://home.example", "a+b&c@example.com", "K7P2-QW4M");

    // Unescaped, the & would end the parameter and the + would arrive as a space.
    expect(link).not.toContain("+b&c@");
    expect(new URL(link).searchParams.get("email")).toBe("a+b&c@example.com");
  });

  it("keeps a port and a path-less origin intact", () => {
    expect(inviteLink("http://localhost:3000", "a@example.com", "AAAA-BBBB")).toMatch(
      /^http:\/\/localhost:3000\/accept-invite\?/,
    );
  });
});

describe("inviteMessage", () => {
  it("is addressed to the invited email and names the home in the subject", () => {
    const mail = message();

    expect(mail.to).toBe("newcomer@example.com");
    expect(mail.subject).toContain("The Flat");
    expect(mail.subject).toContain("Alex");
  });

  it("carries the link and the code in both copies", () => {
    const mail = message();

    for (const body of [mail.text, mail.html]) {
      expect(body).toContain("K7P2-QW4M");
      expect(body).toContain("accept-invite");
      expect(body).toContain("The Flat");
    }
  });

  it("states the expiry in the household's own zone, not the server's", () => {
    // The suite runs with TZ=UTC, so a date formatted from the server's clock would
    // read 4 March. Copenhagen is an hour ahead and this instant is still the 4th —
    // the check that matters is that it went through formatInZone at all, which the
    // late-evening case below proves.
    expect(message().text).toContain("4 March 2026");
    expect(message({ expiresAt: new Date("2026-03-04T23:30:00Z") }).text).toContain("5 March 2026");
  });

  it("says what happens if nobody accepts, so it does not read as an alarm", () => {
    expect(message().text).toContain("ignore this message");
  });

  it("escapes a home name that would otherwise be markup", () => {
    const mail = message({ homeName: `<script>alert("x")</script>` });

    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    // The words themselves still arrive; only the angle brackets were defused.
    expect(mail.text).toContain(`<script>alert("x")</script>`);
  });

  it("escapes an inviter's name carrying a quote", () => {
    expect(message({ invitedBy: `Ann "The Boss"` }).html).toContain("&quot;The Boss&quot;");
  });
});
