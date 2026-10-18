# Landing copy, bolder (18 Oct 2026, M-006)

Branch `web/land3-1018`, worktree `wt-land3`. This changes copy only. Layout, sections, art, motion and structure stay as they are on the live landing, plus the position band.

## The ask

- **M-006, his answer at about 3:50 am on 18 Oct:** "Exciting, bolder copy." He wants punchier, more energetic lines, especially where disclaimers used to be.
- **Earlier ask, 12 Oct 20:59Z:** "Important stuff, exciting copy, captions, and many things can be written" in place of the disclaimers.
- **What M-006 relaxes and keeps:** it relaxes W-093's "no hype" for tone only. The truth rules still hold: no false or unprovable claims, no invented numbers, every count real.
- **Lines kept because he praised them:**
  - The statement "Your lost marks went somewhere. MockMob shows you where…" ("This is good, actually", 15 Oct).
  - The heading "Every mark, traced back to a moment."
  - The held-story names in the position band he asked to keep (D32): Mistake Lab, What's inside MockMob, Score Recovery Lab.
  - The state-aware dock and close labels (L-008, L-010): Free to start / Sign up / Try a CUET question / Sign up free.
- **The USP (16 Oct, L-041 and W-094):** unlimited mocks from one central bank. It now reaches the hero, the stats band, pricing and the FAQ, in one short clause each and never as a banner. Rivals' counts are never named, and nothing says "never repeats".

**How the lines are written:**
- Short sentences and strong verbs.
- No exclamation marks, emoji or AI clichés (unlock, supercharge, elevate, seamless and the like).
- No "guaranteed", "best" or "#1".
- No affiliation with NTA, CUET or DU is implied, and there is no disclaimer line.

## Truth sources used below

| Tag | Claim | Where it is true |
|---|---|---|
| T-bank | Every mock is built fresh from one live bank; no fixed set; the count is live | `src/lib/server/practiceSessions.js` builds the paper at start; `/api/stats` bankSize (6,294 on 18 Oct); `ONBOARDING_LEAD` in `src/lib/paperCopy.mjs`; `docs/design-decisions/web-usp-mocks-1016.md` |
| T-pro | No cap on Pro; unlimited Quick practice and Full mocks | `practiceSessions.js` (Pro spends no credit); pricing page "Nothing to spend: every mode is included" and "Unlimited Quick practice and Full mocks, each a fresh paper"; landing `proPlan` |
| T-key | Repair is written only when the AI's own answer matches the key; on a disagreement there is no repair and no charge | `data/mistake_repair.js` lines 1-6 |
| T-swot | The SWOT is free and uses no credits | `data/mock_swot.js` line 1 |
| T-check | Checks use fresh questions, days apart | `data/recovery.js` (fresh, one per family); `data/repair_check.js` (unseen only, else refused) |
| T-exam | A full mock is 50 questions in 60 minutes, marked +5 / −1; MockMob and NTA-style screens | `labStory.mjs` PAPER_PACE_SEC; ExamComparator; tour chip |
| T-subj | 15 subjects behind 19 of every 20 CUET papers | `data/subject_claim.js` (unchanged) |

## Section by section (390 and 1440 show the same words; phones show the tour's lede line in place of its body)

### Hero
| Element | Current | New | Truth |
|---|---|---|---|
| Headline, line 3 | A clearer next step. | **No more guessing.** | Tone line. The lead below says what replaces the guessing (T-exam) |
| Lead | Take a timed mock. See where every mark went. Know what to practise tonight. | Take a timed mock. See exactly where every mark went. Fix the right chapter tonight. | Chapter review and SWOT name the chapter (T-swot) |
| Bank line, after the subject claim | Every mock is drawn fresh from one live bank of N questions, so there is no fixed set to run out of, and Pro covers as many as you take. | Every mock is built fresh from one live bank of **N questions**: no fixed set to run out of, and no cap on Pro. | T-bank, T-pro. N is live from /api/stats; without it the line drops the number |
| Exam link | Meet the exam before exam day | Try the exam-day screen | The NTA-style preview on this page (T-exam) |
| Sample heading | Your first question starts here | Your first question. Go. | |
| Sample note | Five original CUET-style questions, each with the reasoning behind the answer. | Five original CUET-style questions. Every answer comes with the why. | DemoDrill `why` on all five |
| Drill result, 4 or 5 right | Sharp. A full mock is 50 of these in 60 minutes. | Sharp. Ready for 50 of these in 60 minutes? | T-exam |
| Drill result, fewer | Good. Now you know where to start. | Good. Now you know exactly where to start. | |
| Proof 1 | 5 questions / Try them before you sign up | 5 questions / Free to try, no signup | |
| Proof 2 | 73 / DU programmes to check against your subjects | 73 / DU programmes, matched to your subjects | Live count from `duIndexFacts()` |
| Proof 3 | 2 screens / MockMob or NTA style, your pick | 2 screens / Practise calm. Rehearse NTA style. | T-exam |
| Proof 4 | 60 min / 50 questions, one full CUET mock | 60 min / 50 questions on the full CUET clock | T-exam |

