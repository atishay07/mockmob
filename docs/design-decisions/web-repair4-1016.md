# Repair v4 visual gate fixes (web, 16 Oct 2026)

Branch `web/repair4-1016`. Follows `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md` (rule 39 format). The evidence IDs below
(T00x, S0xx) are the ones in that research pack's papers; the rules that carry them are quoted by number.

## User task

A student has just been shown why they got Q3 wrong. Two things follow: "Check it held" (one fresh question, marked by the
server, no extra credit) and, if they still do not get it, asking Mobi (1 AI credit). The gate found two blockers:

1. When written replies are paused, the repair still promised "One written reply uses 1 AI credit", and the Ask screen then
   told the student they could still ask for free while every control for asking about the question was disabled.
2. "Ask Mobi about this question" sat directly under the new check question but handed over the original mistake, so a
   student would think Mobi was answering the check.

## Decisions

### 1. Written replies unavailable (blocker)

- The repair reads the AI wallet. Available, or not read yet: the link and the price, as before. Paused: no link, one line,
  "Written replies are paused right now. Nothing is charged." No credits: "You have no AI credits left, so Mobi cannot write a
  reply. Nothing is charged." Unreadable: the same, with "could not be read". No state promises a credit or free asking
  (AGENT_RULES 24, MockMob overlay "explain AI uncertainty and credit/quota costs before irreversible model calls"; T006/T008:
  never present a price that is not backed).
- The Ask screen: when a question is handed over and the wallet is read and not available, the question card says
  "Mobi cannot answer this question right now. Nothing was charged." with one button, "Ask about my record", which drops the
  question. The reply-source switch, the generic "paused" notice, the "Ask about the mistake above" hint and the composer are
  not shown: a greyed-out composer for a question that cannot be asked is a dead end (rule 35, permission-denied states).
  The record switch stays off for a handed-over question because a record answer cannot discuss a question, so the screen
  never says the question can be asked about for free.
- Alternative rejected: enabling the free "Your record" switch for a handed-over question. The record path would answer a
  different question than the one the student arrived with.

### 2. Which question is Ask about (blocker)

Chosen: move Ask so it belongs to the original mistake and name it by its number: "Ask Mobi about Q3", with "Mobi sees Q3,
your pick, the key and your rule, and nothing else about you." It sits right after the explanation and the rule, before
"Check it held".

Why this and not "hand over the check question when it is on screen":
- What a student expects: the explanation above is about Q3, they got Q3 wrong, and their open doubt after reading it is
  about Q3. The check is a separate stage that answers "did it stick" and already comes with its own explanation and key.
- Cost and safety: the Ask hand-off (ask-context route, chat route, questionRef validation) only knows `attempt:question`
  and reads the key from the repair row. Handing over a check question would need a new reference kind on two routes that
  spend credits and read keys, a larger change than a gate pass should carry, and it would put the key of a question the
  student may not have answered yet behind a link.
- Trade-off: after missing the check, there is no Mobi link for the check question. Its key and explanation are shown right
  there, so the student is not stuck; if the owner wants it, a check-question hand-off is a separate server task.
- The Ask screen's card now reads "About the mistake you repaired" so the arrival matches the label they clicked.

### 3. Other gate defects

| Defect | Fix |
| --- | --- |
| Mark error reads as build talk | "We could not confirm the mark. Try again. Your answer is counted once." The submit button reads "Try again" after a failure (`retryMark` was defined and unused). |
| `check=changed` message and stale options | "That question was withdrawn before it was marked. Nothing was recorded." (server reason, contract fixture, preview). Options dim and stop taking clicks while "Get another question" is the only action; the old pick is no longer highlighted. |
| Revise said twice | The outcome line now only says what happened ("Missed on a new question from the same topic."). The Revise line says when, once: "Both come back tomorrow: this mistake and the question you just missed." |
| Skeleton jump | Skeleton is 720 px wide like the question and has a 44 px action placeholder. |
| 390 px tags wrap and rows grow | Tag stays on the option's own line (grid column 3, nowrap). Row heights measured 46 px before and after marking (were 46 to 73). |
| Orphan last words | `text-wrap: pretty` on lead, fine print, note, verdict and Revise line; lead max-width 72ch. |
| Pool line below the button | Now directly under "Same topic: ..." and before the question; it explains why this question, so it comes first (rule 8). |
| Ask card: full-width button, accent stripe | Buttons in the card are `justify-self: start; width: auto`. The handed-over card has a hairline border instead of the left stripe. |
| Preview truth: `?lab=older` showed a kept rule check | Preview defaults `rulecheck` to `not_checked` for `lab=older`, as the server does. |
| Pre-capture action copy | "Take another timed mock to see your full Lab" when the reason is `before_capture` (the paper was already a timed mock). |

