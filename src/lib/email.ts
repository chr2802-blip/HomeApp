/**
 * Getting a message out of the app, and nothing about what it says.
 *
 * Mail is optional here, and staying optional is the point: a deployment with no
 * credentials set is not broken, it is an installation whose admins pass invitations on
 * by hand, which is how this app worked before there was any mail at all. So nothing in
 * here throws and nothing here decides anything is fatal — `sendEmail` reports what
 * happened and the caller says so on screen. An invitation that could not be emailed is
 * still a perfectly good invitation.
 *
 * The transport is Resend's HTTP API called with plain `fetch`, which is the whole
 * reason there is no mail dependency in `package.json`: an SMTP client opens a socket
 * and holds it, which is exactly what a serverless function cannot do well.
 */

const ENDPOINT = "https://api.resend.com/emails";

/** Past this and the send is abandoned — a form waiting on it is a person waiting on it. */
const TIMEOUT_MS = 10_000;

export type Message = {
  to: string;
  subject: string;
  /** The message as words. Always sent: some clients show only this, and so do some people. */
  text: string;
  /** The same message marked up. Never the only copy of anything. */
  html: string;
};

/**
 * Whether a send was attempted and what came of it.
 *
 * `reason` is written for the admin looking at the screen rather than for a log: it
 * ends up in the panel beside the invitation code, where "Email is not configured on
 * this installation" is the difference between a bug and a setting nobody has filled in.
 */
export type SendOutcome = { sent: true } | { sent: false; reason: string };

/** Both halves are needed: a key with no sender address cannot address anything. */
export function mailConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
}

export async function sendEmail(
  message: Message,
  env: Record<string, string | undefined> = process.env,
): Promise<SendOutcome> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return { sent: false, reason: "Email is not configured on this installation." };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      // The body carries Resend's own account-level complaint — an unverified sending
      // domain, a key that has been rolled — which is the thing worth repeating.
      const detail = await response.text().catch(() => "");
      logFailure(message, `HTTP ${response.status} ${detail.slice(0, 500)}`);
      return { sent: false, reason: describeStatus(response.status) };
    }

    return { sent: true };
  } catch (error) {
    // A network failure, a DNS failure or the timeout above. None of them is the
    // caller's to handle: the thing the mail was about has already happened.
    logFailure(message, error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    return { sent: false, reason: "The mail server could not be reached." };
  }
}

function describeStatus(status: number) {
  if (status === 401 || status === 403) return "The mail server rejected this installation's key.";
  if (status === 422) return "The mail server refused the address it was given.";
  if (status === 429) return "The mail server is rate-limiting this installation.";
  return "The mail server refused the message.";
}

/**
 * One JSON line, the same shape `instrumentation.ts` writes, so a failed send is
 * searchable beside the request failures rather than lost in free text. The recipient
 * is logged and the message body is not: which address a send failed for is the whole
 * question when somebody says they never got it.
 */
function logFailure(message: Message, detail: string) {
  console.error(
    JSON.stringify({
      level: "error",
      event: "email_failed",
      to: message.to,
      subject: message.subject,
      detail,
      at: new Date().toISOString(),
    }),
  );
}
