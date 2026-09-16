import { describe, expect, it } from "vitest";
import { deploymentInfo } from "@/lib/observability";

/**
 * What the System page says is live.
 *
 * Every field is read from the platform's own environment, so the thing worth pinning
 * down is what happens when it says nothing: a deployment that cannot be identified has
 * to read as unknown rather than as a plausible-looking blank, because the page draws
 * the card at all only when there is a commit to name.
 */
const SHA = "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b";

const vercelEnv = (overrides: Record<string, string | undefined> = {}) => ({
  VERCEL_GIT_COMMIT_SHA: SHA,
  VERCEL_GIT_COMMIT_MESSAGE: "Dress each home in a colour of its own",
  VERCEL_GIT_COMMIT_REF: "main",
  VERCEL_GIT_REPO_OWNER: "chr2802-blip",
  VERCEL_GIT_REPO_SLUG: "HomeApp",
  ...overrides,
});

describe("deploymentInfo", () => {
  it("names the commit, its message, its branch and where to read it", () => {
    expect(deploymentInfo(vercelEnv())).toEqual({
      version: "1a2b3c4",
      message: "Dress each home in a colour of its own",
      ref: "main",
      url: `https://github.com/chr2802-blip/HomeApp/commit/${SHA}`,
    });
  });

  // The card is one line saying what is live, not somewhere to read a commit in full.
  it("keeps the subject line and drops the body", () => {
    const message = "Let a person be part of several homes\n\nThe long explanation.";

    expect(deploymentInfo(vercelEnv({ VERCEL_GIT_COMMIT_MESSAGE: message })).message).toBe(
      "Let a person be part of several homes",
    );
  });

  it("has nothing to say off Vercel, rather than something that looks like an answer", () => {
    expect(deploymentInfo({})).toEqual({
      version: null,
      message: null,
      ref: null,
      url: null,
    });
  });

  it("still names the commit when the repository is not known", () => {
    const partial = deploymentInfo(
      vercelEnv({ VERCEL_GIT_REPO_OWNER: undefined, VERCEL_GIT_REPO_SLUG: undefined }),
    );

    expect(partial.version).toBe("1a2b3c4");
    expect(partial.url).toBeNull();
  });

  // An empty string is what an unset platform variable often arrives as, and a blank
  // message rendered as a message would be a card saying nothing at all.
  it("reads a blank message as no message", () => {
    expect(deploymentInfo(vercelEnv({ VERCEL_GIT_COMMIT_MESSAGE: "   " })).message).toBeNull();
  });
});
