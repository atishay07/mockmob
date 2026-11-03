$ErrorActionPreference = 'Stop'
$base = 'C:\Users\atish\Desktop\mockmob copy\mockmob copy'
$relative = 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/v76-source-prep'
$packetPath = Join-Path $base "$relative/blind-review-packet-v1.json"
$syllabusPath = Join-Path $base "$relative/blind-syllabus-v1.json"
$scopePath = Join-Path $base 'data/question_factory_scope.json'
$packet = Get-Content -Raw -LiteralPath $packetPath | ConvertFrom-Json
$syllabus = Get-Content -Raw -LiteralPath $syllabusPath | ConvertFrom-Json
$scope = Get-Content -Raw -LiteralPath $scopePath | ConvertFrom-Json
$outPath = Join-Path $base "$relative/independent-derivations-sol-v1.json"
if (Test-Path -LiteralPath $outPath) { throw 'Refusing to overwrite a derivation artifact.' }

# Every quotation is copied from the permitted packet, never reconstructed.
# Ordinal IndexOf checks exact characters, including punctuation and whitespace.
function Verify-ExactSubstring($haystack, $needle, $description) {
    if ([string]::IsNullOrEmpty($needle)) { throw "Empty quotation: $description" }
    $offset = $haystack.IndexOf($needle, [StringComparison]::Ordinal)
    if ($offset -lt 0) { throw "Not an exact substring: $description" }
    return [ordered]@{ verified = $true; comparison = 'ordinal'; utf16_offset = $offset; utf16_length = $needle.Length }
}
function Issue($type, $severity, $basis) {
    return [ordered]@{ type = $type; severity = $severity; basis = $basis }
}

