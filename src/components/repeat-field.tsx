"use client";

import { useId, useState } from "react";
import { Input, Label, Select } from "@/components/ui";
import {
  MAX_INTERVAL_DAYS,
  REPEAT_DAYS,
  REPEAT_FIELD,
  REPEAT_ONCE,
} from "@/lib/tasks";

/**
 * Whether a task comes back, and how often.
 *
 * The two sit together because they are one decision. A one-off has no interval to
 * give, so choosing "Just once" takes the number away rather than leaving a box that
 * does nothing — and takes it out of the form entirely rather than disabling it, so
 * there is no greyed-out field inviting somebody to wonder what it is for.
 *
 * The number itself is held here rather than left to the input's own default, so
 * switching to "Just once" and back gives back what was typed instead of the value the
 * sheet opened with.
 */
export function RepeatField({ intervalDays = null }: { intervalDays?: number | null }) {
  const [repeats, setRepeats] = useState(intervalDays !== null);
  const [days, setDays] = useState(String(intervalDays ?? 7));
  const repeatId = useId();
  const daysId = useId();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor={repeatId}>Repeat</Label>
        <Select
          id={repeatId}
          name={REPEAT_FIELD}
          value={repeats ? REPEAT_DAYS : REPEAT_ONCE}
          onChange={(event) => setRepeats(event.target.value === REPEAT_DAYS)}
          className="w-full"
        >
          <option value={REPEAT_ONCE}>Just once</option>
          <option value={REPEAT_DAYS}>Regularly</option>
        </Select>
      </div>

      {repeats && (
        <div className="space-y-1">
          <Label htmlFor={daysId}>Repeat every (days)</Label>
          <Input
            id={daysId}
            name="intervalDays"
            type="number"
            min={1}
            max={MAX_INTERVAL_DAYS}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            required
          />
        </div>
      )}
    </div>
  );
}
