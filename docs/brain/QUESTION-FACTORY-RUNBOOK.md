# Subscription screening and the Luna question factory

Implemented locally on 5–6 October 2026. The factory has completed a paid 100-question
commissioning run. Earlier calibration passes are historical; the current gate is paused.
Production publication remains gated. Current reconciliation and revised acceptance
policy: artifacts/question-factory/final-pass/REPORT.md (6 October final pass).
The target remains 10,000 **new published** questions, initially 2,500 per subject.
The factory starts paused. Jev is outside v1.

## Initial commissioning evidence (historical; current receipt below)

- Pilot target is **800 candidates, 200 per subject**. Eligibility, newly published
  inventory and calibration fixtures are separate counts. No new pilot questions
  have been generated or published yet.
- Legacy screening remains subscription/local only: 9,242 rows, 6,299 mechanically
  clear, 2,943 suspect signals; included desktop review sample 15 clean / 3 suspect /
  2 incomplete. No production screening import; no legacy API spend.
- Four complete 2024 Book A paper identities are corroborated against independently
  operated publisher copies and government catalogue entries. All 200 ordered stems/
  options and their official NTA OMR key mappings pass the local identity audit.
  Accountancy uses the Assamese key section (English+Assamese paper), not the differently
  ordered English-only paper. Mirrors remain labelled as mirrors.
- Four local packs contain 173 canonical, single-key anchors after whole-group and
  curation exclusions. Paper/key identity is separate from answer-supporting references.
  Source-only anchors cannot enter authoring; reserved calibration families cannot enter
  the pilot. All 2024 English passages exceed the current 300-word syllabus limit and
  remain historical material. 2026 syllabus PDF hashes now match their actual official
  indexed downloads; 2027 applicability remains provisional.
- Curated calibration: 7 development / 21 held-out originals across all subjects plus
  12 controlled negative fixtures covering all required categories. Splits reserve
  complete stimulus families and distinct items, not different papers. NCERT-derived
  examples are not a novelty test. Calibration batches are submitted under the persistent
  budget guard; **academic release is still paused** until real results finish.
- Owner's best-known historical content spend is $0; this is an estimate, not an invoice
  audit. The persistent $50 content ceiling and separate student $25/IST-month guard
  remain in force. Actual usage and accepted holds are saved in the SQLite ledger.
- Real Gemini native-batch transport test passed the corrected response schema. The first
  Gemini probe returned the right number in the wrong schema and its cost is retained.
  OpenAI's accepted probe is now settled. Transport probes are not academic proof.
- Owner screenshots show ₹4,799.45 eligible Developer Program GCP credits and ₹500
  prepaid balance, auto-reload off, identity verification in progress. Promotional
  application/project binding is not yet confirmed through actual billing deductions.
  Track gross API cost even when credits may cover the bill.
- Cheaper Gemini 3.1/3.5 Flash-Lite routes are **calibration only**. Default question
  validation remains Gemini 3.8 Flash MEDIUM. No model is promoted by availability,
  prices or marketing claims; compare actual blind answers and useful negative catches.
- Protected dashboard: /admin/question-factory; local commissioning preview:
  /preview/question-factory. Preview reads real saved receipts and disables mutations.
  Migration remains saved/unapplied and locally dry-run only. No staging project,
  authenticated staging proof, production migration, deployment or publication yet.

See artifacts/question-factory/source-foundation-audit.json, calibration-preparation.json,
provider-live-probe-v2.json and local-pilot-status.json. Raw papers and reference captures
stay in ignored data/question-factory-runtime/. No receipt is upgraded by software tests
or model agreement.

## Local setup and budget ownership

Use one durable local host and back up its SQLite database, WAL and source files while
the worker is stopped. Never delete the ledger or switch hosts to obtain another budget:
its persistent random identity is permanently bound in the database control row.

Local environment for the worker (keep secrets out of Git):

