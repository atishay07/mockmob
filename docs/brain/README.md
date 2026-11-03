# MockMob project brain

Authority: the owner's approved implementation roadmap, 2026-10-02, narrowed by the
differentiator decision of 2026-10-03/04 (DECISION-2026-10-03-DIFFERENTIATOR.md).
Read PRODUCT.md for positioning, DESIGN.md for visual conventions, then the files below.

**Working plan (owner, 4 Oct): PLAN-2026-10-04-NEXT-DAYS.md** — Night 1 Score Recovery + AI,
Day 2 AI-verified error-free questions + NTA mode, then the Google Play app. Budgets: student AI
USD 25/IST month (DB-enforced), content generation USD 50 lifetime. Marketing name "Score Recovery";
feature "Score Recovery Lab"; action "Mistake Repair". Model choice: AI-MODEL-REPORT-2026-10-04.md.

**UI/UX execution plan (owner follow-up, 4 Oct): UI-UX-IMPLEMENTATION-PLAN-2026-10-04.md** —
phone performance, accessibility, stable layout, student states/error prevention and activation.
It narrows the UI audit priorities; owner-retained official-key trust wording is outside this sprint.
It does not replace the product working plan or change runtime/payment/evidence contracts.
**Local implementation evidence (4 Oct): UI-UX-IMPLEMENTATION-RESULTS-2026-10-04.md** —
implemented changes, 179 passing tests, responsive/state checks and remaining hardware/performance/deploy gates.

One direction: **repair that holds** is the primary bet (diagnose a reasoning slip, repair it,
check it later on unseen questions), proven on one pathway before eight. Trustworthy practice
supports it; goal-aware DU tools are maintained, not expanded. Label every claim with one
evidence level: research hypothesis → source implementation → academic validation → staging
verification → live availability (`EVIDENCE_LEVELS` / `DIFFERENTIATORS` in data/capabilities.js).

- DECISION-2026-10-03-DIFFERENTIATOR.md: dated competitor and student-need research, the three
  options compared, pre-registered validation thresholds, assumptions and revisit triggers.

- ROADMAP-2027.md: current product, packaging, stages and acceptance contract; takes precedence over older decisions.
- SPEC.md: retained evidence and architecture detail, subordinate to ROADMAP-2027.md.
- STATUS.md: implementation evidence and remaining work. Never confuse source shipped with production deployed.
- GENERATOR-CURRENT-BLOCKERS-2026-10-08.md: current measured spending, live bank versus staging, unresolved academic/runtime gates and the owner's one-off 127-item review. Read before further generator work.
- Completed C/accountability handoff: artifacts/question-factory/cuet-readiness-2026-10-08/execution/ACCOUNTABILITY-HANDOFF-2026-10-08.md. C100/100 complete,84 machine-eligible,USD0.855970 settled,0published; owner holds further optimization. This is not a current academic release.
- Quality-only assessment: artifacts/question-factory/cuet-readiness-2026-10-08/execution/QUALITY-ONLY-ASSESSMENT-2026-10-08.md.20criteria,about6/10 judgment for measured outputs,cost excluded;targeted diagnostic,not fresh reliability evidence. Confirmed semantic duplicate means at most83 distinct C eligible ideas before further review;current unattended publication remains blocked.
- IMPLEMENTATION-2027.md: stage-by-stage completion checklist and the next executable acceptance gates.
- LEARNING-DEPLOYMENT.md: saved migrations, explicit staging order, switches and non-destructive rollback.
- GENERATOR-OPERATING-RULES.md: standing generator invariants (validators never removed, per-stage effort, waves of ten, no web search in the loop, PYQ-calibrated CUET fit). Read before touching the question pipeline.
- Generator handoff (8 Oct 2026, not released, next steps): artifacts/question-factory/cuet-fit-2026-10-07/HANDOFF.md
- QUALITY.md: publishing, source and budget rules; includes the CUET-fit contract.
- ARCHITECTURE.md: interfaces, storage, authentication and migration/rollback.
- COST-POLICY.md: reservation, usage receipts, route pauses and pricing setup.
- BENCHMARK.md: independent reference fixtures and release criteria.
- BACKLOG.md: ordered remaining implementation and launch work.
- BANK-AUDIT.md: read-only inventory and limits of historical failure evidence.
- DESIGN-REFERENCES.md: public reference catalogs and the patterns actually used.
- ROADMAP-GAP-AUDIT-2026-10-02.md: evidence audit comparing the GPT 6.1 Sol
  implementation with the approved roadmap, including Arena and PrepOS findings.
