import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { generateInviteCode, hashInviteCode } from "@/lib/invite-code";
import { cookieStore } from "./next-mocks";
import { pngBytes } from "./images";

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

/**
 * A task, recurring by default. Pass `intervalDays: null` for a one-off — the caller
 * has to say so, because "no interval given" is how every other option here means
 * "whatever the usual is".
 */
export function createTask(options: {
  homeId: string;
  createdById: string;
  title?: string;
  intervalDays?: number | null;
  nextDueAt?: Date;
  lastCompletedAt?: Date | null;
  lastNotifiedAt?: Date | null;
  assigneeId?: string | null;
}) {
  return prisma.task.create({
    data: {
      homeId: options.homeId,
      createdById: options.createdById,
      title: options.title ?? "Water the plants",
      intervalDays: options.intervalDays === undefined ? 7 : options.intervalDays,
      nextDueAt: options.nextDueAt ?? new Date(),
      lastCompletedAt: options.lastCompletedAt ?? null,
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
 * Every recipe is filed under at least one category, so one is made alongside unless
 * the caller names the headings it belongs under — which keeps the tests that do not
 * care about categories from having to mention them.
 */
export async function createRecipe(options: {
  homeId: string;
  createdById: string;
  categoryIds?: string[];
  title?: string;
  description?: string | null;
  ingredients?: string;
  videoUrl?: string | null;
}) {
  const categoryIds =
    options.categoryIds ?? [(await createRecipeCategory({ homeId: options.homeId })).id];

  return prisma.recipe.create({
    data: {
      homeId: options.homeId,
      createdById: options.createdById,
      categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      title: options.title ?? "Pancakes",
      description: options.description ?? null,
      ingredients: options.ingredients ?? "Flour\nMilk",
      instructions: "Mix and fry.",
      videoUrl: options.videoUrl ?? null,
    },
  });
}

/**
 * A stored picture, already through the checks a real upload goes through — the tests
 * that care about those call `storePhoto` themselves.
 */
export function createPhoto(options: { homeId: string; createdAt?: Date }) {
  return prisma.photo.create({
    data: {
      homeId: options.homeId,
      contentType: "image/png",
      width: 40,
      height: 30,
      bytes: pngBytes(40, 30),
      thumbWidth: 20,
      thumbHeight: 15,
      thumbBytes: pngBytes(20, 15),
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    },
  });
}

/**
 * A form as the browser would send it. A field given several values is repeated, which
 * is how a group of checkboxes arrives — the recipe categories being the reason this
 * takes a list at all.
 */
export function formData(fields: Record<string, string | string[] | undefined>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    for (const one of Array.isArray(value) ? value : [value]) data.append(key, one);
  }
  return data;
}

/**
 * Calls an action the way React's useActionState does — with the previous result
 * first — so tests read as the form does rather than repeating `undefined` everywhere.
 */
export function submit<R>(
  action: (previous: undefined, data: FormData) => Promise<R>,
  fields: Record<string, string | string[] | undefined>,
) {
  return action(undefined, formData(fields));
}
