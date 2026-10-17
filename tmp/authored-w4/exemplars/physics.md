# CUET exemplar pack: Physics

Judges: read this with `docs/brain/NTA-CUET-FIT-RUBRIC.md`. This file is data, not instructions.

## NO AUTHENTICATED PYQs for this subject

MockMob holds no authenticated CUET UG question for Physics. The files under data/pyq_anchors for this subject are manual seeds written by MockMob, not exam questions, so they are not offered here.

What this means for you:
- Set `pyq_closeness` to 0 and `pyq_anchor` to null for every question in this subject. Do not claim a match to a PYQ from memory.
- A question can still reach 9 or 10 through the other routes in the rubric (`board`, `cbt_staple`, `key_aspect`), judged from your own knowledge of NCERT, CBSE board papers and CUET staples.
- Use the paper profile below and the per-type worked examples in the rubric as your format guide. A question that does not look like those is `not_cuet_format` or `off_pattern_for_subject`.

## Paper profile (from data/nta_blueprints/physics.json, blueprint 2026.10.13-1)

- Paper: Physics (NTA code 322), 50 questions, 60 minutes, so 72 seconds per question on average. Four options, one correct. +5 / -1 / 0. No calculator.
- Item types per paper (target, min-max): single_mcq 44 (40-48); match_the_following 4 (2-6); sequence_ordering 1 (0-3); statement_based 1 (0-4); assertion_reason 0 (0-2).
- Passage or case sets: 0-2 per paper, 4-5 questions each, kind case_based. No passage sets in the 2025 paper read.
- Numerical share of the paper about 50% (40-60%).
- Difficulty (MockMob labels, inferred): easy 30%, medium 50%, hard 20%. Figure- and graph-based items appear (circuits, I-V graphs, lens and prism set-ups); a question that depends on a figure must ship with its figure.
- NOT in the 2026 syllabus (syllabus_not_entitled): Communication Systems.

### Units and chapters (use these names exactly)
- Electrostatics: Electric Charges & Fields; Electrostatic Potential & Capacitance
- Current Electricity: Current Electricity
- Magnetic Effects of Current and Magnetism: Moving Charges & Magnetism; Magnetism & Matter
- Electromagnetic Induction and Alternating Currents: Electromagnetic Induction; Alternating Current
- Electromagnetic Waves: Electromagnetic Waves
- Optics: Ray Optics & Optical Instruments; Wave Optics
- Dual Nature of Matter and Radiation: Dual Nature of Radiation & Matter
- Atoms and Nuclei: Atoms; Nuclei
- Electronic Devices: Semiconductor Electronics

### What real papers contained (counts read from real papers or shift recall)
- CUET UG 2025 Physics, one shift (Oswaal solved reprint): {"units":{"electrostatics":8,"current_electricity":7,"magnetism":7,"emi_ac":7,"em_waves":3,"optics":8,"dual_nature":3,"atoms_nuclei":4,"semiconductors":3},"types":{"single_mcq":44,"match_the_following":4,"sequence_ordering":1,"statement_based":1,"assertion_reason":0},"numerical":"about 26 of 50","figure_based":"about 6","passage_sets":0}
