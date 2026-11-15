# Durable sessions: ready check (15 Nov 2026, branch web/1115-sess)

## Fixed (commit 7af7dd6ff)
With `LEARNING_SESSIONS_ENABLED=true`, a start quoted free that lost the free first Full mock to a parallel start was charged 50 credits silently: `start_learning_session` took the free row itself and fell back to `attempt_full`. The durable start now takes the row before the session, as the device-held start does (`takeFirstFullMock`): one start gets it, the other is refused with `FIRST_FULL_MOCK_TAKEN` (409) and charged nothing; the holder passes no charge and no quota; a failed session start keeps the row, so reopening the same paper starts it free. No SQL change. Test: `data/tests/first_full_mock_1019.test.mjs` (real routes, production SQL, PGlite): before, [200, 200] and 50 charged; after, [200, 409] and nothing charged.

## What the run showed (local only)
Backend `data/tests/nta_e2e_server.mjs --durable` over the read-only 13 Oct fixtures; dev server on 127.0.0.1:3587 with every `.env.local` key overridden and Supabase pointed at a closed local port, so nothing reached production. Accountancy NTA paper at 390 px:
1. Started with no ticket; each answer saved to the server (`PUT /api/sessions`). `durable-shots/1-durable-nta-3-answered-390.png`
2. Storage cleared, paper reopened: same session, 3 answers back from the server, clock continued (58:34). `2-durable-resumed-from-server-storage-cleared-390.png`
3. Submitted once: 1 right, 2 wrong, 47 blank; session marked submitted. `3-durable-submit-sheet-390.png`

`npm run test:nta-e2e`: 418 of 418 pass.

## Still blocks the switch
1. Confirm production has the connected-learning SQL (`start_learning_session`, `record_recovery_events`, `finish_recovery_session`, `learning_allowances`) and the finaliser cron: a read-only check, not done here.
2. The switch also makes the daily included set and baseline sets free (quota): an owner pricing call.
3. Offline in durable mode, answers not synced by the deadline are lost (no late path there, unlike device-held papers).
4. The fixtures cannot build a Full mock (`INSUFFICIENT_PRACTICE_CONTENT`), so the free Full mock was checked on PGlite only.
