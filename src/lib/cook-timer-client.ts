/**
 * Action mode's side of `/api/cook-timers`: asking for a timer to ring on a locked phone,
 * and taking that back. Neither ever throws — a timer that cannot ring with the page
 * closed still counts and buzzes in the page, exactly as it did before this existed.
 */

export type TimerPushAnswer = { id: string | null; available: boolean };

export async function requestTimerPush(timer: {
  recipeId: string;
  step: number;
  endsAt: number;
  portions: number | null;
}): Promise<TimerPushAnswer> {
  try {
    const response = await fetch("/api/cook-timers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(timer),
    });
    if (!response.ok) return { id: null, available: false };
    const body = (await response.json()) as Partial<TimerPushAnswer>;
    return {
      id: typeof body.id === "string" && body.id ? body.id : null,
      available: body.available === true,
    };
  } catch {
    return { id: null, available: false };
  }
}

/** `keepalive` lets the request outlive the page that sends it, which is the case when
 *  somebody leaves action mode: the page goes, and the timers' pushes must go with it. */
export function cancelTimerPushes(ids: (string | undefined)[]) {
  const wanted = ids.filter((id): id is string => !!id);
  if (wanted.length === 0) return;
  fetch("/api/cook-timers", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: wanted }),
    keepalive: true,
  }).catch(() => {});
}
