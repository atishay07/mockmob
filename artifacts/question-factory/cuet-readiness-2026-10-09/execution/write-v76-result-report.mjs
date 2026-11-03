import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const base='artifacts/question-factory/cuet-readiness-2026-10-09',read=p=>JSON.parse(readFileSync(p)),a=read(base+'/execution/v76-qualification-assessment.json'),l=read(base+'/execution/v76-after-completion.json');
const report=`# V7.6 qualification result — 9 October 2026 IST

**Qualification failed. No V7.6 release, pilot, current-profile staging run or production write is authorized by these results.** Both phases and all accepted provider requests finished; the frozen data and outcomes are preserved.

| Evidence | Fixed cases | Valid eligible | Controlled invalid accepted | Errors |
| --- | ---: | ---: | ---: | ---: |
| Fresh, four subjects | 28 | 15/16 | 0/12 | 0 |
| Regression, including unchanged V7.5 disputed fixture | 13 | 2/4 | 1/9 | 0 |

The exact frozen release checker returns regression_defect_false_accepts_1. Pooled valid survival is 17/20 = 85%; subject results are Accountancy 5/5 and Business Studies, Economics and English each 4/5. The zero-false-accept requirement remains unchanged. The accepted regression fixture is v75f-825e60a00f; its expected-invalid label remains disputed by the source diagnosis and stays in the denominator.

## Cause and correction

Both independent validators solved D from its direct functional-structure source. They dismissed full option B by attributing its wording to divisional structure, without a decisive full-clause refutation or resolution of the functional-empires evidence. The current boolean option challenge gate accepts those false flags. The explanation audit correctly supports its printed D/C claims and contains no B-exclusion claim to catch. This establishes a demonstrated evidentiary exclusion gap; it does not independently establish that all of B is true.

Three designated valid failures remain counted. Fresh English has a correct B solution but conflicting frozen chapter metadata: the pinned passage-dependent rule requires Narrative Passage, while the registered label is Vocabulary. The historical Business Studies explanation adds an unprinted claim that the previous allocation ignored skills; withholding is justified. The Economics explanation describes the scenario's local recipient-transfer focus; its audit broadened that contextual contrast, a judgment error. See the two bounded diagnosis reports; no labels or measured survival were changed.

An additive local V7.7 clause-preserving support/contradiction/unresolved check is being developed. It cannot reuse these inspected cases as fresh evidence or claim qualification from software tests. No further paid benchmark is dispatched under this single-study plan.

## Accounting

All 118 requests are complete and settled. Actual qualification cost is **$${a.settled_usd.toFixed(6)}**, held **$${a.held_usd.toFixed(6)}**: Luna $0.185242; Gemini $0.464738. All 118 receipt charges were independently recomputed, including reasoning and 11 billed truncated responses. OpenAI served default tier; no Flex or Batch discount was assumed. Receipts are not invoices.

The initial $2.383125 dry completion estimate omitted existing billed continuation retries. The preserved correction gives $5.714375 worst case, while the shared **$4 stop cap** and lifetime **$50 ceiling** stayed unchanged and guarded every actual retry. The realized run completed below the cap. No accepted or uncertain request ID was resubmitted.

Lifetime: **$${l.lifetime.settled_usd.toFixed(6)} settled + $${l.lifetime.held_usd.toFixed(6)} held**, leaving **$${l.lifetime.remaining_usd.toFixed(6)}**. The prior 37 unresolved records are retained, including the unrecoverable V7.5 request's $0.008596 maximum hold. There is no active qualification worker or owner lease after natural completion.

## Evidence and checks

- [All 41 cases, sources, native judgments, gates and item receipts](v76-qualification-export/all-cases.json)
- [All 41 cases in CSV](v76-qualification-export/all-cases.csv)
- [Exact release assessment](v76-qualification-assessment.json)
- [Valid-failure diagnosis](v76-valid-failure-diagnosis-sol.md)
- [Disputed regression diagnosis](v76-disputed-regression-diagnosis-sol.md)
- [Receipt recomputation](v76-receipt-cost-integrity.json)
- [Completion checkpoint](root-checkpoint-v76-complete.json)

Factory tests 672/672; recovery 40/40; selected question/payment/student-budget checks 38/38; explicit payment/entitlement checks 40/40; local application build passes with 67 static pages. The frozen academic and runner hashes remain unchanged. Dirty checkout, historical artifacts, payment/entitlement and student-AI budget contracts were preserved.

The source/case reviewers froze independent answers before proposed answers and official marking keys were disclosed. A bounded comparison found no concrete reused question case or numbers-only variant versus prior V73–V75 registrations. Cases share source documents, root/defect variants and a passage, so this compact sample is correlated and does not establish perfect accuracy or learning gains.

## Remaining release requirements

The local corrected version needs separately authorized genuinely fresh independent qualification under a conservative retry-inclusive stop budget. Existing inspected sets remain regression evidence. The 40-candidate pilot still needs exact qualified-version integration, durable allocation before preregistration, and a supported alternative for the exhausted English matching pool; its $3 cap is a stop cap against $12.424320 theoretical completion reservations. Current-profile staging restart/idempotency, complete passage-group atomic publication, student retrieval and dispute invalidation remain unproven. Production publication, deployment and migration require final explicit approval.

The generator goal remains active and unfinished.
`;
const path=base+'/execution/V76-QUALIFICATION-RESULT.md';if(existsSync(path))throw Error('report_already_exists');writeFileSync(path,report,{flag:'wx'});console.log(JSON.stringify({path,qualification:'failed',production_writes:0}));
