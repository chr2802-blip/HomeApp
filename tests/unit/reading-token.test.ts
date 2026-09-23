import { afterEach, describe, expect, it, vi } from "vitest";

import { readingFor, signReading } from "@/lib/reading-token";

/**
 * The token is a shortcut and nothing more: an import saved untouched is stored as the
 * importer read it, rather than read a second time. So every case below that is not
 * "this exact text, in this home, signed here" has to come back as no shortcut — never as
 * a refusal, and never as a breakdown vouching for text it was not about.
 */

const READING = {
  ingredients: "400 g pasta\nsalt",
  instructions: "Kog pastaen.\nSmag til med salt.",
  steps: [
    { uses: [0], minutes: 10 },
    { uses: [1], minutes: null },
  ],
};

const token = () => signReading("home-a", READING)!;

afterEach(() => vi.unstubAllEnvs());

describe("a signed reading", () => {
  it("vouches for the text it was about, in the home it was read for", () => {
    expect(readingFor(token(), "home-a", READING)).toEqual(READING.steps);
  });

  // A textarea submits its lines with `\r\n`, and a blank line at the end is not a step.
  it("reads the text the way every reader splits it", () => {
    const submitted = {
      ingredients: "400 g pasta\r\nsalt\r\n",
      instructions: "Kog pastaen.\r\n\r\nSmag til med salt.",
    };

    expect(readingFor(token(), "home-a", submitted)).toEqual(READING.steps);
  });

  it("vouches for nothing once a line has been edited", () => {
    expect(readingFor(token(), "home-a", { ...READING, ingredients: "500 g pasta\nsalt" })).toBeNull();
    expect(readingFor(token(), "home-a", { ...READING, instructions: "Kog pastaen." })).toBeNull();
  });

  it("vouches for nothing in another home", () => {
    expect(readingFor(token(), "home-b", READING)).toBeNull();
  });

  it("vouches for nothing it did not sign", () => {
    const [body] = token().split(".");
    const forged = Buffer.from(
      JSON.stringify({ h: "home-a", i: ["2 stk æg, pisket"], s: ["Bag."], c: [{ uses: [0], minutes: 5 }] }),
    ).toString("base64url");

    expect(readingFor(`${forged}.${token().split(".")[1]}`, "home-a", READING)).toBeNull();
    expect(readingFor(`${body}.`, "home-a", READING)).toBeNull();
    expect(readingFor("nonsense", "home-a", READING)).toBeNull();
    expect(readingFor(null, "home-a", READING)).toBeNull();
  });

  it("is no shortcut at all where there is no secret to check it with", () => {
    const signed = token();
    vi.stubEnv("AUTH_SECRET", "");

    expect(signReading("home-a", READING)).toBeNull();
    expect(readingFor(signed, "home-a", READING)).toBeNull();
  });
});
