/**
 * What the server and a phone have to agree on about a Realtime message, kept apart from
 * `realtime.ts` so the browser can import it without pulling in `node:crypto`.
 */

/**
 * The one channel a home's changes are announced on. The RLS policy in the
 * `realtime_home_channels` migration reads this same shape back out of the topic.
 */
export function homeTopic(homeId: string) {
  return `home:${homeId}`;
}

/** The event a changed list is announced as, and all it carries. */
export const LIST_CHANGED = "list-changed";
export type ListChanged = { listId: string };
