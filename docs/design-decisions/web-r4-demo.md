# "Not your subject?" on the hero's sample card (round 4 H3, 5-6 Nov 2026)

Branch `web/r4-demo`. Not pushed, not deployed. Packet H3 of `docs/brain/night-1105/SPEC-R4.md`.

## The owner's ask (LK123, 5 Nov about 11:40 pm, verbatim)

> "The questions again: there should be an option of "Not your subject?" or something like that. I don't know how to
> implement it tastefully but you have to do that. If someone selects their questions and all, then we can show random 5
> questions from the bank of those specific subjects."

## User task and success test

A visitor on the home page meets the sample card on Mobi's desk. It opens on English (most CUET candidates sit a language
paper) and runs five mixed questions. A Physics or History student should not have to sign up to see whether MockMob has
their subject. Success: in two taps they are answering five questions of their own subject, with the same reveal (right
option, reason, Mobi's reaction) and the same end; a subject that cannot load says so and leaves the card as it was; the
card's first paint and its own five are unchanged and need no network.

## What was built

| Piece | File |
|---|---|
| The card: the key, the subject list, loading and failure, the new set | `src/components/landing/DemoDrill.jsx` (internals only; the hero packet owns the card's copy and placement, and the `note` prop is theirs) |
| Its drawing | `src/components/landing/demo-subject.css` (imported by DemoDrill; tokens only, Night and Day) |
| Browser-safe rules: the 15 subjects, the URL, the random set, the whole-set check | `src/lib/demoSample.mjs` |
| Server rules: query check, the gate, the card's shape, the bounded window, the egress, the memo | `src/lib/server/demoSample.js` |
| Public route | `src/app/api/sample/route.js` (`GET /api/sample?subject=<slug>&set=<0..5>`) |
| Tests | `data/tests/demo_sample_1105.test.mjs` (10 tests) |

### The flow

1. The card's last line holds the hero's note ("No sign-up for these five.") and, on the right, a quiet underlined key
   **"Not your subject?"** (44 px target; it wraps under the note where both do not fit). Its accessible name is "Not your
   subject? Pick another subject".
2. The card turns to **"Pick your subject"**: one line saying what a pick gives ("Five questions from the MockMob bank, picked
   at random."), the 15 subjects Practice offers as 44 px keys, and a close key (x, "Back to the question"; Escape too).
   Phones: two columns with English, the default, taking the first row whole (15 is odd; no orphan at the end). From a
   420 px card (tablet, laptop, desktop) three columns, five even rows. The subject playing now carries an ink edge and a
   tick (never colour alone, `aria-pressed`).
3. A pick shows a small turning ring on that key and the line under the head says "Loading five Economics questions."
   (an `aria-live` line, in place, so nothing moves). The answer arrives, Mobi goes back to his first line
   (`sendDemoState('load', 0)`), and the card plays the five with the head reading "Economics 1 of 5"; focus goes to
   answer A. A failure says "Couldn't load Physics just now. Try again, or pick another subject." in the same line; the
   card beneath is untouched.
4. After five, the end state keeps "Start practising free" and "Try the five again", and adds "Try another subject" on the
   same line (the bubble already says "Pick your subject next.").
5. Picking the same subject again never asks for the set it just played (`pickDemoSet`).

Nothing a guest picks is stored. The sample import (`src/lib/server/sampleImport.js`, `landing-v1`) still describes the
card's own five; a live set is never saved (no client sends either today).

## The route: only what the demo shows, bounded, cached, rate-limited

- **Shape out.** Per question: `q`, `options` (four texts, the runner's own letter-stripping), `correct` (0-3), `why`, `chapter`
  (the syllabus title). Per answer: `subject`, `name`, `set`, `questions`. No id, family, source, evidence, difficulty or
  count. The card already reveals the right option and the reason after a pick; the route gives no more than that.
- **Only what Practice serves.** Rows that are live or verified-and-active, then the same `readablePracticeQuestions` gate
  every student surface uses (syllabus v2, answer integrity, publication evidence, family holds).
- **Only what reads well on the card** (`demoShape`): no passage set, no List-I/List-II layout, no formula markup, four options
  of at most 90 characters, a stem of at most 240, a reason of 12 to 420, `presentationLint` clean.
- **A bounded public window.** For each subject: the first 30 eligible questions in a salted SHA-256 order of their ids
  (`mockmob-demo-window-v1`), at most 3 from one chapter (topped up from the over-cap ones when a subject has few chapters),
  cut into 6 sets of 5. `set` picks one; it is never a page through the bank. So the whole route can ever show 30
  questions a subject (450 in all) until the bank itself changes, however often it is called. Changing the salt is the only
  way to rotate the window.
- **Egress** (fixtures shaped like production, 3 seeds, a subject of about 920 rows, 120 evidence-managed): one read of 7
  small columns (about 120 KB), then full rows only by id in batches of 40 (2 batches, 80 rows, 360-420 KB), against
  5.2 MB for the subject's rows; the answer is about 2 KB. Each server keeps a subject's window 6 hours and reads it once
  even when visitors ask together; a failed read is never kept.
- **Caching.** 200: `Cache-Control: public, max-age=300` and `CDN-Cache-Control: public, s-maxage=86400,
  stale-while-revalidate=604800` (90 URLs in all). 400, 429, 503 and failures: `no-store`.
- **Limit.** The query is checked before anything else (a bad subject or set never reaches the limiter or the database),
  then `checkPersistentRateLimit` at 30 a minute per address with the in-memory fallback, as the comment in `rateLimit.js`
  recommends for a free read.

## Decisions

| Decision | Why | Evidence |
|---|---|---|
| The card opens on its own five, unchanged; the subject list is one tap away, not a gate before the first question | Value before any choice or account; the first thing a visitor can do is still answer | T003; AGENT_RULES 15 |
| The key says "Not your subject?" in words on the card, not a chevron on the subject name | His words; audience is 16-17-year-olds new to apps, never hide features; no chevrons appended to text | S014; slop 11; memory "audience: teens new to CBT" |
| The list replaces the card's body (no popover, no overlay, no sheet) | Nothing floats over content; no positioning or clipping at 360 px; keyboard and screen reader get a plain group of buttons | slop 1, 17; AGENT_RULES 30 |
| Equal keys for the subjects, English spanning the first row on phones | A list of equal choices is equal weight by meaning; English is the default and the paper nearly all sit, and it removes the odd one out | AGENT_RULES 8, 11 |
| Loading and failure speak in the line under the head; the ring is the only motion while waiting | Truthful state, no fake progress, nothing moves while it loads; a failure gives a way to recover | AGENT_RULES 17, 35; standards 6 |
| A set is accepted whole or not at all (`acceptDemoSet`) | The card never plays half a set or a question without its reason | AGENT_RULES 35 |
| "Five questions from the MockMob bank, picked at random." | True: they are bank questions Practice serves, and the set is random; not "real" or "PYQ", which they are not | T002 |
| Motion: the list and the returning question ease in (200 ms, ease-out, 4 px); reduced motion shows them at once and stops the ring | Motion answers an action; respects the device and the site's own switch | standards 8; AGENT_RULES 31 |

### Also fixed inside the card (found while looking)

The end state's readout box was dark on dark in Day: it kept Night's slate fill (`marketing.css --slate-2`) under Day's ink,
so "After a full mock, chapter review would flag:" and the chapters could not be read. Day now draws it on paper (Night is
unchanged). The same CSS is on the live site, so it is most likely broken there today too (not checked on the live site).

## Tests

- New: `data/tests/demo_sample_1105.test.mjs` (in the landing suites' `*_1105` glob): the subject list equals the subject
  pages; the query check comes before the limiter and the database; the window holds only gated rows in the card's shape,
  spread over chapters, the same on every server; passage, formula, list, long and malformed rows never enter it; the
  egress (7-column first read, by-id batches of 40, under 15% of the subject's bytes, strict rows that throw on any
  unselected column, no `select('*')`); the answer's exact keys and no id or internals; six disjoint sets, wrap and thin
  subjects; the memo (one read for six concurrent visitors, 6 hours, failures not kept); the route's cache and no-store
  headers, no sign-in, the limit; the card's side (its own five first, one request only on a pick, whole-set acceptance,
  no repeat set, `aria-pressed`, Escape, 44 px targets, motion gated).
- No pinned test was changed: the card keeps `DRILL` (5 questions, English first), `{index + 1} of {DRILL.length}`, the
  sample-state calls, both focusable roots and the note.

## Verified (real Chrome 151 headless via playwright-core, dev server on 3593, this worktree)

- 360x640, 390x844, 768x1024, 1280x800, 1440x900; Night and Day: default card, the list, loading, a live set, an answered
  question, a failed subject, the end state. Screenshots in `tmp/r4/shots/` (`*-v2`, `*-v3` after the fixes).
- Pointer clicks (Playwright's real mouse events): the key's centre hit-tests to the key at every size; no horizontal
  overflow at any size.
- Keyboard only (390, reduced motion): Enter on the key opens the list with focus on the current or first subject; Tab
  walks the subjects in order; Enter loads and focus lands on answer A; Escape closes and returns focus to the key (and to
  "Try another subject" from the end state). Reduced motion: no animation on the list or the returning question.
- The success path used a fixture answer through request interception: this worktree has no database, so the real route
  answers 503 here (that is the failure state shown). Its 400s were checked with curl. The route has **not** been run against
  the real bank: the first deploy should open `/api/sample?subject=accountancy&set=0` (and English, Maths, Physics) once and
  read the five, to confirm the window is full and reads well for every subject (Maths and Physics lose questions with
  formula markup; a subject that cannot fill five answers 503 and the card says so).

## Open

- The hero packet owns the card's copy (the note, Mobi's lines). If the note grows, the key wraps under it by design.
- If the owner wants a rotating window (new questions each week), change the salt on a schedule; each rotation exposes 30 more
  questions a subject.
