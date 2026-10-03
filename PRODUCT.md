> Current authority: [approved 2 October implementation contract](docs/brain/ROADMAP-2027.md). Older rollout and packaging decisions below are superseded where they conflict. Evidence and budget safeguards remain binding.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: an Indian Class 11/12 student (or drop-year repeater) preparing for **CUET UG 2027**, the single national entrance test that decides their undergraduate admission — most visibly to Delhi University.

Their situation, confirmed as the design scene:

- They browse, decide, and study **on a phone**, not a laptop. The device floor is a **budget Android on patchy 4G** (owner decision, Aug 2026). Desktop is the minority case.
- They arrive under time pressure and exam anxiety, often late at night, often in low light, often mid-panic after a bad score or a syllabus scare.
- They are price-sensitive and skeptical: they have already seen large test-series brands charging ₹499+ per season and coaching sites full of unverifiable claims.
- The job: **find out where they actually stand on CUET, and what to fix next**, fast enough to act tonight.

Secondary role in the same product: **moderators** (`user.role === 'moderator'`) who review community-submitted questions. Not a marketing audience.

## Differentiator decision (October 4, 2026)

See docs/brain/DECISION-2026-10-03-DIFFERENTIATOR.md. Primary bet: **repair that holds** —
find the reasoning slip behind a repeated mistake, repair it, and check later on unseen questions
whether it held. Supporting: trustworthy practice (versioned evidence, corrections, invalidation)
and goal-aware DU tools (maintenance only). Proven on one pathway before eight. No capability is
advertised until every evidence level through live availability is met. The "score recovery"
framing implies recovered marks. **Owner decision (4 Oct, evening):** marketing name "Score
Recovery", feature "Score Recovery Lab", per-mistake action "Mistake Repair"; loop line "Find the
marks you're losing. Repair the mistake. Prove it on fresh questions." Never print a recovered-marks
number. Student AI is enabled (USD 25/IST month cap); PrepOS model replies and Mistake Repair use the
monthly PrepOS credits (10 free / 50 Pro). Top-up purchases stay paused. See
docs/brain/PLAN-2026-10-04-NEXT-DAYS.md.
Under-18 learners: DPDP consent/monitoring rules apply from about 13 May 2027 (legal review).

## Current implementation authority (October 1, 2026)

The approved specification in `docs/brain/SPEC.md` supersedes older promises below.
Score Recovery Lab is the primary USP: understand marks lost through knowledge,
time and answer decisions, practise an intervention, then retest on fresh material.
Launch scope is CUET UG 2027 English, Accountancy, Business Studies and Economics.
2027 exam rules are provisional until verified. No routine human question review;
uncertain content remains unpublished. Community moderation is a secondary legacy
workflow and cannot bypass automated evidence. Never claim admission certainty,
verified inventory or demonstrated improvement without supporting records.
₹99 one-time access through July 31, 2027 and existing entitlements remain.

## Product Purpose

MockMob is a CUET UG practice platform. A student takes timed mocks and chapter drills against a validated question bank; the platform maps every miss back to a specific chapter, tells them what to do next, and connects the resulting score estimate to realistic Delhi University course options.

Success = a student who (a) discovers their real weak chapters instead of just a score, (b) returns to drill those chapters, and (c) walks into CUET 2027 with a calibrated sense of where they'll land.

Business success = conversion to the one-time **₹99 CUET 2027 access** purchase.

## Positioning

**One exam, all the way down.** Every large prep platform treats CUET as one shelf among forty exams. MockMob does CUET UG only — from first mock to DU admission decision. Scope confirmed by the owner (Aug 2026) as *fully committed CUET-only*: positioning, copy, and IA say "the CUET platform," and no surface may hedge toward JEE/NEET/UPSC. (`PROJECT_CONTEXT.md` still names other exams; it is stale and not authority.)

The mechanism a neighbouring product could not truthfully copy:

1. **An engineered question bank, not a scraped one.** Every question passes schema validation, answer-key verification, duplicate detection, and difficulty tagging before it reaches the Arena. Wrong answer keys are the cardinal failure mode of mock platforms, and the machinery to hunt them is the product's spine (`scripts/pipeline/`, `data/tests/answer_integrity.test.mjs`).
2. **The score is a starting point, not the output.** Radar maps misses to chapters, PrepOS converts that into a next move, Admission Compass converts the score band into DU course options.
3. **Receipts over reviews.** Claims are backed by live counters or they don't ship.

## Operating Context

How the product is actually used and evaluated:

