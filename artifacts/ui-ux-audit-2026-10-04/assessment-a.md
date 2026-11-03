# Assessment A — independent design review

Method: isolated Assessment A; no detector, prior critique, or other agent findings read.
Target: src/app/page.js and its landing sections; sampled development dashboard and result at localhost:3010. Read PRODUCT.md, DESIGN.md, brain README and 4 October plan. Synthetic fixture scores are interface examples, not student or academic evidence.

## Specificity verdict

MockMob feels authored: volt keys, night grid, warm heavy type, Mobi and real CUET question screens form a recognizable identity. The specificity lives in the question, recorded answer changes, +5/−1 accounting and dated DU rules. The marketing structure remains conventional, as the owner requested. The missed opportunity is ordering: an eight-feature catalogue and several separate admission demonstrations compete with the narrow Score Recovery story. The product is more distinctive than its current first promise.

## Nielsen scores

Scores are scoped to observed marketing/sample and fixture interface, not production transaction certification. All ten apply because the sample includes study tools and task flows.

| # | Heuristic | Score /4 | Evidence |
|---|---|---:|---|
|1|Visibility of status|3|Sample gives verdict, explanation and Next; app loading skeletons; session summary and repairs show state. Backend status not certified.|
|2|Match real world|2|Plain subject/mode instructions work; Arena/Radar/PrepOS demand a product vocabulary; official key and safe language imply stronger certainty than supported.|
|3|Control and freedom|3|Tour pause, visible navigation, answer filters and disclosures. No destructive paths tested.|
|4|Consistency and standards|3|Night/volt identity carries through app; tab roles lack expected arrow navigation and mobile tour duplicates selectors.|
|5|Error prevention|2|Subject/mode summary is strong; confusing availability/safety copy risks an incorrect purchasing or trust decision.|
|6|Recognition over recall|3|Numbered setup, chapter names, selected subject and score ledger. Eight features plus several overlapping review destinations burden orientation.|
|7|Flexibility and efficiency|3|Fine-tune is optional, four practice modes, direct question review links. First phone setup has a long preamble.|
|8|Aesthetic/minimalism|2|Main typography/action are clear; duplicated demos, equal feature selectors, extra stats and mascot scale compete with the next action.|
|9|Error recovery|3|Wrong sample answer gets plain explanation and clear continuation. Source result loading error offers retry and preserves intent. Network/auth/billing failures not exercised.|
|10|Help/documentation|2|FAQ, Guide and contextual sample/setup instructions; help still often names features rather than the student's task.|
|Total||26/40|65%, Acceptable: focused improvements needed.|

## Strengths

1. The no-signup question is persuasive product proof. At 1440x900, a real English question and four large answers sit beside the promise. Choosing Hidden at 390x844 showed “Not quite,” highlighted Frank, explained candid, and moved focus to Next question. Clear feedback is supportive and efficient.
2. Recovery uses useful evidence: score → wrong/blank ledger → chapter → recorded changed answer → repair. The result fixture explicitly says a regular chapter set is not unseen proof when fresh verified material is missing. This is a strong foundation for honest student trust.
3. Type, volt action keys and companion form a coherent warm technical brand. Dated cutoffs, illustrative labels, affiliation disclaimers and one-time price/expiry disclosure are unusually careful for this category.

## Priority issues

### P1 — The tour overstates learning safety and current availability
Evidence: src/app/page.js:67 says the AI lands on the “official key”; src/components/landing/TourScreens.jsx:105 says “Matches the official key / So it is safe to explain.” This appeared in the desktop repair tour. The homepage and preview also describe original independent practice, so official is ambiguous. Agreement is a guard, not proof of truth. page.js:77 advertises “Need more? Top-up credits never expire,” while the current plan keeps top-up purchases closed. The FAQ says the full Recovery Lab is unavailable while sources/calibration/authenticated checks remain; the tour uses a present-tense Try Mistake Repair action. These may refer to distinct releases, but the student is not told that.
Why: students choosing an answer repair or paying for Pro cannot reliably distinguish an illustrative workflow, a released AI action, and a verified delayed recovery pathway.
Direction: use “stored answer key” and “matched the key; explanation still subject to verification”; gate promotional statements on the precise capability; label the delayed pathway and single-answer repair separately; remove top-up acquisition language until on sale. Suggested commands: clarify, harden.

### P1 — The phone asks for commitment before the first useful action
Evidence: a-home-390.jpg: at 390x844 the headline, four-line lead, two CTAs and price facts consume the viewport; the question begins below y570 and its four answer choices sit below the initial fold, behind the fixed dock area. The bright first CTA is Start free practice; before auth resolution it links to signup, while no-signup trial is secondary. a-dashboard-390.jpg: the first practice inputs sit beneath the welcome, credit panel, companion and four stats; at the initial viewport the user still has not reached Subject, Mode or Start. Fixture development banner adds ~140px and must be excluded from production-height claims, but the source puts all four preamble blocks before Subject.
Why: the budget-phone student arrives seeking one useful move tonight, yet sees product framing before a solvable question or setup choice.
Direction: make no-signup trial the dominant newcomer action, tighten phone intro, show the first answer options earlier, and place subject/default session setup ahead of credit/stat commentary. Retain visible time/cost recap beside a reachable Start action. Suggested commands: adapt, distill, layout.

