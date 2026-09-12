import { afterAll, beforeEach, vi } from "vitest";
import {
  RedirectError,
  cookiesMock,
  headersMock,
  resetRequestState,
} from "../helpers/next-mocks";

vi.mock("next/headers", () => ({
  cookies: async () => cookiesMock,
  headers: async () => headersMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// getCurrentUser is wrapped in React's cache(), which expects a render scope.
// Outside one it must simply call through, or a test would see the previous
// test's session.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});

const { resetDatabase, disconnect } = await import("../helpers/db");

beforeEach(async () => {
  resetRequestState();
  await resetDatabase();
});

afterAll(async () => {
  await disconnect();
});
