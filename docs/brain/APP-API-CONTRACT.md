# MockMob App API Contract: additions on this branch

The full contract (sections 1 to 7, the Flutter Android client) lives on `feat/app-and-web`
(`docs/brain/APP-API-CONTRACT.md`). This branch (`web/1020-mob-hours`, from `origin/main`) does not carry that file, so it holds
only the section it adds. At integration, append the section below to the full file (heading level `###`, under the Mob routes or
as a new `2.12`) and delete this stub.

## Mob hours (version 15, 20 Oct 2026; owner D173 item 1, approved D174)

A calm "study time together" figure for the Mob den. Server: `src/lib/server/mob/hours.js`, `games.js` (v3Block), `service.js`
(patchMe), migration `supabase/migrations/20261020150000_mob_hours.sql` (undo `supabase/undo/20261020150000_mob_hours.undo.sql`;
NOT applied anywhere). App and web code against this exactly, with demo fixtures until the server ships it.

### Where it appears

`GET /api/mob?mob=<id>` (the den and state response) gains an optional object `hours` on the den's `v3` block:
`response.mob.v3.hours`. It needs `MOB_V3_ENABLED=true` (like the rest of `v3`) and the migration. **When the key is absent, the
app hides every Mob hours element** (no block, no switch, no "studying now" line). Absent means: the migration is not applied, or
the read failed for any reason. It is never `null` and never an empty placeholder.

When the migration is applied, `hours` is always present, even when nobody shares (`target_minutes: 0`, `members: []`), so the app
can offer the switch.

### The `hours` object

```
hours: {
  week_start:     "YYYY-MM-DD",   // the Monday of the IST week these minutes are for
  target_minutes: int,            // 150 x the number of members who share (all of them, even with 0 minutes so far)
  total_minutes:  int,            // sum of `minutes` over `members`
  me_sharing:     bool,           // the signed-in member's own switch, in this Mob
  members: [                      // ONLY members who share AND have at least 1 whole minute; most minutes first
    { member_id: string, first_name: string, minutes: int, goal_days: int }
  ],
  top_member_id:  string | null,  // the one crown; see below
  studying_now: [                 // sharing members with a practice answer in the last 10 minutes, earliest since first
    { member_id: string, first_name: string, since: "ISO 8601 UTC timestamp" }
  ]
}
```

- `member_id` is the same 12-character member id the rest of the Mob payload uses. User ids never leave the server.
- `first_name` is the member's Mob name as the den shows it.
- `goal_days` is 0 to 7: IST days of this week on which the member's counted minutes reached their own daily goal
  (`study_goals.daily_minutes`, else the 20 minutes the study plan defaults to). The week tick is 5 of 7 (the app draws it).
- `top_member_id` is the member with the most minutes, and only when at least two members are listed and the top is not tied.
  With one sharer, or a tie at the top, it is `null` (nobody is crowned; never a rank below the top).
- `studying_now[].since` is the member's first practice answer inside the 10 minutes before the request.
- `studying_now` is only as live as what the server stores. It lights up from: a running durable session's answers, a paper that was
  just submitted (its answers fall in the window), and the per-answer check (`session_check_log`, when that is on). **A device-ticket
  paper that is still running stores nothing until it is submitted** (production has `LEARNING_SESSIONS_ENABLED` off, so ordinary
  practice and NTA mocks are device-ticket papers), so a member in the middle of one is not in `studying_now` yet. The app must not
  promise a live "now" beyond that: word it as "studied in the last few minutes", never "is studying right now".
- A member with 0 minutes, and a member who has not opted in, is never in `members`. A member who has not opted in is never in
  `studying_now`. Their time is never read from the database.
- The den is read with `Cache-Control: no-store`; the numbers are as fresh as the request.

### What counts as minutes

The sum of the member's real answer time on MockMob practice answers in the IST week (Monday 00:00 to Sunday 24:00, IST):

- Time per question is the one rule the result screens use (`data/paper_trace.js`): the time from one event to the next is credited
  to the question on screen; time away from the paper is not counted; the submit sheet credits nobody; with no away data, a gap
  over 30 minutes is a break.
- Only a question the student actually answered counts (an answer with a chosen option). Looking at a question counts nothing.
- Each such question counts at most **180 seconds (3 minutes)** in its session.
- A question belongs to the IST day and week of its last answer.
- `minutes` is whole minutes, rounded down. Under a minute is 0 and is not listed.
- Source, in this order: `public.attempts` (`attempts.selection_meta.recovery`, the record every finished practice or NTA mock keeps,
  device-ticket or durable alike), then `recovery_sessions.events` for a durable paper that has no attempt yet (still running). A paper
  with both is counted once (the attempt id is the session id). A question's day is the IST day of its last answer: for an attempt, the
  submit time minus the record's last paper clock, plus the answer's clock.
- **OWNER DECISION NEEDED (not decided, server-side default):** Mob rounds (sprint and race answers in `mob_game_runs`) and Fix it
  together checks do **not** count toward hours in this version. A member whose only practice this week was Mob rounds shows 0 minutes.
  The app copy must therefore say "practice" or "mocks", never "all your MockMob time". If the owner wants Mob rounds to count, it is
  one more source in the same SQL aggregate (each round answer's `elapsed_ms`, capped at 180 s, on the IST day of the answer).

Hours earn nothing: no credits, no rank below the crown, no countdown, no "less" copy (D174).

### Opting in: `PATCH /api/mob/me`

The existing member settings route (`{ name, colour, showScore, nudgesMuted }`) gains one more optional key:

```
PATCH /api/mob/me   { "mob": "<mob id>", "share_study_time": true | false }
```

- Default is `false` for every member, existing members included (minors' privacy). It is per member, per Mob.
- Must be a JSON boolean. `"yes"`, `1`, `null` and the rest answer `422 BODY_INVALID` and nothing in the body is applied.
- It can be sent with the other keys in the same body; a body with only `share_study_time` is valid.
- `404 MOB_DISABLED` when `MOB_V3_ENABLED` is off. `503 MIGRATION` ("Your Mob is not available just now") when the migration is not
  applied: the app keeps the switch hidden while `hours` is absent, so it should not meet this.
- `404 NOT_IN_MOB` for a Mob the student is not in. Rate limit: the Mob `write` limit (60 an hour).
- The success answer is the den (the same body as `GET /api/mob`), so `mob.v3.hours.me_sharing` is the new value and
  `members` already includes or drops the member.

### Server reads

Two small RPCs per den read: `public.mob_hours_head(p_user_id, p_mob_id)` (membership, the caller's switch, who shares) and
`public.mob_hours_rows(p_mob_id, p_week, p_now)` (the aggregate, the same for every viewer of a Mob). `mob_hours(...)` is both in one
call, for dry runs. The aggregate returns at most one row per sharing member plus the "studying now" rows (a Mob is a handful of
members); raw answers are never pulled to the server. Nothing is stored: the minutes are computed from `attempts` (index
`attempts_user_completed_idx`) and `recovery_sessions` (new index `recovery_sessions (user_id, created_at)`).

The server keeps the aggregate in process for about 60 seconds, keyed by Mob, week and the set of sharing members, so a den polled
every 30 s by several members runs it about once a minute. Flipping a switch changes the set and so recomputes at once, on every
server instance. The minutes and "studying now" can therefore lag by up to a minute. The den read also starts the hours read at the
beginning, beside the other den reads. A failure of the hours read (other than "migration not applied") leaves `hours` out of that
response and is logged as `mob_hours_failed` with an error code and no ids.
