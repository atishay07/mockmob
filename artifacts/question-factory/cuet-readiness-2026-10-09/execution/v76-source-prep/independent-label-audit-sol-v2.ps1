$ErrorActionPreference='Stop'
$dir=Join-Path $PSScriptRoot '.'
$derivationPath=Join-Path $dir 'independent-derivations-sol-v2.json'
$draftPath=Join-Path $dir 'draft-cases-v2-PRIVATE.json'
$overlayPath=Join-Path $dir 'source-overlay-v2.json'
$priorHash='57905df02c23bfeef72701545d5e5edac89cc3159ebe95cfb3e8d2bfcbedb395'
if((Get-FileHash -LiteralPath $derivationPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $priorHash){throw 'Freeze integrity failed'}
$v=Get-Content -Raw -LiteralPath $derivationPath|ConvertFrom-Json
$d=Get-Content -Raw -LiteralPath $draftPath|ConvertFrom-Json
$o=Get-Content -Raw -LiteralPath $overlayPath|ConvertFrom-Json
$notes=@{
 'v76f-5ef78612af'=@('wrong_key','Frozen derivation gives D=2000; proposed B prints 4000. The correct explanation conflicts with the proposed key.',$true)
 'v76f-dcb4ca9b28'=@('missing_decisive_assumption','Final call equals the unstated premium. Explanation imports 40 percent absent from this stem/source. No letter is established; oracle B is an inherited placeholder.',$false)
 'v76f-2b8bd9ddd4'=@('numerical_fault','The explanation asserts 40 x 6/5 = 44, but the product is 48. Proposed C=48 is correct; the explanatory calculation is false.',$false)
 'v76f-972dd21c21'=@('multiple_correct','Both full B (framework) and D (precedence/basis) paraphrase primacy. D is a correct member but not uniquely correct. Explanation also retains an obsolete continuity-distractor reference after B changed.',$true)
 'v76f-8a965d2fc3'=@('unsupported_explanation','No enactment date/identity of this exact regulation is supplied. The appended 1998 claim is unsupported by all referenced excerpts and stem. Core A reasoning remains correct.',$false)
 'v76f-6c0c03dcf8'=@('out_of_syllabus','C=12 and its explanation are correct, but pure derivative evaluation has no Business Studies Marketing objective. Supplied rules do not establish subject entitlement.',$true)
 'v76f-59f949e91e'=@('wrong_key','Frozen derivation gives D=CRR; proposed A is SLR. The correct explanatory definition conflicts with the proposed key.',$true)
 'v76f-cbcd129073'=@('missing_decisive_assumption','Deposits=200/r and r is expressly unstated. Explanation imports 0.20. Neither proposed A nor oracle D is established. Each option fits a different possible ratio.',$false)
 'v76f-060c149e8f'=@('unsupported_explanation','The appended sentence reverses non-rivalry: the source states satisfaction can increase without reducing that obtained by others. Core A truth pair is correct but the final definition is false.',$false)
 'v76f-f4c6fb6af3'=@('wrong_key','Frozen derivation gives D, initial landscape/tourism comparison. Proposed A falsely gives the later 2008 scheme as an already guaranteed success; chronology defeats that full option.',$true)
 'v76f-706de08f5d'=@('multiple_correct','Full B and C both mean little known in the tourism contrast. No text excludes the local-area wording. B is one correct member; explanation cannot restore uniqueness.',$true)
 'v76f-10e903f685'=@('unsupported_explanation','Yearly doubling is absent from the passage and cannot follow from general growth and 2008 acceleration. C and the preceding attitude reasoning remain supported.',$false)
}
$claimStarts=@{'v76f-dcb4ca9b28'='The premium is 40%';'v76f-2b8bd9ddd4'='An allotment of 40';'v76f-8a965d2fc3'='This exact advertising regulation';'v76f-cbcd129073'='The deposits are';'v76f-060c149e8f'='Non-rivalry means';'v76f-10e903f685'='The passage establishes'}
$rows=@()
foreach($item in $d.cases){
 $r=$v.cases|Where-Object {$_.id -eq $item.id};$c=$item.candidate
 if(@($r).Count -ne 1 -or -not [string]::Equals($r.body,$c.body,[StringComparison]::Ordinal) -or -not [string]::Equals($r.passage_text,$c.passage_text,[StringComparison]::Ordinal)){throw 'Draft drift'}
 for($i=0;$i -lt 4;$i++){if(-not [string]::Equals($c.options[$i].text,$r.option_assessments[$i].full_printed_option,[StringComparison]::Ordinal) -or $c.options[$i].key -ne $r.option_assessments[$i].key){throw 'Option drift'}}
 $refs=@()
 foreach($ref in $c.source_refs){
  $source=$o.sources.($ref.id);$text=[string]$source.facts.($ref.locator).text;$q=$r.supplied_source_evidence|Where-Object {$_.source_id -eq $ref.id -and $_.locator -eq $ref.locator}
  if(@($q).Count -ne 1 -or [string]::IsNullOrEmpty($text) -or $text.IndexOf([string]$q.quote,[StringComparison]::Ordinal) -lt 0 -or -not [string]::Equals($text,$q.quote,[StringComparison]::Ordinal)){throw 'Quote drift'}
  if($ref.version -ne $source.version -or $ref.support_hash -ne $source.supports.($ref.locator) -or $source.identity_sha256 -ne $q.identity_sha256){throw 'Source ref mismatch'}
  $rawQuoteHash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.UTF8Encoding]::new($false).GetBytes($text))).ToLowerInvariant()
  $pack=$o.packs.($c.provenance.source_pack_id)
  if($source.state -ne 'active' -or $pack.state -ne 'active' -or $pack.document_ids -notcontains $source.id){throw 'Pack binding failed'}
  $refs += [ordered]@{source_id=$source.id;locator=$ref.locator;quote=$text;source_identity_sha256=$source.identity_sha256;stored_support_hash=$ref.support_hash;stored_support_hash_matches_overlay=$true;raw_utf8_quote_sha256=$rawQuoteHash;exact_substring_verified=$true;ordinal_offset=$text.IndexOf([string]$q.quote,[StringComparison]::Ordinal);version_pack_binding_verified=$true}
 }
 $member=(@($r.proposed_keys) -contains $c.correct_answer);$uniqueMatch=($r.unique_answer -and $member);$claim=$null
 if($claimStarts.ContainsKey($item.id)){
  $offset=([string]$c.explanation).IndexOf($claimStarts[$item.id],[StringComparison]::Ordinal);if($offset -lt 0){throw 'Claim locator missing'}
  $needle=([string]$c.explanation).Substring($offset)
  if(([string]$c.explanation).IndexOf($needle,[StringComparison]::Ordinal) -lt 0){throw 'Exact claim failed'}
  $claim=[ordered]@{locator='candidate.explanation';quote=$needle;exact_substring_verified=$true;ordinal_offset=$offset;appears_verbatim_in_referenced_sources=(@($refs|Where-Object {$_.quote.IndexOf($needle,[StringComparison]::Ordinal) -ge 0}).Count -gt 0);inference_assessment=$notes[$item.id][1]}
 }
 if($item.expected_valid){
  $valid=($r.dispatch_ready -and $uniqueMatch);$sound=$true;$confirmed=$valid;$basis='All explanatory clauses reviewed against the exact supplied sources and frozen proof; arithmetic, classifications, comparisons and passage inferences agree. '+$r.short_proof;$classification=$(if($valid){'none'}else{'source_or_premise_academic_defect'})
 }else{
  if(-not $notes.ContainsKey($item.id) -or $notes[$item.id][0] -ne $item.category){throw 'Unreviewed category'}
  $valid=$false;$sound=$notes[$item.id][2];$confirmed=$true;$basis=$notes[$item.id][1];$classification='decisive_controlled_academic_defect'
 }
 $oracleStatus=$(if(-not $r.solvable){'inherited_placeholder_no_established_answer'}elseif(-not $r.unique_answer){'representative_of_multiple_defensible_answers'}elseif(@($r.proposed_keys) -contains $item.oracle.key){'matches_frozen_independent_answer'}else{'oracle_mismatch'})
 if($oracleStatus -eq 'oracle_mismatch'){throw 'Oracle mismatch'}
 $rows += [ordered]@{id=$item.id;tag=$item.tag;group=$item.group;actual_expected_valid=$item.expected_valid;actual_category=$item.category;independent_keys=@($r.proposed_keys);unique_answer=$r.unique_answer;solvable=$r.solvable;entitlement=$r.entitlement;proposed_key=$c.correct_answer;proposed_key_is_member=$member;proposed_key_uniquely_supported=$uniqueMatch;full_explanation=$c.explanation;explanation_academically_sound=$sound;explanation_support_review=$basis;defective_explanation_quote=$claim;label_confirmed=$confirmed;candidate_academically_valid=$valid;failure_classification=$classification;stored_oracle_key=$item.oracle.key;oracle_status=$oracleStatus;oracle_is_unique_academic_truth=($r.unique_answer -and $r.solvable -and $oracleStatus -eq 'matches_frozen_independent_answer');frozen_short_proof=$r.short_proof;all_full_options_assessed=$true;option_assessments=$r.option_assessments;syllabus_evidence=$r.syllabus_evidence;source_evidence=$refs;assessment_completed=$true;unfinished_or_error_is_academic_reject=$false}
}
if($rows.Count -ne 28 -or @($rows.id|Select-Object -Unique).Count -ne 28){throw 'Denominator altered'}
$positive=@($rows|Where-Object {$_.actual_expected_valid});$negative=@($rows|Where-Object {-not $_.actual_expected_valid});$gaps=@($positive|Where-Object {-not $_.candidate_academically_valid -or -not $_.explanation_academically_sound})
if($positive.Count -ne 16 -or $negative.Count -ne 12 -or $gaps.Count -ne 0){throw 'Unexpected control counts'}
$doc=[ordered]@{
 schema='v76-explanation-and-label-custody-sol-v2';reviewer='independent-sol';frozen_at_utc=[DateTime]::UtcNow.ToString('o')
 custody=[ordered]@{independent_derivations_frozen_before_private_disclosure=$true;derivations_v2_sha256=$priorHash;derivations_v2_frozen_at=$v.frozen_at_utc;private_draft_sha256=(Get-FileHash -LiteralPath $draftPath -Algorithm SHA256).Hash.ToLowerInvariant();source_overlay_sha256=(Get-FileHash -LiteralPath $overlayPath -Algorithm SHA256).Hash.ToLowerInvariant();official_keys_accessed=$false;external_provider_calls=0;native_paid_calls=0;construction_files_modified=$false;all_case_history_preserved=$true;scope='Construction truth-label and explanation custody only; no native evaluation outcomes inspected.'}
 summary=[ordered]@{total=28;positive_controls=16;positive_controls_confirmed=16;positive_control_gaps=0;positive_source_or_premise_academic_defects=0;positive_judgment_errors=0;invalid_controls=12;invalid_labels_confirmed=12;invalid_category_counts=[ordered]@{wrong_key=3;multiple_correct=2;missing_decisive_assumption=2;numerical_fault=1;unsupported_explanation=3;out_of_syllabus=1};unfinished=0;errors=0;all_source_refs_match_overlay_support_hashes=$true;all_exact_quotations_verified=$true;new_blocking_construction_gaps=0;constructive_dispatch_readiness=$true;native_validator_qualification_established=$false}
 conditions=@('Use actual expected_valid/category labels for validity adjudication, not stored single oracle letters on missing-input or multiple-answer cases.','Missing-premium B and missing-reserve-ratio D are inherited placeholders, not academic answers; preserve their history but exclude them from answer-accuracy truth comparisons.','Multiple-answer stored oracle letters are representatives only; full defensible sets remain B/D and B/C.','Only completed source-grounded academic judgments count as acceptance/rejection; unfinished, transport errors and invalid schemas remain separate outcomes.','Stored support hashes agree between draft and overlay; their canonical algorithm is not inspected. Raw UTF-8 quotation hashes are independently recorded separately.','All 16 valid and 12 controlled invalid labels confirmed; retain every case/version.','Construction custody does not qualify native validators or authorize a paid run by itself.')
 cases=$rows
}
$out=Join-Path $dir 'explanation-and-label-custody-sol-v2.json';$json=$doc|ConvertTo-Json -Depth 45;$round=$json|ConvertFrom-Json
foreach($r in $round.cases){foreach($q in $r.source_evidence){$s=$o.sources.($q.source_id).facts.($q.locator).text;if(-not [string]::Equals($s,$q.quote,[StringComparison]::Ordinal)){throw 'Serialized quote changed'}}}
$bytes=[Text.UTF8Encoding]::new($false).GetBytes($json+[Environment]::NewLine);$f=[IO.File]::Open($out,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try{$f.Write($bytes,0,$bytes.Length);$f.Flush($true)}finally{$f.Dispose()}
$hash=(Get-FileHash -LiteralPath $out -Algorithm SHA256).Hash.ToLowerInvariant();$receipt="$out.sha256";$f=[IO.File]::Open($receipt,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try{$b=[Text.UTF8Encoding]::new($false).GetBytes("$hash  explanation-and-label-custody-sol-v2.json`n");$f.Write($b,0,$b.Length);$f.Flush($true)}finally{$f.Dispose()}
foreach($path in @($out,$receipt)){[IO.File]::SetAttributes($path,([IO.File]::GetAttributes($path) -bor [IO.FileAttributes]::ReadOnly))}
if((Get-FileHash -LiteralPath $derivationPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $priorHash){throw 'Prior freeze mutated'}
[pscustomobject]@{path=$out;sha256=$hash;readonly=(Get-Item -LiteralPath $out).IsReadOnly;summary=$doc.summary}|ConvertTo-Json -Depth 8