### 4. Open truth problems closed

- Lead copy said "on the same idea" even when the basis was only the chapter: the lead now follows `check.basis` ("on the same
  idea", "on the same topic", "from the same chapter", or nothing while loading).
- The Revise line could say "tomorrow" about a day that had passed, or about a card already due: the server says "today" for a
  card due today or earlier (`reviseSummary`), and the client works the label out again from the due day when it renders, so a
  stored answer opened days later is right.

### Not fixed, and why

- Performance of the seen lookup (newest 100 attempts read on every open): needs an ids-only read or a lazy status; a server
  change with its own tests, left for its own task.
- POST accepts any currently eligible check id, not only the offered one: the offered one is the first that passes the full-row
  publication gate, so a "top only" check needs the gate on POST too. Cost is one key learned per repair; left.
- A check question shown but never answered is not recorded as seen; a failed progress write can re-offer a question: both
  need a table or a receipt scan.
- Pick mapping if a live question's options are edited between GET and POST: needs an options hash sent by the client.
- Ask hand-off id regex (100 chars) fails for odd ids, for free and with a message: left.
- Unverified: PostgREST accepting `.is('receipt->check', null)`: needs a real database.
- Older problems not from this branch (arrow after "Next mistake: Q5", eyebrow dots, the PrepOS orb, the mismatched v3 fixture
  text): out of scope for a gate fix and listed by the gate "for the record".

## Evidence IDs and rules used

- Rule 7/8 (one main action, rank by what decides next): Ask moved next to the thing it is about; pool line first.
- Rule 18 and 35 (say what happens next; test error, retry, permission-denied states): mark error, withdrawn question, paused Ask.
- Rule 24 and MockMob overlay (AI claims match working logic; cost before irreversible model calls): no price or free promise
  when the call cannot be made. T006, T008 (no unbacked price).
- Rule 31 (motion needs a purpose): no new motion; dimming is a state, not an animation.
- Rule 34 (verify on small and large viewports): 390x844 and 1440x900, Night and Day.

## Assumptions still open

- Paused wallet is read from the shared wallet hook (reused for five minutes); a wallet that changes while the repair is
  open shows its new state on the next read.
- "Written replies" is the wording the Ask screen already used ("Written guidance"); the owner may prefer one term.

## Before and after

Before (gate captures, copied): `mockmob-next/tmp/repair4/fix1/before/` (for example `m390-dark-ask-preview.png`,
`d1440-dark-ready.png`, `m390-dark-missed.png`, `m390-dark-changed.png`).
After: `mockmob-next/tmp/repair4/fix1/` (`{m390,d1440}-{dark,light}-` plus `ready-whole`, `ready`, `picked`, `missed`,
`missed-whole`, `right`, `paused-whole`, `paused-ask`, `loading`, `markerr`, `markerr-retried`, `changed`, `changed-new`,
`none-whole`, `ask-blocked`, `ask-live`, `ask-dropped`, `lab-older`, `lab-precapture`).

## Verification

- eslint clean on every touched file.
- `test:recovery` 246 of 246, `test:learning` 300 of 300 (296 before, plus 4 new tests), `test:app` 268 of 268,
  `test:nta` 169 of 169.
- New tests: Ask label and sees-line name the mistake number; Ask offer for available, unread, paused, empty and unreadable
  wallets (no price, no free promise when unavailable); lead by basis; Revise line by due day; `reviseSummary` today; the Ask
  screen's blocked state and the order of Ask before the check in the repair.
- Headless Chrome (CDP) on `/preview/arena`, port 3141, console errors: none. Row heights at 390 px measured 46/46/46/46 before
  and after marking. Skeleton width 720 px at 1440 matches the question's.
