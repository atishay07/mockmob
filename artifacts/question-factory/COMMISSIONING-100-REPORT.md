# MockMob — 100-question commissioning report

Generated **100/100**; passed **48**; quarantined **52**; published **0**.

Generation and validation cost **$0.769063**, including repairs and rejected candidates. Cost per passing question: **$0.016022**.
This total includes $0.003858 conservatively charged at the full request reservation because an earlier HTTP400 body was not retained; that portion is an upper bound, not reported provider usage.
Total lifetime ledger: $1.419007 settled, $0.000000 reserved, $48.580993 available. Promotional deductions unverified.

Calibration: 16/16 valid items pass; 12/12 controlled bad fixtures quarantine. This is a small external-key benchmark, not universal accuracy.

| Subject | Generated | Pass | Quarantine |
| --- | ---: | ---: | ---: |
| english | 25 | 5 | 20 |
| accountancy | 25 | 15 | 10 |
| business_studies | 25 | 11 | 14 |
| economics | 25 | 17 | 8 |

Unique final fingerprints: 97; anchor families: 29; passage groups: 2; repairs: 51.
Passing drafts span 25 anchor families; fingerprints do not establish distinct skills or complete syllabus coverage.

Inventory kinds: 29 authenticated originals and 71 adaptations. Passing: 19 originals and 29 adaptations.
Draft format groups: vocabulary: 25; matching: 11; sequence: 7; concept/application MCQ: 34; numerical MCQ: 9; statement selection: 4; passage group: 10. Free-form author labels are grouped here and do not count as separate formats.
Difficulty: easy: 64; medium: 36. No difficult draft was produced in this run.

## Rejection reasons

- failed:source_support: 14
- provider_output_incomplete: 18
- duplicate_existing_inventory: 3
- repair_abstained: 10
- invalid_key: 1
- failed:explanation_support: 4
- unknown_route: 1
- passage_sibling_quarantined: 5

## Cost and scaling

Observed-token batch equivalent: $0.382712. Forecast for 10,000 eligible at this acceptance: $79.731667. This is an estimate; it excludes further source work and changes in acceptance.
Assuming all current eligible drafts are subsequently published and this yield persists, remaining funds support approximately 6093 additional eligible questions. Estimated gap to 10,000: $30.767962. Bulk scaling remains paused; no budget increase or validation reduction was made.

| Campaign stage | Requests | Cost | Input tokens | Output tokens, including reasoning |
| --- | ---: | ---: | ---: | ---: |
| authoring | 102 | $0.052610 | 256872 | 53763 |
| blind_solution | 126 | $0.156178 | 445743 | 223095 |
| independent_evaluation | 68 | $0.469774 | 278299 | 69606 |
| repair | 51 | $0.039046 | 79502 | 62144 |
| explanation_support | 67 | $0.047597 | 282835 | 38569 |

## Fixes and next gates

- Strict author schemas now attach authenticated passages locally instead of quoting passage text in schema literals. Explicit pre-inference rejection diagnostics are retained; uncertain usage remains guarded.
- Oversized explanation audits remove repeated format/syllabus context while retaining the actual question, authenticated excerpts and both blind solutions. Authenticated original explanations can be repaired once without changing their official stem/options/key.
- Future adaptations use a strict repair schema and 6000 output-token headroom. The 18 incomplete responses in this measured run retain their failed receipt and repair limit; the future configuration is not counted as a successful live retest.
- Expand supported anchor/topic coverage before scaling, especially English and Business Studies. Preserve family limits and test generation of difficult items and whole passage groups.
- Prove authenticated staging worker/admin/publication operations with the saved migration and dry-run rows before seeking production migration approval. The local preview has disabled controls.

## What is ready

All 48 eligible drafts pass evidence verification and publication row/hash preparation. No database writes were made.

## Remaining gates

- Eligible means all configured automated checks passed, not a guarantee of zero errors.
- Quarantine includes redundancy, incomplete model output and unsupported content; it is not automatically a wrong academic answer.
- Sources span four 2024 paper identities; coverage is too narrow to claim a 10000-question source foundation.
- Staging migration, authenticated admin operations and deployment remain unverified.

## All 100 candidate questions

### 1. english — quarantined

ID: 2e88c27d-da07-4bca-b057-d2149d83c5de; Vocabulary; pyq_adapted; cost $0.002166.

The reviewer’s sycophantic comments about the director raised suspicions. Which option is closest in meaning to “sycophantic”?

A. cowardly
B. domineering
C. flattering
D. insolent

Proposed answer: **C**.
“Sycophantic” means excessively and insincerely flattering someone, often to gain something. Therefore, “flattering” is the closest option.

Outcome: failed:source_support
- “Sycophantic” means excessively and insincerely praising someone, so “flattering” (C) is the closest option; the other choices do not express that meaning.
- The vocabulary/synonym format fits the supplied syllabus and authenticated example. No passage or numerical calculation is required.
- The candidate keeps the anchor’s target word and all four options, changing only the surrounding sentence; this is a cosmetic paraphrase rather than a meaningfully distinct adaptation.

### 2. english — quarantined

ID: 7a930a08-96c3-473f-83fd-e142d008044b; Vocabulary; pyq_adapted; cost $0.001951.

A leader whose qualities command respect and perhaps inspire fear is best described as:

A. flimsy
B. perplexing
C. formidable
D. voluble

Proposed answer: **C**.
“Formidable” describes someone or something that inspires respect or apprehension because of its strength or impressive qualities. The other options mean weak, confusing, and talkative, respectively.

Outcome: provider_output_incomplete

### 3. english — quarantined

ID: f90c84fe-1d6d-4835-937e-baae64268644; Vocabulary; pyq_adapted; cost $0.002503.

Choose the correct ANTONYM for cordial from the options given below.

A. hostile
B. amiable
C. warm
D. affable

Proposed answer: **A**.
Cordial means friendly and warm in manner. Hostile means unfriendly or antagonistic, so it is the opposite. Amiable, warm and affable are similar in meaning to cordial.

Outcome: provider_output_incomplete

### 4. english — quarantined

ID: 025636fa-dabe-4586-9ed1-b7e0730537ae; Vocabulary; pyq_adapted; cost $0.001755.

Choose the correct SYNONYM for redoubtable from the options given below.

A. flimsy
B. perplexing
C. formidable
D. voluble

Proposed answer: **C**.
Redoubtable describes someone or something with strong qualities that inspire respect and perhaps fear. Formidable is the matching synonym.

Outcome: duplicate_existing_inventory

### 5. english — quarantined

ID: 5f2410ea-2dd9-4811-9cf6-6720a21212b7; Vocabulary; pyq_adapted; cost $0.002138.

Choose the correct ANTONYM for sullen from the options given below.

A. morose
B. reticent
C. timid
D. genial

Proposed answer: **D**.
Sullen means being in a bad mood and not speaking. Genial means friendly and cheerful, so it is the antonym. Morose is similar in meaning to sullen; reticent means reserved in speech, and timid means shy.

Outcome: duplicate_existing_inventory

### 6. english — quarantined

ID: 3fab2422-a857-47a7-92ff-bf4ba38f05a0; Vocabulary; pyq_adapted; cost $0.002783.

Read the sentence and identify what it implies about the consultant’s report: The consultant’s <u>sycophantic</u> report praised the director’s every decision in hopes of securing a contract.

A. It was intended to win the director’s favour for personal advantage.
B. It offered an independent assessment of the director’s decisions.
C. It aimed to warn the director about flaws in those decisions.
D. It expressed the consultant’s disagreement with the director.

Proposed answer: **A**.
The sentence links the praise to the hope of securing a contract. A sycophantic report uses insincere praise to gain favour or obtain something, so the consultant’s aim was personal advantage.

Outcome: failed:source_support
- The sentence says the report praised every decision in hopes of obtaining a contract, so A captures the intended flattery for personal gain. B, C, and D contradict the stated praise or motive.
- The dictionary evidence supports the sense of excessive, insincere praise to gain something; the sentence itself supplies that motive. No unstated assumption is needed, and the distractors do not create another defensible answer.
- The item is self-contained and tests vocabulary meaning at a suitable level. However, the anchor also asks for the meaning of “sycophantic”; this version largely restates that same meaning in a sentence, rather than presenting a substantively different reasoning task.

### 7. english — quarantined

ID: 87409e1f-f4f0-4259-bf8c-34a32a28357c; Vocabulary; pyq_adapted; cost $0.001451.

Choose the correct ANTONYM for sullen from the options given below.

A. morose
B. reticent
C. timid
D. genial

Proposed answer: **D**.
Sullen means being in a bad mood and not speaking. Genial means friendly and cheerful, so it is the antonym.

Outcome: duplicate_existing_inventory

### 8. english — quarantined

ID: e94d8ba1-8998-42e5-8c08-7afb8477cde9; Vocabulary; pyq_adapted; cost $0.002666.

Identify the option closest in meaning to the underlined word: Hoping to gain the director’s approval, the applicant adopted an <u>ingratiating</u> manner.

A. A manner intended to win someone’s favour
B. A manner showing open hostility
C. A manner marked by complete indifference
D. A manner expressing firm disagreement

Proposed answer: **A**.
“Ingratiating” describes behaviour intended to make someone like or favour you. The other options describe hostility, indifference, or disagreement.

Outcome: repair_abstained

### 9. english — quarantined

ID: 0b6921d1-c852-4334-a0b0-6b403c2ca7b0; Vocabulary; pyq_adapted; cost $0.002571.

Choose the correct ANTONYM for abundant from the options given below.

A. scarce
B. plentiful
C. ample
D. copious

Proposed answer: **A**.
Abundant means available in large quantities. Scarce means available in limited quantities, so it is the antonym. Plentiful, ample and copious are synonyms of abundant.

Outcome: provider_output_incomplete

### 10. english — quarantined

ID: fdde70a8-503c-44f2-8e6c-cf10fcbc5ba0; Vocabulary; pyq_adapted; cost $0.001530.

Choose the option closest in meaning to the underlined word: The critic’s <u>sycophantic</u> review praised the director lavishly, hoping to secure future work.

A. Impartially evaluative
B. Openly contemptuous
C. Insincerely flattering to gain favour
D. Quietly reserved

Proposed answer: **C**.
A sycophantic person uses excessive, insincere praise to win favour, especially from someone influential. Thus, “insincerely flattering to gain favour” is the closest meaning.

Outcome: repair_abstained

### 11. english — quarantined

ID: 61990482-3f0a-46d8-95c6-72f9ab694703; Vocabulary; pyq_adapted; cost $0.002440.

Leena learns that her debate opponent has won several national titles and is respected—and somewhat feared—even by experienced speakers. She calls the opponent redoubtable and decides to prepare especially carefully. What does redoubtable mean here?

A. Formidable
B. Timid
C. Ordinary
D. Affable

Proposed answer: **A**.
Redoubtable describes someone whose strong qualities inspire respect and perhaps fear. That fits Leena’s accomplished opponent and explains why she prepares carefully.

Outcome: failed:source_support
- “Redoubtable” means having qualities that command respect and may inspire fear; “formidable” is the best match. The context about titles and being respected and somewhat feared reinforces that meaning; the other options do not fit.
- The question tests synonyms, an included CUET English topic, and has one defensible answer. No numerical work or additional assumptions are needed.
- The anchor asks for a synonym of the same word and identifies “formidable” as its answer. Adding a contextual sentence and changing the distractors does not make this a meaningfully distinct adaptation.

