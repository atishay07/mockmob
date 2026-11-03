# Preparation-suite completion audit — 5 October 2026

## Verdict

The preparation suite is a working four-subject pilot, not the finished preparation suite in the approved plan. The follow-up materially improves the original release. Foundation and the first complete learning experience are implemented; eight concept blueprints have teaching content. Full syllabus coverage, released evidence-backed recovery checks, downloadable offline packs and several acceptance/measurement gates remain unfinished.

This is a read-only product/source audit. No application behavior, production records, credentials, entitlements or deployment settings were changed. Only audit artifacts were saved.

## What was checked

- Pasted implementation report, original approved preparation-suite requirements, PRODUCT.md, DESIGN.md and brain documentation.
- Actual release checkout: `artifacts/study-suite/release`, HEAD `d3ec177`, following implementation commit `78a627f` and baseline `a6a61cc`. The original dirty checkout remains at `6c5e05b`; it is not the current deployed implementation.
- Current lesson/card data, server selection, scheduling, progress, preferences, response contracts, study components and authentication code.
- Saved deployment/import receipts and regression/build/lint logs. These are historical evidence, not fresh execution of every check.
- Fresh `npm.cmd run test:study`: **19 passed, zero failures**. Tests exercise grading, scheduling, revisions, database authorization, retries, introduction limits and content tampering in the local test database.
- Signed-in live Learn library, vocabulary lesson overview, and the old study URL from the user's browser context. No lesson or recall run was started and no answer/rating was submitted.
- Live library width 320/390 and lesson overview width 1440: asserted actual dimensions and no root horizontal overflow. At 390 the study library's measured links/buttons met 44px width/height. This does not validate every page, zoom setting, theme or physical phone.
- Impeccable static detector on study components: 58 reported entries, including advisory design-ramp differences. Raw output is in the release checkout's `artifacts/study-suite/v2/2026-10-05-audit-detector.json`. Do not interpret that number as 58 confirmed usability defects.

## Completion against the delivery stages

| Stage | Status | Evidence and remaining work |
| --- | --- | --- |
| 1. Foundation | Largely complete | Four-subject syllabus map, versioned sources/content, saved migrations, dry runs, service-only tables and runtime contracts exist. Supabase CLI migration history still needs reconciliation. Formal recovery source registry remains empty. |
| 2. First complete experience | Implemented | Lessons, checks, durable recall, server scheduling, practice links, Today and separate study progress exist. English now teaches real words rather than only explaining recall. Current defects below prevent treating the experience as fully accepted. |
| 3. Four-subject pilot | Teaching pilot implemented; formal recovery incomplete | All eight concept blueprints have lessons. Sources, content hashes and tamper gates exist. No released formal recovery pathways or assessment families are established by this work. |
| 4. Full four-subject coverage | Early partial implementation | Weekly preferences and Pro mixed recall exist. Printed lesson summaries exist. Only eight chapters have any lessons; complete chapter coverage and chapter-level summaries remain. |
| 5. Mobile expansion | Not implemented | Responsive web and online interruption recovery exist. Downloadable study packs and Android offline/account-isolation/content-update acceptance do not. |

## Verified content inventory

Recomputed directly from the release data: **14 lessons, 65 scheduling cards, 179 task variants**, including 30 vocabulary words.

| Subject | Lessons | Chapters with any lessons / mapped chapters |
| --- | ---: | ---: |
| English | 8 | 3 / 7 |
| Accountancy | 2 | 2 / 16 |
| Business Studies | 2 | 2 / 13 |
| Economics | 2 | 1 / 18 |
| Total | 14 | 8 / 54 |

The remaining **46 chapters have no published lessons**. The eight touched chapters also have partial concept coverage. The 179 variants are forms of 65 memory cards, not 179 independently reserved exam questions. The 2027 map remains provisional, as the UI states.

## Implemented capability checklist

- Subject → chapter → concept library, one primary Learn action, lesson objectives, worked examples/contrasts, common mistakes and knowledge checks with feedback.
- Lesson completion → focused recall → chapter-practice setup, retaining the existing cost/eligibility/session path. Practice links do not themselves start or charge a test.
- Different recall forms, numeric/ratio normalization, optional device text-to-speech, linked lessons and next-review feedback.
- FSRS 5.4.2 server scheduling, 0.90 target, five new cards per IST day, overdue backlog guard, lapse lesson recommendations.
- Version-bound runs, append-only events, request keys, expected revisions, atomic scheduling, correction invalidation, service-only grants and owner-bound application routes.
- Study subject/time preferences, Pro saved weekly preferences and custom mixed recall. These are source/test verified; this audit did not exercise their complete live Free/Pro flows.
- Shared Today sequence and mock shortcut, reading/recall counters distinct from assessment marks, mobile Today/Practice/Learn/Review navigation.
- Published-content manifests, sources and rollback flags. Saved phase-2 receipt reports old v1 versions quarantined without deletion.
- Saved logs contain 183 passing tests across recovery, learning, study, answer integrity, NTA, payments and landing/UI; lint and production build passed in those logs. Only the 19 study tests were rerun in this audit.

## Defects and incomplete connections

### P0 — Production demo authentication needs immediate closure

