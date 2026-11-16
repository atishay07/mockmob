# Free first Full mock: the release race (16 Nov 2026, branch web/1116-race)

Only matters once `LEARNING_SESSIONS_ENABLED=true` (off on production). At most one 50-credit mock per student.

## The race
A durable start takes the free row (`learning_allowances`, kind `first_full_mock:<subject>`) before `start_learning_session`,
and gives it back if its session start fails (`releaseFirstFullMock`). The release read `recovery_sessions`, then deleted the
row, outside the start's `users` row lock. Double tap (same generation key, so the same session id): A's session start fails;
B's holds the `users` lock and has not committed; A's read sees no session and deletes the row; B commits a free session. The
student can then start a second free first Full mock in that subject.

A second order the note did not name: A's release runs just before B reaches the lock. The lock cannot help there; B's
session is made free with no row.

## The fix
1. `release_unstarted_allowance(p_user_id, p_kind, p_period, p_session_id) returns boolean`: locks the student's `users`
   row first (the same lock and order as `start_learning_session` and `start_recovery_session`, so no deadlock), then deletes
   the row only while no `recovery_sessions` row has that id. Security definer, `search_path = ''`, execute only for
   `service_role`. Named generically (any allowance a start takes outside its transaction), which also keeps the 19 Oct pin
   "the first full mock rule needs no migration" true: the rule still works without it.
2. `releaseFirstFullMock` calls it. On PGRST202 / 42883 (function not there: production until applied) it does the old
   read-then-delete; any other error keeps the row.
3. After a free durable start makes its session, `keepFirstFullMock` takes the row again if it is gone (the second order).

## Files
- `supabase/migrations/20261116120000_release_unstarted_allowance.sql` (NOT applied)
- `supabase/undo/20261116120000_release_unstarted_allowance.undo.sql` (NOT applied)
- `src/lib/server/firstFullMock.js`, `src/lib/server/practiceSessions.js` (the durable branch only)
- `data/tests/allowance_release_race_1116.test.mjs` (add to `test:billing`)

## Apply and undo
Apply: run the migration file on the project (SQL editor or `psql -f`). Supabase reloads PostgREST's schema cache on DDL; if
the release still answers PGRST202, run `notify pgrst, 'reload schema';`. Check (read only):
`select prosecdef, proconfig from pg_proc where proname = 'release_unstarted_allowance';` gives `true`, `{search_path=""}`,
and `has_function_privilege('anon', 'public.release_unstarted_allowance(text,text,text,text)', 'execute')` is false.
Undo: run the undo file (drops the function; the code falls back by itself, no deploy needed).