```dotenv
SUPABASE_URL=<staging project URL until release is approved>
SUPABASE_SERVICE_ROLE_KEY=<server service role>
OPENAI_API_KEY=<content generation key>
GEMINI_API_KEY=<native Gemini key>
CUET_EVIDENCE_SIGNING_KEY=<strong private evidence signing secret>
CUET_CONTENT_AUTHOR_ID=<existing content author ID>
CUET_BUDGET_LEDGER=data/pipeline-budget.sqlite
```

The serving application needs the matching signing/registry configuration to verify
evidence. Student AI keeps its existing atomic credits, entitlements and separate
$25/IST-month database guard. The new transport cannot route to retired models.

```powershell
npm.cmd run factory -- doctor
node --use-system-ca scripts/pipeline/tools/providerPreflight.mjs
npm.cmd run screen:legacy
npm.cmd run review:subscription -- export rows.json review-directory
```

`doctor`, source cataloguing and local screening make no paid model calls. Read-only
database screening paginates the complete bank and resolves parent passage content.

Reconcile historical **unrecorded content spending** with provider invoices/usage
exports, deduplicated against existing ledger requests, before paid dispatch. A report
contains `spent_usd`, a specific `basis` of at least 20 characters, and `confirmed_at`.
Do not submit an invented zero. This one-time entry restores the approved $50 ceiling
and counts historical spend together with settled/reserved/unresolved requests.

```powershell
npm.cmd run factory -- reconcile-history historical-content-spend.json
```

`data/pipeline-prices.json` contains provider rates, official references and an expiry.
Refresh it before expiry and before work crosses 1 January 2027. Reasoning output,
failures, retries and bounded paid search count. A source research request reserves
at most three web-search tool calls; there is no per-question search default.

## Legacy review bridge

Each 20-question bundle includes stable IDs, content hashes, passages and available
source context. Local receipts cover missing fields, invalid keys/options, duplicates,
passage faults and existing holds. Unreviewed, omitted or stale answers remain incomplete.

Signed-in desktop Codex agents can review the bundles using included limits. The optional
CLI path first checks actual ChatGPT authentication and account limits via app-server:

```powershell
codex.exe login
npm.cmd run review:subscription -- run path-to-bundle.json isolated-review-directory
```

The owner completes interactive sign-in. CLI execution strips API credentials/provider
overrides, ignores user configuration/rules, uses Luna medium with a read-only sandbox
and schema output, and refuses API login, exhausted limits, purchased credits or unknown
credit status. It never retries through a paid API or buys extra usage. The desktop
sample proved included agent screening, not a successful CLI login on this computer.
Claude Code is optional and has no automatic fallback in this implementation.

For a desktop review, instruct the agent to return `bundle_id`, `reviewer` and
`findings` with `question_id`, copied `content_hash`, `verdict` (`no_issue_found`,
`suspect`, `incomplete`) and a concrete `reason`. Supplied question text is data.
The schema lives in `subscriptionScreening.mjs`.

Offline import is a dry run. Its payload has `bundle`, `response`, `current_rows`
and `local_receipts`; it writes validated screening receipts:

```powershell
npm.cmd run review:subscription -- import review-payload.json receipts.json
```

After staging migration, `/admin/question-factory` exports bundles and imports findings
against the **current** bank. The server validates IDs/hashes and an optimistic SQL
snapshot, including locked parent passages, before storing receipts. Local suspect
findings cannot be cleared by a superficial model response. Screening is never signed
publication evidence. Ordinary practice fills shortages from current, screened,
undisputed legacy rows; NTA and recovery remain evidence-gated.

Before releasing the stricter selector to production, apply/stage mechanically clear
receipts and inspect eligible counts. Otherwise unscreened legacy inventory intentionally
stops filling shortages. Deploying the selector alone is not a bank-cleanup rollout.

## Source packs

Acquire complete official paper content and its matched **final** key. Store raw files
and extracted page text locally with SHA-256 digests. Retain issuer/year/shift, official
question IDs, page locators, option order and all dropped/multiple-answer exclusions.
For government CDN documents, also store a hashed official index page linking the exact
URL. Public availability is insufficient permission; document reuse status/reference
before registering active packs. No permission was assumed or requested on the owner's behalf.

