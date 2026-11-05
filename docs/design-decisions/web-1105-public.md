# The public pages, refined (night of 5 Nov 2026, packet R2-B)

Owner's ask (5 Nov, about 2:40 am, SPEC night-1105): an overall refinement of the website, "keep doubling down on branding",
typography, the app's way of building UI. Standing rules: refine, never rebuild or cut; Night stays subtle; keep the logo and
the fonts; one green (volt #D2F000 fills in Night, olive for brand words in Day); no AI slop. Audience: 16-17-year-olds, many
new to CBT. This packet owned /signup, /login, /pricing, /cuet-cutoff-calculator and the combo planner, the subject pages,
the CUET 2027 guide, /about, /help (critique only: it is the signed-in app), the footer, the site bar and its phone menu, and
the 404 page. The home page and the signed-in app were not touched.

## How it was judged
Real Chrome (headless, the shared lock), 14 routes at 360x640, 390x844, 1024x768 and 1440x900, Night and Day (112 page
renders before, the same after), reduced motion so reveals are drawn. Each render was also measured in the page:
horizontal overflow, a number parted from its name at a line end ("CUET" / "2027", "Round" / "3"), single-word last lines in
headings, paragraphs and list rows, text-wrap on multi-line blocks, touch targets under 44 px outside running text, and an
approximate AA contrast check against the first opaque background. Screenshots: `tmp/night-1105/r2-public/before/` and
`after/` in the worktree (not committed; the tmp folder is ignored).

## The critique, most visible to a first-time student first
1. **Sign up: "Start your CUET / 2027 practice."** The heading split the exam name from its year at 360, 390 and 1440 (the
   known one). Same split in the guide's question "How many subjects can I take in CUET / 2027?", "CUET UG / 2026" in every
   subject page's syllabus line, "Round / 1" and "Round / 3" on the calculator.
2. **The way in had four names.** Home says "Sign up free" and "Log in" (LK83/LK88). The site bar said "Start free", the
   phone dock on every public page said "Start free", the log-in page and card said "Create an account", the guide and the
   calculator said "Start a free mock" (a key that opens the sign-up page), the combo planner's dock said "Try a CUET question".
3. **The phone menu had no way to sign up.** Under 900 px the bar shows only the logo, the theme switch and the menu; the menu
   ended with a plain "Log in" row. A guest who opened the menu found no "Sign up".
4. **The bar ran off the screen at 1024.** Five links, the switch, Log in and the key need about 1100 px; the links showed from
   1024, so the key was pushed past the 32 px gutter to the screen's edge (measured: 30-40 px over).
5. **Ragged lines.** 188 single-word last lines across the 104 public renders (summary questions such as "boards?", unit names,
   footer rows such as "planner", the auth points "out" and "chapter", the plan card's "renew."), and 708 multi-line blocks
   with no text-wrap rule (the home page got pretty/balance tonight, D3; the public pages had it only on .mm-lead and
   .mm-body).
6. **The footer on a phone was one 19-link column**, about 1,500 px of single rows, and the public dock left a blank pad under
   it.
7. **Breadcrumbs looked uneven**: "Home     / CUET subjects / Accountancy". A 44 px minimum width on the short "Home" left a wide
   gap after it.
8. **Pricing.** On phones the two "Also in Pro" tiles were two thin columns of four-word lines ("Your answer- / change habit
   and / pace across every / paper."); at 1440 "Free and Pro, side by side" sat 144 px under the tiles (two 72 px section
   paddings stacked).
9. **404.** One key under a two-line lede with 16 px between them; no second door.
10. Smaller: the sign-up fine print centred with an uneven break; "refunds page" on /about was an inline-flex link that
    stretched its line; the log-in grid's 4 rem bottom padding over the footer.

Checked and fine: no horizontal overflow on any route at any size; no touch target under 44 px outside running text on the
public pages; contrast passed everywhere except a 9 px "Save & Next" inside the pricing page's drawn NTA screen (an
illustration, left as is). Night stays the warm charcoal of the marketing theme; the pricing page's lamp-lit art and
greenish card tone mirror the app's Pro page (owner, 20 Oct: "built like how it is on the app") and were left alone.

Not mine to change, reported: /help is the signed-in app (src/app/(app)/help); its FAQ answers have single-word last lines
("over.", "again.", "left.") and its preview top bar's credits link is 42 px tall. The 404 keeps the app's arena palette (a
cooler near-black than the public pages' warm charcoal) by design (SiteNotFound's own note); left.

## What changed
- **One name for the way in** (owner LK83/LK88 carried to every public page). The bar's key says "Sign up free" (still the
  quiet secondary, one volt per screen); on /login the bar and the card offer "Sign up free" ("Create an account" before);
  the guide's and the calculator's keys say "Sign up free" ("Start a free mock" opened the sign-up page). Subject pages keep
  their specific, true key ("Take your first Accountancy mock free").
