# V7.3 semantic-view regression proposal

This is a proposal-only module-isolation diagnostic, not the literal production provenance path. Its 40 scored fixture IDs and labels match the preceding proposal: 12 positives and all 28 known negatives (12 original critical controls plus 16 audited correctness/presentation cases).

For exactly the 16 audited cases, the diagnostic view changes only `provenance.kind` to `original_practice` and `provenance.anchor_id` to null. A private overlay aligns existing source-pack and family metadata. `diagnostic-view-lineage.json` retains each original candidate/provenance, the per-record strict selector outcome, and before/after semantic-field equality.

The original 12 positive controls are unchanged. All 28 negatives retain the same question text, choices, answer key, explanation, source references, expected label and oracle. The two same-unit chapter disagreements remain in the lineage appendix and are unscored. Five audit cases have deterministic structure/presentation lint findings; those are disclosed as early local gate outcomes, not independent model/source/key judgments. The semantic view has no early provenance stops.

Payload SHA-256: `988c3c63f4c591241a2ada44ec4f1a01508113a6e87713b0e2aaec007a68fe83`. No runner action, provider call, ledger call, or release write occurred.
