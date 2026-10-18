# Ask Mobi: redesign brief (18 Oct 2026)

**Status:** design only, for the owner's yes before anyone builds. Nothing in `src` or `flutter_app` changed.
**Answers:** D6 and D12 (his words: "very old", "too much clutter, too much information at once", "only the Your Record thing is there", "should not be placed below the Light/Dark mode theme selector", "very neon"). He confirmed: the Ask section is Ask Mobi.
**Also covers:** D5 (the Mobi entry on Practice), D7 (Night stays subtle), W-060 (the cost shows before each call, and the balance updates), and FEATURE-ADOPTION items 8 and 9 (Mobi lives in the work).
**Mock:** `tmp/design-1018/askmobi/index.html` (clickable), with captures in `tmp/design-1018/askmobi/captures/`.

## 1. What is wrong today (R4, main 9578ee66)

Read from the code, not guessed:

- **Placement.** To reach Mobi on desktop, a student opens the sidebar foot. There the Appearance switch sits first, then the Help door with the glass orb (`AppLayoutClient.jsx`, `arena-sidebar__foot`). Help opens a four-row menu (`HelpMenu.jsx`). Its first row, "Ask Mobi", opens the panel. That puts Mobi two clicks deep, under the theme selector, behind a door labelled Help. On a phone it sits under More, then Help.
- **Contents.** The panel (`MockMobAIHub.jsx`) has four tabs:
  - **Next step:** repeats Today, with a 10/20/30-minute picker.
  - **Your record:** the one part that works.
  - **Ask:** shows a free/paid segmented switch, a cost box and a "Focus" dropdown before the student types a word.
  - **AI credits:** a wallet card, a rules list and a tools directory.

  That is about 14 controls before the first answer. It reads like a form (D3).
- **Look.** The panel is always `arena-dark-island` on `#090a08`, so it stays dark in Day mode. The orb is a glass marble with lime liquid light. Volt marks the active tab's underline, the selected minute and the hover state. In Night that reads as neon.
- **Already right, so we keep it:**
  - free answers from the record (`answerFromInsights`);
  - the question hand-off from a repair (`questionRef`, `/api/recovery/ask-context`);
  - the price shown before a paid reply;
  - the retry path that can never charge twice;
  - the wallet broadcast to the top bar;
  - the open-in-place event (`openAskMobi`), which lets the panel open over the page the student is on.

## 2. Decision

**Mobi answers one question about what is in front of you, from your own record, and ends with one next move.** It stops being a four-tab destination. It becomes one panel that every relevant screen opens, already about that screen.

This is a refinement, not a rebuild. The record answers, the question hand-off, the cost rules and the retry safety are kept as they are. Only the arrangement changes: what opens Mobi, what the panel shows first, and how it looks.

### What moves where (nothing is deleted)

| R4 panel part | Goes to | Why |
|---|---|---|
| Next step tab and minute picker | **Today** owns the next step. Today's lead gets "Why this?", which opens Mobi with the reason answered. | A second copy of Today made the panel a second home screen (FEATURE-ADOPTION 2). |
| Your record tab | **The record chip** in the panel's context row. Tapped, it opens a three-line summary: marks ledger, biggest leak, pace. "Full record" opens `/mentor`, which keeps `RecordView` as a page. | The part he said works now shows in every answer as its source. |
| Ask tab: free/paid switch, cost box, Focus dropdown | **Automatic.** The panel sorts each ask itself: if `answerFromInsights` can answer it, it is free; otherwise it needs a written reply at 1 AI credit. Each suggested ask carries its price, and so does the composer as the student types. The reply mode follows the context: a question uses `revision`, a mock uses `autopsy`, Today uses `mentor`. | No form fields before the first answer (D3). The cost still shows before every paid call (W-060). |
| AI credits tab: wallet, rules, tools list | The wallet becomes **one line under the composer**: "8 of 10 AI credits left · resets 1 Nov". It links to `/pricing/ai-credits`, where the wallet card and rules already live. The tools list moves to the Guide and help page (the D11 owner places it). | It is a balance, not a section. |
| Glass orb | **Mobi's flat face mark**: the volt diamond, dark visor and two cream eyes from the character art. It is static, with no glass, liquid or light. | Removes the neon source (D7, D12). It matches logo B's Mobi "o". |
| Help door's "Ask Mobi" row | **Removed from Help.** "Ask Mobi" stays as the ordinary sidebar row in Planning (it is already in R4 `arenaNavigation`). That row now opens the panel in place instead of going to `/mentor`. On a phone it is a row in More. | It is never under the theme selector again. Help is D11's to rename and move. |

