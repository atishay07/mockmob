# DESIGN_DECISIONS: study weekdays on the account (web/weekdays-1016), 16 Oct 2026

Owner ledger L06 (study days sheet) and L39 (website features missing in the app). Until now the chosen weekdays lived only on the phone (`PhoneOnlyStudyDays`, `rhythm_days_<userId>` in the app's prefs), so a second device or the website never saw them, and the website's goal editor knew only a number.

## What the app already expected
Nothing on the server. `flutter_app/lib/features/rhythm/data/study_days.dart` says no endpoint holds the weekdays: `PUT /api/me/goal` keeps only the number (and the pause), and `PUT /api/study/preferences` keeps the Pro `weeklyPlan` (subject and minutes per day), which is a different thing. The app left a seam: `StudyDaysRemote` (`storesOnAccount`, `save(Set<int> days)`), overridden through `studyDaysRemoteProvider`. So the smallest design is one optional field on the goal the app already reads and writes. No new route.

## Contract (live once the migration and this branch are deployed)

`weekdays` is an array of integers 0 to 6, Monday = 0 (the app's own numbering, `weekdayNames[index]`), unique, sorted on the way out.

### GET /api/me/goal
```json
{ "daysPerWeek": 4, "timezone": "Asia/Kolkata", "pausedUntil": null, "weekdays": [0, 1, 3, 5] }
```
`weekdays` is `null` when the student has chosen none, or when their count no longer equals `daysPerWeek` (a goal moved by an older client). The key is always present. The app's `planFor(days, goal)` already ignores a plan whose count differs from the goal, so a `null` and a stale plan behave the same.

### PUT /api/me/goal
| Body | Effect |
| --- | --- |
| `{ "daysPerWeek": 4, "pausedUntil": null, "weekdays": [0,1,3,5] }` | Saves the goal and the days in one write. `daysPerWeek` must equal the count, else 422. |
| `{ "weekdays": [0,1,3,5], "pausedUntil": null }` | Same; the goal is the count. |
| `{ "daysPerWeek": 4, "pausedUntil": "2026-10-20" }` (no `weekdays`) | The goal alone changes. Stored days are kept while their count still equals the goal, and dropped when it does not. Every call the app makes today (pause buttons, `saveGoal`) is this shape and keeps working unchanged. |
| `{ "daysPerWeek": 4, "weekdays": null }` | Clears the days, keeps the goal. |

Response: the same object as GET, after the write. 422 `{ "error": "invalid_request", "message": "..." }` for: no goal and no days; a goal outside 1 to 7; days that are not 1 to 7 distinct integers 0 to 6 (strings, 7, -1, 1.5, repeats, `[]`, a non-array); a count that disagrees with `daysPerWeek`. 401 signed out. 503 `unavailable`. The row is the session user's only; no user id is read from the body. The pause is replaced by every PUT exactly as before (send the current `pausedUntil` back).

## What the app changes (not done here; the app tree is read-only for this task)
1. `rhythm_providers.dart`, `saveStudyDays(days)` is today: `saveGoal(days.length)`, then `studyDaysRemote.save(days)`, then the phone. With the field, the first two collapse into one request, which is also what makes the goal and the days never disagree:
```dart
class AccountStudyDays implements StudyDaysRemote {
  AccountStudyDays(this._goal);               // GoalRepository
  final GoalRepository _goal;
  @override bool get storesOnAccount => true;
  @override Future<void> save(Set<int> days) =>
      _goal.save(daysPerWeek: days.length, pausedUntil: /* the current pause, as _currentPause() */, weekdays: (days.toList()..sort()));
}
```
   Simplest: add an optional `List<int>? weekdays` to `GoalRepository.save` and the goal model, send it in the PUT body, parse `weekdays` from GET. Then `saveStudyDays` calls that once, and `studyDaysRemoteProvider` can return an implementation with `storesOnAccount: true` (the receipt then says `RhythmCopy.daysSaved`, not "kept on this phone").
2. `plannedDaysProvider`: read the account's `weekdays` first, fall back to the local `rhythm_days_<userId>` for a student who chose days on this phone before the server held them, and upload that once (a goal PUT with `weekdays`) when the server returns `null` and the local plan's count equals the goal. After that the local copy is a cache only.
3. Offline or a refused save: the server value stays; show the error line and keep the old plan everywhere (the ledger L06 acceptance check, airplane mode).

L06's ring problem (the middle number is the studied count while the ring draws `goal` segments) is app-side and not touched by this change.

## Storage
`study_goals.weekday_mask smallint` (migration `20261016110000_study_weekdays.sql`, undo `supabase/undo/20261016110000_study_weekdays.undo.sql`): bit 0 = Monday ... bit 6 = Sunday; Mon, Tue, Thu, Sat = 43. Null = none chosen. A check keeps it between 1 and 127. Chosen over an array so the table can state the range, and over a cross-column "count equals goal" check on purpose: an older deploy that writes only `days_per_week` must never be refused by the database, so agreement is enforced in code on write and on read (`src/lib/studyWeekdays.mjs`).
Production read-only look (16 Oct): `study_goals` has the five original columns and 0 rows, so the migration backfills nothing and changes no row. Staging (`onwkqxmjqjrhfbjjdydu`): applied, applied again, undone and re-applied cleanly; the table was left with the column.

## Website
Account > Weekly goal (`GoalControl`) is now seven weekday chips, Monday first, instead of a 1 to 7 number row. The goal is the number of chips picked and the line under them says it ("4 study days and 3 rest days. You study Mon, Tue, Thu and Sat."). It reads and writes the same `/api/me/goal` value the app uses.
- A goal held without days (set in the app before this) shows "Your goal is 3 days a week. Choose which days." with no chip lit; Save stays closed until the student picks days. Picking any number of days changes the goal to that number.
- "Saved" is said only after the server answered with the goal and the same days. A server that keeps the number but not the days (an older deploy) gets the existing "We could not confirm" line, not "saved".
- A pause set in the app is sent back with every save, as before. The onboarding days step still sends only a count (4 by default), so it keeps any chosen days that still match and drops them when the count differs.
- The rhythm card on Today reads `daysGoal` from the same goal, so the ring and the chips always agree.

## Verification (16 Oct, this branch)
- `node --test data/tests/study_weekdays.test.mjs` (11 tests: parse and refuse, mask round trip, goal and days decided together, keep and drop rules, migration twice and undo on PGlite, the full save flow against the table, own rows only, route and store source checks); `you_account`, `onboarding_first_run`, `app_prefs_database`, `app_rhythm`, `account_deletion`, `rhythm_view` still green. `npm run lint` on the changed files is clean.
- Gate still to run: the chips at 390 and 1440 in Night and Day (no dev server was started here, RAM), with a signed-in fixture through `/preview/arena` (its goal fixture now echoes `weekdays`).

## Deployment order (main session, under the owner's grant)
1. Apply `supabase/migrations/20261016110000_study_weekdays.sql` to production (additive, no row changes). 2. Deploy this branch. Old code ignores the column; new code against an unmigrated database still reads goals (the column is read with `select *`) but a save carrying `weekdays` would fail with 503, so step 1 comes first. Undo order is the reverse: roll the code back, then run the undo file.
