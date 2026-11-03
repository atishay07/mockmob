$ErrorActionPreference='Stop'
$repo='C:\Users\atish\Desktop\mockmob copy\mockmob copy'
$artifact='artifacts/question-factory/cuet-readiness-2026-10-09'
$benchmark=Join-Path $repo "$artifact/benchmark"
$execution=Join-Path $repo "$artifact/execution"
$ids=@('v76f-71ed304404','cbse24-bs-q02','cbse24-eco-q02')
$inputs=@{}
$cohorts=@{}
foreach($name in @('fresh','regression')) {
 $dir=Join-Path $benchmark "v76-qualification-2026-10-09-$name-bounded-input"
 $cohorts[$name]=@{}
 foreach($entry in @(@('frozen','frozen.json'),@('results','run/results.json'),@('overlay','scratch-registry-overlay.json'))) {
  $path=Join-Path $dir $entry[1]
  $inputs[$path]=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
  $cohorts[$name][$entry[0]]=Get-Content -Raw -LiteralPath $path|ConvertFrom-Json
 }
}
$policy74=Join-Path $repo 'scripts/pipeline/lib/factoryEvidenceV74.mjs'
$policy76=Join-Path $repo 'scripts/pipeline/lib/factoryEvidenceV76.mjs'
$policy73=Join-Path $repo 'scripts/pipeline/lib/factoryEvidenceV73.mjs'
$freezePath=Join-Path $repo "$artifact/v76-contract-freeze.json"
$policyText74=Get-Content -Raw -LiteralPath $policy74
$policyText76=Get-Content -Raw -LiteralPath $policy76
$freeze=Get-Content -Raw -LiteralPath $freezePath|ConvertFrom-Json
foreach($path in @($policy74,$policy76,$policy73,$freezePath)) {$inputs[$path]=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
if($inputs[$policy76] -ne $freeze.file_sha256.'scripts/pipeline/lib/factoryEvidenceV76.mjs') {throw 'V76 policy does not match pinned contract'}
function Exact($container,$quote,$locator) {
 $offset=([string]$container).IndexOf([string]$quote,[StringComparison]::Ordinal)
 if($offset -lt 0 -or [string]::IsNullOrEmpty($quote)){throw "Exact quotation verification failed: $locator"}
 return [ordered]@{locator=$locator;quote=$quote;exact_substring_verified=$true;comparison='ordinal';utf16_offset=$offset;utf16_length=$quote.Length}
}
$chapterInstruction='For an item whose answer depends on the supplied literary/factual/narrative passage, identify the reading-comprehension chapter by that stimulus and record the vocabulary/inference skill as the topic. A standalone lexical question belongs to Vocabulary. Do not copy the assigned chapter to conceal a mismatch; verify the official syllabus and source coverage.'
$contextInstruction='Check every factual claim, including negatives and claims rejecting distractors, for correctness and source support. Read each sentence in its local context before splitting its asserted clauses; resolve pronouns and scope honestly, and do not broaden a local statement into a universal claim. Context does not exempt a factual negative or unsupported added fact.'
$deductionInstruction='Logical deductions are legitimate when all premises are explicit in the stem or supplied excerpts; record the premises and inference in reasons and classify the claim by its actual supported basis (stem/excerpt, or arithmetic for calculation). A deduction is not a guessed case-specific input.'
$contractEvidence=@((Exact $policyText74 $chapterInstruction 'scripts/pipeline/lib/factoryEvidenceV74.mjs:V74_ASSUMPTION_INSTRUCTIONS'),(Exact $policyText76 $contextInstruction 'scripts/pipeline/lib/factoryEvidenceV76.mjs:V76_EXPLANATION_INSTRUCTIONS'),(Exact $policyText76 $deductionInstruction 'scripts/pipeline/lib/factoryEvidenceV76.mjs:V76_EXPLANATION_INSTRUCTIONS'))
$syllabi=@{}
foreach($subject in @('english','business_studies','economics')) {
 $path=Join-Path $repo "data/question-factory-runtime/source-foundation/$subject-syllabus-2026.txt"
 $inputs[$path]=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
 $syllabi[$subject]=Get-Content -Raw -LiteralPath $path
}
$decisions=@{
 'v76f-71ed304404'=@{
  academic_key='B';classification='benchmark_metadata_construction_defect';academic_question_rejection=$false;academic_explanation_defect=$false;model_judgment_error=$false
  judgment='Both blind solvers correctly derive B and correctly classify this passage-dependent contextual vocabulary task as Narrative Passage under the exact pinned V74 instruction. The frozen candidate chapter Vocabulary denotes a standalone lexical task under that contract, while its supplied narrative, route=passage and objective explicitly require paragraph-context inference. The deterministic chapter gate correctly exposes this benchmark metadata inconsistency. This is not failed academic solvability or model misclassification.'
  scope='The phrase is solved through the contrast with Srinagar and paragraph chronology; it is not a standalone dictionary question. Current syllabus explicitly entitles narrative Reading Comprehension, and both solvers record vocabulary/inference as the topic.'
  counterexample='The answer-free source alone establishes B; A reverses the tourist contrast, C introduces an unmentioned ban, D imports later construction. No plausible full competing answer is supplied.'
  future='Record the construction metadata defect and prior review omission. Any future separately registered construction should place the passage chapter consistently with pinned V74 instructions. Do not relabel or repair this frozen cohort/result.'
  prior='My v2 construction custody accepted Vocabulary as a canonical alias from factory scope but did not compare that alias to the exact V74 stimulus-first chapter instruction. That historical metadata-review judgment was incomplete. Preserve the v2 artifact and this correction separately; the academic B derivation remains valid.'
  syllabus_quote='b. Narrative'
 }
 'cbse24-bs-q02'=@{
  academic_key='D';classification='academic_explanation_defect_and_positive_control_construction_gap';academic_question_rejection=$false;academic_explanation_defect=$true;model_judgment_error=$false
  judgment='Both blind solvers correctly derive D from the new allocation of tasks by skills and competencies. The explanation independently asserts that the earlier allocation did not follow skills. The stem states whole-event allocation rather than specific tasks and reports poor task quality, but never states how staff were selected for those entire events. An event could have been assigned using broad event-management skills, with task quality still suffering because specialised tasks were not separately allocated. The missing earlier selection fact can vary while all printed facts and D remain unchanged. The completed Luna explanation rejection therefore correctly identifies an unsupported factual clause.'
  scope='The task-allocation deficiency and the subsequent skill-based task correction support the key. They do not entail the stronger historical assertion that prior staff allocation lacked any skill basis. The explanation says it as a factual prior condition, not merely that the later method newly allocates specialist tasks.'
  counterexample='Manager initially assigns an entire event to each person after considering each person capable of overall event delivery. Graphic design, enquiries and bill payment then suffer because each person lacks some specialist capabilities. Next season the manager allocates particular tasks according to each specialist skill. This satisfies every stem clause but contradicts the explanation assertion that the earlier allocation did not follow skills.'
  future='Treat this positive-control validity label as a construction gap for the complete question-plus-explanation item. Preserve its frozen expected_valid=true and recorded rejection; do not retroactively relabel or repair. A future construction may state the missing historical condition or avoid asserting it, under a new registration.'
  prior='This case was not within my earlier 28-case fresh explanation/label custody review.'
  syllabus_quote='Steps in the process of organising.'
 }
 'cbse24-eco-q02'=@{
  academic_key='C';classification='model_explanation_judgment_error';academic_question_rejection=$false;academic_explanation_defect=$false;model_judgment_error=$true
  judgment='Both blind solvers correctly derive C and accept the targeted-recipient contrast in their full-option reasoning. The disputed explanation sentence begins with The case focuses and is embedded in an answer to most directly illustrated. Its local assertion is about the dimension described in this scenario: who receives a free transfer. The stem expressly identifies low-income recipients, gives no production mix, sectoral resource direction or production input change, and the excerpt explicitly associates transfers and household income distribution with redistribution. Thus the local focus contrast is stem/excerpt-supported reasoning. It does not assert that providing food has no procurement/production effects or that every resource-reallocation policy is exclusively production allocation. Luna explanation auditing treated the contrast as requiring an unsupported external institutional exclusion, rather than respecting its local scenario-focus scope.'
  scope='The explanation distinguishes the most direct objective illustrated by the printed low-income targeting; it never denies other possible effects. Its preceding clause expressly acknowledges other possible macroeconomic effects. Absence of a production premise identifies what is not described by this case; it is not evidence that production-resource effects are impossible or an option is universally false.'
  counterexample='The food programme could procure grain or affect production incentives while still most directly illustrating redistribution through its targeted household transfer. Such side effects leave the explanation local focus claim true. Therefore the claim need not assume they do not exist.'
  future='Retain the recorded explanation rejection as a completed false rejection in this frozen cohort. A future general evaluation may test contextual scope, but no result override, contract edit or paid rerun is authorized here.'
  prior='This case was not within my earlier 28-case fresh explanation/label custody review.'
  syllabus_quote='Government budget - meaning, objectives and components'
 }
}
$rows=@()
foreach($id in $ids) {
 $name=$(if($id -eq 'v76f-71ed304404'){'fresh'}else{'regression'})
 $cohort=$cohorts[$name]
 $fixture=@($cohort.frozen.fixtures|Where-Object {$_.id -eq $id})
 $topology=@($cohort.results.topologies.dual_blind|Where-Object {$_.id -eq $id})
 if($fixture.Count -ne 1 -or $topology.Count -ne 1){throw 'Target cardinality mismatch'}
 $fixture=$fixture[0];$result=$topology[0];$c=$fixture.candidate;$eval=$cohort.results.evaluations.($id);$decision=$decisions[$id]
 if($fixture.expected_valid -ne $true -or $result.expected_valid -ne $true -or $result.state -ne 'quarantined'){throw 'Unexpected target state'}
 $sources=@()
 foreach($ref in $c.source_refs) {
  $s=$cohort.overlay.sources.($ref.id);$text=[string]$s.facts.($ref.locator).text
  if($ref.version -ne $s.version -or $ref.support_hash -ne $s.supports.($ref.locator)){throw 'Source binding mismatch'}
  $sources += [ordered]@{source_id=$s.id;locator=$ref.locator;quote=$text;identity_sha256=$s.identity_sha256;stored_support_hash=$ref.support_hash;support_reference_matches_overlay=$true;exact_quote_check=(Exact $text $text "$($s.id):$($ref.locator)")}
 }
 $providerReviews=@()
 foreach($provider in @('openai','gemini')) {
  $e=$eval.($provider)
  if($e.status -ne 'judged' -or $e.solved_key -ne $decision.academic_key){throw 'Incomplete or unexpected solver outcome'}
  $spanChecks=@()
  foreach($span in $e.supporting_spans) {
   $text=$(if($span.source_id -eq 'passage'){$c.passage_text}else{$cohort.overlay.sources.($span.source_id).facts.($span.locator).text})
   $spanChecks += (Exact $text $span.quote "${provider}:$($span.source_id):$($span.locator)")
  }
  $providerReviews += [ordered]@{provider=$provider;model=$e.model;status=$e.status;solved_key=$e.solved_key;syllabus_chapter=$e.syllabus_chapter;syllabus_topic=$e.syllabus_topic;reasons=$e.reasons;single_defensible_answer=$e.single_defensible_answer;source_support=$e.source_support;blocking_defects=$e.blocking_defects;fit_result=$e.cuet_fit_result;adjudication='Blind academic solution agrees with independent source reasoning.';supporting_span_checks=$spanChecks}
 }
 $explanation=$result.checks.explanation_support
 $explanationReceipt=$(if($null -eq $explanation){[ordered]@{status='not_reached';reason='Deterministic syllabus mapping failed before explanation stage; no explanation receipt exists for either provider.'}}else{[ordered]@{status='completed';provider=$explanation.provider;model=$explanation.model;passed=$explanation.passed;claims=$explanation.claims;reasons=$explanation.reasons;evidence_ids=$explanation.evidence_ids;gemini_separate_explanation_check='not present: this topology records Luna explanation audit using both blind solutions';supporting_span_checks=@($explanation.supporting_spans|ForEach-Object {$span=$_;Exact $cohort.overlay.sources.($span.source_id).facts.($span.locator).text $span.quote "explanation:$($span.source_id):$($span.locator)"})}})
 $disputedClaim=$(if($id -eq 'cbse24-bs-q02'){'The earlier tasks were identified, but allocation to staff did not follow their skills.'}elseif($id -eq 'cbse24-eco-q02'){'A: The case focuses on who receives a transfer, rather than production-resource allocation.'}else{"The phrase is used in contrast with Srinagar’s many tourists."})
 $rows += [ordered]@{
  id=$id;cohort=$name;frozen_label=$fixture.expected_valid;frozen_category=$fixture.category;body=$c.body;options=$c.options;proposed_key=$c.correct_answer;full_explanation=$c.explanation;chapter=$c.chapter;route=$c.route;learning_objective=$c.learning_objective;source_refs=$c.source_refs;source_evidence=$sources
  recorded_state=$result.state;recorded_failed_stage=$result.failed_stage;recorded_failure_details=$result.failure_details;content_hash=$result.content_hash;chapter_mapping=$result.checks.syllabus_mapping.chapter_mapping
  both_blind_solver_reviews=$providerReviews;explanation_check=$explanationReceipt;disputed_explanation_quote=(Exact $c.explanation $disputedClaim 'candidate.explanation');current_syllabus_evidence=(Exact $syllabi[$c.subject] $decision.syllabus_quote "$($c.subject)-syllabus-2026.txt")
  independent_academic_key=$decision.academic_key;classification=$decision.classification;academic_question_rejection=$decision.academic_question_rejection;academic_explanation_defect=$decision.academic_explanation_defect;model_judgment_error=$decision.model_judgment_error
  independent_adjudication=$decision.judgment;scope_analysis=$decision.scope;counterexample_or_boundary=$decision.counterexample;historical_custody_note=$decision.prior;future_action_boundary=$decision.future
 }
}
foreach($path in $inputs.Keys){if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $inputs[$path]){throw 'Input mutated during diagnosis'}}
$doc=[ordered]@{
 schema='v76-valid-failure-diagnosis-sol-v1';at_utc=[DateTime]::UtcNow.ToString('o');reviewer='independent-sol';scope=[ordered]@{target_ids=$ids;bounded_to_three_completed_failures=$true;external_provider_calls=0;official_key_lookup=$false;official_keys_not_relied_upon=$true;frozen_cases_labels_results_preserved=$true;no_contract_or_candidate_edits=$true;no_resubmission=$true;no_paid_benchmark=$true;note='Parsed frozen target fixtures/results and source overlays. Embedded legacy official comparison metadata was not used to establish any answer. No broad custody re-audit performed.'}
 input_file_sha256=$inputs;pinned_contract=[ordered]@{verifier_version=$freeze.verifier_version;validation_contract_hash=$freeze.validation_contract_hash;V76_policy_file_sha256_matches_freeze=$true;inherited_V74_instructions_read_exactly=$true;exact_instruction_evidence=$contractEvidence}
 summary=[ordered]@{total=3;academic_question_defects=0;academic_explanation_defects=1;benchmark_metadata_construction_defects=1;positive_control_complete_item_construction_gaps=1;model_explanation_judgment_errors=1;incomplete_or_error_outcomes_used_as_rejects=0;recorded_states_overridden=0;release_or_native_qualification_claimed=$false;denominator_or_labels_changed=$false;prior_fresh_custody_metadata_review_omission_acknowledged=$true}
 cases=$rows
}
$md=@'
Three completed positive failures were examined. Frozen cases, labels and native results remain unchanged; no provider calls or official key lookup were made.

