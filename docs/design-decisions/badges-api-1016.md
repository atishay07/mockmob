# Badges API (app and website, 16 Oct 2026)

Branch `web/revise-events-1016`. One server list of the 16 badges from `app-you-1016.md` section 3.2, read by the app and the website, so both show the same badges, dates and words. The website badges page (`wt-w2e`) reads this file.

## Contract

`GET /api/me/badges`

- **Auth:** the signed-in student only (`auth(request)`: web session cookie or the app's bearer token). Own rows only: the user id comes from the session, never from the request. No query parameters, no body. No session: `401 {"error":"Unauthorized"}`. A read failed: `503 {"error":"unavailable"}` (nothing partial is ever returned).
- **Caching:** `Cache-Control: private, max-age=60` and a weak `ETag` over the body; a matching `If-None-Match` gets `304` with no body. The server also keeps the finished answer per student in memory for 5 minutes. A badge once earned is never taken back, so a stale answer can only be missing a very new badge, never show a wrong one.
- **Order:** always the 16 badges below, in shelf order (papers, repairs, rhythm, best). Every id is always present, earned or not.

```json
{
  "version": 1,
  "generatedAt": "2026-10-16T09:30:00.000Z",
  "total": 16,
  "earnedCount": 7,
  "bestRunEndedWeek": "2026-10-05",
  "unavailable": [],
  "badges": [
    {
      "id": "first_scored_session",
      "path": "papers",
      "name": "First scored set",
      "condition": "Lands when a set with 5 or more answers is scored.",
      "earned": true,
      "earnedAt": "2026-09-14T11:02:31.000Z",
      "progress": { "current": 1, "target": 1 },
      "record": null
    },
    {
      "id": "full_mocks_5",
      "path": "papers",
      "name": "5 full mocks",
      "condition": "Lands with your 5th scored full mock or NTA paper.",
      "earned": false,
      "earnedAt": null,
      "progress": { "current": 3, "target": 5 },
      "record": null
    },
    {
      "id": "new_best",
      "path": "best",
      "name": "New best",
      "condition": "Lands when you beat your own marks on the same kind of mock.",
      "earned": true,
      "earnedAt": "2026-10-12T08:41:00.000Z",
      "progress": { "current": 1, "target": 1 },
      "record": { "attemptId": "a_123", "subject": "accountancy", "mode": "full", "correct": 32, "wrong": 8, "total": 50, "marks": 152, "maxMarks": 250, "before": 142 }
    }
  ]
}
```

Fields of each badge:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | One of the 16 ids below. Stable. |
| `path` | `papers` \| `repairs` \| `rhythm` \| `best` | The shelf path. `best` is not a sequence: none of its badges waits on another. |
| `name`, `condition` | string | The exact words of `app-you-1016.md` 3.2. Both clients show these words. |
| `earned` | boolean | True only when a record proves it. Never guessed. |
| `earnedAt` | ISO 8601 UTC string or `null` | The date of that record. `null` if and only if `earned` is false. The website shows the date in India time. |
| `progress` | `{current, target}` | Whole numbers, `0 <= current <= target`. `current === target` if and only if `earned`. Where a count is exact the numerator is the real count (`full_mocks_5`: 3 of 5). A single-event badge has `target: 1` and `current` 0 or 1. Read "not yet" by `earned`, never by `progress`. |
| `record` | object or `null` | The paper behind an earned attempt-derived badge (`first_nta`, `full_mocks_5`, `clean_set`, `four_subjects`, `new_best`): `{attemptId, subject, mode, correct, wrong, total, marks, maxMarks, before}`. `before` is set for `new_best` only (the marks it beat). Other badges: `null`. Never contains answers, keys, questions or other students' data. |

`bestRunEndedWeek`: Monday (`YYYY-MM-DD`, the student's own timezone) of the last week of the student's longest run of weeks at goal; `null` before any week at goal. The app asked for it in `app-you-1016.md` section 11.

`unavailable`: ids whose record could not be read this time (today only `first_hold`, which has its own read). Such a badge comes back `earned: false`; a client must not draw it as "Not yet" or "locked" but leave it out or show it quietly unknown, and ask again later. Normally `[]`. An answer with a non-empty `unavailable` is never cached.

### The 16 badges

| # | id | path | earned when (and `earnedAt`) | progress target |
|---|---|---|---|---|
| 1 | `first_scored_session` | papers | First server-scored set with 5 or more answered. Time of that session. | 1 |
| 2 | `first_full_mock` | papers | First scored full mock. Time of it. | 1 |
| 3 | `first_nta` | papers | First scored paper in NTA mode. That attempt. | 1 |
| 4 | `sessions_10` | papers | 10th scored set with 5 or more answered. That session. | 10 |
| 5 | `full_mocks_5` | papers | 5th scored full mock or NTA paper. That attempt. | 5 |
| 6 | `first_repair` | repairs | First finished Mistake Repair (stored repair receipt). Time it was stored. | 1 |
| 7 | `repairs_5` | repairs | 5th finished repair. | 5 |
| 8 | `repairs_10` | repairs | 10th finished repair. | 10 |
| 9 | `repairs_25` | repairs | 25th finished repair. | 25 |
| 10 | `first_hold` | repairs | **It held.** First "Check it held" answered right on a fresh question (`receipt.check.right === true`). `answeredAt` of that check. | 1 |
| 11 | `first_week_met` | rhythm | First week (Monday to Sunday, student's timezone) with the study days of its own goal. The moment its goal-th study day was reached. | 1 |
| 12 | `weeks_met_4` | rhythm | 4th week at goal, not necessarily in a row. The moment that week's goal was reached. | 4 |
| 13 | `run_weeks_3` | rhythm | **3 weeks in a row** at goal (a paused week neither breaks nor extends the run, as the streak already does). The moment the 3rd week's goal was reached. | 3 (`current` is the current run, never an older best run) |
| 14 | `clean_set` | best | Earliest scored attempt of 10 or more questions with every answer right. That attempt. | 1 |
| 15 | `four_subjects` | best | Scored set in 4 different subjects (5 or more answered each). The attempt that made the 4th. | 4 |
| 16 | `new_best` | best | An attempt whose marks (`correct * 5 - wrong`) are strictly above every earlier attempt of the same format id (`formatIdFor`). The beating attempt. | 1 |

Facts from production (read-only, 16 Oct 2026): 1807 of 1815 stored attempts have no `scoringVersion` (scored on the device, before server scoring) and only 8 are server-scored, so almost every student starts with the five attempt-derived badges not earned, exactly as on the phone. `new_best` follows the phone's rule (any format id, so two 10-question quick sets of the same subject can earn it); the vision text says "same kind of mock", so the owner may want it limited to full and NTA papers on both sides at once.

Rules shared with the app (so a badge cannot be earned on one and not the other): only server-scored attempts count (`scoringVersion` is `server_practice_v1` or `server_snapshot_v1`); each attempt is dated by its own `completed_at`; every rule uses a threshold that only grows, so a badge is never taken back; a week that was met stays met in the data the badge reads.

### Rhythm route

`GET /api/me/rhythm` `milestones[]` gains two ids (and a `counts` object, `{sessions, repairs, weeksMet}`, that the badge progress reads) so the app's existing path works unchanged: `run_weeks_3` (pure, from the weeks already read) and `first_hold` (one extra tiny read: the student's earliest right check). Both are listed with `achievedAt: null` until earned. If the hold read fails, `first_hold` is left out of the list (not shown as falsely locked). The response also gains `bestRunEndedWeek`. Nothing existing is renamed or removed.

## Where each badge comes from (no new table)

- Papers and best: one slim read of the student's own `attempts` (id, subject, correct, wrong, total, completed_at, mode, scoringVersion; oldest first, at most 1000; never `details` or `questions_snapshot`), the same rules as the phone's `deriveBadges`, now on the server.
- Repairs and weeks: the existing rhythm reads (`loadActivity`, goal, goal history, timezone), so the badge list and the Rhythm card cannot disagree.
- It held: `ai_credit_reservations.receipt.check` written by `answerCheck` (Repair v4). Read as the earliest right answer for this student. No table, no migration. On production there are no stored checks yet (0 rows, 16 Oct), so it reads as not earned until the first student passes one after deploy.

Query cost: the badges list adds one `attempts` read to the rhythm reads; the finished answer is cached 5 minutes in memory, `private, max-age=60` and `ETag` on the wire. If egress becomes a problem, the next step is a small `user_badges` table (earned never un-earns, so a row is written once) and it would save this read entirely.

## Not decided here

- The phone may keep working out the 5 attempt-derived badges (it works offline from the attempts it holds) and use this list as the authority when the server date differs, as `mergeDerived` already does. The website reads this list only.
- No celebration state lives on the server: "seen" stays per device.
