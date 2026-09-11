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

export type FormState = { error?: string } | undefined;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const email = parsed.data.email.toLowerCase();

  const limit = await checkRateLimit("login", email);
  if (!limit.allowed) {
    return {
      error: `Too many failed attempts. Try again in ${limit.retryAfterMinutes} minute${
        limit.retryAfterMinutes === 1 ? "" : "s"
      }.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    await recordFailedAttempt("login", email);
    return { error: "Wrong email or password." };
  }

  await clearAttempts("login", email);
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

const acceptSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  name: z.string().min(1, "Enter your name."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function acceptInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = acceptSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const email = parsed.data.email.toLowerCase();

  const limit = await checkRateLimit("invite", email);
  if (!limit.allowed) {
    return {
      error: `Too many failed attempts. Try again in ${limit.retryAfterMinutes} minute${
        limit.retryAfterMinutes === 1 ? "" : "s"
      }.`,
    };
  }

  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "An account with that email already exists. Try logging in." };
  }

  const invites = await prisma.invite.findMany({
    where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  const invite = invites.find((candidate) => inviteCodeMatches(parsed.data.code, candidate.codeHash));
  if (!invite) {
    await recordFailedAttempt("invite", email);
    return { error: "That email and code don't match an open invitation." };
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name.trim(),
      passwordHash: await hashPassword(parsed.data.password),
      role: invite.role,
      homeId: invite.homeId,
    },
  });

  await prisma.invite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  await clearAttempts("invite", email);

  await createSession(user.id);
  redirect("/dashboard");
}
