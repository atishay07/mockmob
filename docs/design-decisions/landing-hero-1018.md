# Landing hero: the changing line, Mobi alive, and a calmer phone hero (18 Oct 2026, D38)

Branch `web/land3-1018`, worktree `wt-land3`. Not pushed, not deployed. Refine, not rebuild: every hero element stays (headline, lead, bank line, both buttons, ticks, the sample, the calculator and exam-screen links). Outside the hero only two small fixes, plus the one-Mobi rule the coordinator added from the live re-audit.

## The ask

At about 9 am on 18 Oct, after seeing the landing live, the owner said the hero "majorly needs some sort of improvement or refinement, like the text copy below CUET 2027. There can be some morphing text continuously changing and showing something animated, like I said, and the mobby animation. Along with some other things." "Like I said" is his 15 Oct ask (L-016): a typed line or a crisp per-letter morph, not glass, no glow. The other hero items still open: L-017 (CUET 2027 in the brand colour), L-018 (not a button that only scrolls), L-014 (clean spacing), L-004 (the flying Mobi), L-019 (no glow, sheen or gradient text), L-013 (2-tap paths), L-015 (a way on for other subjects).

## Headline (`HeroMorph.jsx`, `heroPhrases.mjs`, `hero-motion.css`)

- **Three lines as before.** "CUET 2027." / "One mock." / the changing line. "CUET 2027." is plain text in the brand colour: volt on Night, the Day links' dark olive `#526700` on Day (5.8:1 on the Day paper; volt on a light ground fails). It is not a link or a button.
- **The four phrases, each true:**
  | Phrase | Why it is true |
  | --- | --- |
  | No more guessing. | The copy deck's line 3 (M-006); the lead under it says what replaces the guessing. |
  | Every mark traced. | The Mistake Lab sorts every missed mark into one group (`labStory.mjs` marksLedger); its heading is the owner's praised "Every mark, traced back to a moment." |
  | Know what to fix. | Chapter review names the chapter to fix first and the free SWOT gives the sets to do next (`data/mock_swot.js`). |
  | Fresh every time. | Every mock is built fresh from one live bank (`practiceSessions.js`, the bank line, `ONBOARDING_LEAD`). It says fresh, never "never repeats". |
- **Why not the other candidates.** Measured at the hero's own weight and tracking, "Fix the right chapter." (9.4 em), "Fresh paper, every time." (10.9 em) and "Unlimited mocks on Pro." (11.1 em) do not fit one line of the copy column (9 em on a phone, under 8.9 em on a desktop). "Know what to fix." and "Fresh every time." carry the same two ideas in 7.9 em. "Unlimited mocks on Pro." also reads against "One mock." above it; the USP is already in the bank line, the stats band, pricing and the FAQ.
- **The motion.** Per letter: the old letter rises 0.35 em and is gone by 60% of 240 ms; the new one rises in from 0.35 em below over 360 ms, starting 120 ms after its slot's old letter starts leaving, so each letter's change takes 480 ms; letters follow each other 20 ms apart; ease-out `cubic-bezier(0.23, 1, 0.32, 1)`; transform and opacity only, no blur. Each phrase holds 2.6 s after its last letter lands; the first change waits 3.6 s (Mobi has landed and waved, the line has been read once).
- **Nothing moves.** Every phrase shares one grid cell, and on a live page an invisible copy of every phrase sits in it, so the height is the tallest phrase's even if 200% zoom wraps one. A phrase at rest is plain, kerned text; only a phrase on its way in or out is split into letters, and it goes back to text when its last letter lands. So a late web font can only reflow text, never move a letter box.
- **Accessibility.** The h1's accessible name is the static sentence "CUET 2027. One mock. No more guessing." (checked in the browser's accessibility tree). The letters are `aria-hidden`; nothing is `aria-live`.
- **When it runs.** Never under Reduce motion (the system's or MockMob's own switch): the first phrase, still. Paused while the hero is off screen or the tab is hidden.

## Mobi (`brand-pip.css` Round 7, `PipGuide.jsx`, `PipActor.jsx`)

The hero Mobi is the existing raster art (seven WebP poses) with the eyes redrawn as a layer. The antenna is part of the raster, so there is no antenna sway.

