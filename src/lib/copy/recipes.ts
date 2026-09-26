import type { Phrase, Plural } from "./say";

/** The new-recipe dialog and the link importer — the two steps before there is a form. */
export const RECIPES = {
  newRecipe: { EN: "New recipe", DA: "Ny opskrift" },
  importFromLink: { EN: "Import from a link", DA: "Importer fra et link" },
  chooseHint: {
    EN: "Type it in yourself, or pull the title, ingredients and instructions from a link.",
    DA: "Skriv den selv, eller hent titel, ingredienser og fremgangsmåde fra et link.",
  },
  startFromScratch: { EN: "Start from scratch", DA: "Start forfra" },
  startFromScratchInstead: { EN: "Start from scratch instead", DA: "Start forfra i stedet" },
  cancel: { EN: "Cancel", DA: "Annuller" },
  back: { EN: "Back", DA: "Tilbage" },
  saveRecipe: { EN: "Save recipe", DA: "Gem opskrift" },
  worthChecking: { EN: "Worth checking: {note}", DA: "Værd at tjekke: {note}" },

  recipeLink: { EN: "Recipe link", DA: "Opskriftslink" },
  fetch: { EN: "Fetch", DA: "Hent" },
  fetching: { EN: "Fetching…", DA: "Henter…" },
  linkHint: {
    EN: "A recipe page, or a reel from Instagram, Facebook or TikTok. Its title, ingredients, instructions, picture and time open in the usual form, tidied up and ready to check over before saving.",
    DA: "En opskriftsside, eller en reel fra Instagram, Facebook eller TikTok. Titel, ingredienser, fremgangsmåde, billede og tid åbner i den sædvanlige formular, ryddet op og klar til at tjekke igennem, før den gemmes.",
  },
  reading: { EN: "Reading the recipe…", DA: "Læser opskriften…" },
  readingHint: {
    EN: "The AI is writing it up — this can take up to 20 seconds.",
    DA: "AI'en skriver den ind — det kan tage op til 20 sekunder.",
  },
  // The stage lines `AiOverlay` walks through while a link is read — `recipeImportOverlay`.
  readingStage1: { EN: "Fetching the page…", DA: "Henter siden…" },
  readingStage2: { EN: "Looking for the recipe…", DA: "Leder efter opskriften…" },
  readingStage3: { EN: "Sorting out the ingredients…", DA: "Sorterer ingredienserne…" },
  readingStage4: { EN: "Writing up the steps…", DA: "Skriver trinene ind…" },
  pasteLinkFirst: { EN: "Paste a link to a recipe first.", DA: "Indsæt først et link til en opskrift." },
  pasteCaptionFirst: {
    EN: "Paste the reel's description first.",
    DA: "Indsæt først reelens beskrivelse.",
  },

  /** `src/lib/recipe-import.ts`'s error sentences — what to try next, not just what failed. */
  genericError: {
    EN: "Couldn't read a recipe from that page. Check the link, or fill the form in by hand.",
    DA: "Kunne ikke læse en opskrift fra den side. Tjek linket, eller udfyld formularen selv.",
  },
  notAWebAddress: { EN: "That doesn't look like a web address.", DA: "Det ligner ikke en webadresse." },
  couldNotReach: {
    EN: "Couldn't reach that page. Check the link and try again.",
    DA: "Kunne ikke nå den side. Tjek linket og prøv igen.",
  },
  captionUnreachable: {
    EN: "Couldn't read that reel's description — Instagram and Facebook often refuse. Paste it in below instead.",
    DA: "Kunne ikke læse reelens beskrivelse — Instagram og Facebook nægter ofte. Indsæt den nedenfor i stedet.",
  },
  captionNotARecipe: {
    EN: "Couldn't find a recipe in that description. Paste the whole thing in below, or fill the form in by hand.",
    DA: "Kunne ikke finde en opskrift i den beskrivelse. Indsæt det hele nedenfor, eller udfyld formularen selv.",
  },
  readerUnavailable: {
    EN: "Couldn't read that recipe just now. Try again in a moment, paste the description below, or fill the form in by hand.",
    DA: "Kunne ikke læse den opskrift lige nu. Prøv igen om lidt, indsæt beskrivelsen nedenfor, eller udfyld formularen selv.",
  },
  aiLimitReached: {
    EN: "This home has used this month's allowance for reading recipes. Fill the form in by hand, or try again next month.",
    DA: "Hjemmet har brugt denne måneds kvote til at læse opskrifter. Udfyld formularen selv, eller prøv igen næste måned.",
  },
  rateLimited: {
    EN: "That's a lot of imports at once. Try again in {minutes} min, or fill the form in by hand.",
    DA: "Det er mange importer på én gang. Prøv igen om {minutes} min, eller udfyld formularen selv.",
  },

  // src/lib/recipes.ts — timeLabel, a dual-use lib function
  minutesOnly: { EN: "{min} min", DA: "{min} min" },
  hoursOnly: { EN: "{hr} hr", DA: "{hr} t" },
  hoursMinutes: { EN: "{hr} hr {min} min", DA: "{hr} t {min} min" },

  // /recipes
  title: { EN: "Recipes", DA: "Opskrifter" },
  description: {
    EN: "Write them out, or just save the reel you want to cook from.",
    DA: "Skriv dem ud, eller gem bare den reel, I vil lave mad fra.",
  },
  searchRecipes: { EN: "Search recipes and ingredients", DA: "Søg i opskrifter og ingredienser" },
  searchRecipesAria: { EN: "Search recipes", DA: "Søg i opskrifter" },
  filterByCategory: { EN: "Filter by category", DA: "Filtrer efter kategori" },
  filterByTime: { EN: "Filter by time", DA: "Filtrer efter tid" },
  all: { EN: "All", DA: "Alle" },
  anyTime: { EN: "Any time", DA: "Uanset tid" },
  underMin: { EN: "Under {min} min", DA: "Op til {min} min" },
  minPlus: { EN: "{min} min+", DA: "{min} min+" },
  /** A filter chip's own accessible name — the label, and how many recipes it selects. */
  filterAriaLabel: {
    EN: { one: "{label}, {count} recipe", other: "{label}, {count} recipes" },
    DA: { one: "{label}, {count} opskrift", other: "{label}, {count} opskrifter" },
  },
  noCategoriesYet: {
    EN: "No recipe categories yet — an admin adds them under Settings, and then recipes can be saved.",
    DA: "Ingen opskriftskategorier endnu — en admin tilføjer dem under Indstillinger, og så kan opskrifter gemmes.",
  },
  noRecipesYet: {
    EN: "No recipes yet — save your first one with the button above.",
    DA: "Ingen opskrifter endnu — gem jeres første med knappen ovenfor.",
  },
  noRecipeMatch: { EN: "No recipe matches “{query}”.", DA: "Ingen opskrift matcher “{query}”." },
  noneUnderTime: { EN: "No recipes under {min} min.", DA: "Ingen opskrifter under {min} min." },
  noneUnderTimeInCategory: {
    EN: "No recipes under {min} min in this category.",
    DA: "Ingen opskrifter under {min} min i denne kategori.",
  },
  noneOverTime: { EN: "No recipes {min} min or more.", DA: "Ingen opskrifter på {min} min eller mere." },
  noneOverTimeInCategory: {
    EN: "No recipes {min} min or more in this category.",
    DA: "Ingen opskrifter på {min} min eller mere i denne kategori.",
  },
  nothingInCategory: {
    EN: "Nothing filed under this category yet.",
    DA: "Intet arkiveret under denne kategori endnu.",
  },
  editRecipe: { EN: "Edit recipe", DA: "Rediger opskrift" },
  deleteRecipeMessage: { EN: 'Delete the recipe "{title}"?', DA: 'Slet opskriften "{title}"?' },
  includesVideo: { EN: "Includes a video", DA: "Indeholder en video" },

  // Recipe fields, shared by the create dialog, the standalone form and the card's own menu
  categories: { EN: "Categories", DA: "Kategorier" },
  noCategoriesField: {
    EN: "This home has no recipe categories yet. An admin can add them under",
    DA: "Dette hjem har ingen opskriftskategorier endnu. En admin kan tilføje dem under",
  },
  tickEveryHeading: {
    EN: "Tick every heading this recipe belongs under.",
    DA: "Kryds af ved hver overskrift denne opskrift hører under.",
  },
  titleField: { EN: "Title", DA: "Titel" },
  shortDescription: { EN: "Short description", DA: "Kort beskrivelse" },
  totalTimeMinutesField: { EN: "Total time (minutes)", DA: "Samlet tid (minutter)" },
  servingsField: { EN: "Portions", DA: "Portioner" },
  servingsHint: {
    EN: "How many people the amounts below are for.",
    DA: "Hvor mange personer mængderne nedenfor er til.",
  },
  servingsMessage: {
    EN: "Portions must be a whole number from 1 to 99.",
    DA: "Portioner skal være et helt tal fra 1 til 99.",
  },
  picture: { EN: "Picture", DA: "Billede" },
  pictureHint: {
    EN: "What it looks like when it is finished — shown on the recipe and on its card.",
    DA: "Sådan ser den ud, når den er færdig — vises på opskriften og på dens kort.",
  },
  videoLink: { EN: "Video link (Instagram, YouTube, TikTok…)", DA: "Videolink (Instagram, YouTube, TikTok…)" },
  videoLinkHint: {
    EN: "Paste the link and the video is embedded on the recipe page.",
    DA: "Indsæt linket, og videoen indlejres på opskriftssiden.",
  },
  savingRecipe: { EN: "Saving your recipe…", DA: "Gemmer jeres opskrift…" },
  savingRecipeDetail: {
    EN: "The AI is tidying the ingredients and turning the instructions into steps for cooking mode — this can take up to 30 seconds.",
    DA: "AI'en rydder op i ingredienserne og omdanner fremgangsmåden til trin til madlavningstilstand — det kan tage op til 30 sekunder.",
  },
  // The stage lines `AiOverlay` walks through while a save is read — `recipeSaveOverlay`.
  savingStage1: { EN: "Reading your ingredients…", DA: "Læser jeres ingredienser…" },
  savingStage2: { EN: "Splitting amounts from units…", DA: "Skiller mængder fra enheder…" },
  savingStage3: { EN: "Matching ingredients to each step…", DA: "Kobler ingredienser til hvert trin…" },
  savingStage4: { EN: "Timing every step…", DA: "Tager tid på hvert trin…" },
  savingStage5: { EN: "Getting cooking mode ready…", DA: "Gør madlavningstilstand klar…" },
  ingredientsField: { EN: "Ingredients", DA: "Ingredienser" },
  ingredientsPlaceholder: {
    EN: "One per line\n200 g flour\n2 eggs",
    DA: "Én pr. linje\n200 g mel\n2 æg",
  },
  instructionsField: { EN: "Instructions", DA: "Fremgangsmåde" },
  onePerLineStep: { EN: "One step per line", DA: "Ét trin pr. linje" },
  saving: { EN: "Saving…", DA: "Gemmer…" },

  // The standalone create/edit pages — newRecipe and editRecipe above serve as their
  // PageHeader titles too, since the wording is identical.
  saveChanges: { EN: "Save changes", DA: "Gem ændringer" },

  // The recipe's own page
  startCooking: { EN: "Start cooking", DA: "Begynd madlavning" },
  goToLink: { EN: "Go to link", DA: "Gå til linket" },
  ingredientsHeading: { EN: "Ingredients", DA: "Ingredienser" },
  instructionsHeading: { EN: "Instructions", DA: "Fremgangsmåde" },
  noneListed: { EN: "None listed.", DA: "Ingen angivet." },
  portions: {
    EN: { one: "{count} portion", other: "{count} portions" },
    DA: { one: "{count} portion", other: "{count} portioner" },
  },
  fewerPortions: { EN: "Fewer portions", DA: "Færre portioner" },
  morePortions: { EN: "More portions", DA: "Flere portioner" },
  scaledFrom: { EN: "The recipe is written for {count}", DA: "Opskriften er skrevet til {count}" },
  noneWrittenFollowVideo: { EN: "None written — follow the video.", DA: "Ingen skrevet — følg videoen." },

  // Action mode — src/components/cook-mode.tsx
  cookingTitle: { EN: "Cooking {title}", DA: "Laver {title}" },
  stepOfTotal: { EN: "Step {number} of {total}", DA: "Trin {number} af {total}" },
  stepNumber: { EN: "Step {number}", DA: "Trin {number}" },
  timerDone: { EN: "done", DA: "færdig" },
  restartTimer: { EN: "Restart {time}", DA: "Genstart {time}" },
  startTimer: { EN: "Start {time}", DA: "Start {time}" },
  forThisStep: { EN: "For this step", DA: "Til dette trin" },
  notPreparedNotice: {
    EN: "These steps have not been prepared for cooking yet — they will show without their ingredients. Preparing them tidies the steps and works out what each one needs.",
    DA: "Disse trin er endnu ikke forberedt til madlavning — de vises uden deres ingredienser. At forberede dem rydder op i trinnene og finder ud af, hvad hvert af dem skal bruge.",
  },
  prepareSteps: { EN: "Prepare these steps", DA: "Forbered disse trin" },
  preparing: { EN: "Preparing…", DA: "Forbereder…" },
  backButton: { EN: "Back", DA: "Tilbage" },
  start: { EN: "Start", DA: "Start" },
  complete: { EN: "Complete", DA: "Afslut" },
  next: { EN: "Next", DA: "Næste" },

  // Recipe categories, on /settings — src/components/recipe-categories-admin.tsx
  recipeCategoriesHeading: { EN: "Recipe categories", DA: "Opskriftskategorier" },
  skipForSuggestions: { EN: "Skip for dinner suggestions", DA: "Spring over ved middagsforslag" },
  addCategory: { EN: "Add category", DA: "Tilføj kategori" },
  categoryAdded: { EN: "Category added.", DA: "Kategori tilføjet." },
  newCategory: { EN: "New category", DA: "Ny kategori" },
  categoryNamePlaceholder: { EN: "Weeknight dinners", DA: "Hverdagsmiddage" },
  rename: { EN: "Rename", DA: "Omdøb" },
  renamed: { EN: "Renamed.", DA: "Omdøbt." },
  nameOfCategory: { EN: "Name of category {name}", DA: "Navn på kategorien {name}" },
  categoryCount: {
    EN: { one: "{count} recipe", other: "{count} recipes" },
    DA: { one: "{count} opskrift", other: "{count} opskrifter" },
  },
  deleteCategory: { EN: "Delete category", DA: "Slet kategori" },
  deleteCategoryMessage: { EN: 'Delete the category "{name}"?', DA: 'Slet kategorien "{name}"?' },

  // src/app/actions/recipes.ts
  titleRequired: { EN: "Give the recipe a title.", DA: "Giv opskriften en titel." },
  timeMessage: {
    EN: "Time must be a whole number of minutes.",
    DA: "Tiden skal være et helt antal minutter.",
  },
  invalidVideoLink: {
    EN: "That video link is not a valid web address.",
    DA: "Det videolink er ikke en gyldig webadresse.",
  },
  chooseCategory: {
    EN: "Choose at least one category for this recipe.",
    DA: "Vælg mindst én kategori til denne opskrift.",
  },
  prepareOverLimit: {
    EN: "This home has used this month's allowance for preparing recipes. The steps still work as they are.",
    DA: "Hjemmet har brugt denne måneds kvote til at forberede opskrifter. Trinene virker stadig, som de er.",
  },
  prepareRateLimited: {
    EN: "That's a lot of preparing at once. Try again in {minutes} min.",
    DA: "Det er mange forberedelser på én gang. Prøv igen om {minutes} min.",
  },
  prepareReaderUnavailable: {
    EN: "Could not prepare these steps just now. Try again in a moment.",
    DA: "Kunne ikke forberede disse trin lige nu. Prøv igen om lidt.",
  },

  // src/app/actions/recipe-categories.ts
  categoryNameRequired: { EN: "Give the category a name.", DA: "Giv kategorien et navn." },
  categoryAlreadyExists: {
    EN: "There is already a category called “{name}”.",
    DA: "Der findes allerede en kategori, der hedder “{name}”.",
  },
  categoryNoLongerExists: {
    EN: "That category no longer exists.",
    DA: "Den kategori findes ikke længere.",
  },
} as const satisfies Record<string, Phrase | Plural>;
