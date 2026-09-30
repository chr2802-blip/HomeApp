import type { Phrase, Plural } from "./say";

/** `/dashboard` — the greeting, the due-task sections, and the lists shelf. */
export const DASHBOARD = {
  thisHome: { EN: "This home", DA: "Dette hjem" },
  whatNeedsAttention: { EN: "{home} · what needs attention", DA: "{home} · hvad der skal ses på" },

  noHomeSelected: { EN: "No home selected", DA: "Intet hjem valgt" },
  pickAHome: { EN: "Pick a home to work in.", DA: "Vælg et hjem at arbejde i." },
  notInAHome: { EN: "You are not in a home at the moment.", DA: "I er ikke i et hjem lige nu." },
  goToYourHomes: { EN: "Go to your homes", DA: "Gå til jeres hjem" },

  // The row of three numbers under the greeting.
  dueForYouTile: { EN: "due for you", DA: "til dig" },
  overdueCount: {
    EN: { one: "{count} overdue", other: "{count} overdue" },
    DA: { one: "{count} over tid", other: "{count} over tid" },
  },
  noneOverdue: { EN: "none overdue", DA: "intet over tid" },
  toBuy: { EN: "to buy", DA: "at købe" },
  onLists: {
    EN: { one: "on {count} list", other: "on {count} lists" },
    DA: { one: "på {count} liste", other: "på {count} lister" },
  },
  runOut: { EN: "run out", DA: "brugt op" },
  inThePantry: { EN: "in the pantry", DA: "i forrådet" },

  today: { EN: "Today", DA: "I dag" },
  nothingToday: { EN: "Nothing needs doing today. Enjoy it.", DA: "Intet skal gøres i dag. Nyd det." },
  comingUp: { EN: "Coming up", DA: "De næste dage" },
  mealPlan: { EN: "Meal plan", DA: "Madplan" },
  /** Under the fraction in the week's ring. */
  jobs: { EN: "jobs", DA: "opgaver" },

  weekAllDone: { EN: "This week · all {done} done", DA: "Denne uge · alle {done} klaret" },
  weekOfTotalDone: {
    EN: "This week · {done} of {total} jobs done",
    DA: "Denne uge · {done} af {total} opgaver klaret",
  },

  tonightsDinner: { EN: "Tonight's dinner", DA: "Aftensmad i aften" },
  findNew: { EN: "Find new", DA: "Find en ny" },
  finding: { EN: "Finding…", DA: "Finder…" },

  dueForYou: { EN: "Due for you", DA: "Forfalder for dig" },
  dueForSomeoneElse: {
    EN: { one: "Due for someone else ({count})", other: "Due for someone else ({count})" },
    DA: { one: "Forfalder for en anden ({count})", other: "Forfalder for andre ({count})" },
  },
  done: { EN: "Done", DA: "Klaret" },

  favouriteLists: { EN: "Favourite lists", DA: "Favoritlister" },
  recentLists: { EN: "Recent lists", DA: "Seneste lister" },
  seeAll: { EN: "See all", DA: "Se alle" },
  noListsYet: { EN: "No lists yet.", DA: "Ingen lister endnu." },
  createOne: { EN: "Create one", DA: "Opret en" },
  nothingOnItYet: { EN: "Nothing on it yet", DA: "Ikke noget på den endnu" },
  allDone: { EN: "All done", DA: "Alt klaret" },
  starAListOn: { EN: "Star a list on the", DA: "Giv en liste en stjerne på" },
  listsPage: { EN: "lists page", DA: "listesiden" },
  toKeepItHereInstead: {
    EN: "to keep it here instead.",
    DA: "for at beholde den her i stedet.",
  },

  // notification-setup.tsx — shared by the dashboard and the profile page
  taskReminders: { EN: "Task reminders", DA: "Opgavepåmindelser" },
  remindersOn: {
    EN: "Reminders are on in this browser. Each browser and phone is asked separately.",
    DA: "Påmindelser er slået til i denne browser. Hver browser og telefon spørges separat.",
  },
  notificationsBlocked: {
    EN: "Notifications are blocked for this site — enable them in your browser settings.",
    DA: "Notifikationer er blokeret for dette site — slå dem til i din browsers indstillinger.",
  },
  pushUnsupported: {
    EN: "This browser can't show push notifications.",
    DA: "Denne browser kan ikke vise push-notifikationer.",
  },
  turnOnNotifications: {
    EN: "Turn on notifications to be reminded when a recurring task is due.",
    DA: "Slå notifikationer til for at blive mindet om, når en tilbagevendende opgave forfalder.",
  },
  enabling: { EN: "Enabling…", DA: "Slår til…" },
  enableNotifications: { EN: "Enable notifications", DA: "Slå notifikationer til" },
  sendTestNotification: { EN: "Send test notification", DA: "Send testnotifikation" },
  testSent: { EN: "Sent.", DA: "Sendt." },
  noActiveSubscription: {
    EN: "No active subscription on this account.",
    DA: "Intet aktivt abonnement på denne konto.",
  },
} as const satisfies Record<string, Phrase | Plural>;

