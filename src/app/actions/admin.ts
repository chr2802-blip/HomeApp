"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin, requireUser, hashPassword } from "@/lib/auth";
import { assertHomeAdmin, canAdministerHome } from "@/lib/access";
import { generateInviteCode, hashInviteCode } from "@/lib/invite-code";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { optionalText, readForm, requiredText } from "@/lib/form";

const homeSchema = z.object({
  name: requiredText("Give the home a name."),
  address: optionalText,
});

const profileSchema = z.object({
  name: requiredText("Your name cannot be blank."),
  // Blank means "keep the current password", so the length only applies to a new one.
  password: z
    .string()
    .optional()
    .refine((value) => !value || value.length >= 8, {
      error: "A new password must be at least 8 characters.",
    }),
});

const INVITE_TTL_DAYS = 14;

export type InviteState =
  | { ok: true; email: string; code: string }
  | { ok: false; error: string }
  | undefined;

export async function createInvite(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const user = await requireAdmin();
  const homeId = String(formData.get("homeId") ?? "");
  if (!canAdministerHome(user, homeId)) return { ok: false, error: "Not allowed." };

  const form = readForm(
    z.object({
      email: z.string().email("Enter a valid email address."),
      role: z.enum(["ADMIN", "USER"], { error: "Enter a valid email address." }),
    }),
    formData,
  );
  if (!form.ok) return { ok: false, error: form.error };

  const email = form.fields.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    return { ok: false, error: "That email already has an account." };
  }

  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.invite.deleteMany({ where: { email, homeId, acceptedAt: null } });
  await prisma.invite.create({
    data: {
      email,
      homeId,
      role: form.fields.role as Role,
      codeHash: hashInviteCode(code),
      expiresAt,
      createdById: user.id,
    },
  });

  revalidatePath("/admin");
  return { ok: true, email, code };
}

export async function revokeInvite(formData: FormData) {
  const user = await requireAdmin();
  const invite = await prisma.invite.findUnique({
    where: { id: String(formData.get("inviteId")) },
  });
  if (!invite) return;
  assertHomeAdmin(user, invite.homeId);

  await prisma.invite.delete({ where: { id: invite.id } });
  revalidatePath("/admin");
}

export async function updateHome(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const homeId = String(formData.get("homeId") ?? "");
  assertHomeAdmin(user, homeId);

  const form = readForm(homeSchema, formData);
  if (!form.ok) return fail(form.error);

  await prisma.home.update({ where: { id: homeId }, data: form.fields });

  revalidatePath("/admin");
  revalidatePath("/admin/homes");
  return ok();
}

export async function updateMemberRole(formData: FormData) {
  const actor = await requireAdmin();
  const member = await prisma.user.findUnique({
    where: { id: String(formData.get("userId")) },
  });
  if (!member?.homeId) return;
  assertHomeAdmin(actor, member.homeId);
  if (member.role === "SUPER_ADMIN") return;
  if (member.id === actor.id) return;

  const role = String(formData.get("role"));
  if (role !== "ADMIN" && role !== "USER") return;

  await prisma.user.update({ where: { id: member.id }, data: { role: role as Role } });
  revalidatePath("/admin");
}

export async function removeMember(formData: FormData) {
  const actor = await requireAdmin();
  const member = await prisma.user.findUnique({
    where: { id: String(formData.get("userId")) },
  });
  if (!member?.homeId) return;
  assertHomeAdmin(actor, member.homeId);
  if (member.role === "SUPER_ADMIN" || member.id === actor.id) return;

  await prisma.user.delete({ where: { id: member.id } });
  revalidatePath("/admin");
}

export async function createHome(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireSuperAdmin();
  const form = readForm(homeSchema, formData);
  if (!form.ok) return fail(form.error);

  await prisma.home.create({ data: form.fields });
  revalidatePath("/admin/homes");
  return ok();
}

export async function deleteHome(formData: FormData) {
  await requireSuperAdmin();
  const homeId = String(formData.get("homeId") ?? "");

  await prisma.home.delete({ where: { id: homeId } });
  revalidatePath("/admin/homes");
}

/** Super admins browse a home by making it their active home. */
export async function switchHome(formData: FormData) {
  const user = await requireSuperAdmin();
  const homeIdRaw = String(formData.get("homeId") ?? "");
  const homeId = homeIdRaw || null;

  if (homeId && !(await prisma.home.findUnique({ where: { id: homeId } }))) return;

  await prisma.user.update({ where: { id: user.id }, data: { homeId } });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function updateOwnProfile(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  // Both fields are checked before anything is written, so a rejected password never
  // also loses the name the person typed alongside it.
  const form = readForm(profileSchema, formData);
  if (!form.ok) return fail(form.error);

  const { name, password } = form.fields;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
  });

  revalidatePath("/", "layout");
  return ok();
}