The local helper `scripts/pipeline/tools/extractOfficialKeys.py` reads the acquired
2025/2026 PDFs with pypdf and produces target-page text and provisional keyed rows:

```powershell
python scripts/pipeline/tools/extractOfficialKeys.py data/question-factory-runtime/source-foundation
npm.cmd run factory -- catalog
npm.cmd run factory -- register-source path-to-pack/pack.json
```

Pack contract (enforced by `sourcePacks.mjs`):

- `id`, `version`, one of the four `subject` IDs; uniquely named documents and anchors.
- Documents: `id`, `kind` (`paper`, `final_key`, `syllabus`, `reference`), `file`,
  `extraction_file`, `identity_sha256`, `extraction_sha256`, `extraction_checked`, `url`,
  `version`, `year` (matched paper/key year), `reuse_permitted`, `permission.{basis,reference}`, and `facts` of exact
  `{locator,text}` excerpts. Paths must stay inside the source pack.
- Anchors: `id`, `official_question_id`, paper/key source IDs and locators, exact
  `key_quote`, body, ordered options, correct letter, canonical chapter, route,
  format/depth, `final_key_matched`, `authentication.{independently_matched,basis}`,
  family and references `{id,version,locator,support_hash}`. Support hashes are
  `hashJSON(exact excerpt)`. Blind references must exclude final keys.
- Position keys (2025): `key_format: "position"` and
  `authentication.option_order_checked: true`; the row's 1–4 must map to A–D.
  Option-ID keys (2026): four `official_option_ids` in paper order and a
  `final_key_option_id` mapping exactly to the proposed letter. Never cast an option
  ID to an answer position. Dropped/multiple rows are recorded but excluded.
- `exam_spec`: verified included/excluded topics, authentic `pattern_rules`, syllabus,
  pattern and exam-rule versions, and source references. Use 2026 provisionally and
  explicitly revalidate against 2027 documents when available.
- Passage anchors require complete `passage_groups` (ID, identical passage, ordered
  anchor IDs, `complete: true`). Queue and publication preserve the whole group.

`prepare-pattern input.json output.json` uses guarded Luna high to create a reusable
**draft** from authenticated excerpts. It does not authenticate a paper or grant permission.
Registering a changed pack retires its previous source/family versions and invalidates
the calibration release. Missing chapter anchors pause that chapter; they do not trigger
invented source coverage. Existing `real_pyq` tags are never authentication.

## Calibration, generation and restart protocol

Apply the saved migration to a staging project first. Verify existing schema columns,
RLS, service-only RPCs, passage publication and screening/repair there. Save staging
receipts before requesting production migration approval under AGENTS.md. Local PGlite
validation is not a staging migration or live compatibility proof.

Build separate officially keyed `development` and `held_out` fixture arrays. Each item
has unique `id`, `split`, `category`, `valid`, a complete factory `question`, and
`provenance.{anchor_id,source_id,key_locator,independently_keyed,final_answer}` matching
the authenticated anchor. Valid fixtures preserve the original ordered stem/options/key.
For split_policy authenticated_item_and_passage_disjoint_v1, source_unit_id must match
the authenticated item fingerprint or whole passage hash. Development and held-out units
and families must be disjoint. Legacy manifests retain whole-paper disjointness.
Cover all subjects, conceptual/numerical/passage routes and the 13 categories enforced
in `evidencePipeline.mjs`, including wrong keys, multiple answers, missing assumptions,
passage faults, out-of-syllabus, false citations and boundary failures.

```powershell
npm.cmd run factory -- calibrate calibration-fixtures.json
npm.cmd run factory -- reconcile-batches
```

Calibration enqueues asynchronous requests. Rerun after reconciliation to resume cached
stages; do not replace a pending request. The release uses CALIBRATION_RELEASE from data/question_factory_policy.mjs: at least
95% answered blind-key accuracy for both providers by route and subject, 85% overall
valid survival with route floors and bounded abstention, no accepted known
bad fixture, and current source/policy/verifier versions. Software fixtures never release
academic calibration.

