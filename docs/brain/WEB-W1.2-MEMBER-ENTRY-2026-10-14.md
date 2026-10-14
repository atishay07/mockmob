# W1.2 Member entry: brief, contract and proxy spike (14 Oct 2026)

Package W1.2 of `WEB-REDESIGN-PLAN-2026-10-14.md` (section 11, Phase 1), branch `web/W1.2`. Owner decisions applied: D1 (no "Arena" in what a visitor reads), D2 (members start on Practice by default, with a "Start on" setting and the `?home` override), D10 (plain names first).

## Experience brief

- **Job.** A signed-in student opens mockmob.in from a bookmark, the address bar or a link. They came to practise, not to read the marketing page.
- **Outcome.** They land on Practice (or Today, or Home, if they chose that in Account). A student with no scored session yet sees one action: "Start your 10-question check".
- **Data truth.** The kind, plan and day-one stage come from a hint in this browser (no personal data). The redirect waits for the confirmed session. The day-one stage is set only when the attempts list says so for certain. An unknown stage is treated as an active member, so a student with a history is never told to take a first check.
- **States.** S1 and S2 are unchanged apart from "Sign in" becoming "Log in". S3 has a day-one hero and card. S4 and S5 see "Continue practice". In S6 "Resume your test" outranks everything. S7 shows the hinted panel and "Can't reach MockMob right now. You're still signed in." with Try again. The start-page setting has states for reading, saved on this device, not saved, and browser keeps no site data.
- **Persistence.** The start page is a per-device convenience in `localStorage` (`mm:start-on:v1`). It is forgotten on sign-out, like the old checkbox. Moving it to the account record would need a migration, which is out of scope.
- **Feel.** Calm and direct. Nothing tells the student to "enter" anything.
- **Acceptance.** Unit tests cover the redirect rules, the stage contract, the boot script and the copy. The merge step runs the browser walk at 360, 375, 1024, 1366 x 650 and 1920 x 1080 in both themes.

## The hint contract (W1.1 reads this)

- Stored hint: `{ kind: 'member', plan: 'free' | 'pro', started?: boolean }`, `{ kind: 'returning' }`, or nothing.
- `<html data-visitor>` (new, returning or member) and `<html data-visitor-plan>` (free or pro) are unchanged.
- **New:** `<html data-visitor-stage="first">` is present only for a member whose hint says `started: false`. The boot script and VisitorSync set it and clear it.
- **New classes** (in `src/components/visitor-stage.css`, loaded with VisitorSync on every page):
  - `vs-first-only`: shown only on day one. Pair it with `vs-member-only`.
  - `vs-hide-first`: hidden on day one.
- How `started` is learnt: VisitorSync reads `/api/attempts/summary?limit=1` for a confirmed member until the hint says `started: true`.
  - It runs at most once every 20 s.
  - It runs straight away after leaving `/test`.
  - It never runs on `/test`.
  - Once `started` is true it stays true. A failed read changes nothing.
- Exports kept for files outside this package:
  - `ARENA_HREF`, an alias of `PRACTICE_HREF`.
  - `forgetArenaFirst`, an alias of `forgetStartOn`. AuthProvider calls it on sign-out.
  - `arenaRedirectDone` and `markArenaRedirect` in VisitorSync.
  - New: `PRACTICE_HREF`, `FIRST_CHECK_HREF` (`/dashboard?count=10`), `START_ON_OPTIONS`, `startDestination`, `readStartOn`, `writeStartOn` and `stageOf`.

## Redirect rules (client, built now)

`/` sends the student to their start page only when all of these hold:

- The session is confirmed.
- This full page load opened on `/`.
- It was not a reload or a back or forward visit.
- There is no `?home`.
- The referrer is not a MockMob page.
- The start page is not Home.

While the session check runs, the likely destination is prefetched. The cost is a short view of the hinted member panel before the move, as the plan expected.

## Proxy edge-redirect spike (report only; `src/proxy.js` unchanged)