### P2 — Feature breadth obscures the single recovery story
Evidence: homepage desktop tour has eight equally weighted selectors: Practice, Mistake Repair, Replay, Radar, PrepOS, DU Compass, Combo Planner, Benchmarks. Mobile has swipe cards, eight dot tabs, then the same eight tools as rows; it follows with a separate Mistake Lab, Compass, eligibility and exam-comparator sequence. src/app/page.js:179–264; FeatureTour.jsx.
Why: the user learns several product nouns and repeated demonstrations before understanding the one action that differentiates MockMob. This is orientation work without a clear decision.
Direction: lead with three task groups—Practise, Repair a mistake, Check the repair—with one persistent recommended next move. Keep distinct tools accessible under “More ways to prepare.” Preserve the conventional owner-approved page and CUET identity. Suggested commands: distill, clarify, onboard.

### P2 — Result metric composition undermines the reassurance
Evidence: a-result-1440.jpg shows Mobi crossing into the Right metric tile, covering its label. a-result-390.jpg wraps “33%” as “33” then “%” beside “of answered,” making a basic metric awkward. ResultPageClient.jsx:144–164 and recovery/result.css:12–25, 200–204. The summary announces six wrong answers/41 missed marks, then the Lab repeats “You missed 41 marks”; the useful repair action is later in the mobile reading path.
Why: after a bad score, the student gets repeated loss framing and visually compromised evidence before the achievable next move.
Direction: constrain the mascot to its own cell, keep numeric units together, make accuracy descriptor wrap beneath the value, and pair the score immediately with one neutral chapter action (“Start with Admission of a Partner”). Keep the truthful lost-mark accounting as supporting detail. Suggested commands: layout, typeset, clarify.

### P2 — The feature tour's small controls and tab semantics exclude users
Measured in rendered 390x844 page: all eight dot tabs are 20x44 CSS px; Pause is 38x38. Source feature-tour.css:57–60 matches. This violates PRODUCT.md's 44x44 target contract. Pressing ArrowRight on focused Practice tab left focus and selection on Practice; FeatureTour has no tab keyboard handler, roving tabindex or linked tabpanel. Larger next/previous buttons and tool rows provide workarounds, but tab semantics promise a convention the component does not implement.
Direction: use a three- or four-group selector with 44px targets; retain large labelled controls; implement standard tabs fully or present ordinary buttons instead. Suggested commands: audit, adapt, harden.

## Cognitive load

Checklist failures: minimal choices, one decision at a time, and progressive disclosure. Moderate load (3 failures); grouping and prominent basic actions are generally good. Concrete >4 decision sets:
- Tour: eight equal features, with mobile duplicated dot/list navigation.
- App desktop Study group: six siblings (Today, Practice, Explore, Review, Saved, Progress), plus Planning three and Community three. Groups help but Review versus Radar versus Progress versus PrepOS needs task language.
- Homepage eligibility: six languages and thirteen domain subjects. Four quick-start presets help; disclose uncommon subjects through search or more.
- Result repair queue: six peer wrong-answer buttons plus Repair Q2. The recommendation exists but could dominate more clearly.
Do not treat the four answer choices as overload: they are the actual exam task.

## Personas

Casey: the first four sample answers are below the initial phone viewport; setup metadata precedes the subject; 20px tour dots are difficult one-handed. Bottom dock and large sample answers help. Interruption, slow 4G and hardware performance were not tested.
Jordan: “Try five questions” is immediately understandable, but “Start free practice” initially means signup; eight branded tools require translation. Official-key safety and top-up language produce incorrect expectations. Numbered setup and Find/Repair/Prove are helpful.
Sam: sample polite announcement/focus handoff is implemented and was observed; question buttons have descriptive AX labels. Tour ArrowRight convention failed and dots miss target width. Actual screen reader, 200% zoom, complete keyboard flow and contrast measurement were not certified.

## Emotional journey

Arrival is energetic and welcoming; Mobi and “one mock” lower the intimidation threshold. The first wrong sample answer is a useful peak: it explains instead of shaming. The middle valley is a long tour of overlapping tools. A real low result shifts heavily toward losses before the achievable repair. The ending should make one completed repair and a dated fresh check the memorable outcome; show evidence/sample size, not a recovered-marks claim.

## Competitive direction

Fresh desktop Preparoo observation showed a familiar library of Mocks/PYQs/Sectionals/Topic Tests/Notes/Flashcards and a later grouped Try Features area (three families) plus Ask Preparoo (four tasks). Its content, student-count and price claims were not verified. Phone resize/reload screenshots were occupied by an animated Preparoo brand/loading frame, so do not call that a stable mobile defect or make phone hierarchy claims from that capture. MockMob's stronger design opportunity is the immediate no-signup question and recorded mistake → bounded action → later fresh check. “AI copilot” and “weak chapter analytics” alone are visibly category-common; don't make the hero another feature catalogue.

Minor: future-dated reel “as of 5 October” copy appears during the 4 October audit and should follow the actual record date. Mobile fine print needs zoom/contrast testing before certification. No checkout, signup submission, paid AI, production state change or test runner was used.

Questions for synthesis: Can a student explain the product after one wrong answer rather than eight features? What would the result feel like if the first phrase after the score was “Here is tonight's one useful move”? Which admission content is essential before the first practice action?

## Evidence and limits

Saved fresh screenshots: a-home-390.jpg, a-home-1440.jpg, a-tour-390.jpg, a-dashboard-390.jpg, a-dashboard-1440.jpg, a-result-390.jpg, a-result-lab-390.jpg, a-result-1440.jpg, a-demo-wrong-390.jpg. All MockMob captures verified innerWidth/innerHeight at 390x844 or 1440x900 immediately before capture. a-preparoo-390.jpg records a transient load and is not quality evidence. All under artifacts/ui-ux-audit-2026-10-04. New private audit tab closed and viewport reset. Fixture observations do not prove production behavior or live availability. Scores remain qualitative, not a certified accessibility audit.

