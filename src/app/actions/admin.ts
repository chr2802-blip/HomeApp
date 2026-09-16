"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { MemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin, requireUser, hashPassword } from "@/lib/auth";
import { assertHomeAdmin, canAccessHome, canAdministerHome } from "@/lib/access";
import { generateInviteCode, hashInviteCode } from "@/lib/invite-code";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { optionalText, readForm, requiredText } from "@/lib/form";
import { discardReplaced, readPhotoChoice } from "@/lib/photos";

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
  // An account elsewhere on the installation is no longer in the way: somebody can be
  // in several homes, and inviting them into this one is how they get here. Only being
  // in *this* home already is a reason to refuse.
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { memberships: { where: { homeId }, select: { homeId: true } } },
  });
  if (existing && existing.memberships.length > 0) {
    return { ok: false, error: "They are already in this home." };
  }

  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.invite.deleteMany({ where: { email, homeId, acceptedAt: null } });
  await prisma.invite.create({
    data: {
      email,
      homeId,
      role: form.fields.role as MemberRole,
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

  const photo = await readPhotoChoice(formData, homeId);
  if (!photo.ok) return fail(photo.error);

  const previous = await prisma.home.findUnique({
    where: { id: homeId },
    select: { photoId: true },
  });

  await prisma.home.update({
    where: { id: homeId },
    data: { ...form.fields, photoId: photo.photoId },
  });

  // Only once the row no longer points at it, so a failed update cannot leave the home
  // holding a picture that has already gone.
  await discardReplaced(homeId, previous?.photoId ?? null, photo.photoId);

  // The home's picture sits in the header, which every page renders.
  revalidatePath("/", "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/homes");
  return ok();
}

/**
 * The membership a member-shaped form names. Both actions below act on one person in
 * one home, so both are given the pair — a user id on its own stopped being an answer
 * the moment somebody could be in more than one household.
 */
function membershipFrom(formData: FormData) {
  return prisma.homeMember.findUnique({
    where: {
      userId_homeId: {
        userId: String(formData.get("userId")),
        homeId: String(formData.get("homeId")),
      },
    },
    include: { user: { select: { role: true } } },
  });
}

export async function updateMemberRole(formData: FormData) {
  const actor = await requireAdmin();
  const membership = await membershipFrom(formData);
  if (!membership) return;
  assertHomeAdmin(actor, membership.homeId);
  if (membership.user.role === "SUPER_ADMIN") return;
  if (membership.userId === actor.id) return;

  const role = String(formData.get("role"));
  if (role !== "ADMIN" && role !== "USER") return;

  await prisma.homeMember.update({
    where: { userId_homeId: { userId: membership.userId, homeId: membership.homeId } },
    data: { role },
  });
  revalidatePath("/admin");
}

/**
 * Takes somebody out of one home. The membership goes and nothing else does: their
 * account stands, so do the other homes they are in, and so does everything they wrote
 * in this one — a departing housemate does not take the shopping list with them.
 */
export async function removeMember(formData: FormData) {
  const actor = await requireAdmin();
  const membership = await membershipFrom(formData);
  if (!membership) return;
  assertHomeAdmin(actor, membership.homeId);
  if (membership.user.role === "SUPER_ADMIN" || membership.userId === actor.id) return;

  await prisma.homeMember.delete({
    where: { userId_homeId: { userId: membership.userId, homeId: membership.homeId } },
  });
  revalidatePath("/admin");
  revalidatePath("/homes");
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

  // Its members keep their accounts and their other homes; what goes is this household.
  await prisma.home.delete({ where: { id: homeId } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/homes");
  revalidatePath("/homes");
}

/**
 * Moving between homes: anybody picks one of theirs, and a super admin may also look
 * into a household they are not in. Nothing but the pointer changes — what somebody may
 * reach is their memberships, so switching grants nothing and losing the switch costs
 * nothing.
 */
export async function switchHome(formData: FormData) {
  const user = await requireUser();
  const homeId = String(formData.get("homeId") ?? "");
  if (!homeId || !canAccessHome(user, homeId)) return;

  // A super admin passes the check above for a home that does not exist, too.
  if (!(await prisma.home.findUnique({ where: { id: homeId }, select: { id: true } }))) return;

  await prisma.user.update({ where: { id: user.id }, data: { activeHomeId: homeId } });
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
