# Ask Mobi: "Ask now" and "Ask your record", made big (19 Oct 2026)

**Status:** mock-ups only, for the owner to pick (D110, R8). Nothing in `src` or `flutter_app` changed, and nothing is committed.
**Answers:** G21 in his words: "This 'Ask Me' can also be integrated more properly and made more useful, in terms of 'You can ask now' and 'Ask your record,' with a very big UI." Also G23 (a 17-year-old who is new to apps), D53 (instant answers, no consent sheet), D101 (Pro features visible but locked), D105 (the bar becomes Today, Practice, Start, Mob, You) and D84 (copy in his voice).
**Builds on:** ASK-MOBI-1018. The contextual sheet ("Ask Mobi about Q7", "Ask Mobi about this mock"), the free record answers, the price shown before every written reply, and the retry that can never charge twice all stay as they are. This pass is about the **front door**: the page a student opens to ask anything, which today is `/ask` in the app and `/mentor` on the web.

## Where to look

Everything is in `mockmob-next/tmp/design-1019/ask-mobi/`. I opened every image listed here.

| What | Files |
|---|---|
| **Comparison boards** (all three options, 360 × 800) | `board-night.png`, `board-day.png` |
| Option A, the big sheet | `opt-A-360-night.png`, `opt-A-360-day.png`, `opt-A-412-night.png`, `opt-A-412-day.png` |
| Option B, Mobi's own screen (recommended) | `opt-B-360-night.png`, `opt-B-360-day.png`, `opt-B-412-night.png`, `opt-B-412-day.png` |
| Option C, a tab inside You | `opt-C-360-night.png`, `opt-C-360-day.png`, `opt-C-412-night.png`, `opt-C-412-day.png` |
| Web at 1440, the recommended pattern | `web-1440-night.png`, `web-1440-day.png` |
| Source | `src/index.html`, `src/mock.js` (all copy is in its `C` object), `src/mock.css`, `capture.mjs` |

Each option strip has six frames in this order: 1 where it lives, 2 a fresh account, 3 a heavy account, 4 a question being answered, 5 the credit line opened, 6 offline.

