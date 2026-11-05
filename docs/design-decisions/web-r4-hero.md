# The home hero, round 4: a desktop-filling hero, CUET highlighted, a typed line that always types, the features strip, the re-made phone bar (5-6 Nov 2026)

Round 4 packet H1+H2+H8+H9, branch `web/r4-hero` (from 400d647a8, round 3 live). Owner items LK117, LK119-LK124, LK133 and
LK135 from his 5 Nov ~11:40 pm feedback (verbatim in `docs/brain/OWNER-FEEDBACK-2026-10-31-LEARN.md` on feat/app-and-web).
Spec: `docs/brain/night-1105/SPEC-R4.md` (H1, H2, H8, H9). Research: `tmp-night/r3-research/ALL.md` (preparoo, brandloss
B10, pricingmap P5/P6). This packet owns the hero block of `page.js`, the hero CSS, the typed line, the strip, the ways in,
the phone bar and the nav pill. It does not touch the other sections (the sections packet re-lays them).

## User task

A 16-17-year-old, often new to CBT, lands on mockmob.in on a laptop, a tablet or a phone. In one screen: what the exam is
(CUET 2027, unmistakably), what MockMob does, one obvious way in, the main things it gives them, and what it really costs per
mock. On a laptop the screen is full (the owner: "Everything should be massive ... cover the entire screen ... only very
minor margins on the sides"), with a brand texture where paper would otherwise sit empty, especially in Night.

Real data only: the price hook is worked out from the live offer (`publicOffer()`), the features link to sections that
exist on the page (Compass and Key cards only when drawn), the bubble and note say only what the sample does.
States: guest, signed in (the typed line now types for both), reduced motion (no typing, the mark drawn, the texture still),
no JS (the h1 and the mark as drawn by the server), no Key cards section (five features), no Compass (its link goes to the
DU calculator), one-time offer (the hook says "once ... to 31 July 2027"), monthly offer ("a month").

## What changed

| Item | Before (round 3, live) | Now | Why |
|---|---|---|---|
| H1 container | 75 rem column: 106 px empty margin each side at 1440, 325 px at 1920 | `desktop-scale.css`: from 1100 px, 3.5 vw gutters (40-72 px) and up to 1,680 px of content, for the site bar's row and the hero (`--lp-gutter`, `--lp-max` on `.mm.lp`) | LK117/LK119. Measured: content 50→1390 at 1440, 120→1800 at 1920 |
| H1 hero grid | copy 1fr + desk 520 px; words padded down 48-96 px; h1 max 84 px (74 at 1440) | desk `clamp(440px, 41vw, 720px)`; words start at the top; h1 `min(128px, 11.4cqi)`: 79 px at 1440, 101 px at 1920; "CUET 2027." 114 / 146 px | LK117 "massive". The widest typed phrase (8.69 em) still fits its column at every width (test) |
| H1 desk | room 318 px fixed | room `clamp(220px, 100svh - 580px, 400px)`: the sample's four options sit in the first screen at 1280x800, 1440x900 and 1920x1080 (measured); sample stem 26 px and 56 px options from 1440 | fill the screen without pushing the card's options off it |
| H1 texture | none (decision 12) | `BrandTexture` (`brand-texture.css`): an answer sheet: numbered questions, four oval bubbles each, one pencil mark a row, hairline colour, never volt, static; Night rings 8 % / marks 9 %, Day 7 % / 7.5 %. Desktop: clear at the words' left edge, full across the desk side; phones: the top right, where the short lines leave paper open; fades over the hero's last fifth | LK117 "texture ... like we had previously ... black mode". Brand-owned, not the old grid/dot/spotlight (brandloss B10). A `section` variant exists for key sections |
| H1 nav | 60 px row, 26 px logo | from 1440: 68 px row, 28 px logo, 16 px links | holds its own over the larger hero |
| H1 tablet | 560 px column at 640-959 (104 px empty each side at 768) | 752 px column, h1 up to 68 px, room 264 px, Mobi 160 px | LK119 tablet |
| H2 CUET | "CUET 2027." in volt (Night) / #526700 (Day), same size as the lines | one step larger (1.3x phones, 1.45x desktop) under a highlighter mark that draws once (520 ms, after the opening). Day: volt band over the letters' lower part, letters #2C3A00 (9.5:1 on the volt). Night: volt letters with a volt stroke under them | LK120 "no highlighting of the CUET stuff". Preparoo leads with its exam name; ours cannot cycle exams, so the name is set as the anchor |
| H2 typed line | skipped for any visitor with a Supabase session cookie | types for every visitor; a fallback start if the opening's hand-off is ever missed | LK120 "sometimes there, sometimes gone": the cause, below |
| H2 fact line | "5,765 questions. Free to start, Pro ₹99 a month." | removed; "Have an account? Log in" is the only line under the keys | LK121 |
| H2 bubble | "Hi, I'm Mobi. Your first question. Go." / "Right. The why is under it." / "Close one. Read the why." / "That's five. Pick your subject next." | "Hi, I'm Mobi. Try this CUET question." / "That's right. The reason is just below." / "Not this time. The reason is just below." / "All five done. Sign up to keep going." | LK122: complete sentences that invite, no "Go.". The questions are original CUET-pattern questions (DemoDrill: "Not authenticated PYQs"), so never "a real CUET paper question" |
| H2 card note | "No sign-up for these five." | "Free, no sign-up. Every answer shows its reason." (`DESK_NOTE`) | LK122: says the value (the reason) as well as the freedom |
| H2 strip | number strip: 5 questions free / 73 DU programmes / 2 exam screens / 60 minutes | features strip: Unlimited mocks (On Pro, every one fresh) / Mistake Lab / Score Recovery / DU Compass / Ask Mobi / Key cards, each a link to its section, with its desk object (Ask Mobi: Mobi's own mark), then the price hook | LK124 "highlight the main features ... or remove" |
| H2 price hook | none | "As low as ₹X a mock on Pro", then the pace and the price ("₹99 a month at 21 full mocks a week."), a link to `#pricing`. `heroPriceHook` = `perMock(offer, max(MOCK_PACES))`, rounded up to the next 10 paise | LK124 "as low as ₹1 per mock". At the owner's slider top (21 a week, H7) the monthly figure is ₹1.10; on this branch alone (slider 2/4/7/14) it reads ₹1.70; the dev server's one-time offer reads ₹0.20 to 31 July 2027 |
| H2 strip layout | 2x2 / 1x4 hairline cells | phones: one feature a row on raised paper (two across broke every name and line in two at 390); tablets two across; desktop in the words' column under the keys, two across, three from 1400 px (three across at 1280 broke every line) | measured in the captures |
| H8 phone bar | ghost "Log in" + volt "Sign up free" squeezed; key faces 4 px high in the bar | ghost "Log in" sized to its word; volt "Start free" takes the row with "No card needed" inside the key; both 52 px, one radius, faces level, the bar's padding takes the keycap edge (measured 11 px above the faces and 11 px below the volt key's edge at 390); the same on every public page (PublicDock) | LK135 "spacing ... UI/UX ... the CTA is a bit weak" |
| H9 nav pill | `#pricing` jump on the home page | `<Link href="/pricing">` | LK133 |

## Why the typed line was "sometimes there, sometimes gone" (LK120)

`HeroTyped.stillOnly()` returned true when `<html data-signed-in>` was set, and the opening's inline gate sets that attribute
whenever a Supabase session cookie (`sb-*-auth-token`) is present. So the same page typed for a guest and sat still for
anyone signed in on that browser: the owner is signed in on some browsers and not on others. Measured in real Chrome at
390x844 (round 4 captures): with a fake `sb-abcdefgh-auth-token` cookie the slot read "Know what to fix." in all 24 samples
over 12 s; without it, it typed "Fresh every time." → "Every mark traced." → "Know what to fix.". After the fix, the
signed-in run shows 8 distinct texts and rests on "Know what to fix.". Reduced motion still never types (WCAG 2.3.3; the
owner's standards); that is the only case left without the pass. A fallback (`TYPING.openingFallback`, 2.4 s) starts the
pass if the opening's hand-off event is ever missed.

## Alternatives judged

- **The mark in Night.** A volt band at 24 % behind volt letters (built first) read as a muddy selection in the 390 capture;
  a solid volt slab with dark letters would compete with the volt "Sign up free" key right under it (one volt key per
  screen, W-075). The underline stroke keeps the letters volt and the key the one volt block. Day keeps the band: ink on a
  highlighter is what a highlighter does on paper.
- **Headline size.** 7-8 vw at 1440 (101-115 px) for every line cannot coexist with a large desk: "Know what to fix." is
  8.69 em. Setting the exam name a step larger (114 px at 1440, 146 px at 1920) gives the Preparoo scale where it matters
  and keeps the desk large; the two lines under it fill their column (79 / 101 px).
- **Where the strip sits on desktop.** Under the hero (as round 3) it fell below the fold at 1440x900; in the words' column
  it fills the bottom-left that was empty paper, and the first screen shows headline, keys, features, the hook and the desk.
- **Site-wide container.** Applied to the bar and the hero only. Widening every `.mm-wrap` would put content under the
  guide Mobi's desktop lane (brand-pip.css) and re-lay sections this packet does not own. The sections packet should adopt
  `--lp-gutter` / `--lp-max` (plus the lane where the guide flies) so the page keeps one left edge; until then the hero and
  bar sit 56 px further out than the sections at 1440.
- **The dock's words.** "Start free" with "No card needed" (both true: sign-up is free and asks for no card; the close
  band already says "Free to start. No card needed.") reads as the stronger, lower-risk ask; the hero and close band keep
  "Sign up free" (LK83/LK88). Both go to `/signup`.

Evidence: T003 (value before the account wall: the sample stays first-class on the desk), T006 and T008 (the hook names
its pace and its price; monthly and one-time never share a sentence; "As low as" with the condition shown, rounded up),
T009 (no invented discounts or urgency), S014 (nothing important hidden to look minimal: the features are links, not a
carousel), S016 (focus rings on every strip link and the hook, 44 px targets, the nav pill a real link), S010 (one 16/24
rhythm inside the hero).

## Anti-slop check (section 10) and rubric

No floating layer over content (the texture is z-index -1 and pointer-events none; the hero key, the pill and the dock's
key are the elements under their own centres, hit-tested); no decorative gradients (the texture's masks are invisible
alpha ramps, never a colour wash); no identical card grid (one list of links on one sheet; desk objects, not generic
icons); no glow, glass on content, or neon; no hype or exclamation marks; no ALL-CAPS kickers; no fake truth (every figure
is computed; the hook shows its maths); motion only once on load (the mark, 520 ms; the typed line), reduced motion =
none. Rubric (0/1/2, self-scored; the owner signs off): product fit 2, action clarity 2, data truth 2, continuity 2,
agency 2, visual craft 2, feedback 1 (the strip's links are plain jumps, no arrival cue), emotional fit 2, accessibility 2,
performance 2 (one static SVG pattern, no image), return value 1.

## Pinned tests moved to the owner's new decisions

- `homeHero.test.mjs`: decision 12 ("no ambient pattern") → LK117 texture; the fact line and number strip → LK121/LK124;
  desktop h1 84 → 128 px cap and the container (LK117); the strip, the mark and the hero strings with their sources (new).
- `heroTaps.test.mjs`: the bubble lines (LK122), the features and the hook (LK124, new), the fact line's page use (LK121).
- `heroLines.test.mjs`: the signed-in skip removed (LK120) and a new test that it types for everyone, with the fallback.
- `heroScene.test.mjs`: the desktop room and desk width (LK117), the card note (LK122), the mark's forced-colours rule.
- `landingWayIn.test.mjs`, `landing_checklist_1104.test.mjs` (L-008, L-009, L-015, L-041), `public_pages_1105.test.mjs`:
  the dock's "Start free" with its line (LK135); L-041's bank line moves to the features strip (LK121/LK124).
- `bottomBar.test.mjs`: the pill opens /pricing (LK133). `release9_public_1018.test.mjs`: the hero's money is the hook.
- `oneGestureBench.mjs`: the pill is no longer an in-page jump, so the jump bench stops measuring it.

## Verified

Real Chrome 151 headless under the shared lock, dev server (webpack) on :3591. Captures in `tmp/r4/` (v1-v7, before-*):
360x640, 390x844, 768x1024, 1280x800, 1366x768, 1440x900, 1920x1080, Night and Day, plus the phone dock and a public
page's dock. `HOME_HERO_URL=http://localhost:3591 node --test src/components/landing/homeHero.test.mjs` passed its
running-page test (390x844, 375x667, 360x640, 412x915, 1440x900: h1 in the first 12 %, lead two lines, no fact line, the
headline and every typed phrase inside the column, the fourth option inside the first screen at 1440x900, six taps on Mobi
leave the bubble as it was).
Real-pointer checks (`tmp/r4/interact.mjs`, results `tmp/r4/interact.json`): signed-in visitor types; reduced motion =
resting line and the mark drawn without animation; the hero key is under its own centre; the pill is 44 px and a tap opens
/pricing; the dock shows Log in + Start free / No card needed (faces level, Start free wider) and a tap opens /signup; a
public page's dock has the same keys; on desktop a click on "Mistake Lab" lands on the Lab and a click on the hook lands on
#pricing. No sideways scroll at any size. Tests: the landing suites, test:dock, test:app pass (one test:app run hit the
full disk and failed four unrelated tests; the rerun passed 1020/1020); test:egress has one failure that is pre-existing on
the base (`inventory_fingerprint.test.mjs` pins a hash of data files this packet never touched). ESLint clean.

Not verified: a real phone, the production build (`next build`), the live offer in production (monthly: the hook reads ₹1.70
on this branch and ₹1.10 once H7's slider lands).

## Left for others

- Sections packet: adopt `--lp-gutter` / `--lp-max` for one left edge; `<BrandTexture variant="section" />` behind key
  sections (the parent needs `position: relative; isolation: isolate`).
- H3 (demo packet) owns DemoDrill and its "Not your subject?" control; this packet changed only the props it is given (the
  note) and Mobi's bubble lines.
- H7 (pricing packet): `heroPriceHook` reads `MOCK_PACES` from `src/lib/payments/value.mjs`; keep that export (or update
  heroTaps.mjs with it) so the hook follows the slider's top value.
