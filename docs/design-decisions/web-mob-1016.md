# The Mob on the website and server (SP-1 and SP-2), 16 Oct 2026

Spec: `mockmob-next/docs/design-decisions/pass-1016e/SOCIAL-SPEC.md`. App contract: `mockmob-next/docs/design-decisions/pass-1016e/SOCIAL-APP-CONTRACT.json`. Branch `web/ux-social-1016` (wt-webux2), local, not pushed, not deployed. Behind `MOB_ENABLED` (off).

## User task

A student wants a reason to come back each week that is not pressure: sit the same 10 questions as 1 to 4 friends, see the ring fill, and learn from the one option most of the group fell for. A friend who gets the link wants to know what a Mob asks of them before making an account.

## What was built

- **Data.** `supabase/migrations/20261017100000_mob.sql` (9 tables, 14 functions, RLS on, service role only) and its undo. Every membership change runs in one SQL function under a per-Mob lock: create, join, leave, remove, invite, lookup, the member view, patch, freeze the paper, record a sitting, nudge, nudge seen, block, report.
- **Server.** `src/lib/mob/model.mjs` (pure rules shared with the page), `src/lib/server/mob/service.js` (logic, alias-free so it is tested on PGlite), `http.js` (one handler: flag, auth, limits, envelope), `deps.js` (production wiring), 12 thin routes under `src/app/api/mob/**` plus the moderators' `/api/mob/reports`.
- **Practice hooks** (`practiceSessions.js`): a server-only third argument serves the Mob's frozen questions in canonical option order and stamps `selection_meta.mobPaper`; `finishPractice` records the sitting. The durable session path (`finishSession`) is credited on the next read (`syncSittings`), so `recoverySessions.js` is untouched.
- **Website.** `/mob` (start, ring, primary action, shared trap, members, invite, settings), `/join/<code>` (public, noindex), the Today card component (`MobTodayCard`, wired after WP-B), "Your Mob" in the Community group (only when the flag is on), the moderators' "Mob reports" list, and the runner start for a Mob paper (`/test?mob=1`).

## Decisions and evidence

| Decision | Why | Evidence |
|---|---|---|
| One primary action per state: Start a Mob; Sit this week's paper; alone, Invite a friend | One clear task per screen | AGENT_RULES 7 |
| Name prefilled from the account's first name, editable | Real context, visible default | T001, rule 13 |
| "Show my score" off by default | Never preselect a sharing opt-in | rule 14 |
| Cost line from the server under the sit key, before the tap; a short balance links to credits instead of starting | Real fees, no surprise charge | T006, T008, rules 19 and 23 |
| No streak, no countdown, no list of non-sitters; the nudge sender learns a count only | No shame or coercive loss | T005, rule 22 |
| Join page: what it asks (10 questions, about 12 minutes), sample question before sign-in, the code kept for an hour through sign-in | Value before the wall; work survives auth | T003, T004, rules 15, 16 and 18 |
| Trap card only after you sat and 3 or more sat; aggregate only | Truthful, no spoilers, no names | SOCIAL-SPEC P7 |
| No eyebrow above the headline (the spec drew one) | The owner's standards forbid kickers; ArenaHead ignores eyebrows | ui-ux-standards s4 |
| Display names may carry combining marks after the first letter (spec regex is letters only) | अनन्या and other Indian-script names need vowel signs | P3, tested |
| Ring inks only segments new since this device last looked (220 ms, 60 ms step), settles once on completion; static under reduced motion | Motion answers a state change | rule 31, standards s8 |

The loop's effect is a hypothesis [I] (rules 37 and 38). The leading metric and guardrails are in SOCIAL-SPEC section 13; no instrumentation is built in this pass, and no Mob event reaches `usage_events` (P8).

## Deviations from the spec, on purpose

- **Account deletion did not cascade.** The deletion processor keeps the `users` row as a tombstone, so the user foreign keys never fire, and its fail-closed guard would have refused to delete any student who is in a Mob (`unclassified_user_data`). `DELETION_STEPS` now names every `mob_*` table (tested on PGlite with the real processor).
- **More SQL functions than the spec drew** (create, invite, lookup, state, patch, paper, sitting, nudge, nudge seen, block, report, remove), so every rule is enforced in one transaction and tested on a real Postgres.
- **An empty Mob cannot be joined** (`mob_join` and the lookup answer invalid), because a deleted last member leaves no owner to close it.
- **The paper key is derived on the server** per member and week, so a retry resumes the same session and a quick 10 is never charged twice.
- **`/mob` with the flag off** renders the not-found page and noindex, but the dev server answers HTTP 200 because the arena layout has already streamed; the API routes answer 404.
- **Not built here:** the Practice row, the Review trap row and the result-page line (files owned by other packets), the Today wiring (WP-B owns `today/page.jsx`), the Mobi moment on Today, slice 0 (the leaderboard privacy fix, SP-0), the `/admin/funnel` Mob block, and the privacy page section (lands with the change that enables the flag).

## Verification

See `docs/brain/STATUS.md` (16 Oct, the Mob) for the commands, counts, staging dry run and the capture set.
