"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { MemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  hashPassword,
  requireAdmin,
  requireSuperAdmin,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { assertHomeAdmin, canAccessHome, canAdministerHome } from "@/lib/access";
import { generateInviteCode, hashInviteCode } from "@/lib/invite-code";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { optionalText, readForm, requiredText } from "@/lib/form";
import { discardReplaced, readPhotoChoice } from "@/lib/photos";
import { THEMES, THEME_FIELD } from "@/lib/theme";
import { LANGUAGES, LANGUAGE_FIELD } from "@/lib/language";
import { sayIn, type Say } from "@/lib/copy/say";
import { SETTINGS } from "@/lib/copy/settings";

function homeSchema(say: Say) {
  return z.object({
    name: requiredText(say(SETTINGS.homeNameRequired)),
    address: optionalText,
  });
}

/**
 * What a home already has, plus the colour it is dressed in and the language it is
 * read in.
 *
 * Both are a choice from a fixed set and never typed in, so both are checked against
 * their set: a value from outside it would be stored happily and then draw or say
 * nothing, leaving the home as it already was.
 *
 * Both are optional, for the same reason: a colour or a language that was not
 * mentioned is one left alone — unlike a task's interval, where saying nothing would
 * silently change what the record means. The pickers live in the home's own settings,
 * and the other ways here (a picture being replaced, a home being renamed from the
 * list of them) are not about either.
 *
 * A new home is asked about neither: it starts in the app's own colours and its own
 * voice, and is dressed and spoken to from inside it — which is why this extends the
 * create schema rather than replacing it.
 *
 * A function of `say` rather than a module-level constant like `homeSchema`, because
 * the language field's own message has to be read in the language the form was
 * already in. Everything else here keeps the message `readForm`'s other callers
 * already had; those convert in PR 2, with the screens that read them.
 */
function editHomeSchema(say: Say) {
  return homeSchema(say).extend({
    [THEME_FIELD]: z.enum(THEMES, { error: say(SETTINGS.pickAColor) }).optional(),
    [LANGUAGE_FIELD]: z.enum(LANGUAGES, { error: say(SETTINGS.language.invalid) }).optional(),
  });
}

function profileSchema(say: Say) {
  return z.object({
    name: requiredText(say(SETTINGS.nameCannotBeBlank)),
    // Blank means "keep the current password", so the length only applies to a new one.
    password: z
      .string()
      .optional()
      .refine((value) => !value || value.length >= 8, {
        error: say(SETTINGS.passwordTooShort),
      }),
    /**
     * The one they sign in with now, asked for only when they are setting a new one.
     *
     * A session cookie is a bearer token, so without this whoever has one can take the
     * account outright — and the owner, who still knows the password, is the one person
     * who then cannot get back in. Knowing the current password is the thing a borrowed
     * cookie does not carry.
     */
    currentPassword: z.string().optional(),
  });
}

const INVITE_TTL_DAYS = 14;

export type InviteState =
  | { ok: true; email: string; code: string }
  | { ok: false; error: string }
  | undefined;

export async function createInvite(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const user = await requireAdmin();
  const say = sayIn(user.homeLanguage);
  const homeId = String(formData.get("homeId") ?? "");
  if (!canAdministerHome(user, homeId)) return { ok: false, error: say(SETTINGS.notAllowed) };

  const form = readForm(
    z.object({
      email: z.string().email(say(SETTINGS.invalidEmail)),
      role: z.enum(["ADMIN", "USER"], { error: say(SETTINGS.invalidEmail) }),
    }),
    formData,
    user.homeLanguage,
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
    return { ok: false, error: say(SETTINGS.alreadyInHome) };
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

  revalidatePath("/settings");
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
  revalidatePath("/settings");
}

export async function updateHome(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const homeId = String(formData.get("homeId") ?? "");
  assertHomeAdmin(user, homeId);

  const form = readForm(editHomeSchema(sayIn(user.homeLanguage)), formData, user.homeLanguage);
  if (!form.ok) return fail(form.error);

  const photo = await readPhotoChoice(formData, homeId, user.homeLanguage);
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

  // The home's picture and its colour both sit in the chrome, which every page renders.
  revalidatePath("/", "layout");
  revalidatePath("/settings");
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
  revalidatePath("/settings");
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
  revalidatePath("/settings");
  revalidatePath("/homes");
}

export async function createHome(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireSuperAdmin();
  const say = sayIn(user.homeLanguage);
  const form = readForm(homeSchema(say), formData, user.homeLanguage);
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

/**
 * A person's own details, which belong to them rather than to any of their homes: the
 * name every household sees, the password they sign in with, and their picture.
 */
export async function updateOwnProfile(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const say = sayIn(user.homeLanguage);
  // Both fields are checked before anything is written, so a rejected password never
  // also loses the name the person typed alongside it.
  const form = readForm(profileSchema(say), formData, user.homeLanguage);
  if (!form.ok) return fail(form.error);

  // A picture is filed under a home, and the home on screen is the only one an upload
  // of theirs could have gone to. Somebody in no home at all is shown no picture field,
  // so there is nothing here to read.
  const photo = user.homeId
    ? await readPhotoChoice(formData, user.homeId, user.homeLanguage)
    : ({ ok: true, photoId: undefined } as const);
  if (!photo.ok) return fail(photo.error);

  const previous = await prisma.user.findUnique({
    where: { id: user.id },
    select: { photoId: true },
  });

  const { name, password, currentPassword } = form.fields;

  /*
   * Changing the password is the one thing on this page that is not simply "your
   * details", so it is the one thing that asks for the password again. Checked before
   * anything is written, like everything else here: a wrong one must not also cost them
   * the name or the picture they changed in the same submission.
   */
  if (password) {
    const stored = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!stored || !currentPassword || !(await verifyPassword(currentPassword, stored.passwordHash))) {
      return fail(say(SETTINGS.notYourPassword));
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      // A new password ends every session that was opened under the old one — see
      // `SESSION_VERSION_CLAIM`. Including, for a moment, this one: the cookie is
      // rewritten below so the person doing the changing stays where they are, and
      // everybody else holding one is signed out, which is the point.
      ...(password
        ? { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } }
        : {}),
      photoId: photo.photoId,
    },
    select: { tokenVersion: true },
  });

  if (password) await createSession(user.id, updated.tokenVersion);

  // Only once the row no longer points at it, so a failed update cannot leave somebody
  // holding a picture that has already gone. Discarded through the home on screen: a
  // picture chosen in another home and replaced here is simply left, and that home's
  // next upload sweeps it up as one nothing points at.
  if (user.homeId) await discardReplaced(user.homeId, previous?.photoId ?? null, photo.photoId);

  // Their name and picture are drawn in the header and beside them on the members list.
  revalidatePath("/", "layout");
  revalidatePath("/profile");
  revalidatePath("/settings");
  return ok();
}
