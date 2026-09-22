import type { HomeLanguage } from "@prisma/client";
import { Label, Select } from "@/components/ui";
import { sayIn } from "@/lib/copy/say";
import { TASKS } from "@/lib/copy/tasks";

export type MemberOption = { id: string; name: string };

/**
 * Who a task is for.
 *
 * The blank option is first and is the default, because most tasks belong to the house
 * rather than to a person. It is worded as what it does — everyone is reminded — rather
 * than as "unassigned", which reads like something is missing.
 *
 * Rendered from a server component with no client interactivity of its own, so it takes
 * `language` as a prop — reaching for `useLanguage()` here would force the whole thing
 * into a client component for nothing.
 */
export function AssigneeField({
  members,
  selected,
  id = "assigneeId",
  language,
}: {
  members: MemberOption[];
  selected?: string | null;
  id?: string;
  language: HomeLanguage;
}) {
  const say = sayIn(language);

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{say(TASKS.assignedTo)}</Label>
      <Select id={id} name="assigneeId" defaultValue={selected ?? ""} className="w-full">
        <option value="">{say(TASKS.everyoneInHome)}</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </Select>
      <p className="text-xs text-slate-500">{say(TASKS.assigneeHint)}</p>
    </div>
  );
}
