import type { Phrase, Plural } from "./say";

/** `/dashboard` — the greeting, the due-task sections, and the lists shelf. */
export const DASHBOARD = {
  greeting: { EN: "Hi {name}", DA: "Hej {name}" },
  thisHome: { EN: "This home", DA: "Dette hjem" },
  whatNeedsAttention: { EN: "{home} · what needs attention", DA: "{home} · hvad der skal ses på" },

  noHomeSelected: { EN: "No home selected", DA: "Intet hjem valgt" },
  pickAHome: { EN: "Pick a home to work in.", DA: "Vælg et hjem at arbejde i." },
  notInAHome: { EN: "You are not in a home at the moment.", DA: "I er ikke i et hjem lige nu." },
  goToYourHomes: { EN: "Go to your homes", DA: "Gå til jeres hjem" },

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