- **Fly-in.** From just past the right edge on a short, low arc (up 12% of his height, so on a phone he stays under the site bar), touching down at 1.04 and settling to 1, 720 ms; the across and the up-and-down legs run on nested layers with their own curves, so the path is a real arc. Then the greeting wave, as before. Phones: his seat beside "For CUET UG 2027". Desktop: the guide flies in to the lane right of the sample.
- **Idle.** A 4 px float every 3.2 s (on phones his contact shadow narrows as he rises); a blink about every 5 s (a single, then a double); the existing breath.
- **Glance.** On each headline change his eyes go to the line and his head dips about 3 degrees toward it, then he looks back after 1.15 s unless a mouse has caught his eyes. Never mid-act, never before he has landed and waved.
- **The sample.** A right answer: a hop. A wrong answer: the warm pose and a head tilt about the middle of his body (it was a nod from the feet). On desktop the lane Mobi answers; on a phone, where the hero's seat has scrolled away by the time the reason shows, the sample's own small Mobi does (it now appears for a wrong answer too, in the warm pose).
- **Pointer.** Desktop only, as before: the eyes follow a mouse; the vertical reach is now capped under 3 px (2.4 px across, 2.8 px down at the lane's size). Off on touch and under Reduce motion.
- **Off screen** his loops pause. **Reduce motion:** still poses, no guide.

## The phone hero's rhythm (L-014)

- The bank line is one sentence of proof and keeps every fact (the subject claim, built fresh from one live bank of 6,294 questions, no fixed set to run out of, no cap on Pro): "Full NTA-pattern mocks for the 15 subjects behind 19 of every 20 CUET papers, each built fresh from one live bank of **6,294 questions**: no fixed set to run out of, no cap on Pro." It is quieter than the lead (`--ink-3`, 13 px on phones) with the number in full ink.
- The buttons get air above them. At 390 x 844, before and after (top to bottom, px): headline 206-321 / 207-321; lead 332-378 / 333-380; bank line 399-483 (4 lines) / 390-448 (3 lines); buttons 494-542 / 468-516; ticks 554-599 / 528-573; the sample's bay starts at 619 / 593. The headline, lead, both buttons and the ticks are on the first screen at 360 x 780 too (ticks end at 583).
- The lead keeps the copy deck's words.

## Paths (L-013, L-015)

- From the hero: the sample is in the hero itself ("Try five questions" brings it up, one tap); sign-up is one tap ("Start free practice", `/signup`); the Arena is one tap for a signed-in student (`/dashboard`) and sign-up first for a guest.
- New quiet line under the sample: "Taking other subjects? Sign up free and pick yours", linking to `/signup`, where a new student's onboarding asks for up to five subjects (`ONBOARDING_LEAD`). Value before the account wall stays: the five questions need no sign-up (T003).

## The two fixes elsewhere

- **Mistake Lab, Changes scene (L-033).** Q4 was changed 10:35 after its first pick (3:45 to 14:20). The questions run in paper order, so each change now happens inside its own question's visit, seconds after the first pick: Q4 5:08 to 6:00 (0:52 later), Q8 12:12 to 12:58 (0:46), Q9 14:21 to 14:59 (0:38). Same verdicts, marks, net -6 and order; the scene, the tour's replay and the interactive replay all read the same rows. A new test holds every change inside its question's visit and under a minute.
- **Close band at 1440 (Mobi's foot on "See you at your first mock.").** Cause: the guide read the seat's painted box while the band's Reveal still had it 1.5rem low, and a transform ending fires no resize, so Mobi stood 14 px low. He now reads the seat's layout position. And while he is held in the lane lower than his seat (the seat has scrolled up past the lane's top), his line steps out instead of sitting under his feet. Checked at 1280, 1440, 1920 and 390, Night and Day, scrolling the band through the window in 60 px steps: no overlap.

## One Mobi in view (W-074, from the coordinator's live re-audit)

- Desktop: the lane Mobi stands in for every seat; the seats' own figures are now hidden outright (visibility as well as opacity, on the image itself).
- A phone seat that reacted showed two Mobis on top of each other: the finished arrival animation held the rig's opacity at 1, beating the hide rule. Hidden with visibility now.
- Phones (and any width under Reduce motion): two seats can share a screen (the Mistake Lab's and the Compass's at 390). Of the Mobis on screen, the one most on screen stays and the other's figure fades out until it is the one most on screen; its line stays. A challenger must be 15% bigger to take over, so a slow scroll does not flicker.

## Evidence and rules

T003 (value before sign-up: the sample and the new line), S016 (WCAG 2.2: contrast of the Day olive, the static accessible name, Reduce motion, 44 px targets), AGENT_RULES 26 (no glass, gradient or glow), 31 (motion with a purpose: the line's change states what MockMob does; Mobi's glance points the eye at it; reactions answer the student) and 36 (keyboard, zoom, reduced motion).

## Open assumptions

- Two of the four phrases are new words ("Know what to fix.", "Fresh every time.") because three candidates did not fit one line; the owner may prefer others of the same width.
- The desktop headline is 2.6% smaller (11.3 cqi of the column, was 11.6) so "Every mark traced." fits its column.
- Not tested on a real phone.