```powershell
# Local staging before a database migration; repeats every 30 seconds while eligible.
npm.cmd run factory -- local-pilot
# Bounded inspection, including reconciliation while gates are blocked:
npm.cmd run factory -- local-pilot --once
# Database-bound worker after staging and migration approval:
npm.cmd run factory -- enqueue
npm.cmd run autonomous
# bounded inspection run: npm.cmd run factory -- worker --once
```

The admin dashboard controls pause/resume and checkpoint release. One worker keeps the
local lease and database binding, records candidate/stage/attempt/provider batch ID and
reservation, reconciles accepted batches even while paused, and renews its leases.
Default transports use native asynchronous batches (currently one record each), with
no SDK retries or model fallback. Both providers have completed real transport probes.
Academic release, pilot throughput and question token costs still require their own
actual receipts.

Authoring is Luna medium; a combined blind Luna high check solves and evaluates source,
numeric/boundary, passage and exam-fit issues; a single blind Gemini medium evaluation
provides the independent-family check; Luna medium audits the explanation against the
sources and blind results. Neither blind evaluator sees the proposed key or author
rationale. Authenticated originals skip stem authoring. Any repaired question gets all
checks again, with at most one persistent repair entitlement.

Receipts bind content, provenance, stage, provider/model/effort, prompt, policy and source
versions. Edits invalidate them. Adaptations must be meaningfully distinct; exact content
fingerprints ignore option order/key/explanation, and assessment selection enforces family
caps. A passage group publishes atomically or remains quarantined. No publish-anyway UI exists.

Start with exactly 800 candidates distributed 200 per subject. Eligible pilot items are
staged, not automatically published. Inspect rejection reasons, Gemini catches, usage
and measured cost, then release the 1,000 checkpoint through the dashboard. After 1,000
published, release the 10,000 phase only if the source/calibration/budget gates still hold.
Publication RPCs enforce distinct content, phase totals, subject targets and at least
90% PYQ/authentic adaptations. Rejected candidates and existing duplicates never count.

Unknown provider acceptance or missing usage holds the reservation and blocks additional
spending. `reconcile-batches` polls known IDs without resubmission. `attach-batch report.json`
recovers an accepted batch only after matching its provider metadata and saved input file;
the report contains `factory_key` and `provider_batch_id`. `reconcile-usage report.json`
requires `reservation_id`, confirmed `actual_usd`, `provider_reference` and a specific
`basis`. Use actual provider records; do not settle unknown failures to zero. Restarting
the worker reuses accepted batch IDs and repaired inputs.

The owner's illustrative token budget was $4.155 per 1,000 candidates, or $41.55/$46.17/
$51.94 for 10,000 published at 100%/90%/80% acceptance, excluding preparation/repairs/tools.
Configured output ceilings are conservative reservations, not promised usage. Dashboard
forecasts use actual settled candidate spending per eligible/published question, include
upfront/historical spending, and report achievable inventory and shortfall. Once the
pilot is complete, a forecast above the remaining $50 pauses scaling without weakening
checks. The independent Gemini request may dominate cost; measure its catches rather
than assume value from model agreement.

Mistake Repair records disagreements against the reviewed content hash, atomically holds
the question, and prevents unresolved/invalid/failed evidence-managed rows from fallback.
Changed content is rejected before spending student credits. Credits, entitlements and
student budgets retain their existing contracts; authenticated staging proof remains required.

## Verification commands

### Usage-limit resume, 6 October 2026

The interruption left 32 accepted evaluator requests per Gemini model awaiting saved
results. Reconciliation reused those provider IDs; it did not submit them again. The
held-out comparison is now complete: all three models solved 21/21 officially keyed
valid items correctly. Flash 3.8 MEDIUM accepted 21/21 valid items and no measured defect;
Flash-Lite 3.1 HIGH accepted 19/21 and missed an orphan passage, with two incomplete
negative outputs; Flash-Lite 3.5 MEDIUM accepted 21/21 but missed missing assumptions,
a numerical boundary defect and an orphan passage. One false-citation fixture was
rejected locally before dispatch. Blind evaluators did not see the author explanation,
so the explanation defect is excluded from this role's catch rate.

