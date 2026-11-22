import { createHash, randomBytes } from "crypto";
import type { InviteLink } from "@prisma/client";
import { prisma } from "./prisma";

/** 32 random bytes: a link nobody guesses, so it needs no code beside it. */
export function generateLinkToken() {
  return randomBytes(32).toString("base64url");
}

export function hashLinkToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export type LinkProblem = "unknown" | "expired" | "usedUp";

export function linkProblem(
  link: Pick<InviteLink, "expiresAt" | "uses" | "maxUses"> | null,
  now = new Date(),
): LinkProblem | null {
  if (!link) return "unknown";
  if (link.expiresAt <= now) return "expired";
  if (link.uses >= link.maxUses) return "usedUp";
  return null;
}

/**
 * The link a token names, with its home, whether or not it can still be used. Crosses
 * homes on purpose: the token is what says which home, and the person may be in none.
 */
export async function findInviteLink(token: string) {
  if (!token) return null;
  return prisma.inviteLink.findUnique({
    where: { tokenHash: hashLinkToken(token) },
    include: { home: { select: { id: true, name: true, photoId: true, language: true, theme: true } } },
  });
}

export type Joiner =
  | { userId: string }
  | { newUser: { email: string; name: string; passwordHash: string } };

export type RedeemResult =
  | { ok: true; userId: string; homeId: string; joined: boolean }
  | { ok: false; problem: LinkProblem };

/**
 * Brings somebody into the link's home. In one transaction: the use is counted with an
 * update that only matches while the link is unexpired and `uses < maxUses`, so two
 * people pressing at once on the last place cannot both get in, and a new account is
 * only created when there was a place for it.
 *
 * Everybody joins as a USER. Somebody already in the home uses up no place and keeps
 * their role; either way they land in that home.
 */
export async function redeemInviteLink(linkId: string, joiner: Joiner, now = new Date()): Promise<RedeemResult> {
  return prisma.$transaction(async (tx) => {
    const link = await tx.inviteLink.findUnique({ where: { id: linkId } });
    if (!link) return { ok: false, problem: "unknown" } as const;

    if ("userId" in joiner) {
      const member = await tx.homeMember.findUnique({
        where: { userId_homeId: { userId: joiner.userId, homeId: link.homeId } },
      });
      if (member) {
        await tx.user.update({ where: { id: joiner.userId }, data: { activeHomeId: link.homeId } });
        return { ok: true, userId: joiner.userId, homeId: link.homeId, joined: false } as const;
      }
    }

    const counted = await tx.inviteLink.updateMany({
      where: { id: link.id, expiresAt: { gt: now }, uses: { lt: tx.inviteLink.fields.maxUses } },
      data: { uses: { increment: 1 } },
    });
    if (counted.count === 0) return { ok: false, problem: linkProblem(link, now) ?? "usedUp" } as const;

    const userId =
      "userId" in joiner
        ? joiner.userId
        : (await tx.user.create({ data: joiner.newUser, select: { id: true } })).id;
    await tx.homeMember.create({ data: { userId, homeId: link.homeId, role: "USER" } });
    await tx.user.update({ where: { id: userId }, data: { activeHomeId: link.homeId } });
    return { ok: true, userId, homeId: link.homeId, joined: true } as const;
  });
}