## 3. Entry points (each opens the same panel, already scoped)

The context passes through `openAskMobi({ context })`. The opener sends what the screen is about. It never sends a whole transcript.

| Where | Control | Opens with | Cost |
|---|---|---|---|
| **Question review** (Review and the result's answer sheet, question detail) | A quiet "Ask Mobi about Q7" text button after the solution, beside the single "Repair this mistake" action | A Q7 chip, the stem in three lines, "You picked B, 9:6:5" and "Key C, 19:11:10", plus 3 suggested asks | Shown per ask: question asks cost 1 AI credit; the record ask is free |
| **Result, mistakes** (D15) | Inside an expanded mistake, under the one "Repair" action, as a second, quieter line. It is never a second button on the collapsed row. | Same as question review | Same |
| **Result, where the marks went** | "Ask Mobi about this mock", one line under the marks ledger | A Mock 3 chip. The first answer is already there, free: where the 78 lost marks went, by chapter | Free |
| **Practice** (D5) | One row beside the Repairs row, under the subjects loop: "Ask Mobi what to practise", with a record preview such as "Partnership: 11 wrong of 34 answered". The loop does not change (D4). | A Practice chip and the record answer for the weakest chapter | Free |
| **Today's lead** (D1-D3) | "Why this?" beside the lead's reason line | A Today chip. The answer is the plan's own `facts` (basis: record), with denominators | Free |
| **Sidebar row / phone More** | "Ask Mobi" | The page the student is on (`pageHelpForPath`), plus the record chip | Shown per ask |

Rules for every entry:
- One label everywhere: "Ask Mobi about Q7", never "Ask about Q7" on one screen and something else on another (D15).
- No entry adds a card or box to its page. It is a text button or a list row.

## 4. Inside the panel (top to bottom)

1. **Header:** the 24 px Mobi mark, "Ask Mobi" and Close (44 px).
2. **Context row:** up to two chips.
   - The **subject chip** names what Mobi is asked about ("Q7 · Partnership"). Its x drops back to the record.
   - The **record chip** ("Your record · 9 sessions") opens the three-line summary.

   Every answer names its source, so a student never wonders what Mobi read.
3. **Opening:** depends on the context.
   - **Question:** the question quote (three lines), then "Ask about this question" with three rows. Each row has the ask, one line saying what it uses or a real preview from the record, and its price ("1 AI credit" or "Free").
   - **Mock, Today or Practice:** the free answer is already shown, followed by two follow-up asks.

   Suggested asks come from a pure module, `askSuggestions.mjs`. It takes the context and the insights and returns 2-3 asks with intent, preview and price. A preview is never invented: with no record line, the preview is omitted.
4. **Answer:** a short reply, at most about 120 words, in the student's terms with real figures. Under it:
   - a **source line**: "Written reply on Q7 and its key · 1 AI credit used", or "From your record · 4 sessions, 34 answers";
   - **at most one next-move button**, as an outline button, for example "Practise 10 Partnership questions".

   Then "Ask next" with two follow-ups.
5. **Composer:** a one-line field that grows to 5 lines, with the context in its placeholder ("Ask about Q7") and a neutral ink "Ask" button.
   - Under the field: "8 of 10 AI credits left · resets 1 Nov" on the left. On the right, "Record questions are free", which becomes "This needs a written reply: 1 AI credit" when the typed text is not a record question.
   - The balance updates from the reply's charge, and the top-bar chip updates too (`announceWallet`, as today).

**Volt in the panel:** only Mobi's mark. There are no volt fills, underlines or hover tints. The single volt key on screen stays the shell's "Start a session" (or Today's lead button on Today). This is Night kept subtle (D7).

## 5. Placement

| Width | Form | Behaviour |
|---|---|---|
| 1280 px and up | **Docked side panel**, 400 px, from under the top bar to the bottom, with a line border on the left | No scrim. The page stays visible and usable, so the student can see Q7 while asking about it. The main column gives up the panel's width when the student opens it (one user-caused change, never on its own). |
| 768-1279 px | Overlay panel at the right, 400 px | Light scrim (`--a-scrim`). Click outside or press Esc to close. |
| Below 768 px | **Bottom sheet**, as tall as its content, capped 92 px below the top | The handle drags it. A flick down closes it (velocity above 0.11, or past 35 % of its height). The question's head stays visible above the sheet. |

- **Theme:** the panel takes the Arena's Night and Day tokens (`--a-raised`, `--a-line`, `--a-ink-*`). In Day it is a Day surface. This fixes the R4 caveat where the panel was dark in Day.
- **Never:** under the theme selector, behind Help, as a floating orb over content, or as a tab in the dock.

## 6. Motion

Every number below has a purpose.

| Moment | Motion | Why |
|---|---|---|
| Docked panel opens | `translateX(24px)` to 0 and opacity 0 to 1, 240 ms, `cubic-bezier(.32,.72,0,1)` | Says where it came from, the right edge |
| Docked panel closes | The reverse, 160 ms, ease-out | Closing faster than opening: the system gets out of the way |
| Phone sheet | `translateY(100%)` to 0, 380 ms on the drawer curve; it follows the finger while dragged; exit 220 ms | Matches the dock's other sheets; can be interrupted |
| Suggested asks on open | 40 ms stagger, 4 px rise, opacity only | They read as a list arriving, once per open; never on every keystroke |
| Answer arrives | 4 px rise and fade, 220 ms ease-out | Marks the new content. There is no typewriter effect: the reply is not streamed, so it must not pretend to be. |
| Waiting for a written reply | Mobi's eyes blink once every 1.6 s beside "Reading Q7, your pick and the key" | Shows real waiting with real words. No spinner, shimmer or glow. |
| Balance changes | The number crossfades in 160 ms | Shows the charge landed, without a count-up show |
| Press | `scale(.97)` on the buttons and ask rows, 140 ms | Feedback |
| Reduced motion | Fades only; no translate, stagger or blink | |

## 7. States (all designed in the mock's states board)

- **New student, no sessions:**
  - Mobi's "attentive" art (the real character, never cropped).
  - The line "Mobi answers from your own practice. After one session it can show where your marks went."
  - One outline button, "Take a 10-question check".
  - Free product asks ("How do AI credits work?", "What is NTA mode?").
- **No AI credits:**
  - A plain notice: "0 of 10 AI credits left. They reset on 1 Nov. Questions about your record stay free. Nothing is charged from here."
  - Paid rows are disabled and say "Needs a written reply". Free rows still work.
  - Written replies paused (`wallet.state === 'paused'`): the same layout and the same honesty.
- **Waiting:** described in the motion table above.
- **Reply not confirmed (network):** the existing words and the same request id. "Retry this question" can never charge twice.
- **Record not loaded:** the record chip reads "Record not loaded · Retry". Questions about a specific question still work as written replies.
- **Question could not be opened:** "That question could not be opened. You can still ask about your record." The chip drops to the record.
- **Signed out:** no change. The panel only lives in the signed-in Arena.

## 8. Packets (after the owner's yes)

Ownership is split by file, so no two packets touch the same file. Every packet has these sizes: web 390 and 1440, Night and Day; app 412, Night and Day.

**P1. Panel shell (web), Opus.**
- Files: `src/components/ai/AssistantDrawer.jsx`, `MockMobAIHub.jsx`, `prepos.css`, `AskMobiHost.jsx`.
- Work:
  - Docked, overlay and sheet forms by width.
  - Arena tokens in both themes; drop `arena-dark-island` and `#090a08`.
  - Remove the four tabs. Add the header, context row, opening, answer, composer and footer as specified.
  - Keep `send()` and its request-id and retry logic unchanged.
  - Automatic pricing through `answerFromInsights` as the student types.
  - Mode from the context.
  - Wallet line plus `announceWallet`.
  - Motion as in section 6.
- Done:
  - the mock's states reproduced;
  - a paid ask shows its price before it is sent;
  - the balance and the top bar agree after a reply;
  - Esc and focus return work.

**P2. Context and suggestions (pure), Sonnet.**
- Files: `src/components/ai/askMobi.mjs` (extend `openAskMobi({ context: { kind: 'question'|'mock'|'today'|'practice'|'page', ref, label } })`, with `questionRef` kept as an alias), a new `src/components/ai/askSuggestions.mjs`, and tests in `data/tests/`.
- Done:
  - unit tests for every kind;
  - no preview without a record line;
  - prices match `answerFromInsights`;
  - sentence case, no "!", no arrows (copy test).

**P3. Entry points (web), Sonnet.** Each change is one line or one row, and the packet coordinates with the owners of those pages:
- `src/components/recovery/RepairAsk.jsx` and the Review question detail: "Ask Mobi about Q7".
- `SessionReadout.jsx` and the result: "Ask Mobi about this mock". The mistake row's second line goes in after the D15 packet settles its one action.
- The Practice row beside Repairs: the slot comes from the D5 owner.
- Today's "Why this?": the D1-D3 Today design owns the slot.
- `AppLayoutClient.jsx`: the "Ask Mobi" nav row opens the panel (plain click; a modifier-click still goes to `/mentor`), and the orb leaves the Help door.
- `src/lib/helpDoor.mjs`: the `ask` row is removed. Coordinate with the D11 Help packet.
- Done: every entry opens the panel already scoped, at both widths.

**P4. `/mentor` page, Sonnet.**
- Files: `src/app/(app)/mentor/page.js` and the page variant of the hub.
- Work: the page becomes "Your record" (`RecordView`) plus the conversation history. Mobi's composer is on the page, and there are no tabs. It is reached from "Full record" and modifier-clicks.
- Done: deep links `?tab=record` and `?tab=ask&q=` still work. Old `?tab=plan` goes to Today, and `?tab=tools` goes to AI credits.

**P5. App parity (Flutter), Sonnet.**
- Files: `flutter_app/lib/features/insights/` (the `ask_*` widgets and screen), plus the entry points in `features/review` and `features/result`.
- Work:
  - The same contextual sheet, opened from a review or result question.
  - The same context chips and priced ask rows, using `AskCitation` for the source line.
  - The full `/ask` screen stays, with its mascot greeting.
  - Warm-charcoal Night and paper Day from `MmColors`.
- Done: an emulator walk at 412 in Night and Day, with screenshots against D6.

**P6. Verification, main session.**
- Run `npm run test:recovery` and the question and payment suites.
- Do the 390 and 1440 Night and Day walk against D6, D7, D12, D5 and W-060.
- Run the anti-slop check from section 9, then write the STATUS entry.

**Order:**
1. P2 runs first; it is about 30 minutes.
2. P1 and P5 then run in parallel, about 1½ hours each.
3. P3 follows P1 and waits on the D5, D15 and Today slots, about 45 minutes.
4. P4 runs in parallel with P3, about 30 minutes.
5. P6 takes about 45 minutes.

## 9. Checks run on the mock

- **Captures:** 12 headless captures, opened and looked at. They show web at 1440 (answered, opening, states) and 390 (sheet, entries), plus the app at 412 (sheet), each in Night and Day. No horizontal overflow at any size. The Bricolage and Hanken fonts loaded in every capture.
- **Banned list:** none present in the mock.
  - No eyebrow pills or dots, glow, neon, gradient text, icon grids or nested cards.
  - No arrows on buttons, ALL-CAPS labels, hype, emoji or build talk.
  - Nothing looks like a form: there are no tabs, segmented switch or dropdown before the first answer.
- **Numbers and time:**
  - Real numbers with denominators: 142 of 250; 11 wrong of 34 answered; 9 of 10 AI credits; 36 of 78 marks lost.
  - 12-hour time: 9:40 pm.
- **Accent:** volt only in Mobi's mark and the shell's own Start key. Night spends no other accent.
- **Accessibility:**
  - 44 px targets on Close, the ask rows and the composer button.
  - The phone sheet is a dialog with `aria-modal`; the desktop panel is a complementary region (not modal, because the page stays usable).
  - Reduced motion is respected.
- **Evidence IDs:**
  - S014 (progressive disclosure for secondary functions: the record summary sits behind its chip, never the price);
  - S016 (consistent nav, labels and selected state: one "Ask Mobi" label);
  - T001 (defaults from real context: suggested asks are built from the screen and the record);
  - the MockMob overlay rule "explain AI uncertainty and credit costs before irreversible model calls";
  - FEATURE-ADOPTION 8 and 9 (the Khanmigo rebuild put the tutor inside the problem).
- **Not verified:**
  - live behaviour;
  - real reply lengths from gpt-6-luna or Claude Haiku 5.5;
  - the docked panel's width change on real pages at 1280-1440;
  - the app sheet on the emulator.

  Those belong to P1, P5 and P6.

## 10. Questions for the owner (each with my recommendation)

1. **Direction.** Mobi lives in the work: it opens from the question, the mock, Practice and Today's "Why this?", already about that thing. Its four tabs go, and the next step stays on Today. *Recommend: yes.*
2. **Desktop form.** Should the panel dock at the right with the page still visible, or cover the page as an overlay? *Recommend docked at 1280 px and up, overlay below that.*
3. **Mobi's mark.** Should the glass orb become the flat Mobi face (the logo B "o"), with no glass and no light? *Recommend yes.*
4. **Free first answers.** When Mobi opens from Today or a result, should the free record answer already be there, with no tap needed? *Recommend yes. It costs nothing and shows value at once.*
5. **The sidebar row.** Should "Ask Mobi" stay as a Planning row that opens the panel, or leave the nav so Mobi is reached only from the work? *Recommend keeping the row. Moving things is fine; removing them is not.*
