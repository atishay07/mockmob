# V7.11 freeze addendum (9 October 2026)

`v711-contract-freeze.json` (sha256 652df6a6fb8c612af36670f7f21db3e91ec0c9eb588be8d10ee2d6da02335c55) is correct in every hash field:
verifier `cuet-fit-validator-v7.11-compact-resolution`, contract dff119fc0a2034eb719e024e8feb84460f359423fcea66c5f7f2efa1d6f181e3,
prompt d29fc3510a697a7d2d07b508d8497f1a0b349ec5c42bc9346cc3d109a056b4f3, parent V7.10 contract 61d7a05c….

Its free-text `note` was inherited from the copied V7.10 freeze tool and is stale. Correct provenance:
- V7.11 was shaped by the spent V7.9 q1 and V7.10 q2 fresh studies (both failed their unchanged rule with 0/31 defects accepted) and by exposed V7.7 regression cases.
- V7.11 changes only (a) case-insensitive quote/false-part anchoring and (b) the Luna blind output cap 10,000 → 16,000. An offline re-binding of every saved q2 blind resolution changed exactly one outcome (english-v1, valid: ok) and no defect.
- Fresh **q3** cases are authored and blind-keyed only AFTER this freeze, from source facts classified clean (non-interleaved). No validator has seen them.
The freeze file itself is never overwritten.