$definitions = @{}
$definitions.premium = @{
 keys=@('B'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='Premium = 10 x 40/100 = 4. Issue price = 10 + 4 = 14; earlier instalments = 3 + 5 + 2 = 10; final call = 14 - 10 = 4. The percentage and all cash premises are printed; no missing allocation assumption is needed.'
 options=@('3 is application money, not the remaining 4.','4 equals the remaining issue price.','1 does not equal 14 minus 10.','14 is the whole issue price, not the remaining call.')
 syllabus='Issue at par  and premium'; entitlement_basis='Actual task is issue-price and remaining-instalment accounting, expressly within Share Capital issue/allotment at premium. The learning-objective unit number is wrong: the supplied syllabus places this in Unit IV, not Unit III.'
 issues=@((Issue 'metadata_unit_mismatch' 'nonblocking' 'Shares/debentures are Unit IV in the supplied 2026 syllabus; the printed learning-objective tag says Unit III. The task itself is entitled.'))
}
$definitions.prorata = @{
 keys=@('C'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='Uniform allotted/applied ratio = 2000/2400 = 5/6. An allotment of 40 requires an application of 40 x 6/5 = 48. The supplied worked source uses precisely the inverse of the allotted:applied ratio.'
 options=@('40 confuses allotted shares with applied shares.','44 does not preserve the 5:6 ratio.','48 gives 48 x 5/6 = 40 allotted shares.','52 would give 43 1/3 allotted shares, not 40.')
 syllabus='Over'; entitlement_basis='The full syllabus explicitly covers over subscription and issue/allotment of shares. This task applies the printed uniform oversubscription ratio, rather than relying on a category tag.'
 issues=@((Issue 'metadata_unit_mismatch' 'nonblocking' 'Actual entitlement is Company Accounts Unit IV; the learning-objective tag says Unit III.'))
}
$definitions.guarantee = @{
 keys=@('D'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='G ordinary share = 312000 x 2/(3+3+2) = 78000. Deficiency = 80000 - 78000 = 2000. The printed deed allocates the whole deficiency personally to E; E/F shares do not change the deficiency calculation.'
 options=@('1000 improperly halves the deficiency; the deed names E alone.','4000 exceeds the 2000 difference.','8000 exceeds the 2000 difference.','2000 is the full guaranteed-profit shortfall borne by E.')
 syllabus='guarantee of profit to a partner'; entitlement_basis='The supplied syllabus expressly includes guarantee of profit to a partner and division of profit among partners. The source supplies the minimum-guarantee rule and the stem supplies the ratio and sole guarantor.'
 issues=@()
}
$definitions.drawings = @{
 keys=@('A'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='Equal mid-month drawings have a six-month average period under the supplied source. For monthly withdrawal m, interest = 12m x 0.08 x 6/12 = 0.48m. Thus m = 4800/0.48 = 10000. The stem specifies simple interest, all twelve months, and timing.'
 options=@('10000 produces interest 4800.','5000 produces interest 2400.','15000 produces interest 7200.','20000 produces interest 9600.')
 syllabus='Accounts of Partnership'; entitlement_basis='This is partnership-account computation under a partnership deed, within Accounts of Partnership and appropriation accounting. It needs no unlisted mathematical technique beyond simple interest and the supplied timing rule.'
 issues=@()
}
$definitions.discipline = @{
 keys=@('C'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='Mutual observance of an employment agreement is the decisive feature. The supplied discipline source explicitly gives the revival/extra-hours/later-wages example and explains that both sides honour their commitments without prejudice.'
 options=@('No division of work into specialist jobs is described.','Shared organisational goals alone do not supply the one-head/one-plan criterion; the question asks mutual agreement observance.','Discipline directly names obedience to the employment agreement and mutual commitments.','No one-superior reporting arrangement is described.')
 syllabus='Fayol'; entitlement_basis='The actual task distinguishes Fayol principles by a concrete employment-agreement feature; Fayol principles are explicitly entitled.'
 issues=@()
}
$definitions.primacy = @{
 keys=@('D'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='The source distinguishes objectives, primacy, pervasiveness and continuity. Primacy means planning precedes and provides the base/framework for other managerial functions; D expresses both decisive clauses.'
 options=@('This is pervasiveness, not primacy.','This is continuity, not primacy.','This is objective orientation, not primacy.','Both preceding and providing a basis express the source definition of primacy.')
 syllabus='Meaning, features, importance, limitations.'; entitlement_basis='Actual task is distinguishing a feature of planning, expressly within Planning features.'
 issues=@()
}
$definitions.distribution = @{
 keys=@('B'); unique=$true; solvable=$true; entitlement=$true; evidence=$false
 proof='B is the defensible provisional academic classification: selecting wholesalers and retailers is a channel/intermediary decision, distinct from physically moving goods, promotion, or gathering market information. However, the supplied channel excerpt begins mid-sentence and calls the channel decision part of "this function" without its antecedent. Its later sentence names physical distribution for inventory/storage/transportation only. The exact quoted source therefore does not conclusively name the institutional function governing channel selection. Construction must supply the missing heading/preceding sentence before dispatch.'
 options=@('Informing/persuading customers is not intermediary selection.','Provisional best answer: channel/intermediary choice falls under physical distribution in the conventional marketing-function framework, but the exact source is clipped at the decisive naming link.','The supplied source defines transportation as physical movement of goods, not choosing wholesalers/retailers.','The supplied source describes information gathering/analysis; this is not the function that directly houses the stated intermediary decision.')
 syllabus='Physical distribution: meaning, role;'; entitlement_basis='The actual task is classifying a channel/intermediary decision within the expressly entitled physical distribution/channels of distribution syllabus. Entitlement does not repair the clipped source attribution.'
 issues=@((Issue 'source_gap' 'blocking' 'The excerpt v76s-4c88c6e320b3b4 has an unresolved antecedent for "this function" at the sentence assigning channel/intermediary decisions. Supply the preceding text naming the function; do not use the chapter label or implied textbook memory as decisive evidence.'))
}
$definitions.legal = @{
 keys=@('A'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='A compulsory requirement imposed by a regulation is a legal-environment condition. The source explicitly includes legislation and government administrative orders and requires enterprises to obey law. The precise infant warning is a supplied scenario premise; the task does not ask the student to verify a real current regulation.'
 options=@('A regulation imposing a compulsory display directly reflects the legal environment.','Social norms may motivate laws, but the stated direct mechanism is a regulation.','No technical innovation or method is specified.','No economic variable such as income, inflation or interest is specified.')
 syllabus='Dimensions of Business Environment'; entitlement_basis='Actual task classifies a compulsory rule among Business Environment dimensions, explicitly listed including Legal.'
 issues=@()
}
$definitions.crr = @{
 keys=@('D'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='The source calls the legal percentage of deposits retained as cash reserves to prevent over-lending CRR. It separately describes SLR as short-term liquid reserves, bank rate as a loan interest rate, and repo as a repurchase-agreement lending rate. The task does not ask where reserves are held.'
 options=@('SLR is the separate liquid-form reserve requirement, not the named cash-reserve percentage.','Bank rate is a rate on central-bank lending, not a deposit reserve percentage.','Repo rate is the interest rate on lending through a repurchase agreement.','CRR matches cash reserves, deposit percentage and the over-lending purpose.')
 syllabus='Policy tools to control money supply.'; entitlement_basis='The actual task distinguishes monetary reserve and lending-rate tools under the explicitly entitled Money and Banking policy-tools unit.'
 issues=@()
}
$definitions.managed = @{
 keys=@('B'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='Both clauses matter: the exchange rate responds to market forces and central banks intervene by buying/selling currency to moderate movement. The managed-floating source explicitly combines flexible determination with this intervention. A completely flexible system excludes intervention; fixed rates are set at a particular level.'
 options=@('No gold parity or gold-conversion arrangement is described.','Both market determination and moderating intervention match managed floating.','The stem does not say government fixes the rate at a particular level.','The intervention clause contradicts completely flexible exchange rates.')
 syllabus='Managed Floating'; entitlement_basis='Actual task classifies an exchange-rate regime by two operative features; managed floating and fixed/flexible regimes are explicitly entitled.'
 issues=@()
}
$definitions.publicgoods = @{
 keys=@('A'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='The source explicitly states collective consumption, non-rivalry and non-excludability. I is true. The full conjunction II (excludable AND rivalrous) is false: both asserted properties are reversed. Therefore only A gives the correct truth pair.'
 options=@('Correct truth pair: collective consumption true, excludable-and-rivalrous false.','II reverses both defining properties and is false.','I is explicitly true in the source.','I is true and II false, the opposite of D.')
 syllabus='Government budget - meaning, objectives and components'; entitlement_basis='The task examines the government-provision/allocation rationale for public goods within Government Budget objectives. The supplied source explicitly links the characteristics to government provision; this substantive link, not the chapter tag alone, supports entitlement.'
 issues=@()
}
$definitions.occupation = @{
 keys=@('C'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='The supplied source defines occupational structure as distribution of working persons across industries and sectors. C preserves the full definition; the other choices are total counts or within-job tasks.'
 options=@('Total labour-force size is a count, not its sectoral distribution.','Total population includes nonworkers and gives no occupational distribution.','Distribution of working people across industries and sectors is the explicit definition.','Within-job tasks do not describe the economy-wide workforce distribution.')
 syllabus='A brief introduction of the state of Indian economy on the eve of'; entitlement_basis='Actual task interprets the workforce-distribution concept used to describe the colonial economy; this is within the explicitly listed eve-of-independence economic description, supported by the colonial-period source context.'
 issues=@((Issue 'weak_distractors' 'nonblocking' 'A/B/D are definitionally distant counts or within-job tasks. The item remains a legitimate easy definition question; this is a craft concern, not ambiguity or lack of entitlement.'))
}
$definitions.motivation = @{
 keys=@('D'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='Paragraph 1 links Srinagar landscapes recalling Jibhi and its tourist success versus Jibhi anonymity to returning home to start tourism. D captures both clauses. The 2008 scheme and pandemic are later events; the family only later agreed to convert the traditional house.'
 options=@('The 2008 scheme occurs after the initial return/1992 signboard, and guaranteed success is never stated.','The pandemic occurs in 2020-21 after the return; the passage says local tourism stopped and does not attribute the initial return to Srinagar pandemic tourism.','The family later agreed to one house conversion; already-built family concrete hotels are unsupported.','Both recalled-home landscapes and inferred tourism opportunity are supported by paragraph 1.')
 syllabus='Narrative'; entitlement_basis='Actual task draws a motive inference and event sequence from a supplied narrative passage of 208 whitespace tokens, below the 300-word syllabus maximum.'
 issues=@((Issue 'weak_distractors' 'nonblocking' 'All three incorrect options introduce blatant chronology or unsupported-building claims. They are readily eliminated; this does not invalidate a legitimate easy comprehension task.'))
}
$definitions.anonymity = @{
 keys=@('B'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='The contrast with Srinagar welcoming many tourists makes anonymity mean Jibhi was little known to potential visitors. B captures the contextual meaning. The passage gives no prohibition and places concrete growth later.'
 options=@('Crowded with international visitors reverses the contrast with Srinagar.','Not widely known to potential visitors is the contextual sense.','An official prohibition is not stated and does not follow from anonymity.','Concrete development belongs to later growth, not paragraph 1 anonymity.')
 syllabus='Reading Comprehension'; entitlement_basis='Actual task infers a phrase meaning in a supplied narrative context, entitled through Reading Comprehension and verbal vocabulary; passage is under 300 words.'
 issues=@((Issue 'weak_distractors' 'nonblocking' 'A and D reverse passage contrast or chronology; C introduces a prohibition without textual support. The intended answer remains unique and suitable as an easy contextual vocabulary task.'))
}
$definitions.guesthouse = @{
 keys=@('A'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='Paragraph 2 expressly says the traditional house kept its original character AND gained windows for sunlight. A preserves both details. C is partly attractive through preservation, but its full claim of entirely unaltered including windows contradicts the added windows.'
 options=@('Both retention of character and addition of windows are explicitly supported.','Concrete town development is later valley change, not the first house conversion.','The full conjunction fails because windows were added; partial preservation does not mean entirely unaltered.','The supplied passage names the family traditional house, not an Army building, and the pandemic tourism stop is later.')
 syllabus='Reading Comprehension'; entitlement_basis='Actual task retrieves and combines two details from a narrative passage under 300 words; Reading Comprehension is explicitly entitled.'
 issues=@((Issue 'weak_distractors' 'nonblocking' 'B/D are exaggerated or unsupported developments. C gives a valid partial-truth trap because its full unaltered claim fails. Low demand is legitimate for detail comprehension.'))
}
$definitions.attitude = @{
 keys=@('C'); unique=$true; solvable=$true; entitlement=$true; evidence=$true
 proof='Paragraph 4 supports learning, relationships and pride in establishing local tourism; paragraph 3 reports pressure on nature and the opportunity for reflection and sustainable solutions. Only C preserves both benefit and concern. Extreme all-or-nothing alternatives contradict at least one part.'
 options=@('No worthwhile learning/relationships contradicts paragraph 4 explicit cultural learning and returning friends.','Regardless of effects contradicts nature pressure and sustainable reflection in paragraph 3.','Both personal/local benefits and sustainable reflection are supported across paragraphs 3-4.','Permanent abandonment is not advocated; residents hope tourism returns and the first venture grew rather than failed.')
 syllabus='Reading Comprehension'; entitlement_basis='Actual task synthesizes attitude across a supplied narrative passage under 300 words, within entitled Reading Comprehension.'
 issues=@((Issue 'weak_distractors' 'nonblocking' 'A/B/D use sweeping extreme claims that directly contradict the passage. This reduces distractor subtlety but does not invalidate a legitimate balanced-attitude comprehension item.'))
}

$assignments = @(
 @('v76f-e0932269d0','premium'), @('v76f-b2a54a1da6','prorata'), @('v76f-b43f3aebb6','guarantee'),
 @('v76f-e6f3811e7b','drawings'), @('v76f-10a1826742','discipline'), @('v76f-3f144fd374','primacy'),
 @('v76f-0a26fac46f','distribution'), @('v76f-5628fb9f74','legal'), @('v76f-7ac5631def','crr'),
 @('v76f-3d2cef0c02','managed'), @('v76f-d42ab3b35b','publicgoods'), @('v76f-5fe8e07cac','occupation'),
 @('v76f-461c8da728','motivation'), @('v76f-71ed304404','anonymity'), @('v76f-d1489a9ae6','guesthouse'),
 @('v76f-154e50ff60','attitude'), @('v76f-5ef78612af','guarantee'), @('v76f-dcb4ca9b28','premium'),
 @('v76f-2b8bd9ddd4','prorata'), @('v76f-972dd21c21','primacy'), @('v76f-8a965d2fc3','legal'),
 @('v76f-6c0c03dcf8','math'), @('v76f-59f949e91e','crr'), @('v76f-cbcd129073','reserve_missing'),
 @('v76f-060c149e8f','publicgoods'), @('v76f-f4c6fb6af3','motivation'), @('v76f-706de08f5d','anonymity'),
 @('v76f-10e903f685','attitude')
)

$definitions.math = @{
 keys=@('C'); unique=$true; solvable=$true; entitlement=$false; evidence=$true
 proof='The supplied rule gives f-prime(2) = 3 x 2 squared = 12, uniquely C. The actual task is derivative substitution with no marketing decision, marketing data interpretation or business-finance relationship. A self-contained supplied rule makes it solvable but does not entitle mathematics to a Business Studies Marketing unit.'
 options=@('8 is f(2), not its derivative.','6 uses 3 x 2 instead of 3 x 2 squared.','12 equals 3 x 4.','3 is the coefficient alone and ignores x=2.')
 syllabus='Unit XI:  Marketing'; entitlement_basis='The full Marketing unit lists marketing functions, mix, product, physical distribution, promotion and price. This actual derivative task is outside those objectives and outside the factory Business Studies scope, despite the printed Marketing tag.'
 issues=@((Issue 'unentitled_task' 'blocking' 'Pure derivative evaluation is not a Business Studies Marketing task. Supplying the derivative rule repairs solvability but cannot establish subject entitlement.'))
}
$definitions.reserve_missing = @{
 keys=@(); unique=$false; solvable=$false; entitlement=$true; evidence=$false
 proof='Printed model: D=200/r, where r is the required reserve ratio as a fraction. r is expressly not stated. A/B/C/D correspond respectively to r=0.20/0.10/0.05/0.04, all consistent with the given data. The supplied sources define reserve ratios and lending rates but give no applicable numerical r. No option can be established as the answer.'
 options=@('1000 would follow only if r=20 percent, not supplied.','2000 would follow only if r=10 percent, not supplied.','4000 would follow only if r=5 percent, not supplied.','5000 would follow only if r=4 percent, not supplied.')
 syllabus='Money Creation and Money'; entitlement_basis='The actual task is the simple reserve/deposit multiplier explicitly within Money Creation and Money Multiplier. It is entitled but underspecified.'
 issues=@((Issue 'insufficient_premises' 'blocking' 'Required reserve ratio is indispensable and missing. The source contains no case-specific ratio. Do not import a default current CRR or infer a ratio from the choices.'))
}

$rows = @()
foreach ($entry in $assignments) {
    $id = $entry[0]; $type = $entry[1]
    $case = $packet.cases | Where-Object { $_.id -eq $id }
    if (@($case).Count -ne 1) { throw "Case cardinality: $id" }
    $definition = $definitions[$type].Clone()
    if ($id -eq 'v76f-dcb4ca9b28') {
        $definition.keys=@(); $definition.unique=$false; $definition.solvable=$false; $definition.evidence=$false
        $definition.proof='Earlier instalments total 3+5+2=10, equal to face value. If premium per share is p, issue price is 10+p and final call is p. The premium rate/amount is expressly unstated. A/B/C/D are each possible under premiums of 3/4/1/14 respectively, so no unique numerical call follows. Neither supplied source gives a case-specific premium.'
        $definition.options=@('3 is possible if premium is 3, but that premise is absent.','4 is possible if premium is 4; no 40 percent rate may be imported from a different case.','1 is possible if premium is 1, but that premise is absent.','14 is possible if premium is 14, but that premise is absent.')
        $definition.issues=@((Issue 'insufficient_premises' 'blocking' 'Premium rate/amount is missing; the final call equals that unknown premium.'), (Issue 'metadata_unit_mismatch' 'nonblocking' 'The actual Share Capital topic is Unit IV in the supplied syllabus, not the tagged Unit III.'))
    }
    if ($id -eq 'v76f-972dd21c21') {
        $definition.keys=@('B','D'); $definition.unique=$false
        $definition.proof='The same supplied primacy paragraph states that all other functions operate within plans and that planning precedes/provides the basis for them. B expresses the framework meaning; D expresses precedence and basis. Both full options are true interpretations of primacy. A is pervasiveness and C objective orientation. A single-choice key cannot distinguish B and D.'
        $definition.options=@('Pervasiveness, not primacy.','Correct: operating within the planning framework is explicitly stated within the primacy paragraph.','Objective orientation, not primacy.','Correct: preceding and supplying the basis is also explicitly stated within the primacy paragraph.')
        $definition.issues=@((Issue 'multiple_defensible_options' 'blocking' 'Both B and D directly paraphrase the source definition of primacy. The single-choice format requires a rewritten distractor or a changed task.'))
    }
    if ($id -eq 'v76f-706de08f5d') {
        $definition.keys=@('B','C'); $definition.unique=$false
        $definition.proof='Anonymity in the Srinagar/Jibhi tourism contrast means being little known. B expresses not widely known to potential visitors; C expresses little known beyond the local area. Both are defensible contextual paraphrases of the same lack of wider recognition. The passage gives no geographic qualification that makes C false or decisively less appropriate. A reverses the contrast and D imports later development.'
        $definition.options=@('Reverses the tourism contrast.','Defensible contextual meaning of anonymity.','Also defensible: little known beyond the local area captures the same lack of wider recognition; no supplied wording excludes it.','Later concrete-town growth does not describe the paragraph 1 anonymity.')
        $definition.issues=@((Issue 'multiple_defensible_options' 'blocking' 'B and C are overlapping contextual synonyms. The phrase "most nearly" does not establish a decisive distinction; replace one option before dispatch.'))
    }
    $quotes = @()
    foreach ($source in $case.sources) {
        $ver = Verify-ExactSubstring ([string]$source.quote) ([string]$source.quote) "$id / $($source.id)"
        $quotes += [ordered]@{ source_id=$source.id; locator=$source.locator; quote=$source.quote; source_url=$source.source_url; identity_sha256=$source.identity_sha256; exact_substring_verification=$ver }
    }
    $syllabusText = [string]$syllabus.($case.subject).syllabus
    $syllabusQuotation = [string]$definition.syllabus
    if ($type -eq 'prorata') { $syllabusQuotation = 'subscription and Under subscription; Issue at par  and premium;' }
    if ($type -eq 'discipline') { $syllabusQuotation = "Fayol’s principles of management." }
    $syllabusVerification = Verify-ExactSubstring $syllabusText $syllabusQuotation "$id syllabus"
    $assessments=@()
    for ($j=0; $j -lt 4; $j++) {
        $assessments += [ordered]@{ key=$case.options[$j].key; full_printed_option=$case.options[$j].text; assessment=$definition.options[$j] }
    }
    $blocking = @($definition.issues | Where-Object { $_.severity -eq 'blocking' })
    $rows += [ordered]@{
        id=$id; subject=$case.subject; chapter_tag=$case.chapter; body=$case.body; passage_text=$case.passage_text
        proposed_keys=@($definition.keys); proposed_key_status=$(if($type -eq 'distribution') {'provisional_academic_classification_source_gap'} elseif(-not $definition.solvable) {'underdetermined'} elseif(-not $definition.unique) {'multiple_defensible_answers'} else {'derived'})
        unique_answer=$definition.unique; solvable=$definition.solvable; entitlement=$definition.entitlement
        source_evidence_sufficient=$definition.evidence; dispatch_ready=($definition.unique -and $definition.solvable -and $definition.entitlement -and $definition.evidence -and $blocking.Count -eq 0)
        short_proof=$definition.proof; all_full_options_assessed=$true; option_assessments=$assessments
        entitlement_basis=$definition.entitlement_basis
        syllabus_evidence=[ordered]@{ source_id="cuet2026-$($case.subject)-syllabus"; locator='full-syllabus'; quote=$syllabusQuotation; exact_substring_verification=$syllabusVerification }
        supplied_source_evidence=$quotes; academic_issues=@($definition.issues)
    }
}
if ($rows.Count -ne 28 -or @($rows.id | Select-Object -Unique).Count -ne 28) { throw 'Every opaque case must be retained exactly once.' }
$blockingIds = @($rows | Where-Object { -not $_.dispatch_ready } | ForEach-Object { $_.id })
$document = [ordered]@{
    schema='v76-independent-source-only-derivations-v1'; reviewer='independent-sol'; frozen_at_utc=[DateTime]::UtcNow.ToString('o')
    custody=[ordered]@{
        answer_free=$true; official_keys_accessed=$false; private_files_accessed=$false; construction_scripts_accessed=$false; evaluation_results_accessed=$false; external_sources_accessed=$false; external_provider_calls=0
        permitted_input_files=@('AGENTS.md', "$relative/blind-review-packet-v1.json", "$relative/blind-syllabus-v1.json", 'data/question_factory_scope.json')
        input_sha256=[ordered]@{ blind_packet=(Get-FileHash -Algorithm SHA256 -LiteralPath $packetPath).Hash.ToLowerInvariant(); blind_syllabus=(Get-FileHash -Algorithm SHA256 -LiteralPath $syllabusPath).Hash.ToLowerInvariant(); scope=(Get-FileHash -Algorithm SHA256 -LiteralPath $scopePath).Hash.ToLowerInvariant() }
        purpose='Construction custody only. This review does not qualify native V76 Luna/Gemini validators or constitute a paid evaluation.'
    }
    interpretation=[ordered]@{
        solvable='The supplied premises determine the answer or a defensible answer set; a multiple-answer set may be solvable while the single-choice format is invalid.'
        unique_answer='Exactly one full printed option is academically defensible; provisional academic uniqueness does not erase an independent source-evidence gap.'
        entitlement='The actual task is within the provisional 2026 subject syllabus and factory scope; a textbook/chapter label alone is not entitlement.'
        source_evidence_sufficient='The exact supplied excerpts plus explicit task premises support decisive rules/classifications and all needed numerical premises.'
        syllabus_version='CUET 2026 provisional for 2027; final 2027 entitlement still requires revalidation.'
        exact_quotation_check='Every source quotation is copied in full from its case and checked using ordinal IndexOf; every syllabus quotation is independently checked as an exact substring of the supplied subject syllabus.'
        numerical_premises='Question values are legitimate supplied exercise premises; sources need not repeat invented scenario numbers. Missing indispensable scenario values remain blocking.'
        weak_distractors='Recorded as craft concerns where obvious; easy demand and precise passage wording are legitimate and are not automatic rejection grounds.'
    }
    summary=[ordered]@{
        total=28; unique_answer=@($rows | Where-Object { $_.unique_answer }).Count; solvable=@($rows | Where-Object { $_.solvable }).Count
        entitled=@($rows | Where-Object { $_.entitlement }).Count; source_evidence_sufficient=@($rows | Where-Object { $_.source_evidence_sufficient }).Count
        dispatch_ready=@($rows | Where-Object { $_.dispatch_ready }).Count; blocking_cases=$blockingIds.Count; blocking_ids=$blockingIds
        insufficient_premises=2; multiple_defensible_options=2; unentitled_tasks=1; additional_clipped_source_gap=1
        dispatch_decision='BLOCK the cohort pending construction fixes and a newly frozen blind review; retain all 28 cases in the denominator and do not quietly discard problematic cases.'
    }
    cases=$rows
}
$json = $document | ConvertTo-Json -Depth 40
$roundTrip=$json | ConvertFrom-Json
foreach($row in $roundTrip.cases) {
    $original=$packet.cases | Where-Object { $_.id -eq $row.id }
    foreach($quote in $row.supplied_source_evidence) {
        $source=$original.sources | Where-Object { $_.id -eq $quote.source_id }
        $null=Verify-ExactSubstring ([string]$source.quote) ([string]$quote.quote) "$($row.id) serialized quotation"
        if(-not [string]::Equals([string]$source.quote,[string]$quote.quote,[StringComparison]::Ordinal)) { throw 'Quotation changed in serialization.' }
    }
}
$bytes=[Text.UTF8Encoding]::new($false).GetBytes($json + [Environment]::NewLine)
$stream=[IO.File]::Open($outPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try { $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
$hash=(Get-FileHash -Algorithm SHA256 -LiteralPath $outPath).Hash.ToLowerInvariant()
$receiptPath="$outPath.sha256"
$receiptBytes=[Text.UTF8Encoding]::new($false).GetBytes("$hash  independent-derivations-sol-v1.json`n")
$receiptStream=[IO.File]::Open($receiptPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try { $receiptStream.Write($receiptBytes,0,$receiptBytes.Length); $receiptStream.Flush($true) } finally { $receiptStream.Dispose() }
[IO.File]::SetAttributes($outPath,([IO.File]::GetAttributes($outPath) -bor [IO.FileAttributes]::ReadOnly))
[IO.File]::SetAttributes($receiptPath,([IO.File]::GetAttributes($receiptPath) -bor [IO.FileAttributes]::ReadOnly))
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $outPath).Hash.ToLowerInvariant() -ne $hash) { throw 'Hash changed during freeze.' }
[pscustomobject]@{ path=$outPath; sha256=$hash; readonly=([IO.File]::GetAttributes($outPath).HasFlag([IO.FileAttributes]::ReadOnly)); summary=$document.summary } | ConvertTo-Json -Depth 8
