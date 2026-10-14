# Runbook: publish the agent-authored wave 1 and make it NTA-eligible (14 Oct 2026)

Status: **tooling only. Nothing here has been run against production or staging.** Every number below was produced offline, from the committed candidates, the committed score entries, the committed agent tables and the 13 Oct local export of the bank (`tmp/nta-fixtures`). Publication needs the owner's approval (FACTORY-RUN-2026-10-14.md section 4, item 6).

What is being published: the **475 final candidates** of `docs/brain/reports/authored/wave1-candidates-final-2026-10-14.json` (source `claude-authored-2026-10-14`; AUTHORED-QUESTIONS-WAVE1-2026-10-14.md says how they were made and checked). They are the 479 wave-1 candidates, kept unchanged in `wave1-candidates-2026-10-14.json` for history, minus the 4 that failed the fresh judge pass and with the 19 that the engine refused reworded (same ids).

| Piece | File |
| --- | --- |
| Row mapping and plan (pure) | `scripts/lib/authored-wave.mjs` |
| Judge files to score entries (pure) | `scripts/lib/authored-scores.mjs` |
| Publish, with dry-run, apply, restore | `scripts/question-publish-authored.mjs` |
| Offline candidates, score merge and engine check | `scripts/authored-scores-merge.mjs` |
| Tests (no network, 53 tests) | `data/tests/authored_publish.test.mjs`, `npm run test:authored-publish` |
| Final candidates, and the 4 dropped with their reasons | `wave1-candidates-final-2026-10-14.json`, `wave1-dropped-2026-10-14.json` |
| Judge records, durable (the raw `tmp/authored` files are untracked) | `wave1-score-entries-final-2026-10-14.json` |
| Offline engine check of the final set | `wave1-score-check-final-2026-10-14.json` |
| As first built, kept for history | `wave1-candidates-2026-10-14.json`, `wave1-score-entries-2026-10-14.json`, `wave1-score-check-admit-...json`, `wave1-score-check-hold-...json` |

All under `docs/brain/reports/authored/`.

## 0. What changed after the first build, and what is settled

1. **Fresh judge pass on the 60 repaired-text questions** (batches fr-01 to fr-04: two quality judges and three fit judges each, claude-haiku-5-5, 14 Oct). 56 passed. 4 failed the wave's acceptance rule and are **dropped**:

   | Id | Subject | Why |
   | --- | --- | --- |
   | `5417fab7-c777-435a-851d-c06d92c7480a` | english, set `english__p1__set3` | fit judges 8/6/4 (median 6, bar 8) |
   | `2aeac152-79f9-4bc3-b24d-a4fe11c51c3b` | history | quality judges 7/3, flag `duplicate_options` |
   | `bfe02c5b-46a2-478e-a826-fc0392cdff7f` | political_science | quality judges 6/8 (bar 7 each) |
   | `7620ca67-81e1-4155-8b15-c0f56c847aff` | political_science | quality judges 6/7 |

   Consequences: the dropped English question leaves its set with **3 children**, below the engine's minimum of 4, so that set is published (practice and full mock show it) but **never served in NTA mode**. One Political Science chapter (Globalisation, which had a single authored question) now has none.
2. **The 19 engine-refused questions were reworded** (same ids, minimally; batch rw-01-final) and re-judged: 5 blind solvers each (all 19 were 5 of 5 on the key), two quality judges (7 or more, no flags), three fit judges (median 8 or more). The 15 "according to" stems, the one "mainly" stem and the three sign-only option sets are fixed; the engine now refuses none of the 475. Two of the 19 were also in the fresh-60 set; their fresh-60 results judged the older wording, so they are ignored (the builder only uses a fresh result whose batch text equals the final text).
3. **`--repaired-text=admit|hold` no longer changes anything.** Every question whose hashed text differs from what its first judges saw was re-judged on the final text, so no entry binds scores to text the judges did not see (`hashChangedByRepair: 0`; `hold` and `admit` give identical tables, a test checks it). The flag stays mandatory and the runbook uses `admit`. 74 entries still carry first-pass judges on a text that differs only in the difficulty label or the NCERT reference, which are not in the content hash.
4. **Judge model: claude-haiku-5-5 throughout** (confirmed by the orchestrator, including the original wave-1 judges), so the agent threshold (7 of 10 on each judge, calibrated 13 Oct on that model) applies.
5. **The build refuses an unaccepted question.** `--mode=entries` gives no entry, and exits with a problem, for any question whose records fail the rule (4 of 5 solvers on the key, both quality judges at 7 or more with no flag and the key as blind answer, fit median 8 or more, fewer than two fit flags). So a failing question has to be dropped before the tables can be built.