**What the proxy already does.** For any page request carrying a Supabase session cookie, `refreshSupabaseSession` already calls `getClaims()`, with a 5 s budget. That call includes `/`. Its outcome is one of `ok`, `signed_out`, `transient`, `timeout`, `anonymous` or `unconfigured`. So the edge already knows, at no extra Supabase cost, whether a visitor to `/` has a verified session.

**A safe design, if the owner wants the flash gone:**

1. Redirect only when all of these hold:
   - The path is exactly `/`.
   - The outcome is `ok`.
   - The request is a top-level document navigation (`Sec-Fetch-Mode: navigate` and `Sec-Fetch-Dest: document`).
   - `Sec-Fetch-Site` is `none` or `cross-site`.
   - There is no `home` query parameter.
2. In every other case fall through to the current page, and the client rule above still applies. This covers `transient`, `timeout`, `signed_out`, missing Fetch Metadata headers (older browsers) and any error. A dead session therefore never bounces anyone; at worst they see the home page.
3. The start page is in `localStorage`, which the edge cannot read. Mirror it to a small non-httpOnly cookie (for example `mm_start=practice|today|home`, 1 year, `SameSite=Lax`), written by the Account setting and cleared on sign-out. With no cookie, send the student to Practice, which is the default.
4. The redirect response must be `307` with `Cache-Control: private, no-store`, so a CDN never stores a member's redirect. Guests (no cookie) skip the Supabase call entirely, so the cached guest HTML and SEO are untouched.

**Next 16 facts that shape this** (from `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`):

- The proxy cannot see `rsc`, `next-router-prefetch` or `next-router-state-tree`. Next strips them from `request.headers`.
- So an in-app logo click, which is an RSC request, cannot be told apart by those headers. Use the browser's Fetch Metadata headers instead: an RSC fetch has `Sec-Fetch-Dest: empty`, so it is never redirected.
- `NextResponse.redirect` is still the API.

**Open points to measure before building:**

- Which `Sec-Fetch-Site` value Chrome, Android WebView and Safari send on a reload of `/` and on a back navigation. A reload must keep the home page.
- Whether a second proxy hop on `/dashboard`, which runs `getClaims` again, costs more than the flash it removes on a budget phone over slow 4G.
- That the redirect never fires for the PWA `start_url`, if that is `/`. It probably should fire there.

**Recommendation.** Keep the client redirect for Phase 1. Build the edge version in Phase 2 only if the W0.2 or W4.4 measurement shows the flash on a budget phone, with tests that drive `refreshSupabaseSession` and the new branch through the existing `sessionProxy` test harness. The proxy's comment ("It never redirects") would change to "never redirects on an unverified session".

## Review follow-up (2026-10-14)

- **Day-one flag and unfinalised sessions (fixed).** The read-only peek (`finalise=0`) does not finalise expired sessions, so a student whose only session had expired could look like day one. `readStarted` in `data/visitor_state.mjs` now confirms an empty peek with one ordinary read (which finalises) before `started:false` is written. A found attempt still costs one read. A failed confirm leaves the stage unknown, which is treated as an active member. Not confirmed against live data.
- **Copy (fixed).** The dock now says "Start your 10-question check", the same as the hero and closing line.
- **"Practise" in the Practice section title (kept).** It is the verb, in the Indian English spelling used elsewhere on the page ("Practise it."). "Practice" is the noun and is used for the label and kicker. Not a mismatch.
- **Primary member button lost its arrow (decision recorded).** The owner's UI standards forbid arrows appended to button text, so the day-one and active hero buttons stay without one. The guest hero and the dock still carry arrows; removing them belongs to the W1.1 pass, so the visual language is changed in one place.
- **Test gaps.** The new `readStarted` test covers the peek and confirm paths. A component-level test of the VisitorSync races (answer after sign-out, in-flight guard, `/test` exit) needs a React test harness this repo does not have; those rules are covered as pure functions (`shouldCheckStarted`, `nextHint`) and stay on the browser walk at merge. The route's `finalise=0` branch is a one-line condition, now exercised by the confirm read rather than relied on.
- **Duplicate h1.** The hidden hero version is `display: none` through `vs-hide-first` / `vs-first-only`; check at 360 px during the browser walk.
