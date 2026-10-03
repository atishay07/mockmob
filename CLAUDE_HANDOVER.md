# MockMob handover for Claude

You are continuing work in `C:\Users\atish\Desktop\mockmob copy\mockmob copy`.

## User intent

Restore MockMob's original product depth while keeping the new Score Recovery Lab direction. The public landing page must clearly brand MockMob as a CUET platform, show a playable five-question sample, and reconnect the existing signed-in product: Arena/practice, PrepOS, Radar/analytics, saved questions, leaderboard, Admission Compass and profile. Do not replace the existing product with a disconnected demo.

## Current state

- Next.js 16.2.4 / React 19 / Supabase app.
- Local dev URL: `http://localhost:3100`.
- Existing paid entitlements and Razorpay paths must remain intact.
- Launch scope: CUET UG 2027 Commerce + English, with English, Accountancy, Business Studies and Economics as the recovery pilot subjects.
- Brand: MockMob, volt green `#D2F000`, Gabarito + Hanken Grotesk.
- Product direction: Score Recovery Lab (observed answer changes, timing/completion evidence, intervention, fresh follow-up). Do not invent recoverable marks or causal gains.

## Changes made in this pass

- Reworked `src/app/page.js` back toward the live product's stronger CUET-first hero: explicit CUET 2027 positioning, playable `DemoDrill`, subject links, tool suite, Compass, recovery section, honest pricing and FAQ.
- Restored familiar public navigation in `src/components/NavBar.jsx` and made signed-in CTAs open `/dashboard`.
- Updated `src/components/LandingActions.jsx` and `src/components/landing/DemoDrill.jsx` so the demo is explicitly original sample content, not authenticated PYQs.
- Added the legacy/evidence separation in `data/practice_library.js` and `data/practice_availability.js`. Recovery sessions request strict evidence; everyday practice can read existing live library rows without labelling them as evidence-certified.
- Added `data/practice_ticket.js` and `src/lib/server/practiceSessions.js`. Existing practice sessions use an authenticated encrypted server-selected snapshot with owner binding, expiry, idempotent attempt IDs and server scoring. Recovery sessions still use `recoverySessions.js`.
- `/api/sessions` routes `experience: practice` to the compatibility practice flow; recovery requests keep the strict route.
- Restored `/api/questions` as a contribution-safe compatibility endpoint while preventing client-scored question selection.
- Added explicit fallback copy for insufficient practice content and paused recovery migration.

## Verification already run

- `npm.cmd run build` passes; Next produced all routes.
- `npm.cmd run test:recovery` passes: 15/15.
- The first lint run found and fixed the shebang ordering and `module` variable warning. Run `npm.cmd run lint` once more for final confirmation.
- Signed-in local dashboard was visible at `/dashboard`; the account showed credits and Premium. A visible `Failed to load leaderboard` banner remains to investigate. The dashboard requests `/api/attempts?userId=...`; the server route intentionally ignores the query and uses the authenticated owner, which is correct.

## Immediate next checks

1. Run lint again.
2. Refresh `/` and verify the CUET hero + five-question sample at desktop and mobile widths.
3. On the signed-in dashboard, fix leaderboard's visible error if it is a real API/schema issue. The API is `src/app/api/leaderboard/route.js`; the data method is `Database.getLeaderboard()` in `data/db.js`. Do not fabricate real student counts; synthetic practice rivals must remain clearly labelled.
4. Start a Quick Practice session and submit one attempt. Confirm `/api/sessions` returns `sessionTicket`, reload/resume works, submit is idempotent, and `/result/[id]` opens. If Supabase has no migration for recovery, ordinary practice must still work through the compatibility path.
5. Run `npm.cmd run test:recovery` and `npm.cmd run build` after any fix.

## Important constraints

- Read `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, then `docs/brain/README.md` before broad edits.
- Never run paid generation without the persistent budget ledger and verified prices. The $10 lifetime incremental content ceiling and $2 calibration hold are hard limits.
- Human-free publication means abstention when evidence is missing; model agreement is not proof.
- Do not apply the saved Supabase migration to production implicitly. Keep schema changes as reviewed migrations.
- Do not claim the 10,000-question target, academic accuracy, superiority to human review, or score improvement without independent held-out evidence.
- Preserve old useful routes and terms: Arena, PrepOS, Radar, Compass, saved, leaderboard, uploads and profile. Score Recovery Lab augments them.

## Known gates

The source registry and independent academic benchmark fixtures are still empty, so no new evidence-certified bank is publishable. The mobile app source exists but still needs public environment configuration, signing, real-device QA and store review. This is a local implementation/handover, not a production launch.