Offline engine check of the final set (`ntaEligibility` run on every planned row with the merged tables, the same gates the website uses): **475 of 475 admitted**, fit gate (mirror of `wip/cuet-fit`) 475 of 475, no refusal reasons. The real `wip/cuet-fit` engine, run offline on the same rows and tables, agrees: 475 of 475. By subject (admitted of planned): Chemistry 95/95, English 58/58, History 81/81, Political Science 81/81, Psychology 79/79, Sociology 81/81. English passage sets servable: **11 of 12** (the 3-question set is not).

For history, the first build (479 candidates, original judges) gave 460 admitted under `admit` and 402 under `hold`, with 19 content refusals; its tests still run against the kept first-build files.

## 1. Tests

```
npm run test:authored-publish
```

Expected: 53 tests, 0 failures. They need no network and no `.env`. One test compares the fit-gate mirror with `data/nta_fit_scores.js` and skips itself unless a checkout that has it exists (`../mockmob-fit`, or set `NTA_FIT_CHECKOUT`).

## 2. Candidates and entries (already built and committed; rebuild only if `tmp/authored` changes)

```
node scripts/authored-scores-merge.mjs --mode=candidates-final --reword=tmp/authored/fresh/rw-01-final.json
node scripts/authored-scores-merge.mjs --mode=entries --quality-model=claude-haiku-5-5 --fit-model=claude-haiku-5-5 --solver-model=claude-haiku-5-5 --fresh=tmp/authored/fresh
```

`candidates-final` takes the wave-1 candidates (`--original-candidates`), removes the ids of `wave1-dropped-2026-10-14.json` and replaces the text of the reworded ids; it refuses a reword that changes a question's subject, chapter, type, set or passage, a drop without a reason, and a set left with fewer than 2 questions. Expected: 475 candidates, 4 dropped, 19 reworded, 12 passage groups (eleven of 5 children, one of 3).

`entries` expected: `ok: true`, 475 entries, 0 problems, 134 repaired, 73 judged on the final text by the fresh pass, 19 reworded after wave 1, 10 stale fresh results ignored (the five fr-batch judges of each of the two questions that were reworded afterwards). Each reworded entry records `reworded_after_wave1` (the fields), the engine reasons it was reworded for, `expert_reviewed_text: "earlier_text"` and the blind re-solve as `blind_resolve_on_earlier_text`.

## 3. Check, then merge the score tables (offline)

```
node scripts/authored-scores-merge.mjs --mode=check --repaired-text=admit --impact=tmp/nta-fixtures --report=docs/brain/reports/authored/wave1-score-check-final-2026-10-14.json
node scripts/authored-scores-merge.mjs --mode=merge --repaired-text=admit
git diff --stat data/nta_agent_scores
npm run test:nta
npm run test:authored-publish
```

Expected from `check`: `planned: 475`, `agentEntries: 475`, `engineEligible: 475`, `engineIneligible: 0`, `fitGate.pass: 475`, `hashChangedByRepair: 0`, `heldForFreshPass: 0`, `passageSets: 11 of 12 servable`.

Offline paper check (`--impact`, the 13 Oct export of the bank; the five short subjects carry no factory evidence, so the engine can score them without the signing key). Three papers in a row for one simulated student, each leaving out the earlier papers' questions:

| Subject | Eligible rows before, after | Papers before | Papers after (questions) |
| --- | --- | --- | --- |
| Chemistry | 107, 202 | refused x3 | 50, 50, 50 |
| History | 34, 115 | refused x3 | 50, 45, 50 |
| Political Science | 42, 123 | refused x3 | 50, 47, 50 |
| Psychology | 41, 120 | refused x3 | 50, 46, 50 |
| Sociology | 63, 144 | refused x3 | 50, 50, 50 |

All "after" papers are `closest` (not `exact`): a paper of 45 to 50 questions that deviates from the blueprint somewhere (for example a difficulty or type minimum). This is an approximation: the export is from 13 Oct and ignores the 15 questions held since. English is not in this table: its pool carries factory evidence.

`merge` rewrites `data/nta_agent_scores/{chemistry,english,history,political_science,psychology,sociology}.json` with the authored entries added; every other entry is untouched (a test checks it). `merged_at` and `models` change, and each table gains an `authored` block. Entries per table: Chemistry 300 to 395, English 277 to 335, History 197 to 278, Political Science 198 to 279, Psychology 87 to 166, Sociology 212 to 293 (475 added in all). `measures.admissible_before_row_checks` per table: 125 to 220, 96 to 154, 53 to 134, 59 to 140, 53 to 132, 82 to 163 (the other `measures` are left as the base merge wrote them).

Review the diff, then commit the six tables (a normal commit, not a force). Re-running `merge` is safe: authored entries are replaced in place, any other entry with the same id makes it refuse.

