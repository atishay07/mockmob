# Branch web/1115-sess: held, not shipped (15 Nov 2026, about 10:30 pm IST)

Built and green (recovery 655, billing 534, app 1,277, NTA 234, Mob 368, learning 377): late papers (B8) and the durable
start race (STATUS 622). An independent Opus review found no blocker but these must be done before it ships:

1. A modified client can stamp every event inside the time and send it up to 7 days later with looked-up answers. So a late
   paper must earn nothing that compares or rewards: no badges ("Clean set", "New best"), no study day (rhythm,
   `appPrefs.js` L161 `loadActivity`), no Mob chain (`chain_daily`, `mob_v3_chains.sql` L36-37), no Mob hours
   (`mob_hours_rows`, `20261020151000_mob_hours.sql` L233-236 and L266-275, applied on production: needs a new migration plus
   undo with `coalesce(a.selection_meta->>'late','') <> 'true'` in both reads). It keeps: its result, Review, repairs.
2. The result page should say plainly the paper arrived late and why it does not count toward the week (one quiet line).
3. `readLatePapers` (`src/lib/server/latePapers.js` L13) scans all attempts every 2 minutes per instance with no index, and a
   failed read makes the leaderboard 500. Fail soft (log, serve without the subtraction) and add a partial index in the
   cohort migration: `create index ... on attempts ((selection_meta->>'late')) where selection_meta->>'late' = 'true'`.
4. Durable start (`practiceSessions.js` L146-152): the free first Full mock row is taken outside the RPC's transaction; if
   `start_learning_session` then fails, delete that `learning_allowances` row (user, kind, period 'ever', reference = id) when
   no `recovery_sessions` row with that id exists. Test it.
5. The owner applies `20261115200000_late_papers_out_of_cohort_stats.sql` with the deploy (and the new Mob hours migration).

Then: test:recovery, billing, app, NTA, Mob, learning, and an independent review of the diff, then ship alone.
CTO note for durable sessions: `tmp/1115-prod/durable-sessions-ready.md` in this worktree.
