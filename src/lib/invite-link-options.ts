/**
 * How long an invitation link lasts and how many people it may bring in, as an admin
 * can choose. Its own file so the form can import it without the server's crypto.
 */
export const LINK_DAYS = [1, 7, 14, 30] as const;
export const LINK_MAX_USES = [1, 2, 5, 10] as const;
export const DEFAULT_LINK_DAYS = 7;
export const DEFAULT_LINK_MAX_USES = 5;

/** Where a link is opened. The server knows only this; the browser puts its origin in front. */
export const JOIN_PREFIX = "/join/";

export function joinPath(token: string) {
  return `${JOIN_PREFIX}${token}`;
}

/** Whether an action's note is a link it made, rather than words. */
export function isJoinPath(note: string | undefined): note is string {
  return typeof note === "string" && note.startsWith(JOIN_PREFIX);
}