### 12. english — quarantined

ID: 7ad7d81d-f87f-4878-bf36-9f062299b305; Vocabulary; pyq_adapted; cost $0.001727.

Choose the correct synonym for “redoubtable” from the options given below.

A. flimsy
B. perplexing
C. formidable
D. voluble

Proposed answer: **C**.
“Redoubtable” describes someone or something with qualities that inspire respect and perhaps fear. “Formidable” is the closest synonym.

Outcome: failed:source_support
- “Redoubtable” describes qualities that command respect and may cause fear, making “formidable” the best synonym; the other options mean flimsy, perplexing, and talkative.
- The question is supported by the cited paper and dictionary excerpt, and synonyms are expressly included in the syllabus. No passage or numerical calculation is needed.
- The candidate reproduces its anchor question and options without a substantive change, so it is not meaningfully distinct.

### 13. english — quarantined

ID: babefe95-4d88-420b-ad7d-8868b8a481cc; Vocabulary; pyq_adapted; cost $0.007370.

An employee praises a manager’s every decision, even when some decisions have obvious flaws, in the hope of earning a promotion. Which word best describes the employee’s behaviour?

A. candid
B. sycophantic
C. indifferent
D. confrontational

Proposed answer: **B**.
The employee gives excessive, insincere praise to someone in a position of power to gain a promotion. This behaviour is sycophantic.

Outcome: failed:source_support
- B, “sycophantic,” describes insincere excessive praise intended to gain something; the promotion motive and praise despite obvious flaws fit. The other choices describe frankness, lack of concern, or antagonism. E2.1 and E3.1 support this meaning.
- The item is an English vocabulary-in-context question, within the syllabus’s choosing-the-correct-word scope and consistent with the paper’s vocabulary format. No calculation, passage, or unstated assumption is needed.
- The candidate reverses the anchor’s vocabulary task: the anchor asks for a synonym of “sycophantic,” while this asks for that word from a paraphrase of its meaning. It tests essentially the same word-meaning relation, so it is not meaningfully distinct.

### 14. english — quarantined

ID: c97ed53a-0113-4d20-9294-551d4237ada2; Vocabulary; pyq_adapted; cost $0.002558.

Choose the word that best completes the sentence: Unlike the sullen guest, who frowned and avoided conversation, the host was _____, greeting everyone warmly and cheerfully.

A. genial
B. morose
C. reticent
D. timid

Proposed answer: **A**.
A genial person is friendly and cheerful, matching the host’s warm greeting and cheerful manner. Morose means gloomy, reticent means reserved or unwilling to speak, and timid means shy or fearful.

Outcome: provider_output_incomplete

### 15. english — quarantined

ID: 6674c605-56ae-4a0f-8b7d-7a7890bfeafc; Vocabulary; pyq_adapted; cost $0.002013.

Which word best describes praise that is excessive and insincere, especially when offered to gain someone’s favour?

A. Sycophantic
B. Domineering
C. Insolent
D. Cowardly

Proposed answer: **A**.
Sycophantic describes excessive, insincere praise intended to please or gain favour. The other options mean controlling, disrespectful, and lacking courage, respectively.

Outcome: provider_output_incomplete

### 16. english — quarantined

ID: 89f5a1e6-9413-44cc-bf0a-6bd4332a2032; Vocabulary; pyq_adapted; cost $0.001349.

Choose the correct ANTONYM for genial from the options given below.

A. cheerful
B. affable
C. cordial
D. morose

Proposed answer: **D**.
Genial means friendly and cheerful. Morose means gloomy or ill-tempered, so it is the antonym.

Outcome: repair_abstained

### 17. english — quarantined

ID: 91600761-60f6-42dc-b783-536f330a8e6f; Vocabulary; pyq_adapted; cost $0.002251.

Which sentence uses **redoubtable** in a way consistent with its meaning?

A. The redoubtable debater earned the other teams’ respect with her command of the subject.
B. The redoubtable paper cup crumpled at the slightest touch.
C. The redoubtable directions were so unclear that nobody could follow them.
D. The redoubtable guest spoke nonstop throughout dinner.

Proposed answer: **A**.
Redoubtable describes someone with strong qualities that command respect and may inspire fear. The debater’s skill and the respect it earns fit this meaning.

Outcome: failed:source_support
- Redoubtable means formidable, describing someone with qualities that command respect and perhaps fear; the debater’s command of the subject earns respect, so A fits.
- B describes something flimsy, C something perplexing, and D someone voluble; none matches redoubtable.
- The supplied dictionary excerpt and anchor synonym item support the meaning. The syllabus includes synonyms and choosing the correct word, so the item fits CUET English.
- No numerical work or unstated assumptions are needed; the options leave one defensible answer. There is no passage to assess, and the vocabulary item is answerable without one.
- The adaptation uses the anchor’s same four semantic choices—formidable, flimsy, perplexing and voluble—recast as sentences, so it tests essentially the same lexical distinction rather than a substantively different one.

### 18. english — quarantined

ID: 78b1fc6e-76cc-4120-9e6a-908d39dab0b2; Vocabulary; pyq_adapted; cost $0.002026.

Choose the correct ANTONYM for reluctant from the options given below.

A. willing
B. hesitant
C. unwilling
D. uncertain

Proposed answer: **A**.
Reluctant means unwilling or hesitant to do something. Willing expresses readiness to do it, so it is the antonym. Hesitant is close in meaning to reluctant, not its opposite.

Outcome: repair_abstained

### 19. english — quarantined

ID: 89801343-3fe5-43e6-99fb-3c947d02e868; Vocabulary; pyq_adapted; cost $0.003429.

Identify the option closest in meaning to the underlined word: The assistant’s <u>flattering</u> remarks toward the director seemed intended to win favour.

A. sycophantic
B. courteous
C. abrasive
D. indifferent

Proposed answer: **A**.
“Flattering” can describe saying nice things to please someone, sometimes insincerely or to gain something. “Sycophantic” is the closest option because it refers to excessive, insincere praise, especially of someone powerful. “Courteous” means polite but does not imply such praise.

Outcome: failed:source_support
- A is correct: flattering remarks made to win favour match sycophantic; courteous, abrasive and indifferent do not fit that meaning.
- The definitions support the intended distinction: sycophantic praise is insincere and aimed at gaining something, while flattering can describe praise given for that purpose.
- The item fits the syllabus topic of synonyms and the authenticated multiple-choice format. No numerical work or separate passage is involved.
- This repeats the anchor’s same synonym pair in reverse: the anchor asks for a synonym of sycophantic and offers flattering; this item asks for a synonym of flattering and offers sycophantic. The changed sentence does not make it meaningfully distinct.

### 20. english — quarantined

ID: 5f459b81-9954-4fc8-abd9-48b8f6163e75; Vocabulary; pyq_adapted; cost $0.002897.

Choose the correct SYNONYM for daunting in the sentence below: “The sheer height of the cliff was daunting to the novice climber, who hesitated before beginning the ascent.”

A. perplexing
B. intimidating
C. flimsy
D. talkative

Proposed answer: **B**.
Daunting describes something that feels intimidating or difficult to face. Here, the cliff’s height makes the climber hesitate. Perplexing means confusing, which does not fit the context.

Outcome: provider_output_incomplete

### 21. accountancy — quarantined

ID: 78260b39-49c8-4395-bc8f-bbba07494efd; Financial Statements of Company; authentic_pyq; cost $0.002833.

Match List-I with List-II. List-I List-II (A) Share capital (I) Will be called at the time of winding up (B) Reserves and surplus (II) Calls in advance (C) Reserve capital (III) Subscribed but not fully paid (D) Current liabilities (IV) Sinking fund Choose the correct answer from the options given below :

A. (A) - (I), (B) - (II), (C) - (III), (D) - (IV)
B. (A) - (I), (B) - (III), (C) - (II), (D) - (IV)
C. (A) - (I), (B) - (II), (C) - (IV), (D) - (III)
D. (A) - (III), (B) - (IV), (C) - (I), (D) - (II)

Proposed answer: **D**.
Share capital includes subscribed but not fully paid shares (III). A sinking fund is included under reserves and surplus (IV). Reserve capital is called up only at the time of winding up (I), while calls in advance are a current liability (II). Therefore, the correct matching is (A)–(III), (B)–(IV), (C)–(I), (D)–(II), which is option D.

Outcome: provider_output_incomplete

### 22. accountancy — quarantined

ID: 57499780-6a42-4322-bcf1-060658004e5a; Profit & Loss Appropriation Account; authentic_pyq; cost $0.002832.

Match List-I with List-II. List-I List-II (A) Salary to partner (I) Credit side of Partner's Capital Account (B) Interest on partner's loan (II) Debit side of Partner's Current Accont (C) Interest on partner's drawings (III) Debit side of Profit and Loss Account (D) Additional capital introduced (IV) Credit side of Partner's Current Account Choose the correct answer from the options given below :

A. (A) - (I), (B) - (II), (C) - (III), (D) - (IV)
B. (A) - (I), (B) - (III), (C) - (II), (D) - (IV)
C. (A) - (IV), (B) - (III), (C) - (II), (D) - (I)
D. (A) - (III), (B) - (IV), (C) - (I), (D) - (II)

Proposed answer: **C**.
The correct matching is (A)–(IV), (B)–(III), (C)–(II), and (D)–(I). Under the fixed capital method, a partner’s salary is credited to the Partner’s Current Account, while interest on a partner’s loan is an expense charged to the Profit and Loss Account. Interest on drawings is debited to the Partner’s Current Account, and additional capital introduced is credited to the Partner’s Capital Account. Therefore, the correct answer is option C.

Outcome: provider_output_incomplete

### 23. accountancy — quarantined

ID: 64b09a99-5b94-40ec-8ab6-b28fac8d01b1; Financial Statements of Company; pyq_adapted; cost $0.002775.

Match List-I with List-II.

| List-I | List-II |
|---|---|
| (A) Share amount subscribed but not fully paid | (I) Current liabilities |
| (B) Sinking fund | (II) Reserve capital |
| (C) Uncalled capital callable only at the time of winding up | (III) Share capital |
| (D) Amount received from shareholders before it is called | (IV) Reserves and surplus |

Choose the correct matching from the options below:

A. (A)–(III), (B)–(IV), (C)–(II), (D)–(I)
B. (A)–(III), (B)–(II), (C)–(IV), (D)–(I)
C. (A)–(IV), (B)–(III), (C)–(II), (D)–(I)
D. (A)–(II), (B)–(IV), (C)–(I), (D)–(III)

Proposed answer: **A**.
Subscribed share amount not fully paid is classified under share capital. A sinking fund is included in reserves and surplus. Reserve capital is uncalled capital that may be called only on winding up. Money received before it is called is calls in advance, shown as a current liability.

Outcome: provider_output_incomplete

### 24. accountancy — quarantined

ID: 38a5784a-9ceb-44a0-a120-a1e0cb01d2d6; Partnership Fundamentals; pyq_adapted; cost $0.003353.

Identify the correct sequence to be followed while preparing the final accounts of a partnership firm:

(A) Profit and Loss Appropriation Account
(B) Profit and Loss Account
(C) Trading Account
(D) Balance Sheet

Choose the correct answer.

A. (C), (B), (A), (D)
B. (A), (C), (B), (D)
C. (B), (A), (D), (C)
D. (C), (B), (D), (A)