**Fit tables.** The CUET-fit gate (`data/nta_fit_scores.js`, `data/nta_fit_scores/*.json`) is on `wip/cuet-fit`, not on this branch, so `merge` finds no fit base here and writes only the agent tables (it says `fitTablesWritten: false`; authored-only fit files would clash with the full tables on merge). Merge the fit branch first, then run the same `merge` command: on a branch that has `data/nta_fit_scores/` it adds the 475 fit entries to the six existing fit tables (their `measures` and `status` untouched; the authored counts go in an `authored` block). If the fit tables live in another checkout, pass `--fit-base=<that dir>/data/nta_fit_scores --fit-out=<dir to write>`.

## 4. Dry run (reads the target; writes no row)

The target is the project in `.env.local`. The 13 Oct export names project `isrxrxzjocewrdureyhp`; the script stops if the URL's project ref differs from `--expect-project`.

```
node --use-system-ca scripts/question-publish-authored.mjs --mode=dry-run --expect-project=isrxrxzjocewrdureyhp
```

It reads: that each column the insert writes exists in `questions` and `passage_groups`, which planned ids and group ids already exist, and the live count per subject. It writes `docs/brain/reports/authored-publish/authored-publish-plan-<stamp>.json` (every row and group that would be written, the plan hash, the checks). Exit code 2 when there are blockers.

Expected, with the agent tables merged and committed:

| Field | Value |
| --- | --- |
| `summary.questions`, `passageGroups`, `chapters` | 475, 12, 61 |
| `summary.bySubject` | chemistry 95, english 58, history 81, political_science 81, psychology 79, sociology 81 |
| `summary.byType` | conceptual_mcq 260, statement_based 64, sequence_ordering 37, match_the_following 48, reading_comprehension 58, assertion_reason 8 |
| `summary.byDifficulty` | medium 269, easy 188, hard 18 |
| `summary.byExpertReview` | ready 341, repaired 134 (19 rows also carry the tag `authored_revision:reworded`) |
| passage sets | 12 sets: eleven of 5 children, `english__p1__set3` of 3 |
| `warnings` | one: `english__p1__set3` has 3 questions, below the NTA minimum of 4 (not a blocker) |
| `candidatesSha256` | `18b27c06748db793cfc30d13515b3aa6bb3190d03a93c0820c9402be4ed0b69e` |
| `planHash` | `39a4b051475df71b02778f5ad8dfdc7fb4c6c96e76d8e1fc82e019a024b3fca2` |
| `checks.questionColumnsMissing`, `passageGroupColumnsMissing` | 0, 0 |
| `checks.existingQuestionIds`, `existingGroupIds` | 0, 0 (the authored uuids are new; any other number is a blocker) |
| `checks.agentScores` | bound 475, missing 0, hashMismatch 0 |
| `checks.fitScores` | bound 475 when `data/nta_fit_scores` exists and is merged; otherwise "not checked" |
| `checks.bankLookalikes` | exact 0, nearStem 0 (against the local 13 Oct export; informational) |
| `blockers` | `[]` |

Run offline (no database, so no column, id or count check; it says so):

```
node scripts/question-publish-authored.mjs --mode=dry-run --offline
```

A different `planHash` means the row mapping or the candidates changed since this runbook was written; read the plan before approving it.

## 5. Apply

Only after the owner approves the dry-run file.

```
node --use-system-ca scripts/question-publish-authored.mjs --mode=apply --plan=docs/brain/reports/authored-publish/authored-publish-plan-<stamp>.json --reason="owner approved wave 1 publication <date>" --expect-project=isrxrxzjocewrdureyhp
```

What it does, in order: re-plans from the candidates file the dry run named (their sha256 and the plan hash must match, else it stops); checks the columns; **refuses if any planned question id or group id already exists** (it only ever inserts, never updates, so an existing row cannot be overwritten); refuses rows without score entries bound to their hash unless `--allow-unscored`; writes `authored-publish-restore-<stamp>.json` **before the first insert**; inserts the 12 passage groups, then the questions in chunks of 50; reads everything back.

Expected output: `inserted: 475`, `groupsInserted: 12`, `missing: []`, `notVisible: []`, `hashMismatch: []`, `groupsMissing: []`, and `liveAfter` equal to `liveBefore` plus 95, 58, 81, 81, 79, 81 for chemistry, english, history, political_science, psychology, sociology.

Each row is written as: `status live`, `verification_state verified`, `exploration_state active`, `exploration_lane none`, `ai_tier PENDING`, `quality_band unrated`, `source claude-authored-2026-10-14`, tags naming the run, wave, type, unit, expert review and NCERT reference, `live_at` set to the apply time. `provenance`, `evidence`, `legacy_screening` and the database `content_hash` stay NULL on purpose (see section 9). Commit the plan and restore files afterwards, as the earlier hold runs did.