- **Evaluation happens before signup.** A visitor's first real contact is the 5-question no-signup demo drill on the landing page. That drill *is* the onboarding — it must reach a solved CUET question within seconds on a phone.
- **Practice modes:** Quick Practice (5–20 questions), Full Mock (50 questions / 60 minutes), Smart Practice (adaptive, Pro), NTA Mode (exam-style 50 Q / 60 min console with original practice content, Pro). Mode labels and availability come from `data/capabilities.js`.
- **Credit economy:** free accounts spend credits per session (Quick Practice 10 credits, Full Mock 50 credits). Ledger-backed and atomic — `credit_transactions` plus `spend_credits`/`grant_credits` RPCs. Separately, PrepOS has its own AI-credit wallet. **Superseded (2 Oct 2026):** paid PrepOS replies and new top-ups are paused; existing wallets are preserved and shown read-only (see docs/brain/CLAUDE-WORKLOG.md).
- **Checkout:** Razorpay. **Finalised pricing (owner, 2 Oct 2026): Pro is ₹99 per month, auto-renewing, cancellable in Account** (`pro_monthly_99`). It sells only once `RAZORPAY_PLAN_ID_PRO_MONTHLY_99` is configured (see docs/brain/LEARNING-DEPLOYMENT.md). Until then the existing ₹99 one-time access (through 31 July 2027, no auto-renewal) is the only thing on sale, and all copy follows `publicOffer()` in `src/lib/payments/offer.js`. One-time buyers keep their term.
- **Discovery:** organic search on long-tail CUET queries drives the subject hubs (`/cuet/[subject]`), the CUET-2027 guide, and the SEO content pages. These are entry points, not secondary pages.
- **Community loop:** students upload questions, moderators review, approved uploads grant 15 credits.

## Capabilities and Constraints

**Stack (existing, not up for redecision):** Next.js 16.2.4 App Router (breaking changes vs. older Next — consult `node_modules/next/dist/docs/` before writing framework code, per `AGENTS.md`), React 19.2.4, Tailwind v4 (`@theme inline` in `src/app/globals.css`), Supabase Postgres + `@supabase/ssr`, NextAuth v5 beta, Razorpay, `motion` v12, `lucide-react`, Chart.js.

**Hard constraints:**

- **Device floor: budget Android on patchy 4G.** This is a product constraint, not a nice-to-have. It caps JS payload and rules out heavy WebGL/canvas ambition as the default path; any richer hero mechanism must be progressive enhancement over a cheap, correct base.
- Do not break the data access layer (`data/db.js`) or re-implement credits — always route through `Database.spendCredits` / `Database.grantCredits`.
- Razorpay checkout must keep working end to end (`/create-order`, `/create-subscription`, `/verify-payment`, `/webhook`).
- Server Components by default; `"use client"` only for interactive UI.

**Content facts that must stay accurate:**

- Plans: `pro_monthly_99` (₹99/month, opens when its Razorpay plan ID is set) and `pro_cuet_2027` (₹99 one-time through **31 July 2027**, on sale only until monthly opens; always honoured for existing buyers). `pro_cuet_2026` and the ₹69 `pro_monthly` are legacy and must not be sold.
- Free tier: credit-gated Quick Practice and Full Mock, weekly progress tracking, 25 saved questions, leaderboard.
- Pro adds: no per-session credits for Quick Practice / Full Mock, Smart Practice, NTA Mode, difficulty selector, unlimited saves, subject–course eligibility mapping. **Superseded (2 Oct 2026):** CUET score-band estimate, DU college recommendations and fast-lane generation are not product promises; DU tools show sourced historical eligibility and cutoffs only. **Updated (owner, 3 Oct 2026):** Pro includes **Compass Pro**: a practice projection per paper (own record, +5/−1 arithmetic, Wilson range, labelled "projection, not a prediction or admission chance"), a personal DU shortlist compared with published cutoffs, and a next move. Never a normalised score, percentile or chance.
- Free tools include the **CUET Subject Combo Planner** (`/cuet-subject-combination`): which subject combination meets the student's DU targets under DU's published rules. Eligibility only, no score claims.
- **42 CUET subjects** are defined in `data/subjects.js` (13 languages, 28 domain subjects, General Test), each chapter-tagged. Live *covered* subject count comes from `/api/stats` — never hardcode it above what the API reports.
- Six subject hubs are published: English, Accountancy, Economics, Business Studies, History, Political Science (`src/lib/subjectHubs.js`).
- MockMob is **not affiliated with NTA, DU, or any official exam body**. This disclaimer is load-bearing and must survive any redesign.