Proposed answer: **1**.
The sequence is Trading Account, Profit and Loss Account, Profit and Loss Appropriation Account, and then Balance Sheet. This corresponds to (C), (B), (A), (D), option 1.

Outcome: invalid_key

### 25. accountancy — quarantined

ID: 57c309f9-1106-4c55-aaaa-641192880d86; Profit & Loss Appropriation Account; pyq_adapted; cost $0.003497.

Match List-I with List-II, assuming the partnership deed provides for the stated items:

| List-I | List-II |
|---|---|
| (A) Partner’s salary under the fixed capital method | (I) Debit side of Profit and Loss Account |
| (B) Partner’s salary under the fluctuating capital method | (II) Credit side of Partner’s Current Account |
| (C) Interest payable on a partner’s loan | (III) Debit side of Partner’s Current Account |
| (D) Drawings by a partner under the fixed capital method | (IV) Credit side of Partner’s Capital Account |

Choose the correct answer from the options given below:

A. (A) – (II), (B) – (IV), (C) – (I), (D) – (III)
B. (A) – (II), (B) – (III), (C) – (I), (D) – (IV)
C. (A) – (IV), (B) – (II), (C) – (III), (D) – (I)
D. (A) – (III), (B) – (IV), (C) – (II), (D) – (I)

Proposed answer: **A**.
With fixed capitals, a partner’s salary is credited to the Partner’s Current Account, while drawings are debited to that account. Under the fluctuating capital method, salary is credited to the Partner’s Capital Account. Interest payable on a partner’s loan is a charge against profit, so it is debited to the Profit and Loss Account. Thus, A–II, B–IV, C–I and D–III.

Outcome: provider_output_incomplete

### 26. accountancy — quarantined

ID: d919c102-5bf1-4cde-9085-36e4a45560c9; Financial Statements of Company; pyq_adapted; cost $0.003379.

A company has an uncalled portion of its subscribed share capital. By a resolution of its members, the company decides that this amount may be called only if the company is wound up. What is this amount called?

A. Reserve capital
B. Calls in advance
C. Capital reserve
D. Sinking fund

Proposed answer: **A**.
Reserve capital is the portion of uncalled share capital that a company resolves may be called only when it is wound up. Calls in advance are amounts paid by shareholders before they are called, while a capital reserve and a sinking fund are not uncalled share capital.

Outcome: provider_output_incomplete

### 27. accountancy — quarantined

ID: ec9ef7e4-0391-49da-8ab4-7fee2e82c30e; Partnership Fundamentals; pyq_adapted; cost $0.010935.

After a partnership firm has determined its net profit for the year, it must account for the distribution of that profit among its partners. Which account is prepared for this purpose?

Choose the correct answer from the options given below:

A. (A) Trading Account
B. (B) Profit and Loss Account
C. (C) Profit and Loss Appropriation Account
D. (D) Balance Sheet

Proposed answer: **C**.
The Profit and Loss Appropriation Account is prepared to show the distribution of profit or loss among the partners. The Trading Account determines gross profit or loss, the Profit and Loss Account determines net profit or loss, and the Balance Sheet reports the firm’s financial position.

Outcome: failed:explanation_support
- The answer and the claim that the Profit and Loss Appropriation Account relates to distributing partnership profit or loss are supported. However, the explanation also asserts what the Trading Account, Profit and Loss Account, and Balance Sheet each determine or report; the supplied source excerpts do not substantiate those claims. The anchor’s sequence alone does not establish those account functions.

### 28. accountancy — quarantined

ID: a82196c9-5410-43c3-a6e8-a48ac1471284; Profit & Loss Appropriation Account; pyq_adapted; cost $0.004186.

Mira and Dev maintain their partners’ accounts under the fixed capital method. Their agreement provides for a salary to Mira and interest on drawings, and Dev has also lent money to the firm. Which treatment is correct when recording these items?

A. Credit Mira’s salary to her Partner’s Current Account.
B. Debit interest on Dev’s loan to the firm to the Profit and Loss Account.
C. Credit interest on drawings to the relevant partner’s Current Account.
D. Credit additional capital introduced by a partner to that partner’s Current Account.

Proposed answer: **B**.
Interest on a partner’s loan to the firm is treated as a charge against profits and is debited to the Profit and Loss Account. Under the fixed capital method, a partner’s salary is credited to their Current Account, interest on drawings is debited to their Current Account, and additional capital is credited to their Capital Account.

Outcome: provider_output_incomplete

### 29. accountancy — quarantined

ID: ebe927a1-7eff-47c3-b437-c31721864852; Partnership Fundamentals; pyq_adapted; cost $0.011154.

Identify the correct sequence to be followed while preparing the final accounts of a partnership firm: (A) Profit and Loss Appropriation Account (B) Profit and Loss Account (C) Trading Account (D) Balance Sheet. Choose the correct answer from the options given below:

A. (C), (B), (A), (D)
B. (A), (C), (B), (D)
C. (B), (A), (D), (C)
D. (C), (B), (D), (A)

Proposed answer: **A**.
The sequence is Trading Account, Profit and Loss Account, Profit and Loss Appropriation Account, and Balance Sheet: (C), (B), (A), (D). Therefore, the correct answer is option A.

Outcome: failed:source_support
- The standard sequence is Trading Account → Profit and Loss Account → Profit and Loss Appropriation Account → Balance Sheet, so option A is correct. The other choices either put an account before the statement whose result it uses or place the Balance Sheet before the accounts are completed.
- E3.4 identifies preparation of partnership final accounts as a learning objective, but the supplied textbook excerpts do not substantiate the ordering; E1.1 reproduces the question, not its solution.
- The question and all four options are effectively identical to the cited 2024 anchor, so this is not meaningfully distinct as a pyq_adapted item.

### 30. business_studies — quarantined

ID: 61e0ab81-7b26-4575-be9f-b3fa68096725; Business Environment; authentic_pyq; cost $0.001550.

Which of the following is an example of economic environment ?

A. Money supply in economy
B. Constitution of the country
C. Life expectancy
D. Population shifts

Proposed answer: **A**.
Money supply is part of the economic environment because it concerns the economy’s financial conditions. The constitution relates to the political or legal environment, while life expectancy and population shifts are elements of the social environment. Therefore, the correct answer is A.

Outcome: failed:source_support
- Money supply is an economic-environment factor. Life expectancy and population shifts are identified as social-environment factors; the cited excerpt also places legislation in the legal environment, so none of the other options is economic. The supplied excerpts do not directly establish the money-supply classification, so source support for the decisive answer is incomplete.
- The question matches the authenticated 2024 item exactly, fits the included Business Environment dimensions, and needs no passage or numerical assumptions. It is not meaningfully distinct from its anchor.

### 31. business_studies — quarantined

ID: 268482e8-8b04-4ebf-95b3-4b75a350dcbb; Business Environment; authentic_pyq; cost $0.002672.

Which of the following does not characterise business environment ?

A. Inter-related
B. External forces
C. Market orientation and product
D. Relativity

Proposed answer: **C**.
Business environment is characterised by inter-relatedness, external forces, and relativity. “Market orientation and product” does not describe a characteristic of the business environment; it relates instead to how a business responds to market conditions. Therefore, option C is correct.

Outcome: provider_output_incomplete

### 32. business_studies — quarantined

ID: cd8bb369-59f0-494c-8a8a-9e5663909208; Business Environment; pyq_adapted; cost $0.019258.

A company finds that rising inflation has reduced the purchasing power of its customers. This change is an example of which dimension of the business environment?

A. Economic environment
B. Legal environment
C. Social environment
D. Technological environment

Proposed answer: **A**.
Inflation and its effect on purchasing power are economic conditions, so this change belongs to the economic environment. Laws and regulations are part of the legal environment, while social and technological dimensions concern social patterns and advances in technology, respectively.

Outcome: provider_output_incomplete

### 33. business_studies — quarantined

ID: 2dfcab5d-2bf3-4cfc-a826-7065ff9d522a; Business Environment; pyq_adapted; cost $0.003563.

A government introduces stricter emissions standards for vehicles. Car manufacturers invest in cleaner technology, their suppliers change the components they provide, and buyers begin to prefer low-emission models. Which characteristic of the business environment is most directly illustrated?

A. Inter-relatedness
B. Dynamic nature
C. Uncertainty
D. Totality of external forces

Proposed answer: **A**.
Inter-relatedness is shown because a change in the regulatory environment leads to connected effects on manufacturers, suppliers and buyers. Dynamic nature refers to the environment changing over time; here, the key point is how the change in one area affects several others.

Outcome: provider_output_incomplete

### 34. business_studies — quarantined

ID: 0729da52-e53d-4a25-bdff-8e997632e24c; Business Environment; pyq_adapted; cost $0.007990.

A firm in the home-appliance industry regularly revises its products as technology advances, consumer preferences shift and new competitors enter the market. Which characteristic of the business environment is illustrated?

A. Inter-relatedness
B. Totality of external forces
C. Dynamic nature
D. Complexity

Proposed answer: **C**.
The business environment is dynamic because it keeps changing—for example, through technological advances, shifts in consumer preferences and the entry of competitors. The scenario focuses on these ongoing changes.

Outcome: repair_abstained

### 35. business_studies — quarantined

ID: a10d5e03-485f-442c-9670-10c92f2dcb59; Business Environment; pyq_adapted; cost $0.002619.

Before revising its borrowing plan, a firm reviews changes in the external environment. It finds that the total money supply in the economy has changed. Which dimension of the business environment should the firm consider this change under?

A. Economic environment
B. Legal environment
C. Social environment
D. Political environment

Proposed answer: **A**.
Money supply is an economic factor. Therefore, the firm should consider its change under the economic dimension of the business environment.

Outcome: provider_output_incomplete

### 36. business_studies — quarantined

ID: 3566edf6-85a9-48dd-88d3-2373bf4b8273; Business Environment; pyq_adapted; cost $0.016874.

Which of the following is an example of the economic environment?

A. Money supply in the economy
B. Constitution of the country
C. Life expectancy
D. Population shifts

Proposed answer: **A**.
The authenticated CUET question identifies money supply in the economy as an example of the economic environment.

Outcome: failed:source_support
- Money supply is an economic-environment factor; life expectancy and population shifts are listed as social-environment elements, while the constitution relates to the political/legal environment. Thus A is the single defensible answer.
- The item closely reproduces the cited CUET 2024 question and options, with only cosmetic wording changes, so it is not meaningfully distinct from its anchor.
- This direct concept-identification item fits the supplied syllabus and exam format. It requires no calculation; there is no passage or boundary case that affects answerability.

### 37. business_studies — quarantined

ID: 41a568b6-416a-478c-9e0b-cda99042008b; Business Environment; pyq_adapted; cost $0.009098.

A business continues running an advertisement after a government regulation prohibits it. According to the business environment framework, what is the most direct consequence of failing to comply?

A. The enterprise may face legal problems
B. Consumer preferences will necessarily change
C. The political system will become unstable
D. Public debt will increase

Proposed answer: **A**.
Government regulations are part of the legal environment. The NCERT text notes that non-compliance with laws can land a business enterprise in legal problems and that advertisers must follow applicable regulations.

Outcome: unknown_route

### 38. economics — quarantined

ID: d34a7229-91ed-4e3a-87e1-6e86688c43aa; Government Budget & the Economy; authentic_pyq; cost $0.002555.

Article 112 deals with :

