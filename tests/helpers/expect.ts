import { expect } from "vitest";
import { RedirectError } from "./next-mocks";

/** Runs an action that is expected to redirect, and returns where it went. */
export async function captureRedirect(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (error instanceof RedirectError) return error.url;
    throw error;
  }
  throw new Error("Expected the action to redirect, but it returned normally.");
}

export async function expectRedirect(run: () => Promise<unknown>, url: string) {
  expect(await captureRedirect(run)).toBe(url);
}

/** Asserts an action was refused by the home-scoping checks. */
export async function expectDenied(run: () => Promise<unknown>) {
  await expect(run()).rejects.toThrow("Not allowed");
}

/** Asserts an action bounced an anonymous caller to the login page. */
export async function expectRedirectToLogin(run: () => Promise<unknown>) {
  await expectRedirect(run, "/login");
}