**Kept as they are:**
- "For CUET UG 2027".
- Mobi's "Mobi's on your side. Even at 11pm."
- The trust ticks (prices from `publicOffer()`).
- The calculator link.
- The hero buttons (`LandingActions`, outside this pass).

### Statement and shelf
Kept word for word. The statement is the owner's praised line, and the shelf note is `SUBJECT_CLAIM.long`, which a test holds.

### Mistake Lab (held story)
| Element | Current | New | Truth |
|---|---|---|---|
| Sub | A score tells you how it went. The Lab shows why: the minutes, the second thoughts, the reason behind each miss, and the plan for the next mock. | Your score says how it went. The Lab says why: every minute, every second thought, the reason behind each miss, and the plan for your next mock. | The four scenes |
| Time, title | See where every minute went. | Find the minutes that cost you. | The time scene marks every over-pace wrong answer |
| Time, body | Each question runs against CUET's pace of 1:12. The minutes past the line stand out, and so does what they bought. | Every question runs against CUET's pace of 1:12. The overruns light up, and so does what they bought you. | `PAPER_PACE_SEC` |
| Changes, title | Every answer you changed, on the clock. | Every second thought, on the clock. | |
| Changes, body | Your first pick, what you changed it to and when, and the marks each change won or cost. | Your first pick, what you switched to and when, and the marks every switch won or cost. | |
| Repair, body | Written from the official key. If the AI's own working disagrees with the key, you get no repair and no charge. | Why your pick was tempting, where it breaks, and the rule to keep. Written from the official key, or not written at all. | T-key |
| Repair, take | If the two disagree, the question waits. You never get a guess. | If the AI can't match the key, the question waits. You never pay for a guess. | T-key |
| SWOT, body | A SWOT after every mock, built from your own answers, times and earlier mocks, with the sets to do next. Free, no credits. | A SWOT after every mock, built from your answers, your times and your earlier mocks, with the exact sets to do next. Free. No credits. | T-swot |
| SWOT, take | Partnership cost marks in each of your last 3 mocks. That is the first set. | Partnership cost marks in each of your last 3 mocks. That set goes first. | `labStory.mjs` |

