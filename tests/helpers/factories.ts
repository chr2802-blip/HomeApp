import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { generateInviteCode, hashInviteCode } from "@/lib/invite-code";
import { cookieStore } from "./next-mocks";

let counter = 0;
const unique = () => `${Date.now().toString(36)}-${counter++}`;

export const TEST_PASSWORD = "correct-horse-battery";

export function createHome(overrides: { name?: string; address?: string | null } = {}) {
  return prisma.home.create({
    data: {
      name: overrides.name ?? `Home ${unique()}`,
      address: overrides.address ?? null,
    },
  });
}

export async function createUser(
  options: {
    homeId?: string | null;
    role?: Role;
    email?: string;
    name?: string;
    password?: string;
  } = {},
) {
  return prisma.user.create({
    data: {
      email: options.email ?? `user-${unique()}@example.com`,
      name: options.name ?? "Test User",
      passwordHash: await hashPassword(options.password ?? TEST_PASSWORD),
      role: options.role ?? "USER",
      homeId: options.homeId ?? null,
    },
  });
}

/** A home with an admin and a plain member already in it. */
export async function createHomeWithMembers() {
  const home = await createHome();
  const admin = await createUser({ homeId: home.id, role: "ADMIN" });
  const member = await createUser({ homeId: home.id, role: "USER" });
  return { home, admin, member };
}

/** Puts a valid session cookie in place, exactly as a real login would. */
export async function signIn(user: { id: string }) {
  await createSession(user.id);
}

export function signOut() {
  cookieStore.delete("homehub_session");
}

export async function createInviteFor(options: {
  email: string;
  homeId: string;
  createdById: string;
  role?: Role;
  expiresAt?: Date;
  acceptedAt?: Date | null;
}) {
  const code = generateInviteCode();
  const invite = await prisma.invite.create({
    data: {
      email: options.email.toLowerCase(),
      homeId: options.homeId,
      role: options.role ?? "USER",
      codeHash: hashInviteCode(code),
      expiresAt: options.expiresAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      acceptedAt: options.acceptedAt ?? null,
      createdById: options.createdById,
    },
  });
  return { invite, code };
}

export function createTask(options: {
  homeId: string;
  createdById: string;
  title?: string;
  intervalDays?: number;
  nextDueAt?: Date;
  lastNotifiedAt?: Date | null;
  assigneeId?: string | null;
}) {
  return prisma.recurringTask.create({
    data: {
      homeId: options.homeId,
      createdById: options.createdById,
      title: options.title ?? "Water the plants",
      intervalDays: options.intervalDays ?? 7,
      nextDueAt: options.nextDueAt ?? new Date(),
      lastNotifiedAt: options.lastNotifiedAt ?? null,
      assigneeId: options.assigneeId ?? null,
    },
  });
}

export function createList(options: { homeId: string; createdById: string; title?: string }) {
  return prisma.list.create({
    data: {
      homeId: options.homeId,
      createdById: options.createdById,
      title: options.title ?? "Shopping",
    },
  });
}

export function createRecipeCategory(options: { homeId: string; name?: string }) {
  return prisma.recipeCategory.create({
    data: { homeId: options.homeId, name: options.name ?? `Category ${unique()}` },
  });
}

/**
 * Every recipe needs a category, so one is made alongside unless the caller names the
 * category it belongs in — which keeps the tests that do not care about categories from
 * having to mention them.
 */
export async function createRecipe(options: {
  homeId: string;
  createdById: string;
  categoryId?: string;
  title?: string;
  description?: string | null;
  ingredients?: string;
  videoUrl?: string | null;
}) {
  const categoryId =
    options.categoryId ?? (await createRecipeCategory({ homeId: options.homeId })).id;

  return prisma.recipe.create({
    data: {
      homeId: options.homeId,
      createdById: options.createdById,
      categoryId,
      title: options.title ?? "Pancakes",
      description: options.description ?? null,
      ingredients: options.ingredients ?? "Flour\nMilk",
      instructions: "Mix and fry.",
      videoUrl: options.videoUrl ?? null,
    },
  });
}

export function formData(fields: Record<string, string | undefined>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) data.set(key, value);
  }
  return data;
}

/**
 * Calls an action the way React's useActionState does — with the previous result
 * first — so tests read as the form does rather than repeating `undefined` everywhere.
 */
export function submit<R>(
  action: (previous: undefined, data: FormData) => Promise<R>,
  fields: Record<string, string | undefined>,
) {
  return action(undefined, formData(fields));
}
