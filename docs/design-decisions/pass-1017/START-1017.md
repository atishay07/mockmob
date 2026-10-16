# START-1017: the website's Start sheet and Practice setup, with app parity for the rules

Owner ledger items: F4, F5, F6, F7, F8, F9, F10, F12 (`docs/brain/OWNER-FEEDBACK-2026-10-17.md`). Written 17 Oct 2026. This is a design decision with static mocks; nothing here is built or deployed. Mocks and captures: `tmp/design-1017/start/` (captures in `tmp/design-1017/start/captures/`).

## 0. The decision in short

1. **Every way to start is a button, and looks it.** In the Start sheet, every session (Full mock, NTA mode, Quick practice, Choose your own) gets a go disc, a press sink, a hover and a focus ring, and the exam pair gets real objects: the app's lamp-lit stopwatch for Full mock and the exam-screen panel for NTA mode (F4, F5). On Practice, the four modes become four pressable tiles with a radio ring that fills to a tick, instead of a radio list that reads like a table (F5).
2. **The subject leads, bigger, and the rest stand back harder.** Subject objects grow: rail chips go from 48 to 64 px, the shelf on Practice goes to 88 px on phones and 116 px on desktop. Unselected subjects get a real blur (2 px), 50% opacity, desaturation and a 0.9 scale (F6, F7).
3. **What follows the subject says the subject.** One rule on both platforms: *everything under the subject rail follows it, and nothing above it does.* A move that follows the subject (plain practice) sits under the rail and its title names the subject ("10 Accountancy questions"). A move that does not follow it ("Finish your recall session", a repair) sits above the rail (F6).
4. **Fine-tune is always open, sits above Start, and is scoped by mode** (F8, F9):
   - Quick practice: chapters and difficulty.
   - Full mock: difficulty only.
   - Smart practice and NTA mode: no controls, one line saying we choose for you.
   - Chapters are grouped by unit, with search: inline on desktop, a sheet on phones.
5. **F12 is a bug in the dock's rule.** The fix is structural:
   - The phone session bar becomes CSS-sticky inside the setup column, so it can never come back after you pass it.
   - The bar's Start key changes its look only when the route changes, never on scroll.
6. **F10 is two boxes by construction.** The option draws its own outline and a separate "glide" layer slides under it on an overshooting spring. The fix is one box: the selection is drawn on the option itself, inking from its letter the way the app does. The glide layer goes.

Every capture listed in section 13 was opened and checked. Section 11 holds the anti-slop test and the rubric. Section 12 lists the points the owner must confirm.

---

## 1. The problem in the owner's words

- **F4:** "It feels somewhat like this full mock in the start menu is better incorporated in the mobile app than on the website."
- **F5:** "the quick practice is theoretically working, but it's not giving the feel of a button that does something. I don't know why these feel like cards depicting information rather than buttons that I click and an action happens. On the top, subject selection is clearly being figured out as a button."
- **F6:** "Maybe the logos can be made a bit bigger, like in the top card of 'Finish your recall session'. There also, when the subject is changing actively in the card, the subject name can be changed or something like that."
- **F7:** "when we are selecting one subject, the others get blurred. That is good ... just increase the blur of the other subjects a bit more so that the current section is a bit more clear. Also increase the size of the logos".
- **F8:** "Maybe this fine-tune option should be given above the start quick practice so that everyone can see and customize it properly. I think this is something that people will skip through, and the UI of this fine-tune thing can be improved. Chapters are cluttered, and it's difficult to find exactly what we are looking for."
- **F9:** "The fine-tune mode should be disabled automatically in the NTA mode or in the full mock mode because full mock mode can have the difficulty slider but not the chapter option. Even in the smart mode I think we should not give that because we are weighing all this ourselves ... The entire fine-tune should be in the quick practice only."
  - Reading of F9: chapters belong to Quick practice only. Difficulty stays on Full mock, as he allowed.
- **F10:** "When I move to an option, there are two boxes: one box is confirming my selection, and there's another box which is coming out of it as an animation."
- **F12:** "when I am scrolling down, the start button gets white and then a pop-up comes up for practice (15 questions, 15 minutes included). As I scroll down it disappears and then as I scroll down it again appears. What state is it really following?"

Standing rules that apply here:
- Never simplify by cutting; move or fold instead (memory `web-restructure-rejected`, F16).
- At most one Mobi per screen, at a real moment.
- One volt primary action per viewport.
- Night and Day parity.
- Real numbers only.
- Advertise unlimited mocks quietly and truthfully (memory `usp-unlimited-mocks`).

## 2. What exists now

The live site is `wt-batch4b` (main, bc099c53). The motion/UX pass `wt-webux2` (9abc71e5) is about to ship and touches the same files. The app is `wt-owner/flutter_app` (v12, f5d848bf).

### Web: Start sheet