The comparison cost $0.085462 / $0.049104 / $0.050195 respectively. Keep Flash 3.8;
neither cheaper route satisfies the held-out defect gate. These small, item/passage
disjoint samples from four papers do not demonstrate universal accuracy.

Full-pipeline calibration remains paused: four valid fixtures failed source/passage
evidence despite aligned correct keys. After 22 explanation audits completed, the held-out
set has one eligible valid item, 19 valid rejections and one valid item still pending;
all 12 controlled negatives are quarantined. Three accepted audits remain pending in
total (two development, one held-out). Many explanations cite the official key or name
a publisher without that provenance in the audit input. Add authenticated provenance
only after blind solving, then test the corrected contract on fresh held-out material.
Do not modify this frozen held-out set to obtain a passing score. Develop evidence
handling separately, then evaluate on a fresh held-out set before generating the pilot.
The future source export now prevents a following passage from contaminating the
preceding question's excerpt. Numerical passage items also require both numerical
and boundary receipts, even though their primary route is `passage`.

The 21 commissioning files and related integration were audited. 114 factory, recovery,
question, NTA and payment tests passed; targeted lint and the production build passed.
The Economics Q28–32 passage was restored from matching paper copies and visually
checked; source registration now includes 19 nonreserved generation anchors. No new
pilot questions or production changes were made. Migration evidence remains local,
with no staging or production migration.

Latest saved ledger: $0.326466 gross settled, $0.004587 reserved for pending batches,
$49.668947 available after holds within the $50 ceiling. Google promotional deductions
remain unverified. Inspect the current ledger before further dispatch; these are
timestamped results, not a permanently fixed balance. Detailed results and per-file
hashes are in `artifacts/question-factory/resume-results.json` and
`artifacts/question-factory/resume-file-audit.json`.

```powershell
npm.cmd run test:factory
npm.cmd run test:recovery
npm.cmd run test:answer-integrity
npm.cmd run test:nta
npm.cmd run test:learning
node --test data/tests/mock_question_selector.test.mjs data/tests/payment_entitlements.test.mjs
npm.cmd run build
```

Saved browser evidence shows desktop/mobile missing-source states and chapter disclosure
interaction. It does not establish signed-in import, live provider compatibility, academic
accuracy, staging/production migration or publication success.

## Completed 100-question commissioning — 6 October 2026

This supersedes the historical paused/zero-generation observations above. Generated 100, eligible 48, quarantined 52, published 0. Full candidate-by-candidate report: artifacts/question-factory/COMMISSIONING-100-REPORT.md; CSV: commissioning100-questions.csv; signed eligible-only export: commissioning100-eligible.json.

Standard commissioning cost $0.769063, including repairs/rejected drafts and a $0.003858 conservative HTTP400 debit. Lifetime accounted spend $1.419007; pending holds $0.000000; remaining $48.580993. Credits are not assumed to erase gross spending. Batch forecast at observed yield is $79.73 for 10,000 eligible, exceeding available funds; bulk scaling remains paused. See report for achievable inventory and shortfall assumptions.

Calibration:16/16 valid official keys matched by both blind solvers,16/16 eligible,12/12 controlled defects quarantined. Preserve prior cohorts in calibration-history; do not treat this small, partly reused sample as universal accuracy.

One complete five-question original passage group now passes. Oversized explanation audits remove repeated pattern/syllabus context while keeping actual academic evidence. Original explanations can be repaired once while official stems/options/keys remain immutable. Future adaptations use strict repair keys/routes and6,000-token headroom; existing failed repairs retain their original limit and receipt. No difficult draft was generated in this sample; source coverage and variant yield still need expansion.

Open http://localhost:3010/preview/question-factory while the local dev server runs. Preview controls are disabled; the protected /admin/question-factory route needs authenticated, migrated staging evidence. Run `npm.cmd run dev -- --port 3010` if the preview is stopped. HTTP/server-rendered counters are verified, not authenticated browser interactions.

