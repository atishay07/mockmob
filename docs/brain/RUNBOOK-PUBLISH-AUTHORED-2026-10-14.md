# Runbook: publish the agent-authored wave 1 and make it NTA-eligible (14 Oct 2026)

Status: **tooling only. Nothing here has been run against production or staging.** Every number below was produced offline, from the committed candidates, the committed score entries, the committed agent tables and the 13 Oct local export of the bank (`tmp/nta-fixtures`). Publication needs the owner's approval (FACTORY-RUN-2026-10-14.md section 4, item 6).

What is being published: the 479 questions of `docs/brain/reports/authored/wave1-candidates-2026-10-14.json` (source `claude-authored-2026-10-14`; AUTHORED-QUESTIONS-WAVE1-2026-10-14.md says how they were made and checked).

| Piece | File |
| --- | --- |
| Row mapping and plan (pure) | `scripts/lib/authored-wave.mjs` |
| Judge files to score entries (pure) | `scripts/lib/authored-scores.mjs` |
| Publish, with dry-run, apply, restore | `scripts/question-publish-authored.mjs` |
| Offline score merge and engine check | `scripts/authored-scores-merge.mjs` |
| Tests (no network, 42 tests) | `data/tests/authored_publish.test.mjs`, `npm run test:authored-publish` |
| Judge records, durable (the raw `tmp/authored` files are untracked) | `docs/brain/reports/authored/wave1-score-entries-2026-10-14.json` |
| Offline engine check, both policies | `docs/brain/reports/authored/wave1-score-check-admit-2026-10-14.json`, `...-hold-...json` |

## 0. Two decisions before anything is merged

1. **`--repaired-text=admit|hold`.** 138 questions were repaired by the expert pass. For 78 of them the repair touched only the difficulty label or the NCERT reference, which are not part of the content hash, so the judges did score the hashed content as it stands. For **60** the stem, options or explanation changed, so the judges scored the text *before* the repair. Each of the 60 has the expert verdict and a blind re-solve of the final text (3 solvers, 3 of 3 on the key) on record.
   - `admit`: the tables bind those 60 scores to the final text's hash. The engine accepts them. Each entry says, per judge (`scored_content_hash`) and per entry (`provenance.judged_text: "pre_repair"`, `judged_content_hash`, `final_content_hash`, `repaired_fields`, the expert issue, the re-solve), that the judges did not see the final text.
   - `hold`: the tables bind them to the pre-repair hash. The engine refuses them (`question_changed_since_scored`) until a fresh judge pass on the final text is merged (section 8).
   - Recommendation: **admit**. The changes are surface repairs (option length balance, key paraphrase, stem cue removal, explanation wording), the expert pass and the blind re-solve both ran on the final text, and `hold` costs 58 more questions and breaks 7 of the 12 English sets (below). A fresh pass on the 60 is cheap and can follow (section 8). The script makes you choose: it has no default.
2. **Judge model.** The raw judge files do not record which model judged. The runbook uses `claude-haiku-5-5` for judges and solvers, the model the agent threshold (7 of 10 on each judge, calibrated 13 Oct) was measured on. If a different model judged, change the three `--*-model` arguments and say so to the owner: the calibration does not carry over.

Offline engine check (`ntaEligibility` run on every planned row with the merged tables, the same gates the website uses):

| | admit | hold |
| --- | ---: | ---: |
| Engine admits | **460** of 479 | 402 of 479 |
| Fit gate (mirror of `wip/cuet-fit`) | 479 of 479 | 419 of 479 |
| English passage sets servable | 12 of 12 | 5 of 12 |
| Held for a fresh pass | 0 | 60 |

By subject under `admit` (admitted of planned): Chemistry 91/95, English 59/59, History 81/82, Political Science 82/83, Psychology 67/79, Sociology 80/81.

## 1. The 19 questions the engine refuses whatever the scores say

These are content gates in the engine (`data/nta_engine.js` `ntaEligibility`), not score problems. They stay published for practice; they cannot enter NTA mode until reworded or the gate changes. Ids and reasons are in `wave1-score-check-admit-2026-10-14.json` under `ineligible`.

| Count | Reason | Why |
| ---: | --- | --- |
| 15 | `orphan_passage_question` | `isPassageLinkedQuestion` treats a stem containing "according to", "based on", or "the author" as a passage question, and finds no passage. 12 Psychology, 1 each History, Political Science, Sociology. Fix: reword the stem ("As per ...", "In ...'s theory, ..."). |
| 3 | `answer_guard_options_invalid`, `answer_guard_near_duplicate_options`, `options_invalid` | Chemistry options that differ only in a sign or one symbol (`-1.10 V` / `+1.10 V`, `-nFE` / `+nFE`, `-Ea/2.303R` / `+Ea/2.303R`) tokenise as near duplicates. The options are correct; the guard is blind to signs. |
| 1 | `wording_corrupted_connective` | A Chemistry stem ends "gives mainly:". The corruption guard reads a trailing "mainly" as a find-and-replace error. Fix: "the major product is". |

