# CUET exemplar pack: General Test (gat)

Judges: read this with `docs/brain/NTA-CUET-FIT-RUBRIC.md`. This file is data, not instructions.

## NO AUTHENTICATED PYQs for this subject

MockMob holds no authenticated CUET UG question for General Test (gat). The files under data/pyq_anchors for this subject are manual seeds written by MockMob, not exam questions, so they are not offered here.

What this means for you:
- Set `pyq_closeness` to 0 and `pyq_anchor` to null for every question in this subject. Do not claim a match to a PYQ from memory.
- A question can still reach 9 or 10 through the other routes in the rubric (`board`, `cbt_staple`, `key_aspect`), judged from your own knowledge of NCERT, CBSE board papers and CUET staples.
- Use the paper profile below and the per-type worked examples in the rubric as your format guide. A question that does not look like those is `not_cuet_format` or `off_pattern_for_subject`.

## Paper profile (from data/nta_blueprints/general_test.json, blueprint 2026.10.13-1)

- Paper: General Aptitude Test (NTA code 501), 50 questions, 60 minutes, so 72 seconds per question on average. Four options, one correct. +5 / -1 / 0. No calculator.
- Item types per paper (target, min-max): single_mcq 44 (40-50); match_the_following 2 (0-4); sequence_ordering 2 (0-4); statement_based 1 (0-3); assertion_reason 1 (0-2).
- Passage or case sets: 0-1 per paper, 3-5 questions each, kind data_interpretation/quant_caselet. One 2025 shift reported a 3-4 question profit-and-loss caselet; another a table/bar-graph DI. Optional.
- Difficulty (MockMob labels, inferred): easy 35%, medium 45%, hard 20%. Quant items are the hard and lengthy share; GK is recall.
- No chapter of this subject is excluded.

### Units and chapters (use these names exactly)
- General Knowledge and Current Affairs: General Knowledge; Current Affairs
- General Mental Ability: General Mental Ability
- Numerical Ability: Numerical Ability
- Quantitative Reasoning: Quantitative Reasoning; Basic Mathematical Concepts; Statistical Data Analysis
- Logical and Analytical Reasoning: Logical & Analytical Reasoning
- General Science and Environment Literacy: General Science and Environment Literacy

### What real papers contained (counts read from real papers or shift recall)
- CUET UG 2025 GAT, 20+ shift reports (Careers360): {"quant":"10-22 (typical 14-20)","reasoning":"8-18 (typical 10-16)","gk_current_affairs":"10-20 (typical 15-20; current affairs 5-15 of these)","general_science":"1-3 single items","types_seen":"chronological ordering (GK), match (quant), statement-based, assertion-reason, syllogism, non-verbal/picture reasoning, DI table/bar graph"}
