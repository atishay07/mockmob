# The smart layer behind the daily goal (H1), specification

19 Oct 2026, pass 1019 PM, item C (H1). Specification only: nothing here is built or committed.

**His words (OWNER-FEEDBACK-2026-10-19.md, after 3:05 pm):** "The entire smart layer around it should actually be smart, analyzing the entire patterns of the user: what they want, what they don't want. It should actually feel intelligent." And: "If someone wants to attempt 2 mocks a day and they want to take 2 hours, then we should not be stopping them."

**Binding rules:** R1-R8 (PLAN-1019 section 0); AGENT_RULES 17 ("make progress truthful") and 24 ("claims of personalization must correspond to actually functioning system logic and known limits"); runtime AI only gpt-6-luna or Claude Haiku 5.5, inside USD 25 a month; never cap a motivated student.

Bases read: app `ui/v15.3-1019` at 4472b373 (wt-v15-3), web main 4af47969 (wt-rel11), staging Supabase onwkqxmjqjrhfbjjdydu (SELECT only, 19 Oct about 5 pm).

---

## 1. What we record today

### 1.1 On the server (staging counts, 19 Oct)

| Signal | Where | What it holds | Usable? |
|---|---|---|---|
| Papers (practice and mocks) | `public.attempts` (116 rows, 24 users) | `completed_at`, `subject`, `total`, `correct/wrong/unattempted`, `details` (qid, givenIndex, isCorrect; **no per-answer time**), `selection_meta` | Yes: the backbone |
| Session start | `attempts.selection_meta.client.startedAt` (epoch ms), written by the app (`core/sync/session/session_submitter.dart:98`, `startedRefWallMs`) and the web runner (`src/lib/runnerCapture.js:98`) | Wall-clock start | Partly: only **41 of 116** staging attempts carry it (27 of 92 quick, 14 of 24 full); older papers do not |
| Mode | `attempts.selection_meta.mode` | `quick`, `full` (also `smart`, `nta` by the API) | Partly: **chapter practice is sent as `quick`** (`practice_selection.dart:21`, `apiMode`), so the server cannot tell chapter from quick |
| Mob paper | `selection_meta.mobPaper`, `selectionStrategy = mob_paper` (68 staging rows) | A paper played with the Mob | Yes |
| "Tonight" flag | `selection_meta.tonight` | The first move put off to tonight | Yes, rare |
| How it ended | `selection_meta.endedBy` | `submit` only on staging | Weak |
| Weekly goal | `public.study_goals` (9 rows): `days_per_week`, `weekday_mask`, `paused_until`, `timezone`, `exam_date`, **`mock_target` (null everywhere, unused)** | Study days per week, 1 to 7 | Yes |
| Goal history | `public.study_goal_history` (`effective_week`, `days_per_week`) | Each goal change | Yes |
| Weeks and streak | computed, not stored: `src/lib/server/rhythm.js` `computeRhythm` (study day = a paper with at least `MIN_ANSWERED` 5 answers; `weeksMetStreak`) | Weeks at goal | Yes, read through `/api/me/rhythm` |
| Reminder window | `public.notification_prefs.study_window` (8 rows, all `20:00-21:00`, the onboarding default), `timezone`, `weekly_cap` | The time the student **said** | Stated, not observed |
| Revise / Score Recovery | `public.revise_cards` (`box`, `due_day`, `right_total`, `last_recalled_day`, `wrong_at`, `mode`); `public.recovery_sessions` (live sessions, 0 rows; `created_at`, `expires_at`, `mode`, `events`) | Mistakes held, checks due, recall | Yes |
| Usage events | `public.usage_events` (**0 rows**), consent in `public.usage_consent` (1 of 8 allowed) | `session_started`, `session_submitted`, `next_move_dismissed`, `goal_set`, ... | **No.** `src/lib/server/usage.js:14` accepts events only when `age_band === 'adult'`. Our students are 16-17, so this table will stay nearly empty for them by design. The smart layer must not depend on it |
| Ask Mobi | `mentor_sessions`, `mentor_messages` (web `src/app/api/ai/mentor/chat/route.js:150-160`); `runtime_ai_requests` (0 rows) | Chats and their cost | Server-side only; **the mentor tables are not in the staging public schema**, so nothing to read there today |
| Study runs (Learn) | `public.study_runs`, `study_events`, `study_card_states` (0 rows on staging) | Learn cards | Later |