/** The household's weekly rhythm — src/lib/streak.ts, a dual-use lib module. */
export const STREAK = {
  listsCleared: {
    EN: { one: "{count} list", other: "{count} lists" },
    DA: { one: "{count} liste", other: "{count} lister" },
  },
  oneWeekWithClears: {
    EN: "🔥 A list cleared · {lists} cleared this week",
    DA: "🔥 En liste klaret · {lists} klaret denne uge",
  },
  oneWeekNoClearsYet: { EN: "🔥 A list cleared last week", DA: "🔥 En liste klaret sidste uge" },
  runningWithClears: {
    EN: "🔥 {weeks} weeks running · {lists} cleared this week",
    DA: "🔥 {weeks} uger i træk · {lists} klaret denne uge",
  },
  runningNoClearsYet: {
    EN: "🔥 {weeks} weeks running · nothing cleared yet this week",
    DA: "🔥 {weeks} uger i træk · intet klaret endnu denne uge",
  },
} as const satisfies Record<string, Phrase | Plural>;

/** The greeting follows the household's clock (`partOfDay` in `src/lib/greeting.ts`). */
export const GREETING = {
  morning: { EN: "Good morning, {name}", DA: "Godmorgen, {name}" },
  afternoon: { EN: "Hi, {name}", DA: "Hej, {name}" },
  evening: { EN: "Good evening, {name}", DA: "Godaften, {name}" },
  night: { EN: "Still up, {name}?", DA: "Stadig oppe, {name}?" },
} as const satisfies Record<string, Phrase>;

/**
 * The line under the greeting, one of each set a day (`dayLine`). Each set answers one
 * situation — which is decided first — and only the wording rotates, so it reads like a
 * person rather than a status bar and never says something untrue. Keyed rather than
 * listed, so `tests/unit/language.test.ts` (which does not walk arrays) reads every one.
 */
export const DAY_LINE = {
  /** A quiet day in a festive week, for a home that switched its seasonal touches on. */
  festive: {
    christmas: { EN: "Nothing pressing — time for some hygge. 🎄", DA: "Intet presserende — tid til lidt hygge. 🎄" },
    newYear: { EN: "A quiet day between the years. 🎆", DA: "En stille dag i romjulen. 🎆" },
    halloween: { EN: "All calm. Suspiciously calm. 🎃", DA: "Helt roligt. Mistænkeligt roligt. 🎃" },
  },
  dinner: {
    first: { EN: "{dish} is on tonight.", DA: "Der er {dish} i aften." },
    second: { EN: "Tonight it's {dish}. Lovely.", DA: "I aften bliver det {dish}. Dejligt." },
    third: { EN: "Something to look forward to: {dish}.", DA: "Noget at glæde sig til: {dish}." },
  },
  busy: {
    first: { EN: "A few things want doing today.", DA: "Der er et par ting, der skal gøres i dag." },
    second: { EN: "One thing at a time. You've got this.", DA: "Én ting ad gangen. I klarer det." },
    third: { EN: "Busy day — here's what's waiting.", DA: "Travl dag — her er det, der venter." },
  },
  calm: {
    first: { EN: "Nothing pressing today. Put the kettle on.", DA: "Intet presserende i dag. Sæt kedlen over." },
    second: { EN: "A quiet day at home. Enjoy it.", DA: "En stille dag derhjemme. Nyd det." },
    third: { EN: "All calm here. Nice work, everyone.", DA: "Helt roligt her. Godt gået, alle sammen." },
  },
} as const satisfies Record<string, Record<string, Phrase>>;
