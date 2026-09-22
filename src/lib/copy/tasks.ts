import type { Phrase, Plural } from "./say";

/** `/tasks`, a task's own card, and everything on it. */
export const TASKS = {
  title: { EN: "Tasks", DA: "Opgaver" },
  description: {
    EN: "A one-off is done when it is done. Complete a repeating task and it schedules itself again after the interval you set.",
    DA: "En engangsopgave er klaret, når den er klaret. Fuldfør en tilbagevendende opgave, og den planlægger sig selv igen efter det interval, I har sat.",
  },
  newTask: { EN: "New task", DA: "Ny opgave" },
  addTask: { EN: "Add task", DA: "Tilføj opgave" },
  task: { EN: "Task", DA: "Opgave" },
  namePlaceholder: { EN: "Water the plants", DA: "Vand planterne" },
  dueDate: { EN: "Due date", DA: "Forfaldsdato" },
  notesOptional: { EN: "Notes (optional)", DA: "Noter (valgfrit)" },
  photoHint: {
    EN: "Optional — a picture of the filter, the plant, the meter.",
    DA: "Valgfrit — et billede af filteret, planten, måleren.",
  },
  empty: { EN: "No tasks yet — add the first one above.", DA: "Ingen opgaver endnu — tilføj den første ovenfor." },
  allDone: { EN: "Nothing left to do — nice work.", DA: "Ikke mere at gøre — flot klaret." },
  done: { EN: "Done ({count})", DA: "Afsluttede ({count})" },

  // The card's summary
  doneBadge: { EN: "Done", DA: "Klaret" },
  forName: { EN: "For {name}", DA: "Til {name}" },
  doneOn: { EN: "{rhythm} · done {when}", DA: "{rhythm} · klaret {when}" },
  lastDoneOn: { EN: "{rhythm} · last done {when}", DA: "{rhythm} · sidst klaret {when}" },
  neverCompleted: { EN: "{rhythm} · never completed", DA: "{rhythm} · aldrig udført" },

  // The edit sheet
  taskField: { EN: "Task", DA: "Opgave" },
  due: { EN: "Due", DA: "Forfalder" },
  nextDue: { EN: "Next due", DA: "Forfalder næste gang" },
  notes: { EN: "Notes", DA: "Noter" },
  editTask: { EN: "Edit task", DA: "Rediger opgave" },
  deleteTaskMessage: { EN: 'Delete the task "{title}"?', DA: 'Slet opgaven "{title}"?' },
  reopen: { EN: "Reopen", DA: "Genåbn" },
  markDone: { EN: "Mark done", DA: "Marker som klaret" },
  snoozeToTomorrow: { EN: "Snooze to tomorrow", DA: "Udsæt til i morgen" },

  // RepeatField
  repeat: { EN: "Repeat", DA: "Gentag" },
  justOnce: { EN: "Just once", DA: "Kun én gang" },
  regularly: { EN: "Regularly", DA: "Regelmæssigt" },
  repeatEveryDays: { EN: "Repeat every (days)", DA: "Gentag hver (dage)" },

  // AssigneeField
  assignedTo: { EN: "Assigned to", DA: "Tildelt til" },
  everyoneInHome: { EN: "Everyone in the home", DA: "Alle i hjemmet" },
  assigneeHint: {
    EN: "Only the person named gets the reminder. Anyone in the home can still mark it done.",
    DA: "Kun den navngivne person får påmindelsen. Alle i hjemmet kan stadig markere den som klaret.",
  },

  // src/lib/tasks.ts — a dual-use lib module, so these take the language as an argument
  oneOff: { EN: "One-off", DA: "Engangsopgave" },
  // A Plural rather than the bare "Every {n} days" the English used to read even at
  // n=1: Danish's ordinal ("hver 1. dag") does not need the distinction, but writing
  // this as a Plural fixes the English grammar for free rather than leaving it broken
  // in both languages.
  everyNDays: {
    EN: { one: "Every {count} day", other: "Every {count} days" },
    DA: { one: "Hver {count}. dag", other: "Hver {count}. dag" },
  },
  intervalMessage: {
    EN: "Repeat every 1 to {max} days.",
    DA: "Gentag hver 1 til {max} dage.",
  },

  // src/app/actions/tasks.ts
  nameRequired: { EN: "Give the task a name.", DA: "Giv opgaven et navn." },
  notAMember: { EN: "That person is not in this home.", DA: "Den person er ikke i dette hjem." },
  firstDueNotReal: {
    EN: "That first due date is not a real date.",
    DA: "Den første forfaldsdato er ikke en rigtig dato.",
  },
  dueNotReal: {
    EN: "That due date is not a real date.",
    DA: "Den forfaldsdato er ikke en rigtig dato.",
  },
} as const satisfies Record<string, Phrase | Plural>;
