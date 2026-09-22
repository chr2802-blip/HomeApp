import { statusLine } from "@/lib/offline-ops";
import { useLanguage } from "@/components/language-provider";

/**
 * What the list has to say about the connection, and only when it has something to say.
 *
 * A tick made with no signal is kept on the phone and sent later, which is worth exactly
 * one line: a household that is not told cannot tell the difference between a list that
 * saved their shopping and one that quietly lost it, and will stop trusting the ticks
 * either way. Silent when there is nothing waiting and the connection is there, because a
 * permanent "online" badge is a line of furniture on every list.
 *
 * Deliberately not a colour that means something. Amber is overdue and red is about to be
 * deleted, and neither is what this is: nothing has gone wrong, and nothing has been lost.
 */
export function QueueStatus({
  online,
  waiting,
  sending,
}: {
  online: boolean;
  /** How many changes are on this phone and not yet at the server. */
  waiting: number;
  sending: boolean;
}) {
  const message = statusLine(online, waiting, sending, useLanguage());
  if (!message) return null;

  return (
    <p role="status" className="px-4 pt-3 text-xs text-slate-500">
      {message}
    </p>
  );
}
