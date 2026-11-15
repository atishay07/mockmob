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