- CLAUDE-MASTER-HANDOVER.md: copy-ready implementation contract for the next
  Claude run; it supersedes older contradictory execution prompts.

The earlier human-review requirement is superseded. The system abstains when evidence
is insufficient. 10,000 questions for $10 and superiority over human review are not
established results. No fabricated counts, testimonials, selection or score guarantees.

## Delivery order
0. Reconcile capability truth and the project brain.
1. Unify sessions, allowances and owner-bound learning evidence.
2. Validate ONE complete pathway (sacrificing/gaining ratios), measure it, then expand.
3. Connect diagnosis, repair, fresh checks and the shared next action.
4. Harden payments, admissions, runtime costs and correction history.
5. Release behind independent flags; enable ₹299 only after all launch gates pass.

The earlier 40–80-question pilot and store delivery order are superseded by
ROADMAP-2027.md. Question count alone does not release a recovery pathway.

## Handoff rules
Every change records tests, deployment needs, rollback and uncertainty in STATUS.md.
Source registry updates must include permission, source version and locator.
Keep benchmark families disjoint from authoring examples. A generated fixture is a
software regression test, not an independently keyed academic benchmark.


Current generator continuation: [V76 bounded qualification plan](../../artifacts/question-factory/cuet-readiness-2026-10-09/V76-QUALIFICATION-PLAN.md), [prepared checkpoint](../../artifacts/question-factory/cuet-readiness-2026-10-09/execution/root-checkpoint-v76-prepared.json). V75 finished and failed its frozen release; V76 native qualification is pending. STATUS records current costs, holds and exact next steps.


Latest generator evidence (9 October IST): V76 qualification completed and failed; local additiveV77 verified but unqualified. See artifacts/question-factory/cuet-readiness-2026-10-09/execution/V77-LOCAL-CORRECTION-RESULT.md and root-checkpoint-v77-local-complete.json. Frozen studies/history preserved; further paid study awaits single-study scope clarification.


Current generator execution milestone (9 October2026 IST): see STATUS's latest V77 prospective-runner entry and artifacts/question-factory/cuet-readiness-2026-10-09/execution/V77-RUNNER-VERIFICATION-RESULT.md. V76 failed, V77 locally frozen/unqualified; further paid qualification awaits the single scope answer.

Latest generator continuation (9 October 2026 IST; supersedes the older pending-run and blocked-scope pointers above): [Claude handoff](../../artifacts/question-factory/cuet-readiness-2026-10-09/CLAUDE-HANDOFF-2026-10-09.md) and [copy-ready starting prompt](../../artifacts/question-factory/cuet-readiness-2026-10-09/CLAUDE-START-PROMPT-2026-10-09.md). The owner now authorizes Claude's comprehensive final pass through necessary fixes, paid fresh qualification, a qualified pilot and current-profile staging verification within the unchanged USD50 lifetime guard. Final V7.7 cannot pass; V7.8 remains frozen/unqualified pending evidence. Historical studies and uncertain holds remain intact; production operations still require final explicit approval. STATUS contains the authorization update and latest saved costs/process snapshot; the handoff contains targeted evidence and regression causes.

Latest generator result (10 October 2026 IST): V716 integrated, frozen and qualified once on a fresh independently keyed 32-case benchmark. It **failed** (0 false accepts; valid 16/20, Business Studies 3/5). See [result and diagnosis](../../artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v716/V716-QUALIFICATION-RESULT-20261010.md) and STATUS. No pilot, release or production action followed.


## Product experience research and agent workflow — 12 October 2026

- [Consolidated product experience research](PRODUCT-EXPERIENCE-RESEARCH-2026-10-12.md):
  additive integration of the supplied product brain, 59-page UX specification,
  earlier 201-line transcript, new 164-line dashboard/Undertone transcript, and
  owner notes. Includes expanded UI craft, emotional design, retention, learning
  recommendations, website/Android implications and an agent workflow (§11).
  Read §1 for current-authority reconciliation and §§11–12 for the task brief and
  verification rubric; retrieve other sections as needed. Complete originals,
  page-text extraction, six reference figures and checksums are retained.
- [Source manifest](research-sources/2026-10-12-product-experience/source-manifest.json)
  and [document verification](research-sources/2026-10-12-product-experience/verification.json).

This is research plus repository guidance, not a new product implementation,
release, retention result or replacement roadmap. Source-appendix instructions
are not new authorization. Current product/design, evidence, budget, wallet and
release contracts continue to apply.
