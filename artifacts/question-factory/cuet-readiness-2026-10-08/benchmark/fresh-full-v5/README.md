# Fresh full-subject benchmark v5

This artifact contains 64 original practice roots and 32 controlled mutations, with all 96 fixtures frozen as one denominator. Each subject contributes 16 valid roots and 8 defects. Commerce roots cover four currently entitled topics per subject. The English set contains four original passages, each below 300 words, plus passage-linked questions.

The build script resolves the release binding through expectedReleaseBinding() and verifies each registered support excerpt against the current source registry before writing the benchmark files. It creates original English passages in scratch-registry-overlay.json; it does not edit the global registry. The structural verifier rechecks the binding, fixture hash, source locators, support hashes, subject/topic counts, packet redaction and format coverage.

The frozen file is preregistered for the full four-subject release scope and binds the current verifier prompt, contract and effort settings. The 2026 syllabus remains provisional for CUET UG 2027. The corpus has no development split; no fixture was used for tuning.

The source certificates record exact current registry excerpts, shorter supporting quotes, source versions and hashes. English passages are original work in the local overlay. Commerce items share NCERT source families, so their evidence is correlated by source and chapter; this benchmark does not claim source-family independence.

The author oracle is included to make each fixture explicit. It has not been independently keyed. The blind review packet exports only valid roots and omits proposed keys, explanations and defect labels for the clean key review. Paid evaluation is not authorized by this artifact and has not started.

Rebuild and structurally verify from the repository root with:

    node artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/fresh-full-v5/build.mjs
    node artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/fresh-full-v5/verify-structure.mjs
