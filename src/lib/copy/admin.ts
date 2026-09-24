import type { Phrase, Plural } from "./say";

/** `/admin` — the two doors into running the installation. */
export const ADMIN_INDEX = {
  title: { EN: "Admin", DA: "Admin" },
  description: {
    EN: "This installation, rather than any one household.",
    DA: "Denne installation, snarere end et enkelt hjem.",
  },
  systemDescription: {
    EN: "Database health, the reminder job's recent runs, what is stored and the slowest queries of the last day.",
    DA: "Databasens tilstand, påmindelsesjobbets seneste kørsler, hvad der er gemt, og de langsomste forespørgsler det seneste døgn.",
  },
  homesDescription: {
    EN: "Every home on this installation. Create one, switch into one to administer it, or delete one.",
    DA: "Alle hjem på denne installation. Opret et, skift til et for at administrere det, eller slet et.",
  },
} as const satisfies Record<string, Phrase>;

/** `/admin/system` — the installation's own health, content and storage. */
export const SYSTEM = {
  title: { EN: "System", DA: "System" },
  description: { EN: "How the installation itself is doing.", DA: "Hvordan selve installationen har det." },
  backToAdmin: { EN: "Back to admin", DA: "Tilbage til admin" },

  verdictOk: { EN: "Everything looks healthy", DA: "Alt ser sundt ud" },
  verdictDegraded: {
    EN: "Running, but something needs attention",
    DA: "Kører, men noget skal ses på",
  },
  verdictDown: { EN: "The database cannot be reached", DA: "Databasen kan ikke nås" },
  database: { EN: "database", DA: "database" },
  reachableIn: { EN: "reachable in {ms} ms", DA: "svarer på {ms} ms" },
  unreachable: { EN: "unreachable", DA: "ikke tilgængelig" },

  deployed: { EN: "Deployed", DA: "Udrullet" },
  noCommitMessage: { EN: "No commit message recorded.", DA: "Ingen commit-besked registreret." },
  notFromMain: { EN: "This build did not come from main.", DA: "Denne build kommer ikke fra main." },

  remindersHeading: { EN: "Reminders", DA: "Påmindelser" },
  jobNotRun: {
    EN: "The reminder job has not run yet. It runs once each morning; if nothing appears here tomorrow, the schedule is not reaching the app.",
    DA: "Påmindelsesjobbet har ikke kørt endnu. Det kører én gang hver morgen; hvis intet dukker op her i morgen, når planen ikke frem til app'en.",
  },
  overdue: { EN: "overdue", DA: "forsinket" },
  onSchedule: { EN: "on schedule", DA: "til tiden" },
  failed: { EN: "failed", DA: "mislykkedes" },
  lastRun: { EN: "Last run {when}", DA: "Sidst kørt {when}" },
  hoursAgo: { EN: "{hours} hours ago.", DA: "{hours} timer siden." },
  expectedFrequency: {
    EN: "Expected at least once every {hours} hours — reminders are probably not going out.",
    DA: "Forventet mindst hver {hours}. time — påmindelser sendes sandsynligvis ikke ud.",
  },
  goingOutAsScheduled: { EN: "Reminders are going out as scheduled.", DA: "Påmindelser sendes ud som planlagt." },
  lastError: { EN: "Last error: {error}", DA: "Sidste fejl: {error}" },
  didNotFinish: { EN: "did not finish", DA: "blev ikke færdig" },
  ok: { EN: "ok", DA: "ok" },
  dueAndSent: { EN: "{due} due · {sent} sent", DA: "{due} forfaldne · {sent} sendt" },

  contentHeading: { EN: "Content", DA: "Indhold" },
  homes: { EN: "Homes", DA: "Hjem" },
  people: { EN: "People", DA: "Personer" },
  notificationsOnStat: { EN: "Notifications on", DA: "Notifikationer slået til" },
  acrossPeople: {
    EN: { one: "across {count} person", other: "across {count} people" },
    DA: { one: "på tværs af {count} person", other: "på tværs af {count} personer" },
  },
  tasksOverdue: { EN: "Tasks overdue", DA: "Opgaver overskredet" },
  ofTasks: { EN: "of {count} tasks", DA: "af {count} opgaver" },
  lists: { EN: "Lists", DA: "Lister" },
  recipes: { EN: "Recipes", DA: "Opskrifter" },

  slowestCalls: { EN: "Slowest database calls", DA: "Langsomste databasekald" },
  nothingSlow: {
    EN: "Nothing took longer than {ms} ms in the last day.",
    DA: "Intet tog længere end {ms} ms det seneste døgn.",
  },
  worstMs: { EN: "{ms} ms worst", DA: "{ms} ms værst" },
  raw: { EN: "raw", DA: "rå" },
  recordedFor: {
    EN: "Calls over {ms} ms are recorded and kept for {days} days. Failed requests are written to the platform logs rather than stored here.",
    DA: "Kald over {ms} ms registreres og gemmes i {days} dage. Fejlede forespørgsler skrives til platformens logs frem for at blive gemt her.",
  },

  thisDevice: { EN: "This device", DA: "Denne enhed" },
  thisDeviceHint: {
    EN: "What the phone reports about the frame — whether the app is drawn under the status bar, and what colour it was told to paint.",
    DA: "Hvad telefonen rapporterer om rammen — om app'en tegnes under statusbjælken, og hvilken farve den fik besked på at male.",
  },
  bars: { EN: "Bars", DA: "Bjælker" },
} as const satisfies Record<string, Phrase | Plural>;