| Case | Academic answer | Diagnosis |
| --- | --- | --- |
| v76f-71ed304404 | B | Benchmark chapter metadata defect. Both solvers correctly return Narrative Passage under pinned V74 instructions; the frozen candidate says Vocabulary. |
| cbse24-bs-q02 | D | Supported key, unsupported historical explanation clause. Luna rejection is academically defensible; the positive-control label has a complete-item construction gap. |
| cbse24-eco-q02 | C | Completed explanation judgment error. The disputed contrast states the local focus of the supplied scenario, rather than denying possible production effects. |

The pinned V74 instruction requires passage-dependent vocabulary/inference questions to use the reading-comprehension chapter identified by the stimulus, with vocabulary recorded as the topic. Jibhi is a narrative stimulus, and both solvers obey this. The prior fresh custody review accepted the canonical Vocabulary alias without checking that pinned stimulus-first instruction. Its academic answer remains sound, but that metadata-review omission is acknowledged separately and its frozen artifact is preserved.

The organising scenario establishes that tasks were listed and whole events were allocated, then specialist tasks were allocated by skills. It does not establish that the earlier allocation of entire events ignored skills. Entire events could have been assigned using general event-management abilities while specialised task quality still suffered. Thus the explanation's historical claim can be false while every printed fact and D remain unchanged. This is a factual explanation defect, not an answer ambiguity or a model error.

