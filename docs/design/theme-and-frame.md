# A home's colour, and the frame the phone paints

Moved out of CLAUDE.md, which keeps the rules; this is why they are the rules.
The short version lives under "A home is dressed in a colour" there.

## A home is dressed in a colour, and it dresses the controls

`Home.theme` is one of a fixed set (`HomeTheme`), picked by that household's admins in
the Home card on `/settings`. Somebody in several homes needs to know which one is open
before they add milk to the wrong shopping list — the header says so in words, with the
household's picture beside them, and its colour is on every control below.

What each colour *is* lives in **`globals.css` and nowhere else**, as a block of five
variables per theme keyed by `[data-theme="NAME"]`. `src/lib/theme.ts` holds what they
are called, and `BAND` — the one colour CSS cannot reach, because `<meta
name="theme-color">` takes a literal. Anything showing a colour — a swatch in the picker, a dot beside a home
in the header's menu — carries that home's `data-theme` and reads `var(--accent)`, so it *is*
the colour rather than a copy that drifts. `tests/unit/theme.test.ts` reads the
stylesheet and fails if a theme has no block: an undefined variable leaves the element
wearing whatever the page already had, which looks like a theme that works.

The attribute goes on `<html>`, set by the **root layout** from the session. Not on a
wrapper inside the app: sheets and the three-dot panel are portalled into `<body>`, so
anything scoped to a div would leave every dialog in the previous home's colours.

**The frame is `--band`, and it does not follow the household — it is the one thing
about a theme that is not that theme's to choose.** It used to: each theme carried its
own pale tint, on the understanding that `<meta name="theme-color">` retints an
installed app's status bar on every request. It does not — the tag is read once and does
not repaint itself as somebody moves between homes, so the strip stayed whichever colour
loaded first while the header underneath it changed home under it, in five homes out of
six. `BAND` is now a single literal, not a `Record<HomeTheme, …>`, declared identically
in every theme block in `globals.css` and read by `generateViewport` for the meta tag —
the one painter that has to be told the colour in words, which is why it is worked out in
the root layout rather than declared there. It is `#e5e7eb`, not white: a frame drawn in
the page's own colour reads as no frame at all, which is the seam this exists to close by
another route.

**Each painter reaches a different edge.** The app is laid out under the phone's own
bars — `viewportFit: "cover"` — so the gesture bar at the bottom is inside the viewport
and the tab bar's band simply reaches it. On iOS the strip at the top comes from the
document's background, which is why `html` carries the band, and its glyphs stay the
phone's own dark ones through `appleWebApp.statusBarStyle: "default"`. On Android that
strip is tinted from the meta tag at launch. The manifest's `theme_color` reads once when
the app is installed and is the splash screen's colour — now the same literal as
everywhere else, so it is no longer the odd one out.

Laying out under the bars is a debt the layout pays back in three places, and
`tests/unit/theme.test.ts` holds all three together: the header pads past
`env(safe-area-inset-top)` so its row clears the clock, the tab bar pads past
`env(safe-area-inset-bottom)` so the tabs clear the gesture bar while the band behind
them fills it, and `main` clears both. Every inset is zero on a desktop, so getting one
wrong is invisible in a browser and obvious on a phone.

**The band is a pale, neutral tint, not a tint of any theme's accent.** It has nothing
left to be an accent tint *of* — it is the one colour every theme shares — and a light
one for the same reason it always was: the strip at the top holds the phone's own clock
and battery in dark glyphs and the header holds near-black words, and both have to stay
legible on it. Drawing the frame in an accent itself is a different change again: it
wants white header text, and on iOS a translucent status bar style, and it is not a
colour swap.

**The band is opaque, in every theme, and that is load-bearing.** It was `rgb(… / 0.85)`
so the header could frost what scrolled under it — and a frosted header is a different
colour every time the page moves, which a strip the phone paints can follow none of. The
unit test checks the alpha as strictly as the hex, and no theme block may bring back an
`--accent-soft` of its own: that would be a second colour for the same strip, and the
one the phone is told about is whichever of the two the header did not use.

**The colour dresses the controls and the household's own progress, never the meanings
inside them.** The primary button, the active nav pill, the focus ring, the hairline
under the header — and the bar along the bottom of a list card, which is the one thing
here that is not a control: a household's way through its own lists is that
household's, and it was the last fixed colour on those pages that belonged to no home.
Nothing else, the band included: that one dresses no home at all any more. Green is
still "added", red "about to be deleted", amber "overdue", in every home; a household
dressed in one of those would be saying it on every screen, which is why none of the
themes is any of them and why `create` and `danger` keep their own colours — and why a
bar in the home's colour cannot accidentally say one of the three.

**The one palette that is neither a home's colour nor a meaning is the charts'.**
`--chart-recipes`, `--chart-lists`, `--chart-tasks` and `--chart-rest` in `globals.css`
dress the storage donuts, and they are fixed: a slice is read rather than pressed, and in
the household whose accent happened to match it a slice would disappear into the Save
button below it — while a legend drawn in each home's own colours would mean one thing in
the flat and another in the summer house, about kinds that are the same in both. None of
the four is green, red or amber either, checked by `tests/unit/storage.test.ts` against
the same three `theme.test.ts` keeps out of the themes. The exception proves the rule: on
the super admin's across-homes ring a slice *is* a household, so it wears that
household's `data-theme` and reads `var(--accent)`, exactly as its dot does in the
header's menu.

The picker submits `THEME_FIELD`, checked against the set by `updateHome`. It is
optional there — a colour not mentioned is a colour left alone — because the other ways
into that action (a picture being replaced, a rename) are not about the colour. Unlike
`REPEAT_FIELD`, silence here changes nothing about what the record means.