/**
 * Storage and AI-spend readings, shared by a home's own `/settings` page and the super
 * admin's `/admin/system` page — the same charts, read once by whoever runs a home and
 * once across all of them.
 */
export const STORAGE = {
  whatItIs: { EN: "What it is", DA: "Hvad det er" },
  inThisHome: { EN: "in this home", DA: "i dette hjem" },
  acrossHomes: { EN: "Across homes", DA: "På tværs af hjem" },
  inHomes: {
    EN: { one: "in {count} home", other: "in {count} homes" },
    DA: { one: "i {count} hjem", other: "i {count} hjem" },
  },
  ofContent: { EN: "of content", DA: "af indhold" },
  smallerHomes: {
    EN: { one: "{count} smaller home", other: "{count} smaller homes" },
    DA: { one: "{count} mindre hjem", other: "{count} mindre hjem" },
  },
  footnote: {
    EN: "Measured as Postgres stores it, after compression. Indexes and the database's own overhead are not counted, so the whole database is always somewhat larger than this.",
    DA: "Målt som Postgres gemmer det, efter komprimering. Indekser og databasens egen overhead er ikke talt med, så hele databasen er altid noget større end dette.",
  },
  pictureCountsToward: {
    EN: "A picture counts towards whatever is showing it.",
    DA: "Et billede tæller med under det, der viser det.",
  },
} as const satisfies Record<string, Phrase | Plural>;

export const AI_SPEND = {
  spendLine: { EN: "{spent} of {limit} this month", DA: "{spent} af {limit} denne måned" },
  overTheLimit: { EN: " — over the limit", DA: " — over grænsen" },
  footnote: {
    EN: "What Anthropic billed for reading imported recipes this calendar month, converted from its own price in USD at a fixed rate. Resets on the first of the month.",
    DA: "Hvad Anthropic har faktureret for at læse importerede opskrifter denne kalendermåned, omregnet fra sin egen pris i USD til en fast kurs. Nulstilles den første i måneden.",
  },
  noHomesYet: { EN: "No homes yet.", DA: "Ingen hjem endnu." },
} as const satisfies Record<string, Phrase>;

/** Admin → System: how long the household waits on each AI reader. */
export const AI_TIMES = {
  heading: { EN: "AI call times", DA: "AI-svartider" },
  import: { EN: "Import", DA: "Import" },
  save: { EN: "Save", DA: "Gem" },
  calls: {
    EN: { one: "{count} call", other: "{count} calls" },
    DA: { one: "{count} kald", other: "{count} kald" },
  },
  typicalAndSlowest: {
    EN: "typical {typical} · slowest {slowest}",
    DA: "typisk {typical} · langsomst {slowest}",
  },
  seconds: { EN: "{s} s", DA: "{s} sek." },
  noneYet: {
    EN: "No timed calls in the last {days} days yet.",
    DA: "Ingen målte kald de seneste {days} dage endnu.",
  },
  footnote: {
    EN: "The last {days} days. Only calls that finished are counted: one that timed out never reports its time, so the slowest real wait can be longer than shown.",
    DA: "De seneste {days} dage. Kun kald, der blev færdige, tælles med: et kald, der fik timeout, melder aldrig sin tid, så den langsomste reelle ventetid kan være længere end vist.",
  },
} as const satisfies Record<string, Phrase | Plural>;

export const REMINDERS = {
  noOneNotified: { EN: "no one will be notified", DA: "ingen bliver underrettet" },
  notificationsOn: { EN: "notifications on", DA: "notifikationer slået til" },
  subscribedCount: {
    EN: {
      one: "{subscriptions} of {members} person has turned reminders on.",
      other: "{subscriptions} of {members} people have turned reminders on.",
    },
    DA: {
      one: "{subscriptions} af {members} person har slået påmindelser til.",
      other: "{subscriptions} af {members} personer har slået påmindelser til.",
    },
  },
  nobodySubscribed: {
    EN: "Tasks will still come due, but nobody gets a reminder until someone enables notifications from the dashboard.",
    DA: "Opgaver forfalder stadig, men ingen får en påmindelse, før nogen slår notifikationer til fra oversigten.",
  },
  lastReminderSent: { EN: "Last reminder sent:", DA: "Sidste påmindelse sendt:" },
  never: { EN: "never", DA: "aldrig" },
  nextTaskDue: { EN: "Next task due:", DA: "Næste opgave forfalder:" },
  nothingScheduled: { EN: "nothing scheduled", DA: "intet planlagt" },
  overdueCount: {
    EN: { one: "{count} task is overdue in this home.", other: "{count} tasks are overdue in this home." },
    DA: {
      one: "{count} opgave er overskredet i dette hjem.",
      other: "{count} opgaver er overskredet i dette hjem.",
    },
  },
} as const satisfies Record<string, Phrase | Plural>;