A. Consolidated Fund of India
B. Public Account
C. Union Budget
D. Contingency Fund

Proposed answer: **C**.
Article 112 of the Constitution requires the President to lay before both Houses of Parliament an annual financial statement showing the Government of India’s estimated receipts and expenditure for the year. This statement is known as the Union Budget, so option C is correct.

Outcome: failed:source_support
- The expected choice is C: Article 112 concerns the Union government's Annual Financial Statement, commonly referred to as the Union Budget; the other choices name separate funds. But the supplied excerpts authenticate the question and discuss the budget generally without stating the Article 112 link, so the answer is not adequately supported by the permitted sources and I abstain.
- The item matches its anchor question exactly, so it is not meaningfully distinct. It is a direct-recall question on government budgeting and fits the supplied syllabus and exam format.

### 39. economics — quarantined

ID: 35e6b70f-b83d-48eb-8f98-70efb0825973; Balance of Payments; authentic_pyq; cost $0.002258.

European Monetary Union was created in __________.

A. 1996
B. 1994
C. 1999
D. 2002

Proposed answer: **C**.
The European Monetary Union began in 1999, when the euro was introduced as the common currency for participating countries in non-cash transactions. Euro banknotes and coins entered circulation later, in 2002. Therefore, the correct answer is C (1999).

Outcome: failed:source_support
- The conventional answer is C (1999), the year EMU's third stage began; however, none of the supplied source excerpts verifies that date, so I abstain under the source-support requirement. E1.1 confirms the authentic item and its options, not its answer; E2.4 addresses balance-of-payments content without establishing the date.
- The supplied syllabus lists balance-of-payments topics and exchange rates but does not specify the date of EMU's creation, so this historical recall item is not clearly within the stated scope.
- The candidate reproduces its anchor item exactly, so it is not meaningfully distinct. No passage is supplied; passage integrity and answerability raise no issue.

### 40. economics — quarantined

ID: 178eb8d8-f14a-478f-a5ac-43cea6a74c65; Money & Banking; authentic_pyq; cost $0.002848.

Nominal Interest Rate =___________

A. Real Interest Rate  Inflation Rate
B. Real Interest Rate – Inflation rate
C. Real Interest Rate / Inflation rate
D. Real Interest Rate + Inflation rate

Proposed answer: **D**.
The nominal interest rate is approximately equal to the real interest rate plus the inflation rate. This reflects the compensation lenders receive both for the real return on lending and for the loss of purchasing power caused by inflation. Therefore, option D is correct.

Outcome: provider_output_incomplete

### 41. economics — quarantined

ID: 2e45a66e-4385-4da0-9d3d-691350ea05fe; Money & Banking; authentic_pyq; cost $0.002747.

Match List-I with List-II : List-I List-II (A) Bank Rate (I) Securities are pledged in order to repurchase (B) Marginal Standing Facility (II) Minimum rate at which funds are provided for long term (C) Repo Rate (III) Also known as Penal Interest Rate (D) Reverse Repo Rate (IV) Central Bank borrows funds from commerical banks Choose the correct answer from the options given below :

A. (A) - (I), (B) - (II), (C) - (III), (D) - (IV)
B. (A) - (II), (B) - (III), (C) - (I), (D) - (IV)
C. (A) - (I), (B) - (II), (C) - (IV), (D) - (III)
D. (A) - (III), (B) - (IV), (C) - (I), (D) - (II)

Proposed answer: **B**.
The correct matching is (A)–(II), (B)–(III), (C)–(I), and (D)–(IV). Bank Rate corresponds to the minimum rate at which funds are provided for the long term. The Marginal Standing Facility rate is also known as the penal interest rate. Under a repo, securities are pledged in an agreement to repurchase them. Under a reverse repo, the central bank borrows funds from commercial banks. Therefore, option B is correct.

Outcome: failed:source_support
- The standard matching appears to be B: Bank Rate–II, MSF–III, Repo Rate–I, and Reverse Repo Rate–IV. The supplied excerpts support the repo/reverse-repo distinction and describe Bank Rate as the rate for loans to commercial banks, but they do not establish that MSF is the penal interest rate or substantiate the long-term wording in II. Under the source-only constraint, abstain rather than rely on outside knowledge.
- The candidate is identical to its authenticated anchor, so it is not meaningfully distinct.
- It is an in-syllabus, standalone CUET-style matching question; there are no numerical calculations or passage to assess.

### 42. economics — quarantined

ID: 2733bbb4-1e81-441c-b27d-a5c34eda0191; Government Budget & the Economy; pyq_adapted; cost $0.003278.

The Constitution of India provides for the presentation of the Union Government’s annual financial statement under which Article?

A. Article 110
B. Article 112
C. Article 266
D. Article 267

Proposed answer: **B**.
Article 112 provides for the annual financial statement of the Union Government, commonly referred to as the Union Budget.

Outcome: repair_abstained

### 43. economics — quarantined

ID: 258da4fd-a691-4379-8d10-9cf32de2ee6f; Income Determination; pyq_adapted; cost $0.003331.

In an income-determination model, let G denote government expenditure, T taxes, M imports and X exports. If G = T = M = X = 0, which description follows?

A. No government fiscal flows and no foreign-trade flows are recorded in the model.
B. Government fiscal flows are absent, but imports are positive and exports are zero.
C. Foreign-trade flows are absent, but government expenditure is positive and taxes are zero.
D. Imports and exports are both positive, while government fiscal flows are absent.

Proposed answer: **A**.
Since G and T are both zero, the model records no government expenditure or tax flows. Since M and X are both zero, it records no imports or exports. Thus both government fiscal flows and foreign-trade flows are absent from the model.

Outcome: provider_output_incomplete

### 44. economics — quarantined

ID: b89899d4-d06e-44eb-9fa6-2f2f1593fa6c; Balance of Payments; pyq_adapted; cost $0.003685.

Which of the following was created in 1999?

A. European Monetary System
B. European Monetary Union
C. European Union
D. European Economic Community

Proposed answer: **B**.
The European Monetary Union was created in 1999. The other options refer to different European institutions or arrangements.

Outcome: repair_abstained

### 45. business_studies — quarantined

ID: afd1197b-512a-451b-9fdf-b87f3e1daa26; Business Environment; pyq_adapted; cost $0.002780.

A business analyst observes that changes in the money supply and bank lending rates are affecting customers’ purchasing power and firms’ borrowing costs. Which dimension of the business environment should the firm monitor most directly?

A. Economic environment
B. Social environment
C. Political environment
D. Legal environment

Proposed answer: **A**.
Money supply and lending rates are economic conditions. Their effects on purchasing power and borrowing costs therefore point to the economic dimension of the business environment.

Outcome: repair_abstained

### 46. accountancy — quarantined

ID: 2684b957-ad1a-4b27-9f48-90251a8e1110; Partnership Fundamentals; authentic_pyq; cost $0.008649.

Identify the correct sequence to be followed while preparing of final account of a partnership firm : (A) Profit and Loss Appropriation Account (B) Profit and Loss Account (C) Trading Account (D) Balance Sheet Choose the correct answer from the options given below :

A. (C), (B), (A), (D)
B. (A), (C), (B), (D)
C. (B), (A), (D), (C)
D. (C), (B), (D), (A)

Proposed answer: **A**.
The correct sequence is (C), (B), (A), (D). First, the Trading Account determines gross profit or loss. This is transferred to the Profit and Loss Account to determine net profit or loss. The net result is then taken to the Profit and Loss Appropriation Account, where it is distributed among partners and other partnership adjustments are recorded. Finally, the Balance Sheet is prepared to show the firm’s assets and liabilities, including the partners’ adjusted capital balances.

Outcome: failed:explanation_support; repair_abstained
- The answer matches option A in the original question, and the authenticated key identifies A. However, the cited excerpts do not support the explanation’s claims about what each account determines, how profits are transferred or distributed, or what the Balance Sheet includes. The key establishes the original answer, not those steps or claims.

### 47. economics — quarantined

ID: c6c631a2-63d4-4633-b685-e1edfc3c2dc3; Balance of Payments; authentic_pyq; cost $0.011670.

Arrange the following elements in correct chronological sequence (earliest to latest) : (A) Smithsonian Agreement (B) Bretton Woods Conference (C) Establishment of WTO (D) Gold Standard Choose the correct answer from the options given below :

A. (A), (B), (C), (D)
B. (D), (B), (A), (C)
C. (D), (A), (B), (C)
D. (C), (B), (D), (A)

Proposed answer: **B**.
The Gold Standard came first, followed by the Bretton Woods Conference in 1944. The Smithsonian Agreement was reached in 1971, and the WTO was established in 1995. Thus the chronological order is (D), (B), (A), (C), which is option B.

Outcome: failed:explanation_support; repair_abstained
- The stated chronological order and option B are consistent with the authenticated original and its key, but the supplied source excerpts do not substantiate the explanation’s specific dates for Bretton Woods, the Smithsonian Agreement, or the WTO.

### 48. english — eligible

ID: 24281d99-3989-401c-8119-f06de936e756; Vocabulary; authentic_pyq; cost $0.004702.

Choose the correct ANTONYM for sullen from the options given below.

A. morose
B. reticent
C. timid
D. genial

Proposed answer: **D**.
Oxford describes sullen as being in a bad mood and not speaking, while genial means friendly and cheerful. Those meanings contrast, supporting option 4 as the antonym.

Outcome: all required checks passed

### 49. english — eligible

ID: 720ab503-fa80-4e36-8838-de942a3487f7; Vocabulary; authentic_pyq; cost $0.004959.

Identify the option closest in meaning to the underlined word : The movie star’s biography is a glossy, sycophantic portrayal.

A. cowardly
B. domineering
C. flattering
D. insolent

Proposed answer: **C**.
Oxford defines sycophantic praise as excessive and insincere, and defines flatter as saying nice things often insincerely to please or influence someone. These overlap in the sense used by the sentence and support option 3, “flattering”.

Outcome: all required checks passed

### 50. english — eligible

ID: afe7332b-0e12-467f-990a-74053d984bde; Vocabulary; pyq_adapted; cost $0.006999.

At a community event, Leena greeted newcomers with a warm smile, chatted cheerfully, and made them feel welcome. Which word best describes her manner?

A. morose
B. reticent
C. timid
D. genial

Proposed answer: **D**.
Genial means friendly and cheerful, which matches Leena’s warm, welcoming manner. Morose means gloomy, reticent means reserved, and timid means shy or lacking confidence.

Outcome: all required checks passed

### 51. accountancy — eligible

ID: fab8e8b9-af16-4d92-8b96-0363050eea8b; Share Capital; authentic_pyq; cost $0.009227.

Oversubscription is a situation where the

A. number of shares applied for is equal to the number of shares issued.
B. number of shares applied for is more than the number of shares issued.
C. number of shares applied for is less than the number of shares issued.
D. face value of the share is less than the issue price of the share.

Proposed answer: **B**.
Oversubscription occurs when a company receives applications for more shares than it has offered for subscription. Therefore, the number of shares applied for is more than the number of shares issued, making option B correct.

Outcome: all required checks passed

### 52. english — eligible

ID: 0f45611a-97a5-4954-84ff-ac48135d7b78; Vocabulary; pyq_adapted; cost $0.008485.

Identify the option closest in meaning to the underlined word: Her <u>ingratiating</u> remarks seemed designed to win the director’s approval.

A. Designed to win favour
B. Intended to express disapproval
C. Marked by complete impartiality
D. Showing little interest

