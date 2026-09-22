"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { inviteCodeMatches } from "@/lib/invite-code";
import { checkRateLimit, clearAttempts, recordFailedAttempt } from "@/lib/rate-limit";
import { currentLanguage } from "@/lib/auth";
import { sayIn, type Say } from "@/lib/copy/say";
import { AUTH } from "@/lib/copy/auth";

export type FormState = { error?: string } | undefined;

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
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
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

function acceptSchema(say: Say) {
  return z.object({
    email: z.string().email(),
    code: z.string().min(1),
    name: z.string().min(1, say(AUTH.enterYourName)),
    password: z.string().min(8, say(AUTH.passwordMinLength)),
  });
}

/**
 * Joining a home, whether or not the person has been here before.
 *
 * An invitation used to be a way to make an account, so an email that already had one
 * was turned away. Somebody can be in several homes now, so the same code is also how
 * an existing account joins its second household — and the password field means "the
 * one on that account" rather than "choose one" when there is an account to match it
 * against. Getting it wrong is refused, so an invitation to an address cannot be used
 * to walk into the account behind it.
 */
export async function acceptInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const say = sayIn(await currentLanguage());

  const parsed = acceptSchema(say).safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? say(AUTH.checkFormAndRetry) };
  }

  const email = parsed.data.email.toLowerCase();

  const limit = await checkRateLimit("invite", email);
  if (!limit.allowed) {
    return { error: say(AUTH.tooManyAttempts, { count: limit.retryAfterMinutes, minutes: limit.retryAfterMinutes }) };
  }

  const invites = await prisma.invite.findMany({
    where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  const invite = invites.find((candidate) => inviteCodeMatches(parsed.data.code, candidate.codeHash));
  if (!invite) {
    await recordFailedAttempt("invite", email);
    return { error: say(AUTH.noMatchingInvite) };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !(await verifyPassword(parsed.data.password, existing.passwordHash))) {
    await recordFailedAttempt("invite", email);
    return { error: say(AUTH.accountExistsWrongPassword) };
  }

  const user =
    existing ??
    (await prisma.user.create({
      data: {
        email,
        name: parsed.data.name.trim(),
        passwordHash: await hashPassword(parsed.data.password),
      },
    }));

  // The membership is the joining, and the role on the invitation is a role in this
  // home only — being an admin here says nothing about the other homes they are in.
  // Upserted rather than created: an invitation accepted twice must not fail on the
  // second go, it has simply already been honoured.
  await prisma.homeMember.upsert({
    where: { userId_homeId: { userId: user.id, homeId: invite.homeId } },
    update: { role: invite.role },
    create: { userId: user.id, homeId: invite.homeId, role: invite.role },
  });

  // They land in the home they just accepted rather than wherever they were, which is
  // the one thing they have said they wanted.
  await prisma.user.update({
    where: { id: user.id },
    data: { activeHomeId: invite.homeId },
  });

  await prisma.invite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  await clearAttempts("invite", email);

  await createSession(user.id, user.tokenVersion);
  redirect("/dashboard");
}