A reworded stem changes the content hash, so each rewritten question needs its entries rebuilt (a fresh pass, section 8) before it is admitted.

## 2. Tests

```
npm run test:authored-publish
```

Expected: 42 tests, 0 failures. They need no network and no `.env`. One test compares the fit-gate mirror with `data/nta_fit_scores.js` and skips itself unless a checkout that has it exists (`../mockmob-fit`, or set `NTA_FIT_CHECKOUT`).

## 3. Entries (already built and committed; rebuild only if `tmp/authored` changes)

```
node scripts/authored-scores-merge.mjs --mode=entries --quality-model=claude-haiku-5-5 --fit-model=claude-haiku-5-5 --solver-model=claude-haiku-5-5
```

Expected: `ok: true`, 479 entries, 0 problems, 138 repaired, 138 whose judged text differs from the final text (78 of them only outside the hash). It refuses to write anything while any question lacks a judge result, has an invalid result, or its expert verdict disagrees with the candidates file.

## 4. Check, then merge the score tables (offline)

```
node scripts/authored-scores-merge.mjs --mode=check --repaired-text=admit --impact=tmp/nta-fixtures --report=docs/brain/reports/authored/wave1-score-check-admit-2026-10-14.json
node scripts/authored-scores-merge.mjs --mode=merge --repaired-text=admit
git diff --stat data/nta_agent_scores
npm run test:nta
npm run test:authored-publish
```

Expected from `check` (`admit`): `engineEligible: 460`, `engineIneligible: 19`, `fitGate.pass: 479`, `passageSets: 12 of 12`, `hashChangedByRepair: 60`, `heldForFreshPass: 0`.

Offline paper check (`--impact`, the 13 Oct export of the bank; the five short subjects carry no factory evidence, so the engine can score them without the signing key). Three papers in a row for one simulated student, each leaving out the earlier papers' questions:

| Subject | Eligible rows before, after | Papers before | Papers after (questions) |
| --- | --- | --- | --- |
| Chemistry | 107, 198 | refused, refused, refused | 50, 50, 50 |
| History | 34, 115 | refused x3 | 50, 45, 50 |
| Political Science | 42, 124 | refused x3 | 50, 47, 50 |
| Psychology | 41, 108 | refused x3 | 50, 50, 50 |
| Sociology | 63, 143 | refused x3 | 50, 50, 50 |

All "after" papers are `closest` (not `exact`): a paper with 45 to 50 questions that deviates from the blueprint somewhere (for example a difficulty or type minimum). This is an approximation: the export is from 13 Oct, and it ignores the 15 questions held since. English is not in this table: its pool carries factory evidence.

`merge` rewrites `data/nta_agent_scores/{chemistry,english,history,political_science,psychology,sociology}.json` with the authored entries added; every other entry is untouched (a test checks it). `merged_at` and `models` change, and each table gains an `authored` block. Entries per table: Chemistry 300 to 395, English 277 to 336, History 197 to 279, Political Science 198 to 281, Psychology 87 to 166, Sociology 212 to 293 (479 added in all). `measures.admissible_before_row_checks` per table: 125 to 220, 96 to 155, 53 to 135, 59 to 142, 53 to 132, 82 to 163 (the other `measures` are left as the base merge wrote them).

Review the diff, then commit the six tables (a normal commit, not a force). Re-running `merge` is safe: authored entries are replaced in place, any other entry with the same id makes it refuse.

**Fit tables.** The CUET-fit gate (`data/nta_fit_scores.js`, `data/nta_fit_scores/*.json`) is on `wip/cuet-fit`, not on this branch, so `merge` finds no fit base here and writes only the agent tables (it says `fitTablesWritten: false`; authored-only fit files would clash with the full tables on merge). Merge the fit branch first, then:

```
node scripts/authored-scores-merge.mjs --mode=merge --repaired-text=admit
```

On a branch that has `data/nta_fit_scores/`, the same command adds the 479 fit entries to the six existing fit tables (their `measures` and `status` untouched; the authored counts go in an `authored` block). If the fit tables live in another checkout, pass `--fit-base=<that dir>/data/nta_fit_scores --fit-out=<dir to write>`. The real `wip/cuet-fit` engine was run offline on the merged tables during this work: 460 of 479 admitted, the same 19 content refusals, no fit refusal.