The Start sheet is the owner's "start menu".
- `src/components/start/StartSheet.jsx`: the dialog and its order.
  - Order: head (Mobi, "Start a session", balance), subject rail, hero (the plan's move), "Or start something else", rows, note.
  - Rows: Quick practice (dropped when the hero is already 10 questions), Full mock and NTA mode as a pair, Choose your own.
  - The rows are `<Link>`s with a hover background and nothing else: no go mark, no press sink, no named action. Full mock and NTA mode draw a flat 64 px framed glyph.
- `src/components/start/startModel.mjs`:
  - `heroFromPlan()` (lines 233-269) gives the hero the plan's title. A practice link without a subject takes the chosen subject, so the hero's object follows the chip while its title ("Start 10 practice questions") does not. This is F6's "the subject name can be changed".
  - `startRows()` is at lines 279-302.
- `src/components/start/start.css`:
  - Chips (lines 326-365) have a 48 px object stage. Unselected chips are not blurred.
  - The hero (lines 368-430) draws its object at 132 px, zoomed to 96 px on phones.
  - The pair tiles are at lines 446-465.
  - Lines 93-99 make the bar's Start key quiet whenever `.pr-dock[data-shown]` exists. This is half of F12.
- `wt-webux2` changes `start.css`. It extends the quiet key to Today, a result, and any page with `#app-main[data-primary-shown]`, with a 200 ms colour change. That pass would spread F12's flip to more pages, so its rule must change (section 5).

### Web: Practice setup

The Practice setup is `/dashboard`, in `src/app/(app)/dashboard/DashboardPageClient.jsx`.
- **Subject shelf** (lines 423-450):
  - Objects are `clamp(64px, 18vw, 116px)` (`practice.css` line 27). Unselected objects sit at opacity 0.72 with no blur. This is what the owner calls "blurred" (`practice.css` lines 61-73).
  - Five subjects wrap 3 + 2 on phones.
- **Mode list** (lines 452-482): one bordered list of radio rows (`practice.css` lines 109-140). It reads as a table of facts. This is F5.
- **Fine-tune** (lines 517-543):
  - A `SmoothDetails`, collapsed by default ("Optional: balanced mix, all chapters"). It sits under Questions in the left column.
  - On desktop the session card and its Start are in the right column at the top of the page, so fine-tune sits visually after Start. This is F8.
  - Chapters are a wall of chips in one scrolling set, filtered by a substring search, with no units. `/api/chapters` already returns units when the database has them (Accountancy), and `data/subjects.js` has canonical units for every subject.
  - Difficulty shows for any mode with `allowDifficultyOverride` (Quick, Full).
  - Chapters show for every mode (`chapters.length > 0`). `launchHref` (lines 298-306) sends `chapters` for every mode, Full mock, Smart and NTA included. This is F9.
- **Phone dock** (lines 240-258 and 577-597; `practice.css` lines 195-321). This is F12; see section 5.
- **Mobi:** `ArenaCompanion` (line 599) always shows Mobi with "Set up Quick practice. Check the subject, time and access before you start.", which is a filler line.
- **The fresh-paper (unlimited mocks) line** (line 485) is removed in `wt-webux2`. Section 12 lists this conflict.

### Server

`src/lib/server/practiceSessions.js`:
- Line 33 accepts `chapters` for every mode, up to 12.
- Lines 37-39 accept difficulty only where `allowDifficultyOverride` holds, and only for Pro.

`data/test_modes.js`:
- Quick and Full: difficulty override allowed, mix 40% easy, 40% medium, 20% hard.
- Smart: `useWeakTopics`, with `weakAccuracyThreshold` 0.6 on topics (`data/practice_pick.js` lines 119-120).
- NTA: fixed mix 30/45/25.

### Runner (F10)

- `src/app/(app)/test/TestPageClient.jsx` lines 784-802 (`placeGlides`) and line 1085 (the `.pr-glide` span).
- `src/app/(app)/test/practice-run.css` lines 34-50.
- Section 6 has the cause.

### App

- **Start sheet:** `lib/core/router/quick_start.dart` (`QuickStartSheet`, `_StartRows`, from about line 420).
  - The hero is the move, else Quick 10. Then come the subject chips (label only, no objects), then Quick 10, the Full mock and NTA pair, Repair, and "Choose your own in Practice".
  - When Quick 10 is the hero it sits above the chips that change it. That breaks the rule in decision 3.
- **The deck:** `lib/features/practice/widgets/choice_deck.dart`.
  - `LeadChoice` (line 463): a 104 dp lit object and a volt `_GoDisc` (line 575).
  - `TileChoice` (line 611): a 72 dp object, title, and note.
  - `_ChoicePress`: spring sink, the glyph plays on finger-down, a light haptic.
  - This is why F4 says the app is better: the stopwatch is a real lamp-lit object (`assets/art/hybrid-stopwatch.webp`), the tiles have weight, and the hero has a go disc.
- **Practice composer:** `lib/features/practice/widgets/practice_composer.dart` lines 304-391.
  - Chapters only in `PracticeMode.chapter`, which is Quick practice under the hood (`apiMode` 'quick', `practice_selection.dart` line 21).
  - Difficulty for quick, chapter and full (line 34).
  - Smart and NTA have no line saying we choose.
  - `chapter_picker.dart` already groups by unit with search, up to `maxChapters` = 12.

## 3. Decisions, with reasons and evidence

**D1. Start-sheet rows are buttons: a go disc, press, hover and focus, and a clear outcome.**
- What changes:
  - Each session gets a 40 px go disc at its trailing edge. A play mark means the row starts a session; a chevron means it opens Practice.
  - Press sinks the whole row or tile to 0.97. Hover (fine pointer only) raises the surface and nudges the disc 2 px. Focus draws a 2 px ring.
  - The pair tiles get real objects: the app's stopwatch render with its hand drawn at the render's pivot, and the NTA exam panel.
- Why: F5 says rows read as information. Buttons need a visible affordance, and F4 says the app's tiles carry weight that the web's framed glyphs do not.
- One volt per viewport: the discs are outlined. Only the hero's button is volt (AGENT_RULES 7).
- Evidence: AGENT_RULES 30 (variants, press, focus); S016 (consistent identification: every session pressable the same way); T009 and AGENT_RULES 27 (a real product picture over a decorative glyph).

**D2. The subject rail's objects grow, and unselected ones stand back with a real blur.**
- Chips are 56 px tall. The object is 64 px, leaning 14 px over the chip's top edge.
- Unselected objects: `filter: blur(1.6px) saturate(0.55)`, opacity 0.55, scale 0.9.
- On Practice, the same rule with stronger values: blur 2 px, saturate 0.5, opacity 0.5, scale 0.9. Objects are 88 px on phones and 116 px on desktop.
- Why: F6 and F7. The blur sits on 5 small images, never on content or text, so it is not "glass blur on content" (slop list item 9). The name stays sharp, so legibility holds.

**D3. One rule for what follows the subject (web and app).**
- Everything under the subject rail follows it; nothing above it does.
- A hero that follows the chosen subject (the plan's move is plain practice and its link names no subject) sits under the rail. Its title names the subject ("10 Accountancy questions") and changes with it.
- A hero bound to something else ("Finish your recall session", a repair in Ledgers, a resume) sits above the rail and never changes when a chip is pressed. The rows under the rail are then titled "Or start in Economics".
- Why: F6 asks for the name in the card. The owner's earlier Practice note (APP-OWNER-LEDGER L08, his proposal) says no mode may appear above the control that chooses its subject. This rule satisfies both and removes the case where a card changes its picture but not its words.
- Evidence: AGENT_RULES 11 (selected state and consistency); S016.

**D4. Practice modes become four pressable tiles with a radio ring.**
- Layout: a 2 x 2 grid at every width.
- Each tile has:
  - its object (the subject's object for Quick practice, the stopwatch for Full mock, a drawn chapter-weights glyph for Smart practice, the NTA panel for NTA mode);
  - the name, a one-line spec, and the price or "Needs Pro";
  - a ring in the corner that fills with the select colour and a tick when chosen.
- The chosen tile takes a 2 px select ring and a faint lamp wash.
- Semantics: `role="radiogroup"` with `role="radio"` and `aria-checked`, and arrow keys.
- Why: F5. Tiles with a radio ring read as "choose one of these", and the press feedback makes the choice feel done. NTA's exam-screen picture stays in its tile at every width; nothing is cut.
- Evidence: AGENT_RULES 33 (cards group meaningful items: each tile is a mode with its own price) and 30.

**D5. Fine-tune is always open, sits directly under Questions and above the session, and is scoped by mode.**
- The collapsed `<details>` goes. The block is open, with a scope sentence at its top. The scope rules are in section 4.3.
- Desktop: the session card on the right also lists Chapters and Difficulty as links above its Start, so the settings sit visibly above Start on every layout.
- Why:
  - F8: people skip a collapsed control.
  - S014: progressive disclosure is for secondary functions. Chapters and level are what a student practising one chapter needs most, so they are not hidden.
  - T001 and AGENT_RULES 13: the defaults ("All 16 chapters", "Balanced") are shown as editable values, never as empty fields.
- Evidence: AGENT_RULES 24. The Smart line must match real logic: `weakAccuracyThreshold` 0.6 on topics, so the copy says "topics where you get under 60% right", not "chapters".

**D6. Chapters are grouped by unit, with search, as a picker.**
- Desktop: the picker opens inline in the Chapters row.
- Phones: a bottom sheet with search pinned at the top and "Use N chapters" in its footer.
- Units come from `/api/chapters` (`grouped`) or, failing that, `data/subjects.js` canonical units. Every subject has units there: Accountancy 16 chapters in 6 units, Economics 18 in 3, English 7 in 2, General Test 9 in 6. Business Studies has 13 units of 1 chapter each, so it renders flat (no unit headers when every unit holds one chapter).
- Search matches chapter and unit names, ignoring case, punctuation, and "&" against "and".
- Limit: 12 chapters, matching the server's slice and the app's `maxChapters`.
- Why: F8 says chapters are cluttered and hard to find. Grouping by the syllabus's own units is how students already think of the book.

**D7. F12: the session bar is CSS-sticky inside the setup, and the bar key's look is route-stable.** Cause and rule are in section 5.
- Evidence: S016 (a navigation control must not change identity while you scroll); AGENT_RULES 32 (a sticky CTA must not conceal content).

**D8. F10: one box.** Cause in section 6.
- Evidence:
  - AGENT_RULES 31: motion must explain a state change. A travelling second box explains nothing; the answer did not move.
  - Emil's frequency rule: an action seen 50 times per paper gets the least motion that confirms it.

**D9. Mobi on Practice moves to the moment it is true.**
- The always-on `ArenaCompanion` block ("Set up Quick practice. Check the subject, time and access...") leaves its place.
- Mobi appears:
  - in the Fine-tune block for Smart practice and NTA mode, beside "We choose for you";
  - in the session card on a launch error ('oops').
- Never both: the error wins.
- Its NTA line ("Mobi stays outside while you answer") moves into the NTA panel that opens under the tiles. Nothing is lost.
- Why: Mobi at most once per screen, at a real moment (owner, 16 Oct).

**D10. The unlimited-mocks line stays, in the session card.**
- The copy: "Built fresh from the Accountancy bank, questions you have not answered first. No cap on how many you take." The Full mock spec keeps "a new paper every time" (`paperCopy.mjs` MODE_SPECS).
- `wt-webux2` removed the line under the mode list; this decision moves it, it does not drop it.
- Why: memory `usp-unlimited-mocks` says say it everywhere, quietly and truthfully.

## 4. The spec

### 4.1 The Start sheet

The sheet keeps:
- its container: a native modal `<dialog>`, a bottom sheet under 1024 px and a panel from the sidebar key at 1024 px and wider;
- its open and close motion: the 420 ms rise on spring 0.8 on phones, the 360 ms grow from the key on desktop;
- swipe to close, the focus trap and Escape.

**Layout, top to bottom. Subject-bound move** (captures `start-390-*`, `start-1440-*`):

1. **Head:**
   - Mobi (the one Mobi of the sheet, pointing at the hero once it lands; existing behaviour).
   - The title, following the clock as the app's does (`QuickStartSheet.titleFor`): "Pick tonight's work" from 4 PM, "Pick today's work" before. Bricolage 750, 24 px.
   - The balance: "You have 40 practice credits", or "Pro: sessions included".
   - Close: a 44 px circle.
2. **Subject:** a 13 px ink-3 label, then the rail.
   - Chips are 56 px tall, padding 0 18 px 0 76 px.
   - Each chip's object stands on a 64 px stage at left 6 px, bottom 6 px, so it leans out over the chip's top edge.
   - The chosen chip: select ring, volt wash, ink 750 text, the object at scale 1.08 lifted 2 px with its lamp.
   - Others: ink-3 text, the object blurred, desaturated, at 0.55 opacity and scale 0.9.
   - The rail centres the chosen chip when the sheet opens and when the choice changes (`useSubjectRail`, existing).
3. **Hero (the move):** a 22 px radius card with the volt line and a lamp pool behind the object.
   - Grid:
     - the title across the full width (Bricolage 750, 26 px; 28 px on desktop);
     - under it, two columns: the reason and the go row on the left, the object on the right (112 px on phones, 132 px on desktop), sitting on the card's floor.
   - Copy:
     - title: "10 Accountancy questions";
     - reason: "Tonight's move: about 10 minutes, then see why each miss happened.";
     - button (volt, 48 px): "Set it up";
     - cost: "Uses 10 of your 40 practice credits."
4. **"Or start something else"** (label).
5. **Exam pair:** two tiles of equal height (min 196 px), a sunken fill, a 1 px line and an edge light. Each tile has its object at the top, then its name and note, then a foot with the cost on the left and the go disc on the right.
   - Full mock:
     - object: the stopwatch render, 66 x 84 px, with its hand drawn at pivot (0.471, 0.605) as in the app's `HybridSpec.stopwatch`;
     - note: "50 Accountancy questions, 60 minutes, a new paper every time";
     - cost: "50 credits. You have 40." in warn ink when short.
   - NTA mode:
     - object: the exam panel, 76 x 64 px;
     - a "Pro" tag (outlined, volt line) at the top right when locked;
     - note: "The exam-day screen in Accountancy, 50 questions in 60 minutes";
     - cost: a lock and "Needs Pro".
6. **Quick practice row:** shown when the hero is not already this set.
   - The subject's object at 60 px with a "10" count badge.
   - Text: "Quick practice", "10 Accountancy questions, about 10 minutes", "10 credits".
   - A go disc.
7. **Choose your own:** the fan of three objects; "Choose your own"; "Any subject, chapters, mode and length"; a chevron disc.
8. **Note:** "Nothing is spent here. Practice shows the cost again before you start."

**Fixed move** (capture `start-fixed-hero-390-night`): the hero moves above the rail ("Finish your recall session", reason "Tonight's move: 7 cards left from this afternoon. Recall is free and uses no credits.", button "Resume"). The label under the rail becomes "Or start in Economics" and the Quick practice row comes back.

**States:**
- Loading plan: the hero skeleton (existing `st-hero--loading`) in the hero's place for the plan's kind. While the kind is unknown, under the rail.
- Plan failed: the existing `st-miss` row with Try again; the sessions still work.
- One subject: no rail; the hero object shows its name as the caption (existing).
- No practice subject: one row, "Pick your subjects first", with Edit subjects.
- Balance unknown: costs show the mode's price without "You have".
- Pro: costs say "Included"; the Pro tag goes.
- Return (sheet reopened): it opens on the subject last chosen in this tab.

**Motion** (tokens from `motion-kit.css`):

| Moment | What moves | Duration and curve | Reduced motion |
|---|---|---|---|
| Press a row, tile or chip | scale 0.97; the disc scales 0.92 | in 100 ms `--mm-ease-out`, out 140 ms `--mm-press-lift` | colour only (`--a-hover`), no scale |
| Hover (fine pointer) | surface to hover tone; disc border to ink-3 and translateX 2 px; tile object translateY -2 px | 160 ms ease (colour), 200 ms `--mm-ease-out` (transform) | colour only |
| Choose a subject | the old object: blur 0 to 1.6 px, opacity 1 to 0.55, scale 1 to 0.9; the new one the reverse, lamp in | old 200 ms `--mm-ease-exit`; new on `--mm-spring-settle` (809 ms; 420 ms ease-out where springs are off); lamp 420 ms `--mm-ease-emphasized` | 120 ms opacity and filter fade, no scale |
| Subject words in the hero and rows ("10 Economics questions") | out: opacity 0, blur 2 px, translateY -4 px; in: from blur 2 px, translateY 4 px | out 120 ms, in 200 ms `--mm-ease-out` | 120 ms cross-fade |
| Hero object swap | the existing `st-obj-in` | 460 ms spring | none |
| Follow a row | the sheet steps aside (existing `requestClose`) while Practice loads | 240 ms | 120 ms fade |

### 4.2 The Practice setup page

Order, top to bottom. Nothing removed (see section 7).

1. **Head:** "What are we practising?" (or with the first name), the lede "Pick a subject and a mode. Timed, marked +5 / −1, saved to your record.", and the credits line, all unchanged.
   - The numbered step badges ("1 Subject") become plain headings. Slop list item 12 bans numbered section badges, and the headings already read in order.
2. **Subject:** "Edit subjects" link on the right.
   - Phones: one horizontal rail, 104 px per item, 88 px objects, a fade at the trailing edge, the chosen item centred.
   - Desktop: all subjects in one row, 116 px objects.
   - Under each name: "16 chapters" (real, from the unit data). It replaces the bank count, which is often "Checking..." and is not needed to choose.
   - The chosen item has its lamp on and the existing 40 x 3 px select rule under it.
3. **Mode:** hint "Every mode uses the same checked questions."
   - The 2 x 2 tiles from D4.
   - Phones: min-height 182 px, the object at the top, then name and spec, the price at the foot.
   - Desktop: min-height 132 px, the object on the left (72 px column), the ring at the top right.
   - Specs (from `paperCopy.mjs`, shortened where noted):
     - Quick practice: "5 to 20 questions, 1 minute each".
     - Full mock: "50 questions, 60 minutes, a new paper every time".
     - Smart practice: "Leans on the topics you miss most", replacing "Weights chapters you have missed" to match the topic logic.
     - NTA mode: "50 questions, 60 minutes on the exam screen". The long NTA sentence moves into the NTA panel under the tiles, which opens when NTA is chosen (existing `pr-nta__after`, with the exam-screen choice).
4. **Questions:**
   - Quick: segmented 5, 10, 15, 20.
   - Smart: 10, 15, 20.
   - Hint: "About N minutes".
   - Full and NTA: "50 questions" and "60 minutes, one sitting, exam timing", hint "Fixed for this mode".
5. **Fine-tune:** see section 4.3.
6. **The session:**
   - Desktop: a sticky card on the right, top 84 px.
   - Phones: the card after Fine-tune, with the session bar as its footer.
   - Card contents:
     - the subject's lit object (76 px);
     - the mode name (22 px) and "10 Accountancy questions";
     - rows: Time, Marking, Chapters (a link to Fine-tune), Difficulty (a link), Cost (accent ink; ink-3 when locked), "Your practice credits";
     - the fresh-paper line (D10);
     - Start, or the honest blocked action: "Need 10 more practice credits" or "See Pro";
     - the reason line: "10 credits are charged only after a complete set is built."
7. **Below, unchanged:** the stats, Recent sessions, MockMob Pro, "Add a question" / "Feed the bank" and My submissions.

**States:**
- **Loading:** skeleton shapes that match the new layout: 5 object discs, 4 tiles, a segmented bar, the fine-tune block, the session card. Each holds its own place, so nothing jumps when data lands.
- **Error:** the existing `ErrorState` ("Practice did not load ... Nothing was charged.").
- **Empty:** the existing `EmptyState` (pick subjects first).
- **Stale subjects:** the existing warning.
- **Quote states (existing):**
  - "Checking..." disables Start with the same width.
  - On error: "Could not check this session. Nothing was charged. Check again".
  - Blocked: the button becomes "Need N more practice credits" or "See Pro".
- **Launching:** Start shows "Starting..."; Mobi thinks in the card only if the start takes longer than 600 ms.
- **Sparse (no record):** Smart's line adds "With no answers yet, it starts from the standard mix." This is true: `practice_pick.js` passes no weak topics when the student has none.
- **Chapters failed to load:** "Chapters could not load. This set uses all chapters." with "Try again". Start still works.
- **Changing subject with chapters chosen:** the Chapters row says "Chapters reset to all 18 for Economics." until the next change. It is a line, not a toast.
- **Return from a link with a mode that does not allow chapters** (for example `mode=full&chapter=...`): the chapters are dropped and the row says "A Full mock covers every chapter, so the chapter from your link was not used."

**Motion:**

| Moment | What moves | Duration and curve | Reduced motion |
|---|---|---|---|
| Press a subject or a tile | scale 0.97 (the object also plays the existing `answerPick` tap keyframes) | 100 ms in, 140 ms `--mm-press-lift` out | colour only |
| Choose a subject | as in 4.1 (blur 2 px, opacity 0.5, scale 0.9 for the rest) | old 200 ms `--mm-ease-exit`, new `--mm-spring-settle` | 120 ms fade |
| Choose a mode | the ring fills with the select colour and the tick pops (scale 0.6 to 1); the tile's 2 px ring draws; the lamp wash fades in; the previous tile clears | fill 200 ms `--mm-ease-out`; tick on `--mm-spring-icon-pop`; previous 120 ms | colour change only, 120 ms |
| Fine-tune scope change | body height glides (grid-template-rows 0fr to 1fr, the existing `SmoothDetails` mechanics); contents cross-fade | 300 ms `--mm-ease-glide`; cross-fade 200 ms | instant height, 120 ms fade |
| Session card and bar update | values cross-fade (2 px blur bridge); the object swaps with `pr-dock-obj-in` (existing) | 200 ms; object on the settle spring | 120 ms fade |
| Desktop tile hover | translateY -1 px, line to strong | 160 ms ease | colour only |

### 4.3 The fine-tune scope rule (web and app, one table)

| Mode | Chapters | Difficulty | What the block says |
|---|---|---|---|
| Quick practice | Yes (up to 12) | Yes ("Balanced" for everyone; Easy, Medium and Hard need Pro, as the server enforces) | "For Quick practice you can pick the chapters and the difficulty." Under Difficulty: "Balanced is 40% easy, 40% medium, 20% hard" and, when not Pro, "A set level comes with Pro." |
| Full mock | No | Yes (same Pro rule) | "For a Full mock you can set the difficulty. It covers every chapter, like the exam." |
| Smart practice | No | No | With Mobi (think, 40 px): "We choose for you: Smart practice leans on the topics where you get under 60% right, so there is nothing to set." |
| NTA mode | No | No | With Mobi: "We choose for you: 50 questions across the syllabus in the exam's mix, so there is nothing to set." |

**Rules for the build:**
- The client never sends `chapters` for any mode but Quick. It never sends `difficulty` where the mode does not allow it.
- Changing the mode away from Quick keeps the chapter choice in memory. Coming back to Quick in the same visit restores it, and the row says "Your 3 chapters are back." The choice is folded away, not deleted.
- **Server:**
  - Add `allowChapters: true` to `TEST_MODES.quick` only.
  - In `practiceSessions.js`, drop chapters for other modes, and record a warning in the session meta.
  - Once every link builder has been audited (section 9, W3), throw `CHAPTERS_NOT_ALLOWED`.
  - The quote route applies the same rule, so the price and the paper agree.

### 4.4 The chapter picker

- **Desktop (inline, capture `practice-1440-chapters-*`):**
  - Under the Chapters label, the chosen chapters show as removable chips: volt wash, volt line, an x at 14 px, each a 36 px target with a 44 px hit area.
  - "Choose chapters" (or "Change chapters") opens the panel in place.
  - Panel contents:
    - a search field, "Search 16 chapters";
    - per unit, a header with the unit name, its count, and "Whole unit" or "Clear unit";
    - chapters as check rows in two columns, each 44 px tall, with a 20 px check box that fills with the select colour and an ink tick;
    - a foot: "3 of 16 chapters chosen" and "Done".
  - Esc or Done closes it and returns focus to the button.
- **Phones (sheet, capture `chapters-sheet-390-*`):**
  - The same parts in a bottom sheet (90 vh). The header reads "Accountancy chapters" and "16 chapters in 6 units", with a close disc.
  - Search is pinned under the header. The units scroll.
  - Foot: "Clear" (outlined) and "Use 3 chapters". The foot's button is the only volt while the sheet is up; the page under the scrim is inert.
- **Search:** filters as you type, with no debounce over 50 ms. Units with no match fold away. No match says "No chapter matches “xyz”." with "Clear search".
- **Limit:** at 12, unchosen rows dim and the foot says "12 is the most for one set."
- **Motion:**
  - The tick inks with a stroke draw, 260 ms `--mm-dur-ink`.
  - The sheet rises with the Start sheet's spring (420 ms).
  - The inline panel opens with the 300 ms glide.
  - Reduced motion: instant, with a 120 ms fade.

### 4.5 The session bar and the bar Start key (the F12 fix)

- **Phones (captures `practice-390-top-*`, `practice-390-finetune-*`, `practice-390-rest-*`):**
  - The bar is a `position: sticky; bottom: calc(82px + env(safe-area-inset-bottom))` element. It is the last child of the setup column (`.pr-steps`), directly after the session card.
  - While the setup is on screen it rides above the tab bar. When the end of the setup comes into view it lands as the session card's footer. When the page scrolls past, it leaves with the setup. It can never reappear lower down, because a sticky element cannot leave its container.
  - No IntersectionObserver, no scroll listener, no 360 px threshold.
  - Bar contents: the subject's object (52 px, lit), the mode name, "10 Q, 10 min, 10 credits", and the Start button (or "Need 10 more" or "See Pro", outlined).
  - Floating: radius 20, strong line, shadow.
  - Landed: radius 0 0 22 22 and joined to the card. This uses `@container scroll-state(stuck: bottom)` where supported. Elsewhere a fully rounded bar sits 8 px under the card.
  - The bar shows from the first frame on Practice. That is deliberate: the student sees what they are about to start while they set it up.
- **The bar's Start key (phones) and the sidebar Start key (desktop):** their look depends on the route only.
  - On Practice, where the page owns the volt Start, the key is outlined with an ink play mark for the whole visit. It still opens the Start sheet.
  - On every other page it is volt.
  - It never changes while scrolling.
  - Replace the `:has(.pr-dock[data-shown])` selector in `start.css` with `#app-main[data-start-quiet]`, set on mount by pages that own a volt action.
  - In `wt-webux2`, replace `#app-main[data-primary-shown]` (set while scrolling) with the same route-level attribute. Today and a result can opt in with it; they then keep the key quiet for the whole visit.

### 4.6 The runner option (the F10 fix)

- One element per option. The selection lives on the option itself:
  - border: line to `color-mix(volt 72%)`;
  - fill: transparent to `color-mix(volt 9%)`;
  - the letter tile fills with volt and its ink turns dark.
- **The ink:** a `::before` layer inside the option, clipped to it, grows as a circle from the letter's centre: `clip-path: circle(0 at 23px 50%)` to `circle(150% at 23px 50%)`, 260 ms `--mm-ease-out`. This is the app's "the bubble inks from the point the finger touched" (`answer_option.dart`), so web and app match.
- **Changing the answer:** the old option clears in 120 ms (opacity of its `::before`, border back to line). The new one inks in 260 ms. Nothing travels between options.
- **Press:** scale 0.985 on the option, its border included, 100 ms in and 140 ms out. There is no layer underneath, so no second outline can show.
- **Letter:** a scale pop 1 to 1.08 to 1 on `--mm-spring-icon-pop`.
- **Reduced motion:** a 120 ms colour fade, no clip, no scale.
- **NTA classic** (`nta-classic.css`) is untouched: it never had the glide.

## 5. F12: the cause, the rule it follows, and the fix

**The rule in the code** (`DashboardPageClient.jsx` lines 240-258):

```js
const sync = () => setDockShown(away && scrolled);
const io = new IntersectionObserver(([entry]) => { away = !entry.isIntersecting; sync(); }, { rootMargin: '0px 0px -150px 0px' });
const onScroll = () => { const next = window.scrollY > 360; ... };
```

**And in `start.css` lines 93-99:**

```css
html:has(.pr-dock[data-shown]) .app-shell .arena-bottomnav > button.stk--bar .stk__disc { background: var(--a-raised); color: var(--a-ink); ... }
```

The dock is shown when the page has scrolled more than 360 px **and** the session card is not inside the viewport minus its bottom 150 px. `isIntersecting` is false both when the card is **below** the viewport (not reached yet) and when it is **above** it (already passed). The rule cannot tell the two apart. While the dock is shown, the bar's Start disc changes from volt to the raised surface with an ink mark. That is a dark disc with a white mark at Night and a white disc at Day: the owner's "the start button gets white".

**What the owner saw, scrolling down on a phone with 15 questions on Pro:**
1. At the top, no dock, and the key is volt.
2. Past 360 px with the card below: the dock rises with "15 Q, 15 min, Included" (his "pop-up ... 15 questions, 15 minutes included") and the key turns white.
3. The card enters the band: the dock hides and the key turns volt again.
4. Scrolling on, the card leaves through the top: `away` is true again, so the dock rises again over Recent sessions and the key turns white again.
5. Scrolling up replays the same steps in reverse.

The intent (the code comment: carry Start "until the card itself comes into view") was right. The observer cannot express "not reached yet", and the key's colour is tied to the same flip. **It is a bug, not intended behaviour.**

**The fix** (D7, section 4.5):
1. Delete the observer, the scroll listener and the `dockShown` state.
2. Make the bar CSS-sticky inside the setup column, so it can only be below the card or attached to it.
3. Make the bar key's look route-level (`data-start-quiet` on mount), never scroll-driven.
4. Change `wt-webux2`'s `data-primary-shown` the same way before it ships. Otherwise the flip spreads to Today and result pages.

**Not run on a dev server.** Free RAM was 1.6 GB at the time and dropped to 0.87 GB, shared with the emulator and other agents, and `/dashboard` needs a signed-in session. The rule above is read directly from the code and is deterministic. Acceptance check AC-9 reproduces it on the built page.

## 6. F10: the cause and the fix

**Cause.** The practice runner draws the chosen answer twice.
1. The option button itself has a 1 px line border and shrinks to `scale(.985)` on `:active` (`practice-run.css` lines 36-42). Its selected style makes the border transparent over 200 ms.
2. A separate `.pr-glide` span sits under the options (`TestPageClient.jsx` line 1085). `placeGlides` (lines 784-802) measures the chosen option and moves the span to it. It has its own volt border and wash, fades in over 180 ms and, once placed, moves with `transform 320ms cubic-bezier(.34, 1.36, .5, 1)` (a 36% overshoot) and `height 320ms`.

**What he sees:**
- On the first pick: during the press, the option's own outline shrinks inside the glide's full-size outline as the glide fades in. That is two boxes, one inside the other.
- On a change of answer: the glide leaves the old option, travels down (or up), overshoots past the new option and settles back, while the old option's own border fades back in. That is "another box which is coming out of it as an animation", moving "top to down".

**Fix** (section 4.6):
- Remove the `.pr-glide` span, the `glideRefs` ref, `placeGlides`, its layout effect and resize listener, and the `.pr-glide` rules.
- Draw the selection on the option with the inside ink, clipped to the option.
- The 18 lines of the ghost's `is-ghost-selected` style stay (the outgoing question still shows its answer).
- Keep the strike (press and hold), the cross-out note and the `pr-in` / `pr-out` question hand-off. They are not part of F10.

## 7. What moves where (nothing is deleted)

| Thing | Now | After |
|---|---|---|
| Start sheet Quick practice row | Dropped when the hero is 10 questions | Same rule. When the hero is fixed (recall, repair) the row returns under the rail |
| Start sheet framed 64 px glyphs (Full mock, NTA) | Row art | Replaced by the stopwatch object and the exam panel, as in the app. The drawn glyphs stay for Choose your own and the hero fallbacks |
| Hero's 96 px phone zoom | `zoom: 0.7273` | 112 px, no zoom |
| Practice step numbers "1, 2, 3" | Badges before headings | Plain headings; the order is unchanged |
| Practice mode radio list | One bordered list | 2 x 2 tiles, same four modes, same prices, same locks |
| NTA long description | In the mode row | In the NTA panel that opens under the tiles when NTA is chosen (with the exam-screen choice and the free preview link) |
| Bank count under each subject | "N questions" or "Checking..." | The count moves into the session card's fresh-paper line once `/api/stats` returns it (the existing `bankPhrase`); the shelf shows "16 chapters" |
| Fine-tune `<details>` | Collapsed | Open block, scoped by mode |
| Chapter chip wall | Flat chips in a scroll set | Unit-grouped picker (inline or sheet); chosen chapters as chips |
| Phone dock (`pr-dock`) | Fixed, IO-driven | The same bar, CSS-sticky, as the session card's footer |
| Bar Start key quieting | Scroll-driven (`:has(.pr-dock[data-shown])`) | Route-driven (`data-start-quiet`) |
| `ArenaCompanion` on Practice | Always-on Mobi with a filler line | Mobi in Fine-tune for Smart and NTA, and in the card on a launch error. The NTA line moves to the NTA panel |
| Fresh-paper line | Under the mode list (removed by `wt-webux2`) | In the session card, every mode |
| Runner `.pr-glide` | A second box that travels | An ink layer inside the option (same purpose: continuity of the choice) |

## 8. App parity (the rules)

- **A-rule 1 (D3):** in `_StartRows`, when Quick 10 is the hero (`quickIsHero`), or when the move is plain practice in the chosen subject, the chips render **above** the hero and the hero's title names the subject. A fixed move stays above the chips (as now).
- **A-rule 2 (F9):** in `practice_composer.dart`:
  - Quick practice shows the same Fine-tune: `ChapterField` and `DifficultyPicker` together, under a "Fine-tune" label with the scope sentence, above the pinned Start.
  - "By chapter" stays as an entry. It opens the same Quick composer with the chapter picker open first. It is Quick practice with chapters asked first, so it is folded, not removed.
  - Full mock keeps the difficulty only and adds "It covers every chapter, like the exam."
  - Smart and NTA add the one "We choose for you" line, the same words as the web, with Mobi only if the composer has no other Mobi.
- **A-rule 3:** the server rule (chapters only for quick) protects both clients.
- **Optional (owner to say):** the app's Start-sheet chips get the subject objects (64 dp) and the same stand-back blur. The app's chips are label-only today; F6 and F7 were said about the website.

## 9. Build packets

### Web (in a fresh worktree from the shipped main after `wt-webux2` lands)

**W1. The Start sheet** (F4-F7, D1-D3)
- Files: `src/components/start/StartSheet.jsx`, `startModel.mjs` (add `hero.followsSubject`; titles name the subject), `start.css`, `StartArt.jsx` (stopwatch object and exam panel as row art), `src/components/start/__tests__/startModel.test.mjs`.
- Asset: copy `wt-owner/flutter_app/assets/art/hybrid-stopwatch.webp` to `src/components/start/art/`.
- Tests:
  - a following hero's title contains the chosen subject's name;
  - a fixed hero renders before the rail;
  - every row has a go mark and an accessible name that says where it goes.

**W2. Practice setup layout** (F5-F8, D4, D5, D9, D10)
- Files: `src/app/(app)/dashboard/DashboardPageClient.jsx`, `practice.css`, `src/app/(app)/arena.css` (only the `.pr-*` rules it owns), `src/lib/paperCopy.mjs` (Smart spec wording).
- Mode tiles use `role="radio"` with arrow-key handling (reuse `SegmentedControl`'s roving logic).

**W3. Fine-tune scope and the chapter picker** (F8, F9, D6)
- Client files:
  - new `src/app/(app)/dashboard/ChapterPicker.jsx` and `chapter-picker.css`;
  - `DashboardPageClient.jsx`: `launchHref` and the quote only send `chapters` for quick; `difficulty` only where `allowDifficultyOverride` holds.
- Data: `data/test_modes.js` gets `allowChapters`.
- Server: `src/lib/server/practiceSessions.js` drops, later rejects, chapters for other modes; the quote route `src/app/api/practice/quote/route.js` follows the same rule.
- Audit first: `grep -rn "chapter" src/lib/arenaNavigation.js src/lib/server/recoverySessions.js src/components/**/Today* src/app/(app)/analytics` for links that combine a chapter with a non-quick mode.
- Tests: `npm run test:recovery` plus a unit test of the scope table.

**W4. F12** (D7)
- Files:
  - `DashboardPageClient.jsx`: remove the dock effect and state; render the bar as the setup column's last child.
  - `practice.css`: the sticky bar and the container scroll-state query.
  - `src/components/start/start.css`: replace the `:has(.pr-dock[data-shown])` rules with `#app-main[data-start-quiet]`.
  - `src/app/(app)/AppLayoutClient.jsx`: accept the attribute from the page, cleared on route change.
  - `arena.css` line 1727: `scroll-padding-bottom` keyed to the bar's presence on Practice.
- Coordinate with the F13 (dock) owner: this packet fixes the scroll rule only. Where Start lives in the phone bar is F13's decision, and the route rule follows it.

**W5. F10** (D8)
- Files: `src/app/(app)/test/TestPageClient.jsx` (remove the glide), `src/app/(app)/test/practice-run.css` (the ink layer).
- Test: a runner fixture that picks A, then C, and asserts exactly one element with the selected style and no element with class `pr-glide`.

### App (in a worktree from `feat/app-and-web`)

**A1. Start sheet rule** (D3)
- Files: `lib/core/router/quick_start.dart` (`_StartRows` order and the hero title).
- Goldens: the quick start sheet at Night and Day.

**A2. Fine-tune scope** (F9)
- Files: `lib/features/practice/widgets/practice_composer.dart`, `lib/features/practice/copy.dart` (the scope sentences and "We choose for you" lines), `lib/features/practice/model/practice_selection.dart` (`allowsChapters` = quick or chapter).
- Tests: `test/unit/practice/` gains a scope-table test.

**A3 (optional, owner's call).** Subject objects on the Start-sheet chips: `quick_start.dart` `_SubjectChips` plus the `SubjectEmblem` art.

## 10. Acceptance checks a tester can run

Run on a deployed preview or `npx next dev --webpack`, at 390 x 844 and 1440 x 900, in Night and Day. Use a free account with 40 credits and a Pro account. Never use the owner's account.

**AC-1 (F5, Start sheet).**
1. Open Start.
2. Every session (Full mock, NTA mode, Quick practice when shown, Choose your own) has a go disc.
3. Hover on desktop: the surface and the disc change.
4. Press and hold: the tile sinks to about 97% and comes back on release.
5. Tab to each one: a visible 2 px ring.
6. The only volt in the sheet is the hero's button.

**AC-2 (F6 and D3).**
1. On an account whose move is plain practice, open Start and tap Economics.
2. Within 300 ms the hero's object becomes the scale and its title reads "10 Economics questions"; the Full mock and NTA notes say Economics.
3. On an account with a recall session open, the hero "Finish your recall session" sits above the subject chips and does not change when a chip is tapped.

**AC-3 (F7).**
1. In the Start sheet and on Practice, the chosen subject's object is sharp and lit.
2. Every other object is visibly blurred, dimmer and smaller.
3. Object sizes: chip 64 px; shelf 88 px on a phone, 116 px on desktop (measure in DevTools).
4. Names stay sharp.

**AC-4 (F4).** In the Start sheet, Full mock shows the lamp-lit stopwatch with its hand, and NTA mode the exam panel. Compare side by side with the app's Start sheet at 412 dp: the same objects, the same weight.

**AC-5 (F8).**
1. On Practice with Quick practice, Fine-tune is open without a click.
2. On a phone it sits between Questions and the session card.
3. On desktop the session card lists Chapters and Difficulty above Start, and clicking either scrolls to Fine-tune and focuses it.

**AC-6 (F8, picker).**
1. Choose chapters for Accountancy: units "Accounting for Partnership" to "Computerized Accounting System" appear with counts.
2. Type "goodwill": only Reconstitution of a Partnership firm shows, with Goodwill Valuation.
3. Type "and": "Profit & Loss Appropriation Account" matches.
4. Tick "Whole unit" on Reconstitution: 4 chosen.
5. Business Studies shows a flat list with no unit headers.
6. Choosing a 13th chapter is not possible, and the foot says why.

**AC-7 (F9).**
1. Switch the mode with chapters chosen:
   - Full mock: only Difficulty and its scope sentence.
   - Smart practice and NTA mode: no controls, Mobi and the "We choose for you" line.
   - Back to Quick: the chapters return with "Your 3 chapters are back."
2. Start a Full mock: the request to `/api/sessions` has no `chapters`.
3. Call `/api/sessions` by hand with `mode=full&chapters=Goodwill%20Valuation`: the paper is a full-syllabus paper and the meta records the dropped field. After W3's audit, the call returns `CHAPTERS_NOT_ALLOWED`.

**AC-8 (F9, app).**
1. In the app, Quick practice's composer shows Chapters and Difficulty under "Fine-tune".
2. Full mock shows only Difficulty.
3. Smart and NTA show the line.
4. "By chapter" opens the same composer with the chapter list open.

**AC-9 (F12).**
1. On a 390 px phone, with Quick practice and 15 questions selected, scroll slowly from the top to the bottom of Practice and back.
2. The session bar is above the tab bar from the first frame and joins the session card when the card arrives.
3. After passing the card it never appears again, and scrolling back up brings it back only when the card is below again.
4. The bar's Start key keeps one look (outlined) through the whole scroll.
5. Leave to Today: the key is volt.
6. Record the screen and check there are no flips.

**AC-10 (F10).**
1. In a Quick practice paper, pick A, then C, then C again.
2. Record at 60 fps: exactly one outlined box at any frame. The ink grows from the letter. Nothing travels between options and nothing overshoots.
3. Press and hold on an option: one outline that shrinks with the option.
4. Turn on reduced motion: a plain colour change.

**AC-11 (states).**
- Throttle the network: the skeleton keeps the layout.
- Block `/api/chapters`: the Chapters row says so, with Try again, and Start still works.
- Block `/api/practice/quote`: "Could not check this session. Nothing was charged." with Check again.
- A free account on Smart: "See Pro" in the card and the bar.

**AC-12 (one volt).** On every capture state there is at most one volt action per viewport. The chapter sheet's "Use N chapters" covers the page's Start while it is up.

## 11. Anti-slop test and rubric

**12-part test** (`papers/ai-slop-independent.md`):

| # | Check | Result |
|---|---|---|
| 1 | Identity without the logo | Pass. The lamp-lit subject objects, the stopwatch, volt on dark and Bricolage say MockMob |
| 2 | One primary action | Pass. One volt per viewport (hero button in the sheet; Start in the card or bar on Practice; "Use N chapters" in the chapter sheet) |
| 3 | True content | Pass. Chapter and unit names are from `data/subjects.js`. Prices 10 and 50, the 40/40/20 mix, 50 questions in 60 minutes and the 60% Smart threshold are from `data/test_modes.js`. The 40-credit balance is the product's own preview persona |
| 4 | Hierarchy | Pass on stills: subject, then mode, then fine-tune, then session. Needs the owner in use |
| 5 | Composition | Pass. 16 px gutters on phones; 2 x 2 tiles; a 352 px sticky card on desktop |
| 6 | Type roles | Pass. Display 46/31, title 26/22, card 18, body 15, label 13 |
| 7 | States | Specified (4.1, 4.2, 4.4). Not built |
| 8 | Accessible interaction | Specified: radiogroups, focus rings, 44 px targets, reduced motion. Not verified in a browser with a keyboard yet |
| 9 | No pseudo-evidence | Pass. No counts, ratings or urgency invented. The per-subject bank size is left out of the mock because the live number was not available |
| 10 | Motion rationale | Pass. Each motion answers a press or a state change; the travelling glide is removed |
| 11 | Measured usability | Leading metric: share of Start-sheet taps that become a launched session within 2 minutes. Guardrail: back-outs from Practice after arriving from the sheet, and mode changes after arriving (wrong-mode corrections) |
| 12 | Better without it? | The numbered step badges, the always-on Mobi block and the glide box were each asked; each moves or goes as section 7 says |

**0/1/2 rubric** (0 missing, 1 partial or designed only, 2 validated):

| Dimension | Score |
|---|---|
| Task fit | 2 |
| IA | 2 |
| Content truth | 2 |
| Readable hierarchy | 1 |
| Visual specificity | 2 |
| Accessibility | 1 |
| Functional states | 1 |
| Trust | 2 |
| Intentional motion | 1 |
| Performance | 1 |
| Responsive integrity | 1 |
| Instrumentation | 0 |

Total 16 of 24. These are design-stage scores: 1 means specified, not built. The owner signs off.

**Slop list (ui-ux-standards section 10):**
- No gradient text.
- No ALL-CAPS eyebrows (the "Tonight's move" kicker tried in the first mock was folded into the reason line).
- No arrows appended to text.
- No glass on content (blur only on the sticky bar, the sheet and five small images).
- No pure black.
- No monospace labels.
- No fake numbers.
- Floating UI: the sticky bar covers the bottom 64 px of the setup while it scrolls. Section 4.5 and AGENT_RULES 32 cover it: the page keeps 80 px of bottom room, and the bar lands in place.

## 12. Conflicts and questions for the owner

1. **`wt-webux2` spreads the scroll-driven key flip** (`data-primary-shown`) to Today and result pages. This document says the key's look changes only with the route. Ship W4's rule with or before webux2, or hold that part of webux2.
2. **`wt-webux2` removes the fresh-paper line** from Practice. D10 keeps it in the session card (memory `usp-unlimited-mocks`).
3. **Where Start lives on the phone bar is F13** (another packet). This document only fixes when the key changes its look.
4. **App Start-sheet chips without objects** (A3): add the objects to match the web, or keep the app's quiet chips?
5. **Difficulty for free accounts** stays visible and locked ("A set level comes with Pro"), as the server enforces today. If he wants difficulty free on Quick practice, that is a pricing change, not a design one.

## 13. Captures

All captures are in `C:\Users\atish\Desktop\mockmob copy\mockmob-next\tmp\design-1017\start\captures\`. Each was captured headless over the DevTools protocol (`cap.mjs`, exact viewport, deviceScaleFactor 1) and opened.

**Start sheet:**
- `start-390-night.png`, `start-390-day.png`: phone; subject-bound hero under the rail.
- `start-1440-night.png`, `start-1440-day.png`: desktop panel; Full mock tile in hover.
- `start-fixed-hero-390-night.png`: "Finish your recall session" above the rail, Economics chosen.

**Practice setup:**
- `practice-390-top-night.png`, `practice-390-top-day.png`: the first screen with the session bar riding.
- `practice-390-finetune-night.png`, `practice-390-finetune-day.png`: Fine-tune open, with 3 chapters chosen.
- `practice-390-rest-night.png`, `practice-390-rest-day.png`: the bar landed as the card's footer.
- `chapters-sheet-390-night.png`, `chapters-sheet-390-day.png`: the phone chapter sheet.
- `practice-1440-night.png`, `practice-1440-day.png`: desktop, with the Full mock tile in hover.
- `practice-1440-chapters-night.png`, `practice-1440-chapters-day.png`: the inline unit-grouped picker.

**Scope:**
- `scope-full-390-night.png`
- `scope-smart-390-night.png`
- `scope-nta-1440-night.png`
- `scope-full-1440-day.png`

Mock sources: `tmp/design-1017/start/start.html`, `practice.html` and `shared.css` (tokens copied from `arena.css`, `globals.css` and `motion-kit.css`). The `assets/` folder holds copies of the product's own renders.
