import { Label, Select } from "@/components/ui";

export type MemberOption = { id: string; name: string };

/**
 * Who a task is for.
 *
 * The blank option is first and is the default, because most tasks belong to the house
 * rather than to a person. It is worded as what it does — everyone is reminded — rather
 * than as "unassigned", which reads like something is missing.
 */
export function AssigneeField({
  members,
  selected,
  id = "assigneeId",
}: {
  members: MemberOption[];
  selected?: string | null;
  id?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Assigned to</Label>
      <Select id={id} name="assigneeId" defaultValue={selected ?? ""} className="w-full">
        <option value="">Everyone in the home</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </Select>
      <p className="text-xs text-slate-500">
        Only the person named gets the reminder. Anyone in the home can still mark it done.
      </p>
    </div>
  );
}
