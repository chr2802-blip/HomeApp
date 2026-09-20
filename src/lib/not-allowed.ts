/**
 * The one error this app wants to say something specific about on screen.
 *
 * Reaching a record that belongs to another home throws, and the app shell's error
 * boundary draws "Not your home" rather than the generic crash — which is the difference
 * between telling somebody their bookmark points somewhere they left and telling them to
 * try again at something that will never work.
 *
 * **The boundary cannot read the message to know that.** In production Next replaces a
 * server error's `message` before it crosses to the client — the whole point is that a
 * server's error text never reaches a browser — so a boundary matching on
 * `error.message === "Not allowed"` matches in development and never in production,
 * which is the one environment a household uses. What Next *does* carry across is
 * `digest`, and an error that brings its own keeps it. So the signal is a digest, and it
 * is a constant rather than a hash: the boundary has to recognise it, not verify it.
 *
 * Kept in a module of its own, with nothing server-side in it, so the client boundary
 * can import the constant without dragging `lib/access.ts` and its session types into
 * the browser bundle.
 */
export const NOT_ALLOWED_DIGEST = "HOMEHUB_NOT_ALLOWED";

/** What it has always said. Kept so that anything reading the message still reads this. */
export const NOT_ALLOWED_MESSAGE = "Not allowed";

export class NotAllowedError extends Error {
  /**
   * Read by Next when it serialises this error for the client, and by the boundary on
   * the other side. A plain property rather than anything clever: Next checks whether
   * the error already carries one and passes it through instead of generating its own.
   */
  readonly digest = NOT_ALLOWED_DIGEST;

  constructor(message: string = NOT_ALLOWED_MESSAGE) {
    super(message);
    this.name = "NotAllowedError";
  }
}

/** Whether a caught error is that one, from either side of the boundary. */
export function isNotAllowed(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { digest?: unknown }).digest === NOT_ALLOWED_DIGEST
  );
}
