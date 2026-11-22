"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { findInviteLink, linkProblem, redeemInviteLink, type Joiner, type LinkProblem } from "@/lib/invite-links";
import { checkRateLimit, clearAttempts, recordFailedAttempt } from "@/lib/rate-limit";
import { currentLanguage } from "@/lib/auth";
import { sayIn, type Say } from "@/lib/copy/say";
import { AUTH } from "@/lib/copy/auth";

export type FormState = { error?: string } | undefined;

/**
 * Compared against when there is no account by that email, so an unknown address costs
 * the same bcrypt round a wrong password does. Answering at once for a stranger and a
 * tenth of a second later for a real account told anyone timing the form which emails
 * have accounts here. A hash of nothing in particular, at the cost `hashPassword` uses.
 */
const NO_ACCOUNT_HASH = "$2b$10$I499.yDmS6fVZrn9617PmOlKo6mgT0dPUrwvUSstp./U34JZ2DJh.";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const say = sayIn(await currentLanguage());

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: say(AUTH.invalidEmailAndPassword) };

  const email = parsed.data.email.toLowerCase();

  const limit = await checkRateLimit("login", email);
  if (!limit.allowed) {
    return { error: say(AUTH.tooManyAttempts, { count: limit.retryAfterMinutes, minutes: limit.retryAfterMinutes }) };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const matches = await verifyPassword(parsed.data.password, user?.passwordHash ?? NO_ACCOUNT_HASH);
  if (!user || !matches) {
    await recordFailedAttempt("login", email);
    return { error: say(AUTH.wrongEmailOrPassword) };
  }

  await clearAttempts("login", email);
  await createSession(user.id, user.tokenVersion);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

function joinSchema(say: Say) {
  return z.object({
    token: z.string().min(1),
    email: z.string().email(say(AUTH.invalidEmailAndPassword)),
    name: z.string().trim().min(1, say(AUTH.enterYourName)).max(100),
    password: z.string().min(8, say(AUTH.passwordMinLength)),
  });
}

function problemText(say: Say, problem: LinkProblem) {
  return say(problem === "expired" ? AUTH.linkExpired : problem === "usedUp" ? AUTH.linkUsedUp : AUTH.linkUnknown);
}

/**
 * Joining a home with an invitation link. Somebody new gets an account; somebody who
 * already has one joins with it, giving the password they have — getting it wrong is
 * refused, so a link cannot be used to walk into the account behind an address.
 *
 * Making accounts is limited three ways: the link's own `maxUses`, counted in the same
 * transaction that makes the account; `signup`, accounts per address; and `join-link`,
 * accounts per link from anywhere. Wrong passwords count under `join`, like login's.
 *
 * It answers in the language of the home the link is for, since there is no session yet
 * to say which language this person reads.
 */
export async function joinWithLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const link = await findInviteLink(String(formData.get("token") ?? ""));
  const say = sayIn(link?.home.language ?? (await currentLanguage()));
  const problem = linkProblem(link);
  if (!link || problem) return { error: problemText(say, problem ?? "unknown") };

  const parsed = joinSchema(say).safeParse({
    token: formData.get("token"),
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? say(AUTH.checkFormAndRetry) };
  const email = parsed.data.email.toLowerCase();

  const limit = await checkRateLimit("join", email);
  if (!limit.allowed) {
    return { error: say(AUTH.tooManyAttempts, { count: limit.retryAfterMinutes, minutes: limit.retryAfterMinutes }) };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  let joiner: Joiner;
  if (existing) {
    if (!(await verifyPassword(parsed.data.password, existing.passwordHash))) {
      await recordFailedAttempt("join", email);
      return { error: say(AUTH.accountExistsWrongPassword) };
    }
    joiner = { userId: existing.id };
  } else {
    for (const [scope, key] of [
      ["signup", ""],
      ["join-link", link.id],
    ] as const) {
      const allowed = await checkRateLimit(scope, key);
      if (!allowed.allowed) {
        return {
          error: say(AUTH.tooManyAccounts, { count: allowed.retryAfterMinutes, minutes: allowed.retryAfterMinutes }),
        };
      }
    }
    // Counted before the account is made, so a burst of requests sees itself.
    await recordFailedAttempt("signup", "");
    await recordFailedAttempt("join-link", link.id);
    joiner = { newUser: { email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) } };
  }

  let result;
  try {
    result = await redeemInviteLink(link.id, joiner);
  } catch (error) {
    // Two sign-ups with one email at once: the second finds the address taken.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: say(AUTH.accountExistsWrongPassword) };
    }
    throw error;
  }
  if (!result.ok) return { error: problemText(say, result.problem) };

  await clearAttempts("join", email);
  await createSession(result.userId, existing?.tokenVersion ?? 0);
  redirect("/dashboard");
}

/** Somebody already logged in joins the link's home with one press. */
export async function joinWithLinkAsMe(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const link = await findInviteLink(String(formData.get("token") ?? ""));
  const say = sayIn(link?.home.language ?? user.homeLanguage);
  const problem = linkProblem(link);
  if (!link || problem) {
    // Already in the home: the link has nothing left to give, but nothing to refuse either.
    if (link && user.homes.some((home) => home.id === link.homeId)) {
      await redeemInviteLink(link.id, { userId: user.id });
      redirect("/dashboard");
    }
    return { error: problemText(say, problem ?? "unknown") };
  }
  const result = await redeemInviteLink(link.id, { userId: user.id });
  if (!result.ok) return { error: problemText(say, result.problem) };
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
