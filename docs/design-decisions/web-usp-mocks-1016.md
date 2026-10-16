# Unlimited fresh papers on the signed-in website (16 Oct 2026)

Branch `web/usp-mocks-1016` (from `deploy/batch-1016c`). Not pushed, not deployed.

## User task and the owner's ask

The owner's headline difference (16 Oct): MockMob has one central question bank, so a student can take as many mocks as they want, where other sites sell a fixed 10 to 30 mocks per subject. He wants everyone to know it, without it being "in the face", and without naming anyone else.

What a student needs to decide is simple: can I take another paper, will it be new, and what will it cost me. Each surface below answers that once, where the decision is made, in one quiet sentence. There are no banners, badges, eyebrows or hype words.

## Code facts behind every claim

Every sentence is in `src/lib/paperCopy.mjs`. It is pure, so `data/tests/paper_copy.test.mjs` (in `test:app`) checks the words and also the code rules that make them true. If a price, the recency rule or the selector changes, that test fails before the copy goes stale.

| Claim on screen | Where the code makes it true |
| --- | --- |
| There is no fixed set of mocks; each paper is built when you start it | `startPractice` builds the question set at launch (`src/lib/server/practiceSessions.js` 48-52). It calls `Database.getQuestions` → `selectPracticeQuestions` (`data/practice_pick.js`), or `getNtaPaper` → `buildNtaPaper` (`data/nta_engine.js`). No stored list of mocks exists. |
| No cap on how many you take | `startPractice` counts no papers per day or per subject. The only guard is a 60-requests-a-minute abuse limit on `/api/sessions` (`src/app/api/sessions/route.js` 19). The test asserts that no paper-count limit exists. |
| Pro covers every paper | `p_credit_action: user?.isPremium ? null : mode.creditAction` (`practiceSessions.js` 81), and the device path at line 89. |
| On Free each paper uses practice credits: 10 for Quick practice, 50 for a Full mock | `TEST_MODES.quick.creditCost = 10`, `TEST_MODES.full.creditCost = 50` (`data/test_modes.js` 12, 50). The atomic spend is `Database.spendCredits` (`data/db.js`). Smart practice and NTA mode need Pro (`practiceSessions.js` 36). |
| Questions you have not answered come first | Quick, Full and Smart: `rankCandidates` sorts unseen ahead of seen (`data/mock_question_selector.js` 62). This happens inside the evidence tier, which is sorted first (line 61). Questions from the student's last 3 (Quick) or 5 (Full, Smart) sessions in that subject are also left out while at least 70% of the paper can still be filled (`data/practice_pick.js` 106-112, `test_modes.js` recencyLimit). NTA mode: `seenPolicy: 'seen_first'` (`data/nta_engine.js` 1488), with seen questions read by `loadSeenQuestionIds` (`data/nta_pool.js` 218). |
| An NTA paper leaves out your earlier NTA questions while the bank allows, and names any repeat | `const fresh = pool.filter((row) => !previous.has(row?.id))` (`nta_engine.js` 1511), with earlier papers from `loadPreviousNtaPaperIds` (`nta_pool.js` 240). The notice line is "N questions repeat from your earlier NTA papers" (`nta_engine.js` 1283). |
| NTA mode uses only the questions that meet its quality bar | `NTA_MIN_SCORE = 8` (`nta_engine.js` 45). The public counts do not give this subset, so NTA lines never present the whole bank count as the NTA pool. On Practice the count shows in brackets as "the full bank holds N". |
| "1,404 Accountancy questions in the bank", "a live bank of 8,197 questions" | `/api/stats` → `publicInventory()` (`src/lib/server/inventory.js`). This is the stored daily count of questions that pass the same publication and family-hold policy as practice. Live values on 16 Oct (checked 15 Oct 21:57 UTC): bankSize 8,197; accountancy 1,404, economics 466, business_studies 422, english 382. Loading or failed counts are never written as 0; the sentence drops the number. |
| New accounts start with 100 practice credits; an approved upload adds 15 | `credit_balance: 100` (`data/db.js` 348); `v_amount INTEGER := 15` in `grant_contribution_credits` (`supabase/migrations/0027_enforce_credit_integrity.sql` 136). |

What is never said, and why:

- "Never repeats": the code does not guarantee it. A small bank or a long run of papers brings back questions the student has answered. The pricing FAQ says so, and NTA mode names the repeat on the paper.
- "Unlimited" on Free: Free pays credits per paper. The test bans "unlimited" in every line from `paperCopy.mjs`. The Pro card keeps its existing, true "Unlimited Quick practice and Full mocks".
- Competitor names or their mock counts.

## The surfaces

1. **Practice, Mode step** (`src/app/(app)/dashboard/DashboardPageClient.jsx`, `practice.css`)
   - Full mock spec: "50 questions, 60 minutes, a new paper every time".
   - NTA mode spec: one sentence added, "Each paper leaves out your earlier NTA questions while the bank allows."
   - Under the list, one line in the spec ink: "Every paper is built fresh from the 1,404 Accountancy questions in the bank, questions you have not answered first. There is no cap on how many you take, only the practice credits each one uses." Pro drops the credit clause. NTA mode switches to its quality-bar wording. The count follows the chosen subject.
   - It is not a card and has no icon (S017, S018: intent over decoration). The price stays in each mode's row, where the decision is made (T008, T009: clear price at the point of choice).