**How they were made:**
- **Tokens:** copied exactly from `flutter_app/lib/core/theme` at ab04b067. That covers `MmColors.dark` and `.light`, the `MmType` roles (Bricolage Headline, Title and Condensed, plus Hanken Grotesk, loaded from the app's own font files), `MmSpace`, `MmRadius` and `MmBar`.
- **The web view** uses the Arena tokens from `src/app/(app)/arena.css` at 23a7c090.
- **Mobi** is the app's painted character. He was cut from the app's own golden renders (`test/golden/mascot/goldens/mobi_sizes_*`, `mobi_v2_every_act_*`), not redrawn. The small face is the logo B mark, as `MobiMark` draws it. The bell is the app's own `hybrid-deskbell` art.
- **Capture:** headless playwright-core 1.62.1 with its own temp profile, which was deleted afterwards. The script checks that the fonts loaded, that no image is broken and that no text is clipped. The last run reported "no problems".

**The figures in the heavy account are illustrative:** Riya, 25 papers, 355 marks lost in Share Capital, 14 chapters ranked, 38 of 50 credits, and the mock "138 of 250, Thursday". The build reads every one of them from the record (`recordPrompts`, `RecordEvidence`, the wallet). Where the record has no figure, the line is left out; it is never made up. Each structure is real: "50 a month on Free" is `AI_FREE_MONTHLY_CREDITS = 50` (web `aiCreditWallet.js`), and record answers are free (`answerFromInsights`).

## What is wrong today (read from v15.2 and release 10)

- **The app's `/ask` page.** Mobi stands on a lamp-lit stage. Under him sit four record tiles headed "About your marks · Free, from your own answers", then two AI rows headed "Ask anything · Uses 1 credit", and the composer.
  - The two kinds of asking are there, but they read as two small eyebrow labels over tiles. Nothing says "these are the two things you can do here".
  - It is reached by tapping Mobi on Today, from the account sheet, or from Help. A first-time student does not know that the mascot is a button.
- **The sheet.** It is for one thing in front of you, and it is right for that. Its "You can ask now" label is a small grey caption. The owner's words echo it, which shows he noticed the idea but not the place.
- **The web.** `/mentor` is "Your record" with past questions, and the composer lives in the side panel. "Ask Mobi" is a Planning row. Nothing on the web says "ask any CUET doubt here".

## The two doors, in every option

| | Ask now | Ask your record |
|---|---|---|
| What it is | Any CUET question, a concept or a doubt. The student types it or taps a starter. | Questions answered from the student's own papers |
| What answers it | A written reply through the server's budget guard | The record on the phone for the free asks; a written reply for a plan |
| Price | 1 credit, shown on every starter and under the field before sending | Free for the record asks; "What should I revise tonight?" is 1 credit and says so |
| Fresh account | Works at once, with 3 starters | Says plainly what it needs and offers one first step |
| Tap behaviour | A starter sends at once, with no consent sheet (D53) | Same |

**Record asks, in order** (7 in total, which is the "See all 7" count):
1. Where am I losing marks? (free)
2. Which chapter should I practise? (free)
3. Why did I lose marks in my last paper? (free, **new**)
4. What should I revise tonight? (1 credit)
5. Am I too slow on wrong answers? (Pro, visible but locked; D101)
6. How is my week going? (free)
7. Do I change answers too much? (free)

A blank-answers ask exists too ("What am I leaving blank?"). It stays in the follow-up rail, as today.

**One new free intent is needed.** "Why did I lose marks in my last paper?" is answered from the latest attempt's breakdown. That is the same lines the result screen already passes to `AskMobiContext.mock(lines: ...)`, so it costs no credit. Today `answerFromInsights` has no "last paper" intent. That is the one logic addition behind these mock-ups. The other record asks already exist.

## Option A: the big sheet

**What it is:** "Ask Mobi" rises as a near-full-screen sheet (`top: 56` dp) over whatever screen the student is on. Two big square tiles, Ask now and Ask your record, choose the door. One list under the tiles changes with the tile, and one field at the bottom takes any typed question.

**Entry:** a labelled "Ask Mobi" glass capsule (Mobi's head and the words) in the header of Today, Practice and Mob. At 360 it reads "Ask" to fit beside "Good evening". A tap raises the sheet to half height, and dragging takes it to full height.

**R2, per screen:**
- Entry: "There is an Ask Mobi button; it opens something." Clear.
- Sheet, fresh: "Pick a tile. The record one says it opens after my first paper, so I'll practise first, or type a doubt." Clear in about 3 seconds.
- Sheet, heavy: "Tap a question; they say Free." Clear, **but** the two tiles look like a switch and only one door's questions show at a time. A newcomer may not realise the other tile has its own list. **Finding.**
- Answering: "Mobi is writing; I can stop it." Clear.
- Credits: "Answers from my marks are free; a written answer costs 1 of my 38." Clear.
- Offline: "It didn't send, and nothing was charged; my record still works." Clear.

**Pros:**
- One component, which the existing `AskMobiSheet` grows into.
- The screen the student came from stays underneath.
- It is fast to open from anywhere.

**Cons:**
- A sheet reads as temporary. The owner asked for "a very big UI", and a sheet is the smallest of the three in feeling.
- The tiles are a two-state switch, and the student sees half the questions at a time (S014: do not hide frequent actions behind a disclosure).
- Typing raises the keyboard over a tall sheet, which leaves little room for the reply at 360 × 800.
- Two kinds of sheet (contextual and front door) would look alike but behave differently.

## Option B: Mobi's own screen (recommended)

**What it is:** Ask Mobi becomes a full screen. It is the `/ask` route, which already exists, already opens with the rise transition and already has Mobi on lamp light, so no new route is needed. The screen is laid out as two huge stacked doors, each complete:

1. **Ask now:** a Bricolage 30/32 headline, the bell art, the field and the starters.
2. **Ask your record:** the headline. Then the lead question as a big tile with the real figure in Bricolage Condensed 54. Then the next starters and "See all 7 questions about your record".

**Entry, every path labelled** (nothing that is visible today is removed; R3):
- the "Ask Mobi" capsule in the header of Today, Practice and Mob;
- a big Ask Mobi card on Practice, with Mobi and two buttons, "Ask now" and "Ask your record". Each opens the screen scrolled to its door, with Ask now's field focused. This **replaces** the small v15.2 row "Ask Mobi what to practise" in the same slot; it is not an extra card;
- the account sheet row and the Help row, as today;
- tapping Mobi on Today, as today.

The contextual entries ("Ask Mobi about Q7", "Ask Mobi about this mock", "Ask Mobi about today") still open the 1018 sheet over the work, because there the page under it matters.

**R2, per screen:**
- Practice card: "Mobi helps with doubts. Two buttons: ask now, or ask my record." Obvious.
- Fresh: "Big Ask now: type my doubt or tap one. Ask your record says my record is empty; practise 10 questions first." Obvious in 3 seconds.
- Heavy: "Ask now at the top. Below it, my record says 355 marks lost in Share Capital; tap to ask why." Obvious.
- Answering: "My question, then Mobi writing the answer in big type; Stop if I want." Obvious.
- Credits: "38 of 50 left; marks questions are free." Obvious.
- Offline: "I'm offline; it wasn't sent and nothing was charged; my record still answers." Obvious.

**Pros:**
- It is the biggest and plainest of the three: two doors, each with everything it needs, so nothing is hidden behind a switch (S014).
- The Back key is a labelled pill (his D43). The credit pill sits in the header.
- It reuses the `/ask` route, the stage, the Mobi greeting ration (`MobiRation.greeting('ask')`) and the composer.
- The reply gets the whole screen.
- It matches the web page one to one (see below).

**Cons:**
- It is a navigation away from the student's screen. That is mitigated by the labelled Back and by the contextual sheet staying for question-specific asks.
- **At 360 × 800 the record door starts below the fold** on a heavy account. Its headline, sub-line and lead figure are visible, and its list scrolls. To keep both doors visible:
  - Ask now shows one starter at 360 and two at 412 on a heavy account;
  - on a fresh account at 360 it shows one starter, plus "Tap the box to see three ideas to start with".

## Option C: a tab inside You

**What it is:** "Ask Mobi" becomes the first chip on the You screen, beside Week, Badges, Bests and Mocks. The doors are the same as in B, but the bottom bar stays and the conversation happens inside You.

**R2, per screen:**
- Entry: "This is my profile... and Mobi?" A newcomer does not look for help under You. **Finding** (G23).
- Fresh and heavy: the doors are clear, but squeezed between the chips and the bar.
- Answering: the composer sits above the bar, so the reply gets the least room of the three.
- Credits and offline: clear.

**Pros:**
- One tap from the bar, and no new route.

**Cons:**
- The owner said the Mob being "hidden inside the You section" does not work (G17). This repeats that mistake for Mobi.
- Its least room is for the thing that needs the most (the reply and the keyboard).
- The bar's "You" label does not say "ask". Icon or label mismatch fails S016.

## Recommendation

**Pick B, Mobi's own screen, and keep A's sheet for asks about a specific question or mock.**
- B gives the student the two big doors he described, both complete, with a labelled way in on every tab and a big card on Practice.
- It reuses what is already built and approved: the `/ask` route and stage, the composer and its price line, the record answers, and the retry safety.
- D53's instant answers stay: a starter sends on tap with no sheet in between.

The web follows the same pattern at 1440 (`web-1440-*.png`):
- `/mentor` becomes the two doors side by side, with Mobi's greeting above them.
- Under the doors sit the credit line and "Your recent questions" (from `mentorHistory.mjs`, each row with what it cost and a 12-hour time).
- The "Ask Mobi" sidebar row opens this page.
- The docked panel from 1018 stays for asks about a question or a mock.

## Exact copy (read aloud; D84)

- **Greeting, fresh:** "Hi Riya. Ask me any CUET doubt, right now."
- **Greeting, heavy:** "Hi Riya. Ask me any doubt, or ask what your 25 papers say."
- **Ask now:**
  - title "Ask now"; line "Any CUET question, concept or doubt, explained in plain words.";
  - field "Type your doubt here"; caption "Or tap one to ask it now";
  - on a compact 360 fresh screen: "Tap the box to see three ideas to start with."
- **Ask now starters:**
  - fresh: "Explain sacrificing ratio in simple words", "What is price elasticity of demand?", "How do I find the main idea of a passage?";
  - heavy (from the student's subjects): "Explain sacrificing ratio in simple words", "How is goodwill valued by the super profit method?", "What is the difference between shares and debentures?";
  - each is marked "1 credit".
- **Ask your record, heavy:**
  - title "Ask your record"; line "Mobi reads your 25 papers and answers from them.";
  - lead tile "Where am I losing marks?" with the figure, "marks lost in Share Capital, your biggest leak", and "Free";
  - caption "Tap a question and Mobi answers at once"; link "See all 7 questions about your record".
- **Previews on the record asks:**
  - "14 chapters ranked from your answers";
  - "Accountancy full mock, 138 of 250, Thursday";
  - "A written plan built from your record";
  - "Timing from your timed papers", with a Pro lock.
- **Ask your record, fresh:**
  - "Your record is empty for now." / "Finish one practice paper and Mobi can show you where every mark went.";
  - button "Practise 10 questions first";
  - under it: "After that, you can ask where you lose marks, which chapter to practise and what to revise tonight."
- **Credit line:**
  - "38 of your 50 monthly credits left · renews 1 Nov" (a link), then "Answers from your marks are free. A written answer uses 1 credit.";
  - with ONE balance on (`askOneBalanceProvider`), the first half follows `walletLine`: "38 credits left · free ones renew 1 Nov".
- **Credit sheet:**
  - "Your credits"; "38 of 50 left this month"; "Free gives you 50 credits every month. They renew on 1 November.";
  - rows: "Answers from your marks · Free", "A written answer, like an explanation or a revision plan · 1 credit", "A reply that fails or never arrives · No credit";
  - button "Done".
- **Answering:**
  - "Mobi is writing", then the reply, a lead sentence in bold and the body at 18/28;
  - "Stop writing"; under the field: "Writing a reply · this one uses 1 credit".
- **Offline:**
  - "You are offline. Answers from your record still work. Written answers wait until you are back online.";
  - on the failed ask: "This was not sent because you are offline. No credit was used." with "Send again";
  - heading "Your record still answers"; under the field: "Offline · answers from your record still work".
- **Practice card (B):** "Ask Mobi" / "Stuck on a doubt? Ask now, or ask what your papers say." with the buttons "Ask now" and "Ask your record".
- **Sheet greeting (A):** "What would you like to ask, Riya?"

Banned-list check on these lines: no exclamation marks, arrows, emoji, ALL CAPS or build talk. Every price is said before the tap.

## Motion (B; values follow the existing motion tokens)

- **Screen:** the existing `MmTransition.rise` route.
- **Doors:** `RiseIn`, 12 dp, staggered 0 / 60 ms. Starters are staggered 40 ms each, once per open.
- **Mobi:** hello once a day (the existing ration), then idle. He listens while the field is focused and thinks while a reply is on its way (the existing `MobiAct.listen` and `loading`).
- **Reply:** a 4 dp rise and fade, 220 ms ease-out.
- **Balance:** a 160 ms crossfade when a reply lands.
- **Reduced motion:** fades only.

**Streaming (frame 4) needs a decision.** Replies are not streamed today (`ask_controller`, `/api/ai/*`); they arrive whole. Frame 4 shows the reply growing with a caret and "Stop writing", which needs a streaming response from the server. Until that exists, frame 4 must show the honest wait (Mobi thinking, "Writing a reply · this one uses 1 credit") and then the whole reply rising in. It must never fake a typewriter. **Question for the owner:** add server streaming for written replies? I recommend yes, as a separate packet after the layout ships.

## Research and taste checks

- **Evidence IDs:**
  - S014: frequent asks stay visible, never behind a switch. This is why B beats A.
  - S016: consistent labels and selected state, one "Ask Mobi" label everywhere. This is why C fails.
  - T001: starters come from the student's real subjects and record.
  - Rule 7: one primary action per screen. Two equal doors is a documented exception, because the owner asked for exactly two ways in.
  - The MockMob overlay: "explain AI uncertainty and credit costs before irreversible model calls".
- **12-part anti-slop test on B:**
  1. Identity: Mobi, the bell, lamp light and Bricolage.
  2. Primary action: the two doors are justified above.
  3. Truth: illustrative figures are labelled; the build reads real ones.
  4. Hierarchy: the doors at 30 px, then the field, then the starters.
  5. Composition: a 16 dp gutter and 12 dp gaps.
  6. Typography by role.
  7. States: fresh, heavy, answering, offline and the credit sheet are designed. Paused replies and no credits stay as in 1018.
  8. Targets: 44 px or more; the field is 56; the starters are 52 or more.
  9. No pseudo-evidence.
  10. Motion: specified above.
  11. Metric (proposed): the share of first-week students who ask at least one question. Guardrail: written replies reported as wrong.
  12. "What would be better without it?": the eyebrow labels from v15.2 are gone; each door is self-explaining.
- **0/1/2 rubric (my score, internal, not proof):**
  - 2: task fit, IA, content truth, hierarchy, visual specificity, trust, responsive integrity.
  - 1: accessibility (not tested with a screen reader), functional states (streaming not built), motion (not shown as frames), performance (not run).
  - 0: instrumentation (not defined in code).
- **Owner taste profile:**
  - #3 one leading way in: two labelled doors;
  - #4 self-explaining: every door says what it does;
  - #8 Mobi alive and sized to the space;
  - #11 a labelled Back key and a gap under the status bar;
  - #13 Night stays subtle: volt only on Start, the tick and Mobi;
  - #14 instant (D53).

## Not verified

- No device or emulator run. These are HTML mock-ups at real sizes with real tokens.
- No keyboard-open frame.
- No frame sequence of the motion.
- No real reply lengths from gpt-6-luna or Claude Haiku 5.5.
- Mobi is shown from golden renders, not live.

All of that belongs to the build packet after his pick.

## Questions for the owner

1. **Which option?** I recommend B, Mobi's own screen, with the question sheet kept for asks about a question or a mock.
2. **Stream written replies** so the answer appears as Mobi writes it? This is a server change. I recommend yes, after the layout.
3. **The Practice card** with both buttons, in place of the small "Ask Mobi what to practise" row: yes? I recommend yes. It moves the entry; it removes nothing.