Then: deploy the code that carries the merged tables if it is not already deployed (until it is, the rows are visible in practice and invisible to NTA mode). The NTA pool is cached in memory for 5 minutes (`NTA_POOL_CACHE_MS`), so a new paper picks the rows up within that time. To confirm, run the existing read-only `scripts/nta-engine-run.mjs`.

## 6. Restore

```
node --use-system-ca scripts/question-publish-authored.mjs --mode=restore --restore=docs/brain/reports/authored-publish/authored-publish-restore-<stamp>.json --expect-project=isrxrxzjocewrdureyhp
```

Default **hide**: the 475 rows go to the withheld state of `scripts/question-hold.mjs` (`pending`, `disputed`, `pending_review`) and `is_deleted = true`, and the 12 groups to `hidden` / not discoverable. This keeps attempt history. Only ids named in the restore file, only rows still from this source. `--hard-delete` deletes the rows that are still exactly as written (skipping any edited since), then the groups no question points at; tables that reference questions with `ON DELETE CASCADE` lose their rows for these ids, so use it only before any student has seen them. The same command cleans up after a failed apply: the error message names the restore file, which already lists every intended id; ids that were never written are skipped.

## 7. A further fresh judge pass (another wording, or a question dropped and replaced)

`--mode=rejudge-list` lists the questions whose judged text differs from the final text in a way the content hash covers; on the final entries it lists none. To re-judge anything else, save the batch text the judges were given as `<batch>.json` (`{ "batch": ..., "questions": [...] }`) next to their results `<batch>__j1|j2|h1|h2|h3.json` (and `<batch>__s1..s5.json` for fresh blind solvers) in one directory, then:

```
node scripts/authored-scores-merge.mjs --mode=entries --quality-model=claude-haiku-5-5 --fit-model=claude-haiku-5-5 --solver-model=claude-haiku-5-5 --fresh=tmp/authored/fresh --fresh=<dir>
node scripts/authored-scores-merge.mjs --mode=merge --repaired-text=admit
```

A fresh result replaces the original of its role only where its batch text equals the candidate's text (a result on an older wording is counted as stale and ignored), all five judges of a question must be fresh together, and the question must pass the acceptance rule or the build refuses it. A reworded candidate changes the plan hash, so run the dry run again.

## 8. After publication

- Update `docs/brain/STATUS.md` with the dry-run counts, the apply read-back and the engine check.
- The Explore feed reads `question_scores` rows, which direct inserts do not create, so these questions do not appear in Explore. Practice, full mock and NTA mode read `questions` directly. Say so if the owner expects them in Explore.
- Select-only checks to run in the SQL editor: `select subject, count(*) from questions where source = 'claude-authored-2026-10-14' and not is_deleted group by 1;` (95, 58, 81, 81, 79, 81) and `select count(*) from passage_groups where source = 'claude-authored-2026-10-14';` (12).

## 9. Why the rows look the way they do

- `provenance` is NULL. `isEvidenceManaged` (`data/question_factory_policy.mjs`) treats any row with `provenance` as factory-managed, and `legacyPracticeVisible` (`data/practice_availability.js`) then hides it from practice unless it carries a full signed evidence record. Where the questions came from is in `source`, the tags, the score tables and the restore file. A test pins this.
- `evidence` is NULL: the engine's agent path reads only rows without evidence (`loadNtaAgentRows`), and these rows are scored by the agent tables, not by signed factory evidence.
- The database `content_hash` column is NULL, like all 5,339 live rows exported on 13 Oct. It is body plus key only and unique among undeleted rows, and many English passage questions share a generic stem and key.
- `question` and `correct_index` are NULL, as on 5,324 of the 5,339 live rows; the reader uses `body` and `correct_answer`.
- Passage children carry `passage_group_id`, `passage_id`, `passage_text` and a 1-based `order_index`; the group id is `pg_` plus 32 hex digits derived from the set id, so a re-run writes the same group. Group titles are the passage type ("Factual Passage" and so on), because the authored sets have no titles.
- `author_id` and `uploaded_by` are NULL (the 15 seed rows are the only other live rows without an author; the column is nullable since migration 0007).
- The NTA content hash in the score tables is `contentHash` of the planned row (`scripts/lib/authored-wave.mjs` `contentHashOf`); a test checks the hash of every planned row against the engine's.

## 10. Open questions for the owner

1. Publish now, after reading the dry-run file?
2. The English set `english__p1__set3` has 3 questions and will not be served in NTA mode. Publish it for practice as it is (the plan does), author one replacement question for it (one more question and a judge pass would make it servable), or drop its three questions from the publish set (add their ids to `wave1-dropped-2026-10-14.json` and rebuild)?
3. Political Science "Globalisation" has no authored question left. Cover it in wave 2?
4. Merge `wip/cuet-fit` into `fix/nta-mode` before the fit entries are merged (section 3)?
5. Should these appear in Explore (needs `question_scores` rows, a separate step)?