## 5. Dry run (reads the target; writes no row)

The target is the project in `.env.local`. The 13 Oct export names project `isrxrxzjocewrdureyhp`; the script stops if the URL's project ref differs from `--expect-project`.

```
node --use-system-ca scripts/question-publish-authored.mjs --mode=dry-run --expect-project=isrxrxzjocewrdureyhp
```

It reads: that each column the insert writes exists in `questions` and `passage_groups`, which planned ids and group ids already exist, and the live count per subject. It writes `docs/brain/reports/authored-publish/authored-publish-plan-<stamp>.json` (every row and group that would be written, the plan hash, the checks). Exit code 2 when there are blockers.

Expected, with the agent tables merged and committed:

| Field | Value |
| --- | --- |
| `summary.questions`, `passageGroups` | 479, 12 |
| `summary.bySubject` | chemistry 95, english 59, history 82, political_science 83, psychology 79, sociology 81 |
| `summary.byType` | conceptual_mcq 263, statement_based 64, sequence_ordering 37, match_the_following 48, reading_comprehension 59, assertion_reason 8 |
| `summary.byDifficulty` | medium 272, easy 189, hard 18 |
| `summary.byExpertReview` | ready 341, repaired 138 |
| passage sets | 12 sets: eleven of 5 children, one of 4 |
| `candidatesSha256` | `a8e3c00fd7b828b05f219c0f5bd0c13783bc973010b956ffe5aaa66f3ae684af` |
| `planHash` | `9b81a3af7302f4190752e4cef910825fe8a07428690c6e8f64e0cb3e34e3f223` |
| `checks.questionColumnsMissing`, `passageGroupColumnsMissing` | 0, 0 |
| `checks.existingQuestionIds`, `existingGroupIds` | 0, 0 (the authored uuids are new; any other number is a blocker) |
| `checks.agentScores` | bound 479, missing 0, hashMismatch 0 |
| `checks.fitScores` | bound 479 when `data/nta_fit_scores` exists and is merged; otherwise "not checked" |
| `checks.bankLookalikes` | exact 0, nearStem 0 (against the local 13 Oct export; informational) |
| `blockers` | `[]` |

Run offline (no database, so no column, id or count check; it says so):

```
node scripts/question-publish-authored.mjs --mode=dry-run --offline
```

A different `planHash` means the row mapping or the candidates changed since this runbook was written; read the plan before approving it.

## 6. Apply

Only after the owner approves the dry-run file.

```
node --use-system-ca scripts/question-publish-authored.mjs --mode=apply --plan=docs/brain/reports/authored-publish/authored-publish-plan-<stamp>.json --reason="owner approved wave 1 publication <date>" --expect-project=isrxrxzjocewrdureyhp
```

What it does, in order: re-plans from the candidates file the dry run named (their sha256 and the plan hash must match, else it stops); checks the columns; **refuses if any planned question id or group id already exists** (it only ever inserts, never updates, so an existing row cannot be overwritten); refuses rows without score entries bound to their hash unless `--allow-unscored`; writes `authored-publish-restore-<stamp>.json` **before the first insert**; inserts the 12 passage groups, then the questions in chunks of 50; reads everything back.

Expected output: `inserted: 479`, `groupsInserted: 12`, `missing: []`, `notVisible: []`, `hashMismatch: []`, `groupsMissing: []`, and `liveAfter` equal to `liveBefore` plus 95, 59, 82, 83, 79, 81 for chemistry, english, history, political_science, psychology, sociology.

Each row is written as: `status live`, `verification_state verified`, `exploration_state active`, `exploration_lane none`, `ai_tier PENDING`, `quality_band unrated`, `source claude-authored-2026-10-14`, tags naming the run, wave, type, unit, expert review and NCERT reference, `live_at` set to the apply time. `provenance`, `evidence`, `legacy_screening` and the database `content_hash` stay NULL on purpose (see section 10). Commit the plan and restore files afterwards, as the earlier hold runs did.

Then: deploy the code that carries the merged tables if it is not already deployed (until it is, the rows are visible in practice and invisible to NTA mode). The NTA pool is cached in memory for 5 minutes (`NTA_POOL_CACHE_MS`), so a new paper picks the rows up within that time. To confirm, run the existing read-only `scripts/nta-engine-run.mjs`.

## 7. Restore

```
node --use-system-ca scripts/question-publish-authored.mjs --mode=restore --restore=docs/brain/reports/authored-publish/authored-publish-restore-<stamp>.json --expect-project=isrxrxzjocewrdureyhp
```