2. **Result page, after the repair work** (`src/app/(app)/result/[id]/ResultPageClient.jsx`, `src/components/recovery/result.css`)
   - "Take another fresh paper" sits as a hairline-ruled closing section above the record links. It never sits above the Mistake Lab, because repair is still the first next step (AGENT_RULES rule 7: one main action per screen).
   - It has one outline action, "Set up another Full mock" (or Quick practice, NTA mode, Smart practice, or "paper" for older attempts without a mode). The action opens Practice with the same subject and mode already chosen, and Quick keeps its count. It does not start a paper or spend credits; the price appears on Practice before Start (rule 18: say what happens next; T007 and T009: specific action wording).
   - The price line follows the plan. Pro: "Pro covers every one". Full mock on Free: the shared spend line, "A Full mock uses 50 practice credits. You have 40." (`src/lib/creditCopy.mjs`). Quick on Free: "Practice shows the price before it starts", because today's included 10-question set can make it free and only the server quote knows that. NTA and Smart on Free: "needs Pro". This follows rule 23: no unbacked fixed quote.
3. **/pricing** (`src/app/pricing/page.js`)
   - One sentence under the lead: "There is no fixed set of mocks: each paper is built when you start it, from a live bank of 8,197 questions, questions you have not answered first. Pro covers as many as you take; on Free, each one uses practice credits."
   - The Free list now names the real costs (10 and 50 practice credits) and adds "Every paper built fresh from the live question bank".
   - On Pro, "each a fresh paper" is added to the unlimited line, and NTA mode gets "as many papers as you take".
   - Comparison: a "A fresh paper each time, questions you have not answered first" row, included on both plans.
   - How Free works: "New accounts start with 100 practice credits. Each question you upload that passes moderation adds 15."
   - FAQ: "How many mocks do I get per subject?" The answer states the rule, the costs, and that repeats can happen. Money stays honest: no invented reference price, no urgency (T006, T009, rule 19).
4. **Onboarding, subjects step** (`src/app/onboarding/OnboardingPageClient.jsx`)
   - Lead: "Pick up to 5. Each mock in a subject is a fresh paper from its question bank. You can change them any time."
   - Each subject tile adds its bank count, for example "1,404 questions", beside its chapters. Real data at the point of choice (rule 9), left out when unknown.
   - No step was added (the owner rejects 5-question onboarding).

## Alternatives considered

- **A banner or highlighted card on Practice:** rejected. It is "in the face", it nests a card inside the step, and it repeats the price. (S017, owner's 16 Oct words.)
- **A "Never the same paper twice" headline:** rejected as untrue (see above).
- **Putting the next-paper block in the result hero:** rejected. It would compete with "Repair Q12 first", the page's main action.
- **Fetching NTA-eligible counts per subject for the Practice line:** rejected. It needs a bank read per request. The full bank count is given in brackets instead.

## Verification

- Headless Chrome (own profile, never visible) against `next dev --webpack -p 3160` on `/preview/arena`. `/api/stats` was answered with the saved live counts so the real numbers show.
  - Practice: 390 Night (Full mock selected, Free) and 1440 Day (NTA selected, Pro).
  - Result: 390 Night Free, 1440 Night Pro, 1440 Day Pro.
  - Onboarding: 390 Day and 1440 Night.
  - /pricing: 390 Night and 1440 Day. Locally the server has no inventory, so the sentence correctly shows no number.
  - Screenshots were looked at: no overlap, no layout shift, a 44 px target on the new action, and no horizontal scroll at 390.
- `npm run lint`: clean. `test:app`: 352 pass (includes the new `paper_copy.test.mjs`). `test:billing`: 87 pass. `test:recovery`: 356 pass. `npx next build --webpack`: built.

## Anti-slop check (12 parts) and rubric notes

No eyebrow pills or dots, glow, gradient text, icon grids, nested cards, arrows on buttons, ALL-CAPS labels, hype, or exclamation marks. No em dashes or middle dots in the new copy (enforced by test). Units sit beside counts. Unknown is never 0. One accent, with tokens from the existing arena system, so Night and Day both work. Rubric (0/1/2), self-scored, for the owner to sign off:

| Dimension | Score |
| --- | --- |
| Hierarchy | 2 |
| Truthfulness | 2 |
| Copy | 2 |
| States (loading, unknown, Free, Pro, NTA, older attempts) | 2 |
| Accessibility (role=note, 44 px, focus inherited from btn-outline) | 2 |
| Motion | 1 |
| Evidence | 2 |

Motion scores 1 because the press sink is the only motion added (`mk-press`), and none was needed.

## Open points

- The pricing page reads the stored inventory row on each request through `publicInventory()`, which is memoised. That does not happen in local dev, so the bank number was checked only by unit test and the live `/api/stats`.
- Older attempts store no `selectionMeta.mode`, so the result action says "Set up another paper" and opens Practice on the subject only.