### 1.2 On the phone (Flutter, Drift and prefs)

| Signal | Where | Kept for |
|---|---|---|
| Daily minutes chosen in onboarding (10/20/30) | `features/onboarding/model/answers.dart` (`minutes`; **`fromJson` throws away any value not in `[10, 20, 30]`, line 284**); `sheet_sync.dart:57-60` says minutes "stay on the phone" | Life of the sheet |
| Study days and stated window (Early 6, Afternoon 17, Evening 20, Late 22) | same sheet (`days`, `window`; `model/choices.dart:56`), days synced to `/api/me/goal`, window to `/api/me/notification-prefs` | Life of the sheet |
| Per-answer events incl. `away` and `back` | Drift `AnswerJournal` (`core/storage/tables.dart:8`, types visit/answer/mark/strike/away/back/end) | **Deleted after submit** (`session_journal.dart:196`) |
| Session start, end | `SessionDrafts` (`endsAtMs`), `startedRefWallMs` in the submitter | Until submit |
| Today deck: Up next / Not now | `DeckMemory` in prefs key `today_deck_memory` (`features/today/logic/suggested_deck.dart:430`): pass days per card kind, 7-day window, a kind sinks after passes on 2 days | 7 days |
| Today "Not today" | Drift `Dismissals` (kind, subject, chapter, `expiresAtMs`) | Until expiry |
| Length chosen on Today | `TodayMinutes` (`features/today/data/today_providers.dart:48`) | **Memory only, reset each day** |
| Repairs | Drift `RepairLocal` (status, `ackedAtMs`), `ReviewLog` (`atMs`, kind) | Until cleared |
| Papers | Drift `CachedAttempts` (`completedAtMs`, full JSON incl. `selection_meta.client.startedAt`) | Cache |
| Weekly celebration state | Drift `RhythmSeen` | Life |
| Analytics queue | Drift `AnalyticsQueue`, events listed in `core/analytics/event_allowlist.dart` (sessionStarted fired in `practice_starter.dart:298`, sessionSubmitted in `runner_effects.dart:63`, nextMove* in `today_providers.dart`, repair* in `repair_run.dart`, goalSet in `you/goal/goal_screen.dart`) | Sent only with adult consent, see above |

**What nobody records today:** a durable per-session log of start time, active minutes (start to end minus away), the real mode (chapter vs quick), where the session came from (Today card, Practice, Mob, a reminder), whether the student finished or left it, and the length he picked versus the one we suggested. That gap is what the first slice closes, on the phone.

---

## 2. The design

### 2.1 Principles

1. **Rules first, on the phone.** A pure Dart model, `StudyPattern`, built from a local log and the student's own papers. No AI, no new server table in the first slice, no dependency on usage events.
2. **Every sentence is a computed fact.** Each insight has a template, a firing rule and the numbers it prints; a test recomputes the numbers from the raw log (the "claim auditor", section 2.8). If a rule does not fire, the sentence does not appear.
3. **Thin data says so.** Below the minimum, the app says it is still learning and uses the student's own goal as the baseline.
4. **Suggest, never impose.** The layer changes defaults and order. It never lowers a goal by itself, never removes a card the student can reach (R3), never blocks more practice.
5. **Never cap.** Meeting the goal turns Today into "Goal met. Keep going?" with the next best move one tap away. There is no "enough for today" lock.
6. **The student can correct it.** Each insight carries "Not quite right?", which forgets that one learned fact and lets him say what is true.

### 2.2 The local study log (new)

One entry per finished or abandoned session, per user, in prefs (same pattern as `DeckMemoryStore`), at most 300 entries and 56 days, cleared on sign-out and account deletion with the other per-user stores.