- **The phone menu ends with the way in**: a ghost "Log in" and the volt "Sign up free" side by side (the home dock's pair);
  a signed-in student gets "Go to Practice" under Profile and Sign out; on /login or /signup only the other door shows.
- **The public dock is the home dock** (new `PublicDock.jsx` over MobileDock): a guest gets "Log in" and "Sign up free"; a
  student one key back in; the page's factual note stays above the keys ("Your first Accountancy mock is free."), slogans
  went ("Practise this syllabus tonight.", "One exam. Done properly."); the combo planner's "Try a CUET question" and its
  "Free. No signup." note went (they contradicted a sign-up key); it leaves at the footer like the home dock, so no blank pad.
- **"CUET 2027" never parts**: `src/lib/keepTogether.mjs` joins CUET/UG/Class/Round/Paper to their number with a no-break
  space in rendered text only (JSON-LD keeps plain spaces). Used by the auth shell, the guides (SeoContentPage), the subject
  pages, the calculator and planner FAQs and steps; the footer's "CUET 2027 guide" carries its own. The auth title's measure
  went from 14ch to 18ch so the joined name gives two balanced lines ("Start your / CUET 2027 practice.") instead of three,
  and in the two-column layout (900 px and up) the title scales with the screen (2.5 rem to 3.5 rem) to keep two lines at 1024.
- **Even lines on every public page**: a zero-specificity rule in marketing.css (pretty on p, li, dd, FAQ bodies; balance on
  headings, terms, questions, captions, table cells), scoped to `.mm:not(.lp)` so the landing keeps its own copy; the footer's
  rows break the same way everywhere.
- **The bar's links show from 1120 px** (was 1024); below that the menu holds them and the bar shows Log in and Sign up free.
  Measured in Chrome at 900-1440: nothing past the gutter (the menu button's intended 6 px overhang aside); at 1120 the row
  fits exactly with the compact link spacing (now 1120-1199).
- **Footer on phones**: brand block and Product full width, Subjects and Company side by side.
- **Breadcrumb**: the 44 px target comes from padding on both sides with a matching negative margin, 14 px text; the
  separators are even.
- **Pricing**: under 520 px each "Also in Pro" tile is one row, art beside the words; at 960+ the compare section starts
  1.5 rem under the tiles (was 4.5 rem).
- **404**: the lede sits 12 px under the headline, the keys 28 px under the lede, 48 px tall; a guest also gets "Log in", a
  student keeps "Open Practice".
- Small: the auth fine print balances; /about's refunds link is inline; the sign-up and log-in grid's bottom padding is 3 rem
  on phones (was 4).

## Before and after (measured, 104 public renders each: 13 routes x 4 sizes x 2 themes; /help excluded)
| Measure | Before | After |
| --- | --- | --- |
| A name parted from its number at a line end ("CUET / 2027", "Round / 3") | 14 | 0 |
| Single-word last lines (headings, paragraphs, list rows, questions) | 188 | 10 (below) |
| Multi-line blocks with no text-wrap rule | 708 | 24 (three hint lines inside the calculator's and planner's own widgets, and the 404's key row, which wraps by design) |
| Horizontal overflow | 0 | 0 |
| Targets under 44 px outside running text | 0 | 0 |
| Text under AA (approximate) | 8 (one 9 px label in the drawn NTA screen) | 8 (same, left) |
| Bar items past the right gutter at 1024 | about 30-40 px | 0 (links in the menu below 1120) |

The 10 single-word lines left (Night and Day each): "1950-1990" ending a chapter list on /cuet/economics at 1024 and 1440 (one token, the data's
own), "format" in the h2 "Beating the case-based format" and "options." in one paragraph on /cuet/business-studies at 360,
and "needed" in the pricing plan's term "None, and no card needed" at 360. Two more found in the first
after-run were fixed and re-measured: the sign-up title at 1024 ("Start your / CUET 2027 / practice." became two lines) and
the combo planner's dock (below).

Screens (worktree `tmp/night-1105/r2-public/`): `before/<page>-<width>-<night|day>-{top,full0..n,menu}.png`, the same names
in `after/`, the re-checks in `after2/`, the bar at 1024/1120/1200/1440 in `after/nav-*.png`.

## Tests
- New `data/tests/public_pages_1105.test.mjs` (10 tests): keepTogether, the joined headings, the text-wrap rule, the CTA words,
  the sheet's keys and their ink, the 1120 px breakpoint, the public dock, the phone footer, the breadcrumb.
- Updated, deliberate refinement (the CTA rule now covers the bar; the rule each pins is unchanged): landing_checklist_1104
  L-007 and L-012 ("Start free" -> "Sign up free" in the nav) and homeHero decision 15 (the bar's key is the raised-paper
  secondary, label now "Sign up free").

## Verification
- Real Chrome (playwright-core, the shared browser lock), dev server on :3542, 112 renders before and 112 after, then 32
  re-renders of the four pages changed after review; every screenshot above was looked at for the routes and sizes named.
- Real pointer, ui-ux-standards section 11 (`tmp/night-1105/r2-public/clicks.mjs`), Night and Day, all 30 checks passed:
  touch-tap the menu button at 390, both sheet keys are the top element at their centres (146x49 and 194x49), the volt key's
  ink is #0B1000, tapping "Sign up free" lands on /signup; on /cuet-2027 mid-page both dock keys are on top (147x48,
  196x48) and read "Log in | Sign up free", the dock is hidden at the footer and the last footer link is reachable, tapping
  "Log in" lands on /login, whose switch line reads "Sign up free"; at 1024 and 1440 the bar's "Sign up free" (120x47) is on
  top, inside the gutter, and a mouse click lands on /signup.
- Bar fit (`navfit.mjs`): at 900-1119 nothing passes the gutter but the menu button's intended 6 px; at 1120-1440 the last
  item ends exactly at the gutter; the links never overflow their row.
- Tests: the 40 suites that read these files plus the new file, 514 pass, 0 fail; `npm run test:app` 1009 pass;
  test:subjects 62, test:du 42, test:dock 55, test:auth 141, all pass. ESLint clean on every changed script.
- Not verified: a signed-in visitor (no sign-in by agents): the sheet's "Go to Practice" and the dock's one key are checked in
  source only. Reduced motion was on for the captures; the sheet's keys rise with the menu's existing stagger (n+8) when
  motion is allowed, not filmed. Real phones not used; Chrome's mobile emulation only.