Proposed answer: **A**.
“Ingratiating” describes behaviour intended to gain someone’s favour or approval. The other options describe disapproval, impartiality, or indifference.

Outcome: all required checks passed

### 53. accountancy — eligible

ID: 2c7f1331-d354-4808-8ebe-23aa248448cb; Share Capital; authentic_pyq; cost $0.013249.

Match List-I with List-II. List-I List-II (Name of account to be debited or (Amount to be debited or credited) credited, when shares are forfeited) (A) Share Capital Account (I) Debited with amount not received (B) Share Forfeited Account (II) Credited with amount not received (C) Calls-in-arrears Account (III) Credited with amount received towards share capital (D) Securities Premium Account (IV) Debited with amount called up Choose the correct answer from the options given below :

A. (A) - (I), (B) - (II), (C) - (III), (D) - (IV)
B. (A) - (IV), (B) - (III), (C) - (II), (D) - (I)
C. (A) - (I), (B) - (II), (C) - (IV), (D) - (III)
D. (A) - (III), (B) - (IV), (C) - (I), (D) - (II)

Proposed answer: **B**.
On forfeiture, Share Capital is debited with the called-up amount (A–IV). Share Forfeiture is credited with the amount received towards share capital (B–III), while Calls-in-Arrears is credited with the unpaid amount (C–II). If the securities premium has not been received, Securities Premium is debited for that unpaid amount (D–I). Therefore, the correct answer is option B.

Outcome: all required checks passed

### 54. accountancy — eligible

ID: 2782c53c-4cd4-4031-b0df-466f478627b9; Share Capital; authentic_pyq; cost $0.010491.

A company can accept calls in advance, if authorised by :

A. Shareholders
B. Board of Directors
C. Articles of Association
D. Memorandum of Association st

Proposed answer: **C**.
A company may accept calls in advance when its Articles of Association authorise it. Therefore, option C is correct.

Outcome: all required checks passed

### 55. accountancy — eligible

ID: ffbf2eaa-257a-4930-bf2d-6bd6d54aad1c; Partnership Fundamentals; pyq_adapted; cost $0.008880.

A partnership firm has completed its Balance Sheet. When tracing the preparation of its final accounts backwards, which sequence of the other accounts is correct?

(A) Profit and Loss Appropriation Account
(B) Profit and Loss Account
(C) Trading Account

A. (A), (B), (C)
B. (B), (C), (A)
C. (C), (B), (A)
D. (A), (C), (B)

Proposed answer: **A**.
The forward preparation sequence is Trading Account, Profit and Loss Account, Profit and Loss Appropriation Account, and then Balance Sheet. Tracing backwards from the Balance Sheet, the other accounts are therefore Profit and Loss Appropriation Account, Profit and Loss Account, and Trading Account: (A), (B), (C).

Outcome: all required checks passed

### 56. accountancy — eligible

ID: 1b161744-da1e-440e-8bd3-a6df28773a5a; Financial Statements of Company; pyq_adapted; cost $0.011052.

Match List-I with List-II.

| List-I | List-II |
|---|---|
| (A) Calls in arrears | (I) Amount paid by a shareholder before it is called by the company |
| (B) Calls in advance | (II) Subscribed share capital that has not been fully paid up |
| (C) Reserve capital | (III) Amount called by the company but not yet received from shareholders |
| (D) Subscribed but not fully paid share capital | (IV) Uncalled share capital that the company can call only in the event of winding up |

Choose the correct answer from the options given below:

A. (A)–(I), (B)–(III), (C)–(II), (D)–(IV)
B. (A)–(III), (B)–(I), (C)–(IV), (D)–(II)
C. (A)–(III), (B)–(II), (C)–(IV), (D)–(I)
D. (A)–(IV), (B)–(I), (C)–(III), (D)–(II)

Proposed answer: **B**.
Calls in arrears are amounts already called but not received, so (A) matches (III). Calls in advance are received before being called, so (B) matches (I). Reserve capital is uncalled capital callable only on winding up, so (C) matches (IV). Subscribed but not fully paid share capital matches (II).

Outcome: all required checks passed

### 57. accountancy — eligible

ID: e539e791-5e64-48ad-be13-53df6e25a079; Profit & Loss Appropriation Account; pyq_adapted; cost $0.012016.

Under the fixed capital method, match each transaction in List I with the account in which it is recorded in List II.

List I
(I) A partner’s share of profit
(II) Additional capital introduced by a partner
(III) Salary to a partner
(IV) Part of a partner’s capital withdrawn under the agreement

List II
(A) Partner’s Capital Account
(B) Partner’s Current Account

Choose the correct combination:

A. (I)–(A), (II)–(B), (III)–(B), (IV)–(A)
B. (I)–(B), (II)–(A), (III)–(B), (IV)–(A)
C. (I)–(B), (II)–(A), (III)–(A), (IV)–(B)
D. (I)–(A), (II)–(A), (III)–(B), (IV)–(B)

Proposed answer: **B**.
Under the fixed capital method, a partner’s share of profit and salary are recorded in the Partner’s Current Account. Additional capital introduced and capital withdrawn under the agreement are recorded in the Partner’s Capital Account, since these are changes to the fixed capital.

Outcome: all required checks passed

### 58. accountancy — eligible

ID: b05f3b4d-275f-4c20-903f-80b9eefc4d33; Share Capital; pyq_adapted; cost $0.009189.

A company receives applications for 54,000 shares, which is 9,000 more than the number of shares it offered for subscription. How many shares did the company offer?

A. 45,000 shares
B. 63,000 shares
C. 9,000 shares
D. 54,000 shares

Proposed answer: **A**.
Applications exceed the number offered by 9,000. Therefore, shares offered = 54,000 − 9,000 = 45,000. Since applications are greater than the number offered, the issue is oversubscribed.

Outcome: all required checks passed

### 59. accountancy — eligible

ID: ea3b40b5-dc4b-4718-a7b9-5a5a2b46b016; Profit & Loss Appropriation Account; pyq_adapted; cost $0.010582.

A firm maintains partners’ capital accounts under the fixed capital method. Match List-I with List-II.

List-I
(A) Interest on capital
(B) Partner’s drawings
(C) Additional capital introduced
(D) Share of profit

List-II
(I) Credit side of Partner’s Capital Account
(II) Credit side of Partner’s Current Account
(III) Debit side of Partner’s Current Account

Choose the correct answer from the options given below:

A. (A) - (II), (B) - (III), (C) - (I), (D) - (II)
B. (A) - (II), (B) - (I), (C) - (III), (D) - (II)
C. (A) - (III), (B) - (II), (C) - (I), (D) - (II)
D. (A) - (II), (B) - (III), (C) - (II), (D) - (I)

Proposed answer: **A**.
Under the fixed capital method, items such as interest on capital and share of profit are credited to the Partner’s Current Account, while drawings are debited to it. Additional capital introduced is credited to the Partner’s Capital Account.

Outcome: all required checks passed

### 60. accountancy — eligible

ID: d1e4b734-18a9-45a4-9be3-fdee0d226e8f; Share Capital; pyq_adapted; cost $0.010973.

A company forfeited some fully called-up equity shares of ₹10 each. The holders had not paid the final call of ₹3 per share, but the issue premium of ₹2 per share had been received in full. The total amount credited to Share Forfeiture Account on forfeiture was ₹4,200. How many shares were forfeited?

A. 420 shares
B. 600 shares
C. 525 shares
D. 1,400 shares

Proposed answer: **B**.
The Share Forfeiture Account is credited with the amount received towards share capital; the premium received is excluded. The amount received towards share capital per share was ₹10 − ₹3 = ₹7. Therefore, the number of shares forfeited was ₹4,200 ÷ ₹7 = 600.

Outcome: all required checks passed

### 61. accountancy — eligible

ID: 5315d8d9-8a25-4171-83c3-41fba1ff160c; Financial Statements of Company; pyq_adapted; cost $0.020384.

Match List-I with List-II.

List-I
(A) Calls in arrears
(B) Calls in advance
(C) Securities premium
(D) Reserve capital

List-II
(I) Amount received over and above the nominal value of shares
(II) Amount called on shares but not received
(III) Called at the time of winding up
(IV) Amount received from a shareholder before it becomes due

Choose the correct answer from the options given below:

A. (A)–(II), (B)–(I), (C)–(IV), (D)–(III)
B. (A)–(IV), (B)–(II), (C)–(I), (D)–(III)
C. (A)–(II), (B)–(IV), (C)–(III), (D)–(I)
D. (A)–(II), (B)–(IV), (C)–(I), (D)–(III)

Proposed answer: **D**.
Calls in arrears are amounts called on shares but not received, while calls in advance are received before they are due. Securities premium is the amount received above the nominal value of shares. Reserve capital is called at the time of winding up. Thus, the correct matching is (A)–(II), (B)–(IV), (C)–(I), and (D)–(III).

Outcome: all required checks passed

### 62. accountancy — eligible

ID: 5ec3ec4d-fe39-4608-a3a0-4c02f53707e3; Partnership Fundamentals; pyq_adapted; cost $0.024359.

In a partnership firm, identify the correct sequence for tracing the transfer and final presentation of profit, starting with the Trading Account and ending with the Balance Sheet:

(A) Trading Account → Profit and Loss Account → Profit and Loss Appropriation Account → Partners’ Capital/Current Accounts → Balance Sheet
(B) Trading Account → Profit and Loss Appropriation Account → Profit and Loss Account → Partners’ Capital/Current Accounts → Balance Sheet
(C) Trading Account → Profit and Loss Account → Partners’ Capital/Current Accounts → Profit and Loss Appropriation Account → Balance Sheet
(D) Trading Account → Profit and Loss Account → Profit and Loss Appropriation Account → Balance Sheet → Partners’ Capital/Current Accounts

A. (A) Trading Account → Profit and Loss Account → Profit and Loss Appropriation Account → Partners’ Capital/Current Accounts → Balance Sheet
B. (B) Trading Account → Profit and Loss Appropriation Account → Profit and Loss Account → Partners’ Capital/Current Accounts → Balance Sheet
C. (C) Trading Account → Profit and Loss Account → Partners’ Capital/Current Accounts → Profit and Loss Appropriation Account → Balance Sheet
D. (D) Trading Account → Profit and Loss Account → Profit and Loss Appropriation Account → Balance Sheet → Partners’ Capital/Current Accounts

Proposed answer: **A**.
The authenticated question establishes the order Trading Account → Profit and Loss Account → Profit and Loss Appropriation Account → Balance Sheet. The NCERT excerpt states that partners’ shares of profit are recorded in their capital accounts or, under the fixed capital method, current accounts, and that these accounts are presented in the Balance Sheet. Thus, the partners’ accounts follow the Appropriation Account and precede the Balance Sheet, making option (A) correct.

Outcome: all required checks passed

### 63. accountancy — eligible

ID: 6ff08f7a-b79b-4290-83a6-007f7b4df498; Share Capital; pyq_adapted; cost $0.011961.

When a company receives money for a call before the call is made, which journal entry is recorded?

A. Calls in Advance A/c Dr. — To Bank A/c
B. Bank A/c Dr. — To Calls in Advance A/c
C. Bank A/c Dr. — To Share Capital A/c
D. Calls in Arrears A/c Dr. — To Bank A/c

Proposed answer: **B**.
The amount received before a call is made is credited to Calls in Advance Account, while Bank Account is debited for the money received.

