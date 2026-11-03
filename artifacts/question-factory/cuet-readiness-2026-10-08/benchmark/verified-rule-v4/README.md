# CUET verified-rule benchmark v4

Status: **cases and labels frozen before any model judgment**. No provider was called, and no case from the separate official-42 held-out set was opened. This is a diagnostic academic fixture for CUET readiness gates, not a release-eligibility benchmark. The registered preregistration scope is `diagnostic`; do not upgrade it to full-CUET release evidence without independent key review and an explicit decision that its power limits are acceptable.

## What it tests

The gate under test is whether an item belongs in CUET: entitlement to the documented syllabus, a recognizable subject-question format, source support for the key and explanation, a unique answer, complete decisive conditions, and correct arithmetic. A direct/easy item can be valid. The benchmark does not score general writing polish or reward difficulty for its own sake.

The official 2026 NTA syllabi are the entitlement baseline (provisional for 2027). Ten short English comprehension passages are original stimuli and each is checked against the English syllabus maximum of 300 words. Accountancy items use Unit I partnership topics; Business Studies items use Unit VI staffing; Economics items use Course III, Unit III current challenges. The format uses four-option subject MCQs, including English comprehension, a matching-style accountancy item, a staffing distinction, and explicit numerical partnership-ratio items. Easy direct recall is deliberate and should not be treated as a defect.

## Count and dependence

There are **194 candidate records and 45 declared root families**:

| Subject | Source-root valid items | Total records | Root families |
|---|---:|---:|---:|
| English | 10 | 40 | 10 passage roots |
| Accountancy | 10 | 74 | 15, including controlled exception/numeric families |
| Business Studies | 10 | 40 | 10 staffing roots |
| Economics | 10 | 40 | 10 current-challenge roots |

The 40 source-root questions each have a valid record plus controlled wrong-key, overlapping-option, and unsupported-explanation mutations. Extra records exercise one missing-condition case, three explicit Accountancy syllabus exclusions, and 30 arithmetic values from **one** profit-share calculation family. Those variants improve defect coverage but are not independent roots. Do not report 194 as independent n; the main valid-survival sample is only 40 root items (10 per subject), with just five valid roots per subject in the release partition. This is enough for a small diagnostic, not a high-confidence release claim.

The six certified defect categories have these counts: wrong key 40, overlapping options 40, unsupported explanation 40, missing decisive condition 1, syllabus mismatch 3, numeric error 30. This is deliberately not a balanced prevalence sample; category counts are fixture coverage, not an estimate of production defect rates.

## Partitions and overlap disclosure

`development/cases.json` and `release-sealed/cases.json` use disjoint root families. The release payload is frozen at SHA-256 `e880dcc9fa5ec1f08cf4624c016ee12d0d0b925d545fc20224de79539b583dbd`; development is `f1dffb1a67c1c10c71ee0888a3aeb6a6546b33db13225e8e24d9e569904d036f`. Combined canonical payload: `e08c13c8e0ad13b3ed61639f0b881c1b197fe3e5bff95f37208c155deac26de0`.

Accountancy roots use one NCERT partnership-basics document across both partitions, and Business Studies roots use one Staffing chapter across both partitions; locators/concepts are separated, but document-source independence is not claimed. Economics uses different NCERT chapters across the split: Employment/Human Capital roots in development, Rural Development/Environment roots in release. English uses separate newly authored passage roots. The source registry/locators were available during prior project work, and I contributed to validator design; I cannot certify that the textbook concepts were unseen by all earlier authoring. No held-out benchmark content was inspected to check overlap. Disclose that limitation in every later report.

## Certificates and checks

Every source-root record carries the exact registered excerpt, source URL, source identity and extraction hashes, excerpt hash, official NTA syllabus clause, answer derivation, and decisive assumption list. Original English passages carry their own exact text/hash and are clearly labelled benchmark-authored rather than independent reference sources. Numeric cases state every operand and ratio in the stem; their answer certificate computes the result directly. Syllabus-exclusion cases quote the official Accountancy Unit III parenthetical exclusions.

Run from the repository root:

```powershell
node artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/verified-rule-v4/build.mjs
node artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/verified-rule-v4/verify.mjs
node artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/verified-rule-v4/pipeline-view.mjs
```

`verify.mjs` checks the frozen payload hashes, unique case IDs, root-disjoint partitions, per-subject valid/root floors, source/excerpt and syllabus hashes, exact syllabus-clause presence, English passage length, controlled defect mechanics, and numeric derivations. `pipeline-view.mjs` maps the frozen labels to canonical factory candidates and emits `pipeline-view.json`; it adds original English stimuli, registered NCERT and official-syllabus sources, benchmark-only source packs/families, format routes, and a helper-canonical payload hash. Its local preflight checks candidate structure, provenance, source support, and oracle separation without provider calls. The adapter is structural/certificate-integrity evidence; it cannot prove semantic entailment without independent audit. The question/answer labels were authored and reviewed by one benchmark designer, not independently keyed by a second examiner. Model agreement must not be represented as truth.

## Remaining evidence gap

No model judgments or generation runs have been performed against this set. No observed CUET-candidate timing is claimed. No matched-PYQ level statistics, validator false-accept rate, valid-survival confidence interval, or production yield/cost estimate is established here. A later release study must preserve this sealed partition, compare anonymized cases with authenticated CUET exemplars without showing keys, use an independent source/key audit, and treat this benchmark as diagnostic evidence rather than proof of readiness.
