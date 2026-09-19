import type { Message } from "./email";
import { formatInZone } from "./time";

/**
 * What an invitation says, and the link it carries. Nothing here sends anything, so it
 * can be read back in a unit test without a network or a key.
 */

/**
 * The link that puts somebody in front of the right form with the right answers.
 *
 * It carries both halves the accept form asks for, because a person who has been
 * handed a link has been handed one thing and expects to press it once. The code is
 * still written out in the message beside it: a link can be mangled by a mail client
 * and a person retyping eight characters is a worse experience than a fresh
 * invitation, not a broken one.
 *
 * This is not a weakening of the code. Whoever holds the mail holds both halves either
 * way, and the invitation is still spent against one named address, still expires, and
 * still leaves the invitee choosing a password before they are in anybody's home.
 */
export function inviteLink(origin: string, email: string, code: string) {
  const url = new URL("/accept-invite", origin);
  url.searchParams.set("email", email);
  url.searchParams.set("code", code);
  return url.toString();
}

export type InviteDetails = {
  /** The address the invitation is for, which is also the one it must be accepted with. */
  email: string;
  code: string;
  link: string;
  homeName: string;
  /** Who issued it, so the message is from somebody rather than from an installation. */
  invitedBy: string;
  expiresAt: Date;
};

/**
 * Plain words, no marketing and no images.
 *
 * An invitation from a household app arriving in a stranger's inbox has one job: to
 * look like the person they know asked them to join something, rather than like the
 * thing every spam filter is built to catch. So it names the home, names who sent it,
 * and offers one link.
 */
export function inviteMessage(details: InviteDetails): Message {
  const expires = formatInZone(details.expiresAt, "d MMMM yyyy");
  const subject = `${details.invitedBy} invited you to ${details.homeName} on HomeHub`;

  const text = [
    `${details.invitedBy} has invited you to join ${details.homeName} on HomeHub —`,
    `the household's shopping lists, tasks and recipes.`,
    ``,
    `Accept the invitation:`,
    details.link,
    ``,
    `The link fills the form in for you. If it does not work, go to the app, choose`,
    `"Accept invite", and enter this email address with the code ${details.code}.`,
    ``,
    `The invitation is for ${details.email} and expires on ${expires}.`,
    `If you were not expecting it, you can ignore this message — nothing happens`,
    `until somebody accepts it.`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
      <p style="margin:0 0 16px;font-size:16px;line-height:1.5">
        <strong>${escapeHtml(details.invitedBy)}</strong> has invited you to join
        <strong>${escapeHtml(details.homeName)}</strong> on HomeHub — the household's
        shopping lists, tasks and recipes.
      </p>
      <p style="margin:0 0 24px">
        <a href="${escapeHtml(details.link)}"
           style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
          Accept the invitation
        </a>
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#475569">
        The link fills the form in for you. If it does not work, open the app, choose
        “Accept invite”, and enter this email address with the code
        <strong style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.1em">${escapeHtml(details.code)}</strong>.
      </p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b">
        The invitation is for ${escapeHtml(details.email)} and expires on ${escapeHtml(expires)}.
        If you were not expecting it, you can ignore this message — nothing happens until
        somebody accepts it.
      </p>
    </div>
  </body>
</html>`;

  return { to: details.email, subject, text, html };
}

/**
 * A home's name and a person's name are typed by people, and both land inside markup
 * here. Nothing else in the app builds HTML as a string, which is precisely why this
 * has to do by hand what React does everywhere else.
 */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