Outcome: all required checks passed

### 64. accountancy — eligible

ID: 3d547d56-6873-4057-85d8-8a627eed611d; Share Capital; pyq_adapted; cost $0.009758.

A company offers 20,000 shares to the public and receives valid applications for exactly 20,000 shares. How should the issue be classified?

A. As oversubscribed, because applications have been received for the shares offered.
B. As undersubscribed, because applications do not exceed the number of shares offered.
C. As fully subscribed, because applications equal the number of shares offered.
D. As issued at a premium, because applications equal the number of shares offered.

Proposed answer: **C**.
Oversubscription occurs when applications exceed the number of shares offered; undersubscription occurs when applications are fewer. Here, the numbers are equal, so the issue is fully subscribed. The number of applications does not establish whether shares were issued at a premium.

Outcome: all required checks passed

### 65. accountancy — eligible

ID: 2d2a61f1-9e8c-4118-a689-52fbde8d14f7; Profit & Loss Appropriation Account; pyq_adapted; cost $0.009770.

A firm maintains partners’ accounts under the fixed capital method. After all appropriations, a residual profit of ₹1,20,000 is to be shared equally between its two partners. Which journal entry records the transfer of this profit to the partners?

A. Debit Profit and Loss Appropriation Account ₹1,20,000; credit each partner’s Current Account ₹60,000.
B. Debit each partner’s Current Account ₹60,000; credit Profit and Loss Appropriation Account ₹1,20,000.
C. Debit Profit and Loss Account ₹1,20,000; credit each partner’s Current Account ₹60,000.
D. Debit Profit and Loss Appropriation Account ₹1,20,000; credit each partner’s Capital Account ₹60,000.

Proposed answer: **A**.
The residual profit is transferred by debiting the Profit and Loss Appropriation Account and crediting the partners’ accounts in their profit-sharing proportions. Since the partners share equally, each receives ₹60,000. Under the fixed capital method, this credit is recorded in each partner’s Current Account, not Capital Account.

Outcome: all required checks passed

### 66. accountancy — eligible

ID: f354a935-306d-40af-a914-6159be1bbcd9; Financial Statements of Company; pyq_adapted; cost $0.021357.

Match each situation in List-I with the appropriate accounting treatment or classification in List-II.

| List-I | List-II |
|---|---|
| (A) A shareholder does not pay an amount that the company has called on the shares | (I) Recorded in a separate Calls-in-Advance account |
| (B) A shareholder pays an amount before the company calls for it | (II) Uncalled capital reserved to be called only in the event of winding up |
| (C) Shares are issued for more than their nominal value | (III) Unpaid calls, also called calls in arrears |
| (D) The company resolves that a part of its uncalled capital will be called only if it is wound up | (IV) Amount credited to Securities Premium Reserve |

Choose the correct matching:

A. (A)–(I), (B)–(III), (C)–(II), (D)–(IV)
B. (A)–(III), (B)–(I), (C)–(IV), (D)–(II)
C. (A)–(II), (B)–(IV), (C)–(I), (D)–(III)
D. (A)–(IV), (B)–(II), (C)–(III), (D)–(I)

Proposed answer: **B**.
An amount called but not received is unpaid calls, also called calls in arrears. An amount paid in excess of what is due on allotment or calls is calls in advance, for which a separate account is maintained. The premium on shares is credited to Securities Premium Reserve. Uncalled capital reserved to be called only on winding up is reserve capital. Thus, the matching is (A)–(III), (B)–(I), (C)–(IV), (D)–(II).

Outcome: all required checks passed

### 67. business_studies — eligible

ID: 7d475953-f798-4712-bac8-57c55b4467c2; Business Environment; pyq_adapted; cost $0.009326.

A food manufacturer must follow a government administrative order requiring an allergen warning on its labels. A political party has also proposed a different labeling policy, but it has not been issued as an order or law. Which dimension of the business environment does the current requirement illustrate?

A. Political environment
B. Legal environment
C. Social environment
D. Economic environment

Proposed answer: **B**.
The allergen-warning requirement is in a government administrative order, making it part of the legal environment. The party’s proposal is a political development, but it is not the binding requirement the manufacturer must currently follow.

Outcome: all required checks passed

### 68. business_studies — eligible

ID: 33f9d62d-cce7-4f57-9958-47bf3993fdd8; Business Environment; pyq_adapted; cost $0.009795.

A court judgment directs a business to take a specific action. What should management do in response?

A. Follow the judgment and take the action it directs.
B. Treat the judgment as advisory and wait for a separate statute to repeat it.
C. Follow the judgment only if the company’s industry peers do so as well.
D. Set the judgment aside if carrying it out conflicts with the company’s preferred policy.

Proposed answer: **A**.
Court judgments are part of the legal environment, and businesses are expected to obey the law. Management should therefore act in accordance with the judgment.

Outcome: all required checks passed

### 69. economics — eligible

ID: 7398cc0e-85ff-4daf-b51e-d66316c6124f; Balance of Payments; authentic_pyq; cost $0.012452.

Under flexible exchange rate, when the price of domestic currency in terms of foreign currency increases, it is called ___________ .

A. Depreciation of domestic currency
B. Appreciation of domestic currency
C. Devaluation of domestic currency
D. Revaluation of domestic currency

Proposed answer: **B**.
Under a flexible exchange rate, an increase in the price of domestic currency in terms of foreign currency means the domestic currency has gained value. This is called appreciation, so the correct answer is B. Devaluation and revaluation refer to changes made by the government under a fixed exchange rate system.

Outcome: all required checks passed

### 70. business_studies — eligible

ID: 274369ee-db68-467e-8eea-93cae22519da; Business Environment; pyq_adapted; cost $0.009326.

A packaged-food company finds that growing health awareness is increasing demand for low-sugar products. Retailers respond by stocking more of these products, and the company redesigns its production accordingly. Which characteristic of the business environment is best illustrated by these connected effects?

A. Totality of external forces
B. Inter-relatedness
C. Uncertainty
D. Relativity

Proposed answer: **B**.
A change in social awareness influences customer demand, retailers’ stocking decisions and the company’s production. The way these factors affect one another illustrates the inter-relatedness of the business environment.

Outcome: all required checks passed

### 71. economics — eligible

ID: d5db67c1-dbcd-4fac-954f-67169bc49631; Income Determination; authentic_pyq; cost $0.010348.

Identify the correct set of statements. (A) Ex Ante Saving represents what is actually planned to save. (B) Ex Post Saving represents what is actually planned to save. (C) Ex Post Saving depicts what has actually happened. (D) Ex Ante Post Saving represents what is actually saved. Choose the correct answer from the options given below :

A. (A) and (D) only
B. (A) and (C) only
C. (B) and (D) only
D. (C) and (D) only

Proposed answer: **B**.
Ex ante saving is the amount planned to be saved, so statement (A) is correct. Ex post describes what has actually happened, making statement (C) correct. Statement (B) is incorrect because ex post saving is not planned saving; statement (D) is incorrect because “ex ante post saving” is not the term for actual saving. Therefore, the correct answer is (A) and (C) only.

Outcome: all required checks passed

### 72. economics — eligible

ID: bfef7eb8-0e03-4f97-a848-f8cab4f76776; Money & Banking; authentic_pyq; cost $0.012434.

Which of the following statements are true ? (A) Quantitative tools control the extent of money supply by changing the CRR. (B) There are two types of open market operations – outright and upright. (C) A fall in the bank rate can decrease the money supply. (D) Selling of a bond by RBI leads to reduction in quantity of reserves. (E) The RBI can influence money supply by changing the rate at which it gives loan to the commercial banks. Choose the correct answer from the options given below :

A. (A), (C) and (D) only
B. (A), (B) and (D) only
C. (B), (D) and (E) only
D. (A), (D) and (E) only

Proposed answer: **D**.
Statements (A), (D) and (E) are true. The RBI uses quantitative tools, including changes in the CRR, to influence the extent of money supply. When it sells bonds, buyers pay the RBI, reducing reserves in the banking system and therefore tending to reduce money supply. The RBI can also influence money supply by changing the rate at which it lends to commercial banks. (B) is false: the two types of open market operations are outright and repo, not “outright and upright.” (C) is false: a fall in the bank rate makes borrowing from the RBI cheaper and generally tends to increase, not decrease, money supply. Thus the correct answer is (A), (D) and (E) only.

Outcome: all required checks passed

### 73. economics — eligible

ID: 241254c1-410a-4e91-81b4-d623b89fcb73; National Income & Related Aggregates; authentic_pyq; cost $0.009785.

Identify the correct statements : (A) Stocks are defined over a period of time. (B) Flows are defined over a period of time. (C) Flows are defined at a particular point of time. (D) Stocks are defined at a particular point of time. (E) GVA at factor costs + Indirect Taxes – Subsidies = GVA at market prices. Choose the correct answer from the options given below :

A. (A), (C) and (E) only
B. (B), (C) and (D) only
C. (B), (D) and (E) only
D. (C), (D) and (E) only

Proposed answer: **C**.
Stocks are measured at a particular point in time, whereas flows are measured over a period of time. Thus (B) and (D) are correct, while (A) and (C) are incorrect. Adding indirect taxes and subtracting subsidies from GVA at factor cost gives GVA at market prices, so (E) is correct. Therefore, the correct answer is (B), (D) and (E) only.

Outcome: all required checks passed

### 74. economics — eligible

ID: 9376c4a1-b3f2-425f-b159-7f462e52ec03; Income Determination; authentic_pyq; cost $0.008902.

If there is no government and no foreign trade, then :

A. G = T = M = X > 1
B. G = T = M = X = 1
C. G = T = M = X = 0
D. G = T = M = X < 1

Proposed answer: **C**.
In the absence of government, government expenditure (G) and taxes (T) are zero. With no foreign trade, imports (M) and exports (X) are also zero. Therefore, G = T = M = X = 0, so the correct answer is C.

Outcome: all required checks passed

### 75. economics — eligible

ID: 2681477c-8455-4fb2-8ec2-2fed9fdeb650; Government Budget & the Economy; authentic_pyq; cost $0.011023.

All those elements which create liability and decrease the assets of government are known as :

A. Capital Receipts
B. Capital Payments
C. Revenue Receipts
D. Revenue Payments

Proposed answer: **A**.
Capital receipts are government receipts that either create a liability, such as borrowing, or reduce its financial assets, such as proceeds from selling government assets. Therefore, the correct answer is A, Capital Receipts.

Outcome: all required checks passed

### 76. economics — eligible

ID: 02fc49a9-7017-459b-9d70-d571d0a0edf3; National Income & Related Aggregates; pyq_adapted; cost $0.008913.

In a two-sector economy consisting only of households and firms, households spend all their income on goods and services produced by domestic firms. There is no saving, government, or external trade, and firms distribute all their sales receipts as factor income. If firms receive ₹720 crore from household purchases during a year, what is the aggregate factor income received by households?

A. ₹720 crore
B. ₹360 crore
C. ₹0 crore
D. ₹1,440 crore

Proposed answer: **A**.
In this two-sector circular flow, household expenditure on firms’ output equals firms’ sales receipts. Since firms distribute all those receipts as factor income, household factor income is also ₹720 crore.

Outcome: all required checks passed

### 77. economics — eligible

ID: 736b38df-f7fd-4c72-82f1-55bd7789e2d4; Income Determination; pyq_adapted; cost $0.010059.