`src/lib/auth.ts:16-29` registers Demo Login without a production guard. `authorize` looks up an existing user by supplied name or creates one, then returns their identity without a password. `data/db.js:313` queries names with `ilike`. The live `/api/auth/providers` endpoint still advertises the credentials provider. This creates a potential existing-account impersonation path, beyond merely allowing demo account creation. No impersonation attempt was performed.

The same live provider response lists localhost:3000 sign-in/callback URLs; verify production NextAuth URL configuration when closing this route. Do not disrupt the working Supabase/Google flow.

### P1 — Guided Today can introduce recall before teaching

`studyRecord` and `startStudyRun` pass cards from all selected published units into `recallQueue`; unseen cards are not restricted to completed lessons. `guidedSequence` places that queue before Learn. A fresh deterministic reproduction with zero completed lessons and zero card states returned:

1. Lock in 5 new cards — described as "Cards from lessons you have read".
2. Learn the vocabulary lesson.
3. Practise 10 questions.

The Learn library's initial hero prioritizes a lesson, but Today retains the confusing earlier behavior. Restrict guided new-card introductions to taught units, while keeping due reviews and intentional independent browsing available. Add a meaningful new-student acceptance check across both queue selection and Today.

### P2 — Results do not expose every matched chapter

`src/components/study/MistakeLessonLink.jsx:24` uses `units.slice(0, 3)`. Matching all mistaken chapters does not mean rendering all of them; several lessons from one chapter can exhaust the limit. Group by chapter and provide an explicit remainder/show-all path.

### P2 — Corrected-run recovery lacks a direct current-lesson action

The live old URL `/study/9fd62677-414a-4be1-ba95-819a7406fa49` shows "open the current version", but presents Try again / Back to Learn / Practise questions. It does not link the replacement lesson. `StudyWorkspace` handles this load failure before `StudyRun` can render its current-lesson action. Back to Learn is a workaround; retrying cannot resume the retired content. Return safe replacement metadata or a direct lesson link.

### P2 — Pro mixed revision adds an unnecessary detour

`StudyPreferences.mixed` starts a run and displays "Continue it from the top of Learn or from Today" instead of opening the returned run. The already-loaded library is not refreshed there. Navigate directly to the returned run and verify stale-page/concurrent-session behavior.

### Incomplete — Fresh proof and the learning-to-assessment connection

The Apply step currently links ordinary chapter practice. It does not reserve an unseen assessment family or prove that this specific concept held after delay. `data/recovery_pathways.json` has no released pathways and `data/source_registry.json` has no formal sources/families. The study-specific source registry is populated; these are separate gates. Preserve the distinction and release validated assessment pathways before claiming the full mistake → teaching → recall → delayed unseen proof loop.

### Incomplete — Richer coverage and measurements

Published lesson kinds include text, word sets, steps, tables, contrasts and checks, but no diagram blocks. Economics graph interpretation and deeper formula/concept coverage remain content work. Printable material is per lesson, not complete chapter summaries. Raw dated runs/events support some analysis, but the agreed activation, due-review return, delayed outcomes, defect rates and cost-per-validated-unit reporting are not delivered as an operational measurement system.

## Acceptance gates still open

- Real budget Android with keyboard open and interrupted/slow connectivity.
- Physical screen-reader journey, actual 200% text/zoom, reduced-motion and complete both-theme checks across updated screens. Source ARIA/focus/touch support is useful evidence, not accessibility certification.
- Complete updated 320/390/768/1024/1440 and short-landscape flow matrix. Older v1 matrix receipts do not automatically validate all v2 lesson blocks.
- Controlled performance measurements against LCP ≤2.5s, INP ≤200ms and CLS ≤0.1, followed by field evidence. Layout checks and production build do not prove these targets.
- Real new-student comprehension: can students explain what Learn does and complete lesson → recall → practice without coaching?
- Meaningful delayed unseen-question outcomes with sample sizes/uncertainty; no comparative superiority is established.
- Full current live acceptance for Free/Pro preferences, AI exhaustion, missing/unmapped content, all interrupted requests/concurrent tabs and corrections. Existing automated coverage reduces risk but does not finish these live gates.
- Supabase migration-history reconciliation and deliberate integration of the original dirty checkout before later publishing owner edits.
- Downloadable offline packs and associated account-isolation/sign-out/content-correction checks.

No aggregate accessibility/performance score is issued: key measurement gates are untested. The sampled live UI is coherent and readable, and the versioned persistence tests provide useful implementation evidence. Those positives do not close the remaining gates.

## Recommended order

1. Close the production demo authentication route and verify production auth URLs/session boundaries.
2. Fix Today for new students, correction recovery, result-link completeness and direct mixed-run navigation.
3. Test the complete first-time journey with actual students and finish mobile/accessibility/performance acceptance on the current release.
4. Release one validated delayed fresh-check pathway and its measurement before expanding that claim across eight concepts.
5. Expand sourced content chapter by chapter; publish actual coverage. Finish chapter summaries and richer concept representations where useful.
6. Add downloadable packs only after the online experience passes its gates; then complete Android acceptance.

Routine visual polish belongs after the functional gaps. The Impeccable adapt/harden checks can address the identified UI acceptance work, followed by polish. Re-run a bounded audit after fixes; do not substitute a long cosmetic loop for student comprehension or complete content.