## Not checked
- The function against production: not applied, not read there. Nothing on production was touched.
- A real two-connection lock wait: PGlite has one connection, so the test plays the wait (A's release runs after B commits)
  and proves the lock separately (the `users` row's xmax inside a transaction). Postgres semantics, not observed live.
- Still open: A's own session start reaching the database after A's own release (its request held up past the client's
  error) makes a free session with no row; and a third start of the same subject inside the gap in the second order. Closing
  both needs `start_learning_session` to check the free row under its lock, a change to that function not made here.

## Independent review, 16 Nov 2026 (verdict: nothing blocking; safe to merge with the switch off; merged into web/1115-prod)

Still to do before `LEARNING_SESSIONS_ENABLED=true`, in order of weight:

1. A free session can still end up with no free row: A's release runs before B reaches the lock, B's session commits, but
   B's call returns an error (or B's server process dies) before `keepFirstFullMock` runs (`practiceSessions.js` 154-161);
   the retry goes through the replay return (76-78), which never calls keep. Needs two failures inside one double tap; the
   harm is one extra free mock. Real fix: check the free row inside `start_learning_session` under its own lock. Stopgap:
   call keep on the durable replay path too.
2. `keepFirstFullMock` can tie the free row to a paid session when a twin start with the same key read "used" and made the
   session paid (three or more starts with the same key). Fix: skip the claim when `startAlreadyPaid('recovery:' + id)`.
3. With the switch on and this migration not applied, a call error with no code keeps the row (`firstFullMock.js` 108):
   the safe direction, but apply the migration before the switch.
4. Not shown by any test: a real lock wait across two connections (PGlite has one), and PostgREST's error codes on the live
   service.

## Second pass, 16 Nov 2026 (branch web/1116-race2): the review's cases 1 and 2

Only matters once `LEARNING_SESSIONS_ENABLED=true`. With it off nothing here runs (the device-held start is unchanged; tested).

### Case 1 (a free session with no free row): closed in code, with the function production has today
- `practiceSessions.js`, durable branch: a start that holds the free row now passes it to `start_learning_session` as its quota
  (`p_quota_kind = first_full_mock:<subject>`, `p_period = 'ever'`, `p_credit_action = null`). The old function already does the
  right thing with that: it inserts a missing allowance with the session, and a present one with no action charges nothing.
- Why every order of two or three same-key starts ends with one free session holding one row (with 20261116120000 applied):
  same key means same session id `I`, so the row's reference is always `I` or absent. A free session `I` is only ever written
  inside `start_learning_session`, under the users row lock, in the transaction that finds or inserts row `I`; so at its commit the
  row is there. Row `I` is only deleted by `release_unstarted_allowance`, which takes the same lock and deletes only while no
  session `I` exists; so after the commit it stays. A release before the commit is undone by the commit itself. Nothing after the
  commit is needed any more, so a lost reply, a dead process, or the replay return (which never calls keep) changes nothing.
- Tests (PGlite, real routes, real functions): a gate scheduler (AsyncLocalStorage) lets the test choose the order of every
  allowance, session and ledger statement and every rpc. Case 1 with a lost reply and with a dead process (both failed before the
  fix), and 200 seeded random interleavings of 2 or 3 same-key starts with failures before the database, lost replies, release
  timeouts, failed rule reads and one dead process, on the old function and on the new one: all end with one session, its one free
  row, nothing charged (seed 2 failed before the fix).

### The new function (optional, closes what the old one cannot)
- `supabase/migrations/20261116130000_start_learning_session_own_allowance.sql` (NOT applied) and
  `supabase/undo/20261116130000_start_learning_session_own_allowance.undo.sql` (NOT applied).
- Same signature, `security invoker` (the repo's function is invoker, not definer; kept as it is), `search_path = ''`, same grants.
  Only the allowance step changes: a row this session already holds is its own (free); a missing one is inserted (`on conflict do
  nothing`, then read again); one another session holds charges the action as before, or, with no action, raises
  `allowance taken` and writes nothing. The server maps that to FIRST_FULL_MOCK_TAKEN (409, requote, nothing charged).
- What it closes: a start with ANOTHER key (another tab) taking the row in the moment between a twin's release and this start's
  session call. With the old function that start gets a free session with no row, a second free mock (the test shows 2 sessions);
  with the new one it is refused.
- Guard: one DO statement that replaces the function only while its live body's md5 (CR stripped) is connected_learning's
  `4c0c17b29dcc4477badd27c9a44db2da` or its own `62896e7e810a48535b4df6e43ea447e3`; anything else raises and nothing changes,
  even under a runner that continues after errors. The undo is guarded the same way and restores the original body exactly.

### Case 2 (the free row tied to a paid session): fixed in `keepFirstFullMock`
- Keep reads the ledger (`recovery:<id>`, `startAlreadyPaid`) before it takes anything: a session a twin started paid never takes
  the free row, and a row this start took before its call is given back (no start can make that paper free any more). A failed
  ledger read writes nothing. Tested both ways through the routes (the review's 4-start order, and a twin whose rule read failed).

### Apply (in this order, with the owner's or the CTO's word)
1. `20261116120000_release_unstarted_allowance.sql`, if not yet (see above).
2. Read only: `select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure('public.start_learning_session(jsonb,text,text,text)');`
   must give `4c0c17b29dcc4477badd27c9a44db2da`. If not, stop: production's function is not the repo's; compare first.
3. Run `20261116130000_start_learning_session_own_allowance.sql`. Check (read only): the md5 above is now `62896e7e810a48535b4df6e43ea447e3`;
   `select prosecdef, proconfig from pg_proc where oid = to_regprocedure('public.start_learning_session(jsonb,text,text,text)')` gives
   `false`, `{search_path=""}`; `has_function_privilege('anon', 'public.start_learning_session(jsonb,text,text,text)', 'execute')` is false.
   Same signature, so no PostgREST schema reload is needed.
- Undo: run the undo file (the md5 goes back to `4c0c17b2...`). No deploy: the server works against either version.

### Still open
- Without 20261116120000 (production today): the read-then-delete release can still delete the row between its read and a twin's
  commit; keep repairs it unless that twin's reply is lost or it dies (3 of 100 seeded runs end with no row). Apply it before the switch.
- Without 20261116130000: the other-key case above (needs three starts over two tabs plus a failure).
- Case 2 remainder: if the free tap's own call fails (or its process dies) after a paid twin made the session, the row it took stays
  on the paid session (the release keeps it because the session exists; keep does not run). Needs a failed rule read on one tap of
  an app build (no firstFree) plus a failed call on the other. Harm: that subject's free mock is lost; nothing is overcharged.
- New function with the fallback release (20261116130000 applied without 20261116120000): a row the fallback deletes inside the
  function's insert-then-read answers FIRST_FULL_MOCK_TAKEN although the free one is there again; a re-quote shows it free.
- The review's stopgap (keep on the replay return) was not added: with the session call taking the row it has nothing to do, and a
  replay cannot tell whether an old session was the free one (Pro at the time, a Mob paper) without guessing.

### Not checked without a live database
- Production's live `start_learning_session` body (the guard and step 2 check it before anything changes).
- Real lock waits across connections, an outside insert landing inside the function (PGlite runs one statement at a time; the
  scheduler plays statement order), `on conflict do nothing` waiting on an uncommitted insert, and PostgREST putting the raised
  `allowance taken` in `message` on the live service.

### Commits and checks
- de630b908 (migration and undo), 055f69477 (code and tests), 76386379b (test timeouts).
- `data/tests/allowance_release_race_1116.test.mjs` 19/19 (10 new; about 80 s), already in `test:billing`. test:billing 564/564,
  test:recovery 664 pass 3 todo, test:learning 408/408, test:least-privilege 12/12, test:health-egress 56/56, test:mob 369/369,
  test:app 1342 pass 2 skipped. eslint clean on the three changed files.

## Independent review of the second fix, 16 Nov 2026 (nothing blocking; safe to merge with the switch off; merged)

- Production today is unchanged: every change sits inside `if (durableLearningEnabled())` (`practiceSessions.js` 139-172).
- `start_learning_session` checks only that a free row exists, not whose it is, so a row held by another session also gives a
  free session (the two-tab gap): closed only by migration 20261116130000. Its insert has no `on conflict`: a twin's claim
  landing between the check and the insert raises 23505, shown as a 503 with nothing charged; a retry works.
- Still open with the switch on: a free start whose own call fails after a paid twin's commit, or whose ledger read fails in
  `keepFirstFullMock` (`firstFullMock.js` 140, 147), leaves the free row on the paid session: the student loses that
  subject's free mock, nobody is overcharged. Smallest fix: on the error path, call keep when a session with this id exists.
- Migration 20261116130000 sits in `supabase/migrations`, so a routine push applies it; if the live function body differs from
  the guarded md5 its DO block raises and changes nothing (a push would stop there).
- Not shown by any test: the new-function-only state under random orderings, real lock waits across two connections.