A household plans to consume ₹36,000 and save ₹9,000 during a month. At the end of the month, it has actually consumed ₹39,000 and saved ₹7,000. Assuming disposable income is divided only between consumption and saving, what are its planned disposable income and actual disposable income, respectively?

A. ₹45,000 and ₹39,000
B. ₹36,000 and ₹46,000
C. ₹45,000 and ₹46,000
D. ₹46,000 and ₹45,000

Proposed answer: **C**.
Planned (ex ante) disposable income equals planned consumption plus planned saving: ₹36,000 + ₹9,000 = ₹45,000. Actual (ex post) disposable income equals actual consumption plus actual saving: ₹39,000 + ₹7,000 = ₹46,000.

Outcome: all required checks passed

### 78. economics — eligible

ID: 331a63d4-1402-48fa-83d0-e65ebd16419f; Balance of Payments; pyq_adapted; cost $0.008811.

Under a flexible exchange rate, the foreign-currency price of one unit of domestic currency rises from $0.04 to $0.05. What is the percentage increase in this price, and what does the change indicate?

A. 20%; appreciation of the domestic currency
B. 25%; appreciation of the domestic currency
C. 25%; depreciation of the domestic currency
D. 20%; revaluation of the domestic currency

Proposed answer: **B**.
The percentage increase is (($0.05 − $0.04) ÷ $0.04) × 100 = 25%. Under a flexible exchange rate, an increase in the price of domestic currency in terms of foreign currency is an appreciation of the domestic currency.

Outcome: all required checks passed

### 79. economics — eligible

ID: 7910a488-0ca9-4524-a5fd-c019b6a9710a; Money & Banking; pyq_adapted; cost $0.009494.

In a simplified banking system, the required reserve ratio is 20%, banks hold no excess reserves, and there is no cash leakage. Each ₹1 of reserves can therefore support up to ₹5 of bank deposits. After the RBI sells government bonds, the system’s maximum deposit-creation capacity falls by ₹150 crore. Assuming the sale withdraws reserves from banks rupee-for-rupee, what is the value of the bonds sold?

A. ₹30 crore
B. ₹150 crore
C. ₹750 crore
D. ₹7.5 crore

Proposed answer: **A**.
A ₹1 reduction in reserves lowers the maximum deposit capacity by ₹5. Therefore, a ₹150 crore reduction in deposit capacity corresponds to a reserve withdrawal—and bond sale proceeds—of ₹150 ÷ 5 = ₹30 crore.

Outcome: all required checks passed

### 80. economics — eligible

ID: 2c29250c-6a94-428d-9f4a-6b809f2472ec; Government Budget & the Economy; pyq_adapted; cost $0.009049.

The government receives money by selling some of its shares in a public-sector enterprise. The sale does not create a liability for the government. How is this receipt classified?

A. Capital receipt
B. Revenue receipt
C. Revenue expenditure
D. Capital expenditure

Proposed answer: **A**.
Selling government shares reduces the government’s financial assets. Receipts that reduce government assets are classified as capital receipts, even when they do not create a liability.

Outcome: all required checks passed

### 81. economics — eligible

ID: 1cf1f238-b143-4aa7-8acd-c5550ec35eeb; National Income & Related Aggregates; pyq_adapted; cost $0.009265.

An economy records GVA at market prices of ₹950 crore. If indirect taxes are ₹120 crore and subsidies are ₹30 crore, what is its GVA at factor cost?

A. ₹860 crore
B. ₹800 crore
C. ₹920 crore
D. ₹1,100 crore

Proposed answer: **A**.
GVA at market prices = GVA at factor cost + indirect taxes − subsidies. Rearranging, GVA at factor cost = ₹950 crore − ₹120 crore + ₹30 crore = ₹860 crore.

Outcome: all required checks passed

### 82. economics — eligible

ID: 6a77f9d5-9a84-414d-bfa7-2a9e48ee1a8d; Money & Banking; pyq_adapted; cost $0.007925.

Using the simplified relationship that nominal interest rate equals real interest rate plus the inflation rate, what is the real interest rate if the nominal interest rate is 9% and inflation is 4%?

A. 5%
B. 13%
C. 2.25%
D. 36%

Proposed answer: **A**.
Rearrange the given relationship: real interest rate = nominal interest rate − inflation rate. Thus, 9% − 4% = 5%.

Outcome: all required checks passed

### 83. economics — eligible

ID: 4ecf0ccf-8840-4b54-93e0-2867b7df8c7a; National Income & Related Aggregates; pyq_adapted; cost $0.008852.

In a simple two-sector economy consisting of households and firms, which of the following describes a real flow in the factor market?

A. Households provide factor services to firms.
B. Firms provide factor payments to households.
C. Firms provide final goods and services to households.
D. Households provide consumption expenditure to firms.

Proposed answer: **A**.
In the factor market, households supply factor services, such as labour and capital, to firms. This is a real flow. Factor payments from firms to households are a monetary flow, while goods and consumption expenditure flow between firms and households in the goods market.

Outcome: all required checks passed

### 84. business_studies — eligible

ID: 3c5f2a8f-d3e1-4b3d-8d0f-ba79f30199a4; Business Environment; pyq_adapted; cost $0.007998.

A government rebate makes electric two-wheelers more affordable. Demand rises, manufacturers increase production, and battery suppliers expand capacity; greater battery availability then encourages further purchases. Which characteristic of the business environment is best illustrated?

A. Inter-relatedness
B. Dynamic nature
C. Uncertainty
D. Totality of external forces

Proposed answer: **A**.
The example shows several environmental factors influencing one another: the rebate affects demand, which affects manufacturers and suppliers, and expanded battery availability feeds back into demand. This mutual influence illustrates inter-relatedness. Dynamic nature refers more broadly to ongoing change, while uncertainty concerns difficulty predicting future events.

Outcome: all required checks passed

### 85. business_studies — eligible

ID: ac792d56-4a6b-487a-8b89-9c1f791e25bd; Business Environment; pyq_adapted; cost $0.013826.

A court orders a company to stop making a misleading claim on its product label. The company changes the label to comply with the order. Which dimension of the business environment is most directly reflected?

A. Economic environment
B. Social environment
C. Legal environment
D. Technological environment

Proposed answer: **C**.
Court judgments and orders are part of the legal environment. The company’s compliance with the court order reflects the influence of the legal environment on business.

Outcome: all required checks passed

### 86. economics — eligible

ID: 088188f1-4aa7-43d2-bba5-e4192d233d0c; Government Budget & the Economy; pyq_adapted; cost $0.010303.

According to the chapter, since Independence and alongside the Five-Year Plans, the Union Budget came to be regarded as more than a statement of receipts and expenditure. What additional role did it acquire?

A. A yearly statement confined to government receipts and expenditure
B. A significant national policy statement
C. An instrument exclusively for approving taxation
D. A report on only the government’s capital expenditure

Proposed answer: **B**.
The chapter states that with the launching of the Five-Year Plans, the budget also became a significant national policy statement, rather than merely a statement of receipts and expenditure.

Outcome: all required checks passed

### 87. economics — eligible

ID: dd83debc-8114-4729-b431-222013a04bfc; Income Determination; pyq_adapted; cost $0.011950.

At the start of a year, a household expects an income of ₹1,20,000 and plans consumption of ₹90,000. By the end of the year, its actual income is ₹1,10,000 and its actual consumption is ₹95,000. Using saving = income − consumption, identify the correct set of statements. (A) Its ex ante saving is ₹30,000. (B) Its ex post saving is ₹15,000. (C) Its ex ante saving is ₹15,000. (D) Its ex post saving is ₹30,000. Choose the correct answer from the options given below:

A. (A) and (C) only
B. (A) and (B) only
C. (B) and (D) only
D. (C) and (D) only

Proposed answer: **B**.
Ex ante refers to what was planned: planned saving is ₹1,20,000 − ₹90,000 = ₹30,000, so (A) is true. Ex post refers to what actually happened: realized saving is ₹1,10,000 − ₹95,000 = ₹15,000, so (B) is true. Statements (C) and (D) assign the amounts incorrectly.

Outcome: all required checks passed

### 88. english — eligible

ID: 81e67374-a170-407d-9bc2-d3cdfd2fe884; Vocabulary; authentic_pyq; cost $0.009747.

Choose the correct SYNONYM for redoubtable from the options given below.

A. flimsy
B. perplexing
C. formidable
D. voluble

Proposed answer: **C**.
Oxford defines redoubtable as describing someone with very strong qualities who is respected and perhaps feared. This meaning matches “formidable,” option 3.

Outcome: all required checks passed

### 89. economics — eligible

ID: 217a1fc6-a646-4a32-9e80-b0f405cca714; National Income & Related Aggregates; authentic_pyq; cost $0.018124.

Identify the correct statement in the context of Circular Flow of Income in a two sector economy :

A. Household receives factor services from firms.
B. Household invests while firm saves.
C. Firms produce goods and services.
D. Household supplies factor services to Government.

Proposed answer: **C**.
In the two-sector circular flow, households provide factor services to firms, and firms use those services to produce goods and services. Therefore, statement (3) is correct. Statement (1) reverses the direction of factor services. The simple model excludes government, so statement (4) does not apply. It also assumes households spend their entire income and do not save, so statement (2), which says the household invests while the firm saves, does not describe this model.

Outcome: all required checks passed

### 90. business_studies — eligible

ID: d1e66d7a-cb5c-4613-ae0b-7a6ab8f50a76; Business Environment; authentic_pyq; cost $0.013644.

Which of the following is an example of legal environment ?

A. Death/Birth Ratio
B. Trade Union Act
C. Prevailing Political System
D. Public Debt

Proposed answer: **B**.
The legal environment includes legislation, and the Trade Union Act is listed among the relevant legal enactments. Therefore, the correct answer is B.

Outcome: all required checks passed

### 91. business_studies — eligible

ID: e1b7a2de-7fc1-425d-803e-2a29a2687254; Marketing Management; authentic_pyq; cost $0.009430.

In the above case "Just Foodie" is using various variables of Marketing Mix. Identify the variable used in the following statement : "To make their products available to customers at right time, right place, they are also selling their products to grocery stores in addition to their own outlets."

A. Product
B. Price
C. Promotion
D. Physical distribution

Proposed answer: **D**.
The correct answer is (D) Physical distribution. Selling products through grocery stores in addition to the company’s own outlets uses intermediaries to make the products available to customers at the right place and time. These activities are part of physical distribution, also called Place in the marketing mix.

Outcome: all required checks passed

Passage:
"Just Foodie" is a food chain offering different snacks like chips, biscuits, chocochip cookies, cakes, etc. through their own retail outlets. To make their products available to customers at right time, right place, they are also selling their products to grocery stores in addition to their own outlets. The taste, quality and packing are given utmost care. They are offering good quality, so they are able to charge higher price than their competitors. To increase their sales, they are using different offers like : Free gifts, Cash backs, etc. They are offering discounts to customers on various occasions. All these considerations have made "Just Foodie" a complete success and they are able to win over different competitors in the market, and their market share is rising continuously.

### 92. business_studies — eligible

ID: 2b0a5325-8293-4f7e-8525-8a84fdfc92b6; Marketing Management; authentic_pyq; cost $0.009524.

"To increase their sales, they are using different offers like : Free gifts, Cash backs etc. They are offering discounts to customers on various occasions." Identify the marketing mix element from the above statement.