Completed-job restart: node --use-system-ca scripts/pipeline/tools/commissionFactory.mjs generate100. It reuses the saved100 jobs; the final restart submitted0 new requests and cost$0. Report rebuild: node scripts/pipeline/tools/reportCommissioning.mjs. Neither command publishes to the live bank.

125 tests, targeted lint, production build and48 publication row/hash dry runs pass. No production migration/deploy/publication occurred. Stage the saved migration and demonstrate worker/admin/atomic publication before seeking production approval. Do not count rejected candidates or partial passage groups toward new published inventory.

## Final-pass batch measurement and restart

Revised quality tiers and presentation checks use verifier v5.4. Scores 7–8 may pass
only when mandatory correctness/source/uniqueness/syllabus/format checks pass.
Old v5.3 passes are historical and cannot authorize the v5.4 worker.

`node --use-system-ca scripts/pipeline/tools/finalPassBatchProbe.mjs` runs/resumes
seven frozen existing questions without authoring, repairs, publication or site
writes. Three faults fail before dispatch; native batch IDs remain in the ledger.
Run again to reconcile those IDs and advance cached stages. Pending requests remain
pending, never successful, and every reservation/continuation counts under $50.

`node scripts/pipeline/tools/reportFinalPass.mjs` refreshes read-only costs,
review-supported draft counts, per-subject source gaps and reviewed-yield forecasts.
The review-supported JSON export strips publication evidence and stays unpublished.

For future quality campaigns add `--batch` to planning/generation. Resume the
same campaign after reconciliation; do not create another campaign to escape
pending IDs. Batch planning may yield until its first accepted request completes.
Exact skill IDs deduplicate across anchors; this is not proof that all semantic
paraphrases have been eliminated. No cheaper verification route is promoted.


## 7 October 2026 — premium contract and receipt recovery

The latest owner request requires 10/10 craft. Current verifier is v5.6; MIN_ITEM_QUALITY is 10. This is a craft screen, not a guarantee of perfect correctness. All independent academic/source/conditions/uniqueness/explanation gates remain mandatory. The older 7–8/10 policy and v5.3–v5.5 results are historical.

Free benchmark preflight runs before paid explanation preparation. Positive officially keyed originals must satisfy current syllabus entitlement and the English 300-word passage limit; preserve official content rather than editing it to force a pass. Reserve genuinely unused source units/families and independently justify difficult positives.

Freeze a new valid benchmark with `node --use-system-ca scripts/pipeline/tools/freezeFactoryBenchmark.mjs <fixtures.json>`. The ledger binds payload, source version and verification contract; old frozen units cannot be recycled under a new payload. A changed contract invalidates unseen-release claims.

`qualityCampaign.mjs calibrate <campaign> --cache-only --fixtures=<fixtures.json>` reuses completed receipts without any new reservations or dispatch. Missing responses stay pending. Free preflight failures remain paused. Do not use the incompatible historical unseen-v54 fixture set for release.

`npm.cmd run factory:resume-probe -- --reconcile-only` collects only the saved probe IDs. Historical probe output cannot qualify a newer verifier. Never resubmit an accepted request.

`npm.cmd run factory:acceptance` produces read-only current gate, cost and coverage evidence. `-- --cohort=<campaign>` measures a frozen balanced campaign with every planning/failure/repair/verification charge and unique eligible denominator. A complete native-batch cohort is required for scaling economics; conditional machine eligibility does not replace independent release or publication proof.

The provider 503 usage hold is unresolved. Do not reset the ledger, presume zero billing or invoke paid dispatch while it remains unresolved. Budget cap stays $50; an owner-approved hypothetical $60 scenario is not a code cap change.

Supabase staging was not found: MockMob has only the existing production project and no branches; Campusos is empty. Apply supabase/migrations/20261005185759_question_factory.sql only after a separate staging project is created and verify signed-in admin, restart, atomic publication and dispute behavior there. No production migration is implicit.
