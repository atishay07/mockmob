# Source-key construction evidence, 8 October 2026

All 64 original construction candidates remain present, with 16 per subject and 254 printed options. The four immutable claim-audit files record exact source/stimulus excerpts, every option's reasoning, independently derived answers, calculations where needed, and unresolved assumptions. They are construction evidence, not paid validator performance or student approvals.

The independent answer/source freeze is `freeze-before-official-key-comparison-v3.json`, SHA-256 `c6950201a2774d2636452edda70eebd88cfc7a00cd3ab937e1af68468257e5e8`. It was written before the separate post-freeze official-key comparison. That comparison verified all 16 original official document identities. The 51 source-key positive candidates agree with both the separate frozen blind review and the official marking scheme: English 11, Accountancy 12, Business Studies 14, Economics 14. All 13 withheld candidates remain exported; five have key disagreements or an abstention. No disagreement was resolved by changing an independent answer to match a marking scheme.

The decisive source quotes use the validated original content-stream NCERT extraction cache (`logical-pages-v5`), exact raw text offsets, page and PDF hashes. The earlier geometric column caches are retained history and are not used as decisive evidence. Official consumer-protection definitions and the NIOS deferred-payment definition are separate locally cached sources with explicit attribution and restricted educational-use notices. An earlier-year CBSE worked definition establishes break-even income; that reference is expressly identified and is not a key for these candidates.

For the current v7.3 contract, **all 64 cases are regression evidence**. The 2026–27 cases were inspected before the prospective prompt. Although the 2025–26 candidate file was created later, its source PDFs were acquired at 07:12 UTC, before the contract was finalized at 07:22 UTC. `CURRENT-CONTRACT-EVIDENCE-ROLE.json` records the conservative classification. Neither group will be presented as unseen release evidence.

The new question-only source acquisition lives separately in `../../cbse-2024-25-source-keys-v4/`. Its validator binding was saved before the four question papers were acquired. No candidate marking-scheme documents were read by the acquisition tool. Economics question 14 and its earlier-read worked example are excluded from the prospective selection. Candidate construction, independent keys, controlled defects, paid fit evaluation and release qualification remain unfinished for that new corpus.

Reproducible local tools, run from the repository root:

```powershell
node --use-system-ca scripts/pipeline/tools/buildManualEnglishSourceAudit.mjs
node --use-system-ca scripts/pipeline/tools/buildManualBusinessSourceAudit.mjs
node --use-system-ca scripts/pipeline/tools/buildManualAccountingSourceAudit.mjs
node --use-system-ca scripts/pipeline/tools/buildManualEconomicsSourceAudit.mjs
node --use-system-ca scripts/pipeline/tools/freezeManualSourceKeyCustody.mjs
node --use-system-ca scripts/pipeline/tools/compareFrozenOfficialSourceKeys.mjs
node --test scripts/pipeline/tests/freshCuetReadinessV73Guards.test.mjs scripts/pipeline/tests/manualSourceAuditSupport.test.mjs
```

The construction/freeze/comparison tools deliberately refuse to overwrite existing evidence. Inspect the saved outputs or reproduce them in an isolated copy; do not delete historical evidence to make a rerun succeed. No paid model API call, global source-registry mutation, question publication or production change occurred in this source-audit stage. Main-agent subscription usage is separate and is not asserted to cost zero.

The prospective runner preserves Luna and Gemini plus the explanation audit for publication validation. Haiku is evaluated on fresh comparison cases only; regression registration rejects reduced validator sets and falsely labelled fresh Haiku roles. The fixed release thresholds are unchanged.