A. Product mix
B. Price mix
C. Promotion mix
D. Physical distribution mix

Proposed answer: **C**.
The offers of free gifts and cashbacks are sales-promotion techniques used to encourage purchases. In this context, the discounts offered on occasions also serve as promotional incentives to increase sales. Therefore, the marketing mix element is the Promotion mix (Option C).

Outcome: all required checks passed

Passage:
"Just Foodie" is a food chain offering different snacks like chips, biscuits, chocochip cookies, cakes, etc. through their own retail outlets. To make their products available to customers at right time, right place, they are also selling their products to grocery stores in addition to their own outlets. The taste, quality and packing are given utmost care. They are offering good quality, so they are able to charge higher price than their competitors. To increase their sales, they are using different offers like : Free gifts, Cash backs, etc. They are offering discounts to customers on various occasions. All these considerations have made "Just Foodie" a complete success and they are able to win over different competitors in the market, and their market share is rising continuously.

### 93. business_studies — eligible

ID: 351a0920-d3fd-42a0-8604-eabc2887fcb9; Marketing Management; authentic_pyq; cost $0.010883.

"To increase their sales, they are using different offers like : Free gifts, Cash backs etc. They are offering discounts to customers on various occasions." Which tool of the promotion mix is used in the given statement ?

A. Advertisement
B. Sales promotion
C. Personal selling
D. Publicity

Proposed answer: **B**.
The correct answer is (B) Sales promotion. Free gifts, cashbacks and discounts are short-term incentives offered to encourage customers to buy, which are examples of sales promotion.

Outcome: all required checks passed

Passage:
"Just Foodie" is a food chain offering different snacks like chips, biscuits, chocochip cookies, cakes, etc. through their own retail outlets. To make their products available to customers at right time, right place, they are also selling their products to grocery stores in addition to their own outlets. The taste, quality and packing are given utmost care. They are offering good quality, so they are able to charge higher price than their competitors. To increase their sales, they are using different offers like : Free gifts, Cash backs, etc. They are offering discounts to customers on various occasions. All these considerations have made "Just Foodie" a complete success and they are able to win over different competitors in the market, and their market share is rising continuously.

### 94. business_studies — eligible

ID: 49e8d294-ec2f-4387-8c5e-b5972cbe2ba7; Marketing Management; authentic_pyq; cost $0.007558.

Identify the element of marketing mix in the following statement : "The taste, quality and packing are given utmost care."

A. Product mix
B. Price mix
C. Promotion mix
D. Physical distribution mix

Proposed answer: **A**.
Taste, quality and packaging are features and decisions relating to the product. These are part of the product mix, so the correct answer is A, Product mix.

Outcome: all required checks passed

Passage:
"Just Foodie" is a food chain offering different snacks like chips, biscuits, chocochip cookies, cakes, etc. through their own retail outlets. To make their products available to customers at right time, right place, they are also selling their products to grocery stores in addition to their own outlets. The taste, quality and packing are given utmost care. They are offering good quality, so they are able to charge higher price than their competitors. To increase their sales, they are using different offers like : Free gifts, Cash backs, etc. They are offering discounts to customers on various occasions. All these considerations have made "Just Foodie" a complete success and they are able to win over different competitors in the market, and their market share is rising continuously.

### 95. business_studies — eligible

ID: cb17d0fd-9331-4276-9058-0b801e0c7dc1; Marketing Management; authentic_pyq; cost $0.008841.

"They are able to charge higher price than their competitors." Which element of marketing mix is discussed in the statement ?

A. Product mix
B. Price mix
C. Promotion mix
D. Physical distribution mix

Proposed answer: **B**.
The statement refers to the price element of the marketing mix. Charging a higher price than competitors is a pricing decision, so the correct answer is Price mix (B).

Outcome: all required checks passed

Passage:
"Just Foodie" is a food chain offering different snacks like chips, biscuits, chocochip cookies, cakes, etc. through their own retail outlets. To make their products available to customers at right time, right place, they are also selling their products to grocery stores in addition to their own outlets. The taste, quality and packing are given utmost care. They are offering good quality, so they are able to charge higher price than their competitors. To increase their sales, they are using different offers like : Free gifts, Cash backs, etc. They are offering discounts to customers on various occasions. All these considerations have made "Just Foodie" a complete success and they are able to win over different competitors in the market, and their market share is rising continuously.

### 96. business_studies — quarantined

ID: cfe45a37-91c7-40df-a492-e3085ff284ac; Marketing Management; pyq_adapted; cost $0.010571.

The offers described in the passage belong to the promotion element of the marketing mix. Which additional decision would also be part of this element?

A. Running an advertising campaign to inform customers about the snacks
B. Changing the packaging design of the snacks
C. Adding more grocery stores as retail outlets
D. Increasing the price of the snacks

Proposed answer: **A**.
Advertising communicates information about products to customers and encourages them to buy, so it is part of promotion. Packaging is part of product decisions, adding outlets is part of physical distribution, and increasing prices is a price decision.

Outcome: failed:explanation_support; passage_sibling_quarantined
- The promotion classification for advertising is supported, as are the place/distribution and four marketing-mix categories. But the cited product excerpts do not specifically establish that packaging is a product decision, so that explanation claim is unsupported by the supplied evidence.

Passage:
"Just Foodie" is a food chain offering different snacks like chips, biscuits, chocochip cookies, cakes, etc. through their own retail outlets. To make their products available to customers at right time, right place, they are also selling their products to grocery stores in addition to their own outlets. The taste, quality and packing are given utmost care. They are offering good quality, so they are able to charge higher price than their competitors. To increase their sales, they are using different offers like : Free gifts, Cash backs, etc. They are offering discounts to customers on various occasions. All these considerations have made "Just Foodie" a complete success and they are able to win over different competitors in the market, and their market share is rising continuously.

### 97. business_studies — quarantined

ID: 492a98ca-eb6c-450b-ac0b-680d67bf88c0; Marketing Management; pyq_adapted; cost $0.005940.

A snack company plans to alter only the Price element of its marketing mix, while leaving its product, outlets and advertising unchanged. Which action would carry out that plan?

A. Revise the product features
B. Change the amount charged for each packet
C. Add or remove distribution outlets
D. Change the advertising message

Proposed answer: **B**.
Changing the amount charged is a pricing decision and therefore implements a change to the Price element. The other actions concern the product, physical distribution and promotion.

Outcome: failed:source_support; passage_sibling_quarantined
- B is correct: changing the amount charged changes price. A changes the product, C changes distribution, and D changes promotion/advertising. The textbook identifies the four marketing-mix elements, and the anchor associates charging a higher price with the price mix. [E3.4, E1.1]
- There is one clear answer and no calculation or unstated condition. Marketing mix is in the included syllabus, and the direct MCQ format and depth fit the authenticated example. [E1.1, E3.4]
- The supplied passage is coherent and provides context on the company's products, outlets and pricing; the hypothetical and the marketing-mix principle together make the item answerable. [E5.1, E5.2, E3.4]
- The item is valid but not meaningfully distinct from its anchor: it reverses the same price-identification association into an action choice without introducing materially different reasoning. [E1.1]
- No numerical calculation or special boundary condition applies.

Passage:
"Just Foodie" is a food chain offering different snacks like chips, biscuits, chocochip cookies, cakes, etc. through their own retail outlets. To make their products available to customers at right time, right place, they are also selling their products to grocery stores in addition to their own outlets. The taste, quality and packing are given utmost care. They are offering good quality, so they are able to charge higher price than their competitors. To increase their sales, they are using different offers like : Free gifts, Cash backs, etc. They are offering discounts to customers on various occasions. All these considerations have made "Just Foodie" a complete success and they are able to win over different competitors in the market, and their market share is rising continuously.

### 98. business_studies — quarantined

ID: e29157e2-2824-4c72-9c5e-f2107c12086f; Marketing Management; pyq_adapted; cost $0.010157.

If Just Foodie were to add one more promotional activity to encourage customers to buy its products, which action would be a sales promotion technique?

A. Offering free samples of a new snack
B. Showing a television advertisement for its snacks
C. Having a salesperson explain the snacks to grocery-store owners
D. Issuing a press release about the company’s expansion

Proposed answer: **A**.
Sales promotion uses short-term incentives to encourage purchase, and free samples are one such incentive. Television advertising, salesperson presentations and press releases represent advertising, personal selling and publicity, respectively.

Outcome: passage_sibling_quarantined

Passage:
"Just Foodie" is a food chain offering different snacks like chips, biscuits, chocochip cookies, cakes, etc. through their own retail outlets. To make their products available to customers at right time, right place, they are also selling their products to grocery stores in addition to their own outlets. The taste, quality and packing are given utmost care. They are offering good quality, so they are able to charge higher price than their competitors. To increase their sales, they are using different offers like : Free gifts, Cash backs, etc. They are offering discounts to customers on various occasions. All these considerations have made "Just Foodie" a complete success and they are able to win over different competitors in the market, and their market share is rising continuously.

### 99. business_studies — quarantined

ID: 4fa7155b-e6fc-4174-98b7-cf1b49ccf3d8; Marketing Management; pyq_adapted; cost $0.010846.

Based on the Just Foodie case, what customer benefit is the company seeking by selling its products through grocery stores as well as its own outlets?

A. Customers can find the products at convenient places and when they need them.
B. Customers receive products with improved taste, quality and packaging.
C. Customers are persuaded to buy through free gifts and cash-back offers.
D. Customers are charged a higher price than competing brands.

Proposed answer: **A**.
Selling through grocery stores adds outlets where customers can obtain the products. This supports their availability at the right place and time, which is the purpose of physical distribution.

Outcome: passage_sibling_quarantined

Passage:
"Just Foodie" is a food chain offering different snacks like chips, biscuits, chocochip cookies, cakes, etc. through their own retail outlets. To make their products available to customers at right time, right place, they are also selling their products to grocery stores in addition to their own outlets. The taste, quality and packing are given utmost care. They are offering good quality, so they are able to charge higher price than their competitors. To increase their sales, they are using different offers like : Free gifts, Cash backs, etc. They are offering discounts to customers on various occasions. All these considerations have made "Just Foodie" a complete success and they are able to win over different competitors in the market, and their market share is rising continuously.

### 100. business_studies — quarantined

ID: fd0d93ee-2fe0-48d2-833d-1bdf8876dde7; Marketing Management; pyq_adapted; cost $0.009768.

Based on the passage, if “Just Foodie” wants to strengthen the marketing-mix element reflected in its care for taste, quality and packing, which decisions should it focus on?

A. Product features, quality and packaging
B. Price levels, discounts and credit terms
C. Channels and physical availability of products
D. Advertising, sales promotion and public relations

Proposed answer: **A**.
Taste, quality and packaging are product-related decisions. Therefore, strengthening the product element of the marketing mix means focusing on product features, quality and packaging.

Outcome: passage_sibling_quarantined

Passage:
"Just Foodie" is a food chain offering different snacks like chips, biscuits, chocochip cookies, cakes, etc. through their own retail outlets. To make their products available to customers at right time, right place, they are also selling their products to grocery stores in addition to their own outlets. The taste, quality and packing are given utmost care. They are offering good quality, so they are able to charge higher price than their competitors. To increase their sales, they are using different offers like : Free gifts, Cash backs, etc. They are offering discounts to customers on various occasions. All these considerations have made "Just Foodie" a complete success and they are able to win over different competitors in the market, and their market share is rising continuously.