The economics explanation says “The case focuses on who receives a transfer, rather than production-resource allocation.” Read with “most directly illustrated” and its preceding acknowledgement of other possible effects, this describes the printed scenario's focus. The stem explicitly targets low-income recipients and describes no production allocation. The source explicitly connects household transfers with disposable income and redistribution. This supports the local distinction without claiming that resource-allocation side effects are impossible or introducing a universal institutional definition. Luna's blind solution accepts that same distinction, but its explanation audit rejects it by expanding the local comparison into an unsupported external classification. That completed audit rejection is a judgment error.

No separate Gemini explanation audit exists in these receipts. Both providers' blind solutions were reviewed. Fresh English failed before the explanation stage; both regression explanation checks were completed by Luna using the blind solutions.

These are diagnoses of frozen failures, not changes to measured survival or qualification. Every observed rejection remains in the original results and denominator. Any future repair or evaluation requires a separately registered construction; no repair or rerun was performed here.
'@
$outJson=Join-Path $execution 'v76-valid-failure-diagnosis-sol.json'
$outMd=Join-Path $execution 'v76-valid-failure-diagnosis-sol.md'
foreach($entry in @(@($outJson,($doc|ConvertTo-Json -Depth 50)),@($outMd,$md))) {
 $path=$entry[0];$text=$entry[1];$bytes=[Text.UTF8Encoding]::new($false).GetBytes($text+[Environment]::NewLine)
 $f=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$f.Write($bytes,0,$bytes.Length);$f.Flush($true)}finally{$f.Dispose()}
 $hash=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
 $receipt="$path.sha256";$bytes=[Text.UTF8Encoding]::new($false).GetBytes("$hash  $([IO.Path]::GetFileName($path))`n")
 $f=[IO.File]::Open($receipt,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$f.Write($bytes,0,$bytes.Length);$f.Flush($true)}finally{$f.Dispose()}
 foreach($saved in @($path,$receipt)){[IO.File]::SetAttributes($saved,([IO.File]::GetAttributes($saved) -bor [IO.FileAttributes]::ReadOnly))}
 [pscustomobject]@{path=$path;sha256=$hash;readonly=(Get-Item -LiteralPath $path).IsReadOnly}|ConvertTo-Json
}
$doc.summary|ConvertTo-Json