**Kept as they are:**
- Kicker "Mistake Lab" (the band name).
- H2 "Every mark, traced back to a moment."
- Repair title "Repair the reason, not just the answer."
- SWOT title "Leave every mock with a plan."
- The time and changes takes, which are derived from the data.
- Every word inside the product screens (the product's own copy, held by `labStory.test.mjs`).

### What's inside MockMob (feature tour)
| Element | Current | New | Truth |
|---|---|---|---|
| Sub | Practice, repair, replay and the plan that ties them together. | Practise. Replay. Repair. Then one plan that ties it all together. | |
| Practice, title | Practise the way the exam runs. | Train on the exam's own clock. | T-exam |
| Repair, title | Fix why you missed it, not just what the answer was. | Fix why you missed it. Not just the answer. | |
| Repair, body | …written from the official key. If the AI's own working disagrees with the key, you get no repair and no charge. | …all written from the official key. If the AI's working can't match the key, there's no repair and no charge. | T-key |
| Repair, phone lede | Why your pick was tempting and where it breaks, written from the official key. No repair and no charge if the AI's working disagrees. | Why your pick was tempting, where it breaks, and the rule to keep. From the official key, or not at all. | T-key |
| Replay, title | Replay a mock, answer by answer. | Replay your mock, move by move. | The replay timeline, in order |
| Chapter review, title | Know which chapter to fix first. | Know the chapter to fix first. | |
| Chapter review, body | …traces every miss back to its chapter, so tonight's session has a target… | …traces every miss to its chapter, so tonight has a target… | |
| Combo, title | Choosing five papers? Check the combination first. | Picking five papers? Test the combination first. | `/cuet-subject-combination` |

**Kept as they are:**
- The h2 "What's inside MockMob." (the band name, and L-030).
- The Ask Mobi, Compass and Benchmarks slides.
- Every chip, point and CTA. These are factual, and several are prices and credit counts.

### Score Recovery Lab
| Element | Current | New | Truth |
|---|---|---|---|
| Check panel eyebrow | Fresh questions, never repeats | Fresh questions, days apart | T-check. **Softened:** "never repeats" is banned unless guaranteed (L-041). |

**Kept as they are:**
- Kicker, h2 "Fix it once. Check it holds." and the sub. These are already bold.
- The four steps.

### DU Compass
| Element | Current | New | Truth |
|---|---|---|---|
| H2 | Put your shortlist beside the numbers. | Hold your shortlist up to real cutoffs. | Published CSAS 2026-27 round lists |
| Sub | Slide a score and see which colleges it would have cleared in 2026, by category and round. | Slide a score. See which colleges it would have cleared in 2026, by category and round. | |
| Compass Pro text | Turn your recorded practice into a paper-by-paper range. Compare it with your DU shortlist and see which paper has the most room to improve. | Turn your practice into a paper-by-paper range. Set it against your DU shortlist and see which paper has the most marks open. | Compass Pro list, "Next move" |

### DU eligibility and Combo Planner
| Element | Current | New | Truth |
|---|---|---|---|
| H2 | Which DU courses fit your subjects? | Which DU courses are open to you? | Eligibility by subject (2026 rules) |
| Sub | Tick your subjects to see every DU programme they open under the 2026 rules, then compare college cutoffs in your category. Free, no signup. | Tick your subjects. See every DU programme they open under the 2026 rules, then compare college cutoffs in your category. Free, no signup. | |
| Combo h3 | Not sure which CUET subjects to pick? | Five CUET subjects. Pick them right. | |
| Combo text | Choose your DU goals and available subjects. Compare… | Set your DU goals and the subjects you can take. Compare… | |

### Exam screens
| Element | Current | New | Truth |
|---|---|---|---|
| H2 | Your practice space. / Your exam-day rehearsal. | Practise calm. / Rehearse exam day. | T-exam |
| Sub | Practise on MockMob's calm screen. As exam day gets close, switch to the NTA-style screen and rehearse the real thing. Same questions, either way. | Build speed in MockMob. As exam day gets close, flip to the NTA-style screen and rehearse. Same questions, either way. | T-exam |

### Stats band
| Element | Current | New | Truth |
|---|---|---|---|
| Bank note | Every mock draws from this bank, so there is no set number of mocks. Scored +5 right, −1 wrong. | Every mock is built from this bank: no set number, no cap on Pro. Marked +5 right, −1 wrong. | T-bank, T-pro |

### Instagram
| Element | Current | New |
|---|---|---|
| Sub | DU seniors and admissions creators have put MockMob in front of their audiences. Tap a reel to watch it here. | DU seniors and admissions creators have put MockMob in front of their followers. Tap a reel and watch it right here. |

The h2 "Featured by CUET creators." is kept: it is true and already confident. The counts are the real ones from `src/lib/social.js`.

### Pricing
| Element | Current | New | Truth |
|---|---|---|---|
| H2 | Start free. Go Pro when you want more room. | Start free. Go Pro for unlimited mocks. | T-pro |
| Sub (one-time offer) | One payment of ₹99 covers you through 31 July 2027. Monthly Pro at ₹99 is coming. Pay once now and keep every day you paid for. | ₹99 once covers Pro through 31 July 2027. Monthly Pro at ₹99 is on the way. Pay once now and keep every day you paid for. | `publicOffer()` |

The plan lists, prices and buttons are factual and kept. Mobi's "No rush. Free stays free." is kept.

### FAQ
| Element | Current | New | Truth |
|---|---|---|---|
| "What is MockMob built for?" | …with DU eligibility and published cutoffs alongside. | …with DU eligibility and published cutoffs alongside. Every mock is built fresh from one live question bank, and Pro puts no cap on how many you take. | T-bank, T-pro |

### Close
| Element | Current | New |
|---|---|---|
| H2 | Five questions. Then your next move. | Five questions. Your move. |
| Sub | Answer five now. Sign up when you want MockMob to keep your record. | Answer five now. Sign up when you're ready to keep score. |

The buttons and "Free to start. No card needed." are kept (L-008, L-010).

## Not rendered today, left unchanged
These branches are not live:
- The `recoveryReleased()` hero ("Find the mistake behind the marks.").
- The `newOfferReleased()` plan lists.
- The monthly-offer price lines.
- The Learn slide (STUDY flags off).
- The Wall of love (no consented voice yet).

The footer tagline lives in `MarketingFooter.jsx`, outside the landing files, and is unchanged.

## Seen while checking, not changed (data, not copy)
The Changes scene still shows a change made 10:35 after the first pick (Q4, 3:45 to 14:20). L-033 bans "10:35 change times" as unrealistic. This is the session data in `labStory.mjs`, which `labStory.test.mjs` holds. Changing it is a data change for the owner's next landing pass.

## Verified (18 Oct, against the running dev server on port 3206)
- **Tests.** No existing test asserted the replaced lines, so none were edited.
  - New: `src/components/landing/landingCopy.test.mjs` (6 tests). It locks the bold claims to the code that makes them true:
    - Pro "unlimited mocks" holds only while the Pro list says unlimited.
    - "Or not at all" holds only while a disagreement gives no repair and no charge.
    - "Free. No credits." holds only while the SWOT uses no model and no credit.
    - No landing source says "never repeats", "41 subjects", a guarantee or a hype word.
  - Results: `node --test src/components/landing/*.test.mjs` passes 34 of 34. `npm run test:subjects` passes 30 of 30. `landing_content` and `sample_import` pass 12 of 12. eslint is clean on the changed files.
- **Headless walk.** Headless Chrome via playwright-core, with its own profile. It covered every section and every held-story scene, at 390x844 and 1440x900, in Night and Day. Screenshots are in `tmp/land3-copy/` (before: `tmp/land3-copy/before/`).
  - No horizontal overflow and no page errors.
  - No text element gained a line against the before run; 4 elements at 390 and 7 at 1440 got shorter.
