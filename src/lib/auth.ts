import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { HomeTheme, MemberRole, PlatformRole } from "@prisma/client";
import { prisma } from "./prisma";
import { DEFAULT_THEME } from "./theme";

const COOKIE = "homehub_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(value);
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** One of the homes somebody belongs to, as the switcher and the checks need it. */
export type Membership = {
  id: string;
  name: string;
  photoId: string | null;
  /** The colour it is dressed in, so a home is recognised in the list before it is read. */
  theme: HomeTheme;
  role: MemberRole;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  /**
   * Every home this person belongs to, in the order they joined them. This is what
   * says where they may go — `homeId` below only says where they are.
   */
  homes: Membership[];
  /** The home being read right now, drawn from `homes`. */
  homeId: string | null;
  homeName: string | null;
  /** The home's own picture, shown wherever the home is named. */
  homePhotoId: string | null;
  /** Their own picture, shown wherever they are named. */
  photoId: string | null;
  /**
   * The colour that home is dressed in, which the root layout puts on the document so
   * the whole app — sheets and menus included — is wearing it.
   */
  homeTheme: HomeTheme;
  /**
   * What they may do in that home, or null when it is not one of theirs — which only
   * a super admin, looking into a household they are not in, ever is.
   */
  homeRole: MemberRole | null;
};

/**
 * Cached per request: the layout and the page below it both need the session, and
 * without this each render costs a second identical round trip to the database.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string") return null;
    userId = payload.sub;
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      activeHome: { select: { id: true, name: true, photoId: true, theme: true } },
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          home: { select: { id: true, name: true, photoId: true, theme: true } },
        },
      },
    },
  });
  if (!user) return null;

  const homes: Membership[] = user.memberships.map((membership) => ({
    ...membership.home,
    role: membership.role,
  }));

  // The stored choice is a preference, not a permission. It stands while it is still
  // one of their homes — or, for a super admin, still a home at all — and otherwise
  // they land in the first one they joined. Nothing is written back: a membership
  // revoked while somebody was reading another home would otherwise wait to surprise
  // them, and a page render is no place to start correcting the database.
  const active =
    homes.find((home) => home.id === user.activeHomeId) ??
    (user.role === "SUPER_ADMIN" ? user.activeHome : null) ??
    homes[0] ??
    null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    homes,
    homeId: active?.id ?? null,
    homeName: active?.name ?? null,
    homePhotoId: active?.photoId ?? null,
    photoId: user.photoId,
    // Somebody between homes, or on a page that belongs to none, gets the app's own
    // colours rather than the last home's.
    homeTheme: active?.theme ?? DEFAULT_THEME,
    homeRole: homes.find((home) => home.id === active?.id)?.role ?? null,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * A user reading one of their homes. Somebody in no home at all — a super admin before
 * they have looked into one, or a person whose last membership was revoked — is sent to
 * the list of their homes, which is the only page that has anything to tell them.
 */
export async function requireHomeUser(): Promise<SessionUser & { homeId: string }> {
  const user = await requireUser();
  if (!user.homeId) redirect("/homes");
  return user as SessionUser & { homeId: string };
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") redirect("/dashboard");
  return user;
}

/**
 * Somebody who runs at least one home — the gate on being offered administration at
 * all, and never the answer to whether a particular home is theirs.
 *
 * The name says "any" because the shorter one did not, and that cost us a bug: paired
 * with the home on screen it reads like a permission check and is not one, which let an
 * admin of the flat administer the summer house's recipe categories. Which home is
 * theirs to run is the second question, asked per home by `assertHomeAdmin` against the
 * id the action was given, or by `canAdministerCurrentHome` when the action takes its
 * home from the session.
 */
export async function requireAnyHomeAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN" && !user.homes.some((home) => home.role === "ADMIN")) {
    redirect("/dashboard");
  }
  return user;
}