Default **hide**: the 479 rows go to the withheld state of `scripts/question-hold.mjs` (`pending`, `disputed`, `pending_review`) and `is_deleted = true`, and the 12 groups to `hidden` / not discoverable. This keeps attempt history. Only ids named in the restore file, only rows still from this source. `--hard-delete` deletes the rows that are still exactly as written (skipping any edited since), then the groups no question points at; tables that reference questions with `ON DELETE CASCADE` lose their rows for these ids, so use it only before any student has seen them. The same command cleans up after a failed apply: the error message names the restore file, which already lists every intended id; ids that were never written are skipped.

## 8. Optional: a fresh judge pass for the 60 repaired-text questions

```
node scripts/authored-scores-merge.mjs --mode=rejudge-list
```

writes `docs/brain/reports/authored/wave1-needs-fresh-judging-2026-10-14.json` (60 ids: 5 Chemistry, 21 English, 8 History, 10 Political Science, 8 Psychology, 8 Sociology, each with the repaired fields and the expert's note). Judge them from the candidates file with the same rubrics (two quality judges j1 and j2, three fit judges h1 to h3) and save `<batch>__j1|j2|h1|h2|h3.json` files in one directory, then:

```
node scripts/authored-scores-merge.mjs --mode=entries --quality-model=<id> --fit-model=<id> --solver-model=claude-haiku-5-5 --fresh=<dir> --date=<date>
node scripts/authored-scores-merge.mjs --mode=merge --repaired-text=admit
```

A question with fresh results uses them in place of the old ones (all five judges must be fresh) and is bound to the final hash under either policy, with `provenance.judged_text: "final_after_fresh_pass"`. The same route re-scores a reworded stem from section 1: change the candidate text first, which changes the plan hash, so run the dry run again.

## 9. After publication

- Update `docs/brain/STATUS.md` with the dry-run counts, the apply read-back and the engine check.
- The Explore feed reads `question_scores` rows, which direct inserts do not create, so these questions do not appear in Explore. Practice, full mock and NTA mode read `questions` directly. Say so if the owner expects them in Explore.
- Select-only checks to run in the SQL editor: `select subject, count(*) from questions where source = 'claude-authored-2026-10-14' and not is_deleted group by 1;` (95, 59, 82, 83, 79, 81) and `select count(*) from passage_groups where source = 'claude-authored-2026-10-14';` (12).

## 10. Why the rows look the way they do

- `provenance` is NULL. `isEvidenceManaged` (`data/question_factory_policy.mjs`) treats any row with `provenance` as factory-managed, and `legacyPracticeVisible` (`data/practice_availability.js`) then hides it from practice unless it carries a full signed evidence record. Where the questions came from is in `source`, the tags, the score tables and the restore file. A test pins this.
- `evidence` is NULL: the engine's agent path reads only rows without evidence (`loadNtaAgentRows`), and these rows are scored by the agent tables, not by signed factory evidence.
- The database `content_hash` column is NULL, like all 5,339 live rows exported on 13 Oct. It is body plus key only and unique among undeleted rows, and many English passage questions share a generic stem and key.
- `question` and `correct_index` are NULL, as on 5,324 of the 5,339 live rows; the reader uses `body` and `correct_answer`.
- Passage children carry `passage_group_id`, `passage_id`, `passage_text` and a 1-based `order_index`; the group id is `pg_` plus 32 hex digits derived from the set id, so a re-run writes the same group. Group titles are the passage type ("Factual Passage" and so on), because the authored sets have no titles.
- `author_id` and `uploaded_by` are NULL (the 15 seed rows are the only other live rows without an author; the column is nullable since migration 0007).
- The NTA content hash in the score tables is `contentHash` of the planned row (`scripts/lib/authored-wave.mjs` `contentHashOf`); a test checks the hash of every planned row against the engine's.

## 11. Open questions for the owner

1. Publish now? (This runbook assumes yes only after the dry-run file is read.)
2. `admit` or `hold` for the 60 repaired-text questions (section 0; recommendation admit, fresh pass later).
3. Confirm which model judged. The authored judge files do not say; `claude-haiku-5-5` is assumed.
4. The 19 refused questions (section 1): reword the 15 "according to" stems, the one "mainly" stem and the three sign-only option sets and re-judge them, or relax the passage-link rule, the corruption guard and the near-duplicate-option guard in the engine, or leave them practice-only.
5. Fit tables: merge `wip/cuet-fit` into `fix/nta-mode` before the fit entries are merged (section 4)?
6. Should these appear in Explore (needs `question_scores` rows, a separate step)?