**Terminology (product vocabulary, keep it):** Arena (the practice surface), Radar (weakness analytics), PrepOS (AI co-pilot), Admission Compass (score → DU course mapping), Mistake Replay, Mock Sprint, NTA Mode, credits.

## Brand Commitments

- Name: **MockMob**. Support: support@mockmob.in. Site: mockmob.in.
- Voice, owner-stated and binding: **tech-superior, premium, unique** — explicitly *not* a standard marketing page.
- **Kinetic text personality is a keeper.** The owner liked the original morphing-text treatment; the scramble/decode effect (`DecodeWord`) currently carries it. Any replacement world must keep a deliberate kinetic-type moment rather than dropping to static headlines.
- Existing product mechanics that must survive a redesign intact: the **5-question no-signup demo drill**, the **live stats band fed by `/api/stats`**, and working Razorpay checkout.
- **Volt green `#D2F000` is the retained brand signature** (owner decision, Aug 2026). Everything else about the incumbent look — layout, typography, spacing, motion, component vocabulary — was released for replacement.
- **Standing preference: the category standard, executed at full craft** (owner decision, Aug 2026). Offered a rolled out-of-category visual world twice, the owner chose the conventional form on purpose. Conventional structure is therefore the commitment, not a fallback: hero with a clear primary action, feature sections, comparison pricing, FAQ. It is executed without irony and without smuggled quirk.
- **Landing look (owner decision, Oct 2, 2026):** the homepage is night-first ("Night Arena", see DESIGN.md), evolved from the original mockmob.in with grid/dot-matrix depth, section animation and richer content. The earlier paper homepage was rejected. This applies to `/` only.
- **Craft bar: Brilliant and Duolingo, plus the Indian EdTech leaders (Physics Wallah, Unacademy, Allen)** the audience actually compares MockMob against (owner decision, Aug 2026). This sets the register: activation-first, warm rather than austere, mobile-native, bright surfaces with the product's own screens rendered dark.

## Evidence on Hand

Confirmed usable proof (owner, Aug 2026):

- **Question bank size and CUET subject coverage**, live from `/api/stats` (`bankSize`, `subjectCounts`), with a truthful static floor when the API is unreachable.
- **Creator reach (owner, 3 Oct 2026)**: public follower and reel engagement counts of creators who featured MockMob, dated and sourced from their profiles in `src/lib/social.js`, with paid partnerships marked. These describe creators' audiences, never MockMob's users.
- **The question-integrity process itself**: machine validation, answer-key audit, duplicate detection, difficulty tagging (routine peer/human review is superseded; uncertain items are quarantined) — the claim is the pipeline, and it is real.

Explicitly **not** available and never to be fabricated:

- No testimonials, reviews, quotes, student photos, or named success stories. (Fabricated testimonials were removed in Jul 2026 and must not return.)
- No student counts, registration numbers, attempt totals, or community-size figures — the owner did not authorise these as proof. Design must persuade **without any social-proof headcount**.
- No rank improvements, score guarantees, selection claims, or partner/press logos.
- Every proof surface needs a truthful **zero/low-traffic state**, because the counters can legitimately read small.

## Product Principles

1. **One exam, all the way down.** Depth on CUET beats breadth across exams. Never hedge toward other exams.
2. **Receipts, not reviews.** If a claim can't be backed by a live number or a described mechanism, it doesn't ship. Persuasion must work with zero social proof.
3. **The phone is the product surface.** A budget Android at 11pm on weak signal is the design target; anything that only works on a fast desktop has failed.
4. **A score must end in a next move.** Every result surface owes the student a specific, chapter-level action — not a number and a shrug.
5. **Let them solve before they sign up.** The fastest honest path to belief is a real CUET question answered in the first viewport.

## Accessibility & Inclusion

- Low-light, one-handed, late-night phone use is the primary scene; contrast and touch-target sizing are functional requirements, not compliance checkboxes. Minimum 44×44px targets, ≥4.5:1 body contrast.
- `prefers-reduced-motion` is already honoured across the incumbent code and must remain honoured — the kinetic personality has to degrade cleanly.
- Copy is English-only today, but subject names and chapter titles are long and untruncatable (e.g. "Knowledge Tradition & Practices of India", "Computer Science / Informatics Practices") — layouts must survive them.
- Network resilience is an inclusion issue here: every data-backed surface needs a defined slow/failed state.