```
StudyLogEntry {
  startedAtMs        // startedRefWallMs
  endedAtMs          // submit or abandon time
  activeMs           // end - start minus the away-to-back gaps from AnswerJournal, read before the journal is deleted; capped at the paper's limit
  mode               // quick | chapter | smart | full | nta | repair | revise | mob   (the app's PracticeMode name, not apiMode)
  subject
  questions          // paper length
  source             // today_lead | today_deck | practice | mob | reminder | result_next | record (backfilled)
  suggestedMinutes   // what Today offered, null if not from Today
  chosenMinutes      // what he picked
  finished           // submitted vs left / timed out / "Finish for now"
}
```

Plus one small map of deck reactions with longer memory than `DeckMemory` (kind -> list of `{day, picked|passed|dismissed}` for 28 days). `DeckMemory` keeps its 7-day sink rule unchanged.

**Backfill so a heavy account is not "new" on a new phone:** on first build, every cached paper with `selection_meta.client.startedAt` becomes a `record` entry (start, `completed_at`, mode from `selection_meta.mode`, `activeMs` = end - start capped at the paper's limit, `finished` true). Papers without a start give time of day only (from `completed_at`), never a length. Mob papers count with `mode = mob`.

**Hook points:** `runnerAfterSubmitProvider` (`features/runner/data/runner_effects.dart:57`) for papers; `repair_run.dart` (repairCompleted) for repairs; `recap_flow.dart` / `practice_result_screen.dart` (finishForNow) for "left early"; `today_providers.dart` (nextMoveStarted, nextMoveDismissed, the deck's Up next and Not now) for reactions; `TodayMinutes.choose` for the length picked.

### 2.3 What we learn, the minimum before any claim, and how it fades

All weights decay with a **half-life of 14 days** (`w = 0.5^(age_days / 14)`); entries older than 56 days are dropped. "Sessions" below means log entries with `activeMs` of at least 3 minutes (a peek is not a session). Times are IST day and hour, like `DeckMemory.dayOf`.

| Fact | How it is computed | Minimum before we say it | Notes |
|---|---|---|---|
| **Usual session length** | Weighted median of `activeMs` over finished sessions, rounded to the nearest 5 minutes | 5 sessions on at least 3 different days in the last 28 days, and the middle half (25th-75th percentile) within plus or minus 50% of the median | If the spread is wider, say a range ("between 15 and 45 minutes"), never one number |
| **Usual time** | Weighted share of session starts in each window (Early before 12, Afternoon 12-17, Evening 17-21, Late 21 onward), and the weighted median start time inside the top window, rounded to 15 minutes | Same 5 sessions on 3 days, and the top window holds at least 60% of the weight | Below 60%: "irregular", which is a fact we can say too |
| **Study days** | Days with a session per weekday | 3 full weeks of data | Slice 2 |
| **Preferred mode** | Weighted share of modes among sessions the student chose himself (`source = practice`, or a deck card he swiped to) | 4 self-chosen sessions, and one mode at 50% or more | Today-lead sessions do not count: they show what we offered, not what he wants |
| **Subject he avoids** | A subject he chose in onboarding with no session in the last 14 days, while he did at least 6 sessions in other subjects in that time | As stated | Never said in the first 14 days of an account |
| **Cards he ignores** | A deck kind passed or dismissed on at least 3 different days in the last 14, and never picked | As stated | Sinks to the back, and we stop leading with it for 7 days |
| **Cards he likes** | A kind picked on at least 3 different days in the last 14 | As stated | Rises to just after the recommended card |
| **Goal fit** | Minutes done per study day (sum of `activeMs`, plus papers with a start from the website) against the daily goal | 7 days since the goal was set and 4 study days | Drives the goal suggestions below |
| **Longer when he can** | `chosenMinutes > suggestedMinutes` on at least 3 of his last 5 Today sessions | As stated | Raises Today's default length |
| **Shift** | The last 7 days' median length or top window differs from the 28-day model by more than 50% / a different window, with at least 4 recent sessions | As stated | The decay already follows him; this only changes the copy to "lately" |

**Never inferred:** mood, ability from time spent, anything about other students, anything from Ask Mobi text. Ask Mobi use is not a pattern input in either slice (no claim is worth reading a minor's chat for); only "has opened Ask Mobi at least once" may decide whether a deck card introduces it.

### 2.4 How it changes Today and the goal

**The daily goal (H1, with the More path from PLAN-1019-PM):** the goal becomes **daily minutes** (10, 20, 30, plus More: 1 hour "a full mock a day", 2 hours "two full mocks", or a custom amount). Custom accepts any whole number of minutes from 5 to 999 (three digits, longer than a waking day, so it is input hygiene, not a cap). Above 4 hours the step shows one calm line, never a block: "That is a big day. Short breaks between papers help the marks stick." The study-days goal on the server stays as it is (it drives the weekly streak); minutes stay on the phone in slice 1 and move to the server in slice 2. `OnboardingAnswers.fromJson` must accept the new values (today it resets anything outside 10/20/30 to 20, which would silently undo a custom goal).

**Today's default length** (replaces the fallback `i.plan?.minutes ?? 10` in `move_builder.dart:746` and the `preferred` passed to `_pick`):
1. If the student picked a length today, that wins (unchanged).
2. Remaining goal today = goal minus minutes done today. If zero or less, the goal is met: the hero keeps a real move and the overline reads "Goal met. Keep going?".
3. With a usual length known: default = the chip nearest to `min(remaining, usual length)`; if the remaining goal is more than 1.5 times the usual length, the plan is "two blocks" and the line says so.
4. With "Longer when he can": one chip longer than step 3.
5. Goals of 60 minutes or more on a study day with at least one full mock in the last 14 days (or the "a full mock a day" choice): the lead is a full mock, as the full-mock hero already renders it.
6. Thin data: default = the chip nearest the goal (10, 20 or 30), capped at the remaining goal.

**The Suggested deck:** existing rules first (the recommended card, then the weakest chapter, then the rest; `DeckMemory` 7-day sink). Then: cards he likes rise; cards he ignores sink and are not the lead for 7 days; one "subject you have not touched" card may enter at position 2 (it uses the existing card format); if he passes that card on 3 days, it leaves the deck for 7 days and the "avoid" fact stays silent for 14. Preferred mode decides which practice card a tie goes to. The deck never gains or loses a card the lead could not swap to except the two new kinds below, and nothing reachable disappears (R3).

**Two new deck cards (existing card format, no new layout):**
- **Raise the goal:** fires when he did at least 1.25 times his goal on 5 of his last 7 study days. Up next sets the new goal (rounded to 5 minutes); Not now is respected for 14 days.
- **A goal that fits for now:** fires when he met the goal on at most 1 of the last 7 study days, two weeks running. It offers a smaller goal with "Keep my goal" as the equal choice. It never fires in the first 14 days and never lowers anything without a tap.

**Reminder time (slice 2):** when the usual time is known and differs from `notification_prefs.study_window` by more than 45 minutes, offer to move the reminder to 15 minutes before his usual start.

### 2.5 The exact copy (R6, his voice: full sentences, plain, persuasive; read aloud)

Placeholders: `{m}` minutes rounded to 5, `{t}` a time like "9:30 pm", `{w}` a window plural ("mornings", "evenings", "nights"), `{n}` a count, `{s}` a subject name, `{g}` goal minutes. Each line is shown only when its rule in 2.3 holds. "I" is Mobi, as elsewhere in the app.

**Where they appear (no new layout in slice 1):** the Why sheet (`today/screens/why_sheet.dart`), the length panel's line under its title (`widgets/length_pill.dart`), the hero's meaning line, and the deck cards' evidence line.

**Thin data (the baseline):**
- 0 sessions: "I'm still learning how you study. For now, tonight's plan follows your {g}-minute goal."
- 1 to 4 sessions: "I'm still learning how you study. After {n} more sessions, I'll plan around your real times." (n = 5 minus sessions)
- Enough sessions but no strong pattern yet: "You have studied at different times this week, so tonight's plan stays at your {g}-minute goal."

**Length and time:**
- Usual length and time both known: "You usually practise about {m} minutes after {t}, so tonight's plan is {m} minutes."
- Known only in a range: "Your sessions run between {a} and {b} minutes, so tonight's plan starts with {m} and you can keep going."
- Two blocks: "You usually practise about {m} minutes at a time, so your {g}-minute goal is planned as two sittings."
- Irregular: "Your study times change a lot, so I'll keep each plan short and easy to start."
- Shift: "Lately you practise in the {w}, so the plan now fits around that."
- Longer when he can: "You often choose a longer session than I suggest, so tonight's plan is {m} minutes."

**Goal:**
- Met: "Goal met. Keep going?" (overline) and "You have done {d} minutes today. Every extra paper still counts." (meaning)
- Progress: "{d} of {g} minutes done today. {r} to go."
- Raise card, title: "Make {m} minutes your daily goal?" line: "You have done about {m} minutes on {n} of your last 7 study days."
- Fit card, title: "Try a {m}-minute goal for now?" line: "Your {g}-minute goal has been hard to reach lately. A smaller goal you meet beats a big one you miss. You can raise it again any time."
- More path, line under 1 hour: "One full mock a day, timed like the real exam." Under 2 hours: "Two full mocks a day, for students who want to go all out."
- Over 4 hours: "That is a big day. Short breaks between papers help the marks stick."

**Modes and subjects:**
- Preferred mode (Why sheet): "You pick {mode} most often, so it comes first when nothing else is more urgent."
- Avoided subject card, title: "{s} has been waiting {n} days." line: "You chose {s} for CUET but have not practised it for {n} days. Ten questions keep it fresh."
- Card he ignores (Why sheet, after it sinks): "You have passed on {kind} a few times this fortnight, so I've moved it to the back."

**Correction (every insight):** "Not quite right?" opens: "Tell me what's true and I'll forget this." with "I usually study at another time", "My sessions are longer or shorter", "Show me this again" (each forgets that fact and resets its counts; the first two ask one plain question).

### 2.6 Privacy

- The log, the deck reactions, the learned facts and the minutes goal stay **on the phone** in slice 1, per user id, and are wiped with the other per-user stores on sign-out and account deletion.
- The only server data read is the student's own papers, which the app already fetches.
- Nothing new is sent. Usage events stay as they are (adult consent only); the smart layer never needs them.
- Slice 2 moves only `daily_minutes` to the server (his goal, which he typed), so the website can show the same goal. The log itself stays local unless a later, separate decision adds opt-in sync.
- Slice 2 adds "What MockMob has learned about you" in You: every fact in plain words with "Forget this" and "Forget everything".

### 2.7 AI

Not needed. Every sentence above is a template filled from computed numbers. If AI is ever added, the only fitting use is a weekly reflection on the week-ending page phrased by Claude Haiku 5.5 (or gpt-6-luna) from the computed facts only (no chat text, no raw log), with the template as the fallback, metered through `runtime_ai_requests` and capped by `runtime_ai_budget` inside the USD 25 a month runtime budget. Price it from `runtime_ai_prices` before switching it on; it needs the owner's yes (paid step).

### 2.8 Testing it truthfully

**Pure unit tests** on `StudyPattern` and the copy, with a fixed clock (19 Oct 2026, 10 pm IST) and three fixture logs plus edge fixtures, in `test/features/today/study_pattern_test.dart`:

| Fixture | Shape | Must say | Must not say |
|---|---|---|---|
| `new` | 0 sessions, goal 20 | "I'm still learning how you study. For now, tonight's plan follows your 20-minute goal." | Any time, length, mode or subject claim |
| `new_three` | 3 sessions on 2 days | "...After 2 more sessions, I'll plan around your real times." | Usual length or time |
| `regular` | 21 sessions over 4 weeks, 18 of them starting 9:15-10:15 pm, active 35-45 min, mostly chapter practice and repairs, Economics chosen but untouched for 16 days, goal 30 met 6 of 7 days at about 40 | "You usually practise about 40 minutes after 9:30 pm, so tonight's plan is 40 minutes." The raise card at 40. The Economics card at position 2 with "16 days" | The fit card |
| `irregular` | 14 sessions in 4 weeks, starts spread over mornings, afternoons and nights (no window over 45%), 5-70 min | "Your study times change a lot, so I'll keep each plan short and easy to start." or the range line | A single usual time or a single length |
| `shifted` | `regular` 30-40 days ago, then 6 morning sessions in the last 9 days | "Lately you practise in the mornings, ..." | "after 9:30 pm" |
| `heavy_backfill` | 60 cached papers, 25 with `client.startedAt`, no local log | Length and time from the 25; time of day from all 60 | A length from papers without a start |
| `away_time` | One 50-minute wall-clock session with 20 minutes away | activeMs = 30 minutes | 50 |
| `midnight` | Sessions starting 11:50 pm IST | Counted on the IST day they started, window Late | |
| `motivated` | Goal 120, two full mocks a day | Lead is a full mock; after both, "Goal met. Keep going?" with a real next move | Any cap or stop |

**The claim auditor:** a test helper that, for any log and any emitted insight, recomputes the printed numbers from the raw entries with an independent, naive implementation and fails if they differ; plus a property test over 500 random logs asserting that no insight fires below its minimum and that every number printed is the rounded computed value.

**Goldens:** the Why sheet and the length panel for `new`, `regular` and `irregular` at 360 dp, Night and Day.

**Device truth (R1, R2, R5):** emulator walk on a brand-new staging student (the thin-data lines, then 5 short sessions on 3 days are not practical in one walk, so the heavy path uses a **debug-only fixture switch** in profile builds, `--dart-define=MM_PATTERN_FIXTURE=regular|irregular`, compiled out of release builds), then the seeded heavy account (backfill path). R2 line for each touched screen. No new motion in slice 1; if the length pill's number roll changes default, check its frames against build 9 (R5).

---

## 3. The split

### First slice (one agent, one session, app only, no server or database change)

1. `features/today/logic/study_log.dart` and `study_pattern.dart`: the entry, the prefs store (per user, 300 entries, 56 days, wiped with the other stores), the backfill from `CachedAttempts`, and the pure model with every threshold in 2.3 except study days.
2. Recording: the submit hook (with active time from the journal before it is deleted), repairs, finish-for-now, deck reactions, the length picked.
3. Goal minutes: `OnboardingAnswers.minutes` accepts 5 to 999 (fix `fromJson`), the You > goal screen edits minutes as well as days (existing editor, values only), and progress for today. The **More chooser in onboarding step 6 is a layout change**: it ships in this slice only if the owner has picked its mock-up (R8); otherwise the slice keeps the 10/20/30 chips and everything else still works with a custom goal set from You.
4. Today: the default-length rules in 2.4, "Goal met. Keep going?", the deck rise/sink and the three new deck cards (raise, fit, untouched subject), all in existing components.
5. Copy: every line in 2.5 in `features/today/copy_pattern.dart`, with the correction sheet ("Not quite right?") reusing the existing sheet component.
6. Tests: the fixtures, the claim auditor, goldens; then the emulator walk (fresh, fixture, heavy), R2 lines, R4 side by side with build 9.

Truthful insights this slice can say: the thin-data baseline lines; usual session length (or its range); usual start time and window, or "irregular"; "lately" shifts; longer-than-suggested; goal progress and "Goal met. Keep going?"; raise-the-goal and fit-for-now; a chosen subject left untouched for N days; a card he keeps passing on; his most-picked mode.

### Later slice

- Server: `study_goals.daily_minutes` (new column) and use of the existing `mock_target`, `/api/me/goal` read/write, web parity on Today; an owner yes before the production migration.
- Reminder time suggestion (writes `notification_prefs.study_window` through the app's normal PUT).
- Study-days pattern ("You study most on weekends") once 3 weeks of data exist; suggested study days for the weekly goal.
- "What MockMob has learned about you" in You, with Forget (layout: mock-up first, R8).
- Week-ending reflection on `weekly_ending_page.dart` from the facts (template; Haiku 5.5 phrasing only with his yes).
- Mob-aware planning ("Your Mob usually plays at 9 pm") after B ships.
- Send `chapter` as its own mode (or `selection_meta.practiceMode`) so the server can tell chapter from quick; per-answer `timeMs` in `details` if pacing insights are wanted.

---

## 4. Not verified

- No code was run and nothing was built; thresholds are proposals to tune on real students.
- Staging data is mostly test-bot papers (median 1 minute), so no real pattern was observed; the fixtures above are synthetic.
- Production tables were not read (not allowed). The mentor tables are absent on staging, so Ask Mobi storage was read from code only.
- I did not open the onboarding step 6 screen or the Why sheet on a device for this spec.
