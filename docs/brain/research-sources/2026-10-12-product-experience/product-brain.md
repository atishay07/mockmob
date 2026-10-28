# MarkMob
## Product, UX, retention and recommendation reference

Version 1.0 | Prepared 11 October 2026 | Research and implementation handoff

A detailed product brain for a CUET preparation platform: how the experience should feel, what students should do next, how recommendations become trustworthy, and how progress supports a durable brand.

> Working identity: the current request says MarkMob; previous project context calls the product MockMob and gives mockmob.in. This document uses MarkMob as requested. Confirm the public brand before changing production names or assets.

## Read this before implementation

The controlling product promise is: **Know what to work on next, do a focused repair, and see evidence that you improved.** An engaging interface serves that promise. App opens, XP and screen time are supporting signals, not proof of learning.

This is both a research synthesis and a proposed specification. It does not report results from MarkMob experiments, inspect the production database, or claim to have accessed real student histories. Numerical examples, card content, thresholds, algorithms and interface drawings are illustrative proposals unless explicitly marked otherwise.

### Provenance and completeness

The uploaded transcript contains 201 speaker lines and approximately 32 KB of source text. Every source line is reproduced, in order and without correction, in Appendix A. The original text file is also included in the companion package. Line references L001-L201 refer to that upload, not video timestamps: no timecodes were supplied.

Earlier context recovered fifteen principles, a five-question guest flow, Practice / Improve / My Goal navigation, Mobi feedback, the post-mock learning sequence, four retention loops, weekly goals, verified-performance competition, structured recommendations and a learning-cycle North Star. The retrieval service did not return the earlier assistant replies verbatim or their rendered graphics, and did not return an existing full card specification. The material below reconstructs and expands those ideas; it is not a claim that every sentence or original image from the unseen replies has been preserved. The schematic figures are newly drawn reference designs.

The public mockmob.in page could not be retrieved in this research pass. No fresh site audit, authenticated walkthrough, performance test or backend review was performed. Earlier reports of traffic, paying users and pricing are context, not independently verified facts. Do not use them as evidence for public marketing.

### Evidence legend

| Label | Meaning | Implementation consequence |
| --- | --- | --- |
| Verified source | A directly inspected official publication or original research supports the nearby statement. | Preserve scope and limitations; do not turn association into causation. |
| Transcript claim | The speaker asserts it; the claim is preserved in Appendix A. | Do not reuse the statistic publicly until independently checked. |
| Proposed requirement | A recommended product or technical decision for MarkMob. | Treat as a starting specification; validate with user research and engineering. |
| Illustrative fixture | Invented data for explaining or testing behavior. | Never display as actual student history or production results. |
| Historical context | Recovered prior conversation information. | Check the current product, configuration and owner decisions before adopting. |

### How an agent should use this reference

Read sections 1-3 for priorities, sections 4-8 for behavior and visuals, sections 9-14 for the recommendation contract, and sections 15-19 for measurement and shipping. Appendix A preserves the raw source; Appendix B indexes coverage; Appendix C lists verified research and unresolved claims. Read the companion Markdown when indexing knowledge: its selectable text, tables and code are easier to retrieve than flattened imagery.

If implementation conflicts with a current repository, inspect its actual schema, scoring rules and design system first. Keep a conflict log. Reuse existing components and history tables when their semantics match; do not create parallel sources of truth merely to match a proposed name here.

# 1. Product direction and the student job

### 1.1 The job is progress under uncertainty

A student can have access to thousands of questions and still not know what to do tonight. A mock score describes a result; it rarely supplies a credible plan. MarkMob should bridge that gap: explain the pattern behind the result, choose a bounded next action, help the student complete it, and verify the skill later using fresh questions.

The emotional outcome is calm agency: 'I know where I stand and I have a manageable next step.' The functional outcome is more reliable performance on relevant, unseen exam-like questions. Brand memory should come from that repeated experience, not from an isolated launch screen.

### 1.2 Three student contexts

| Context | Student concern | Best product response |
| --- | --- | --- |
| First visit | Is this useful, accurate and worth my time? | A small guest practice, transparent answer explanation and a clear sample diagnosis. |
| Regular practice | I am working, but am I fixing the right things? | A next-action card based on eligible history, a small repair session and a later verification. |
| Near the exam | I have limited time and do not want surprises. | Stable exam simulation, realistic pacing, priority revision and careful uncertainty language. |

These are behavioral contexts, not rigid demographic personas. A single student may move between all three. Ask for subject combination and goal when those answers change recommendations, not simply to fill a profile.

### 1.3 Proposed positioning

Headline: 'Turn your last mock into your next improvement.' Support: 'See the pattern, practise the right skill, and check it on fresh questions.' Primary action: 'Try 5 questions.' Secondary action: 'See how improvement works.'

This is a positioning hypothesis. Test whether students understand it better than a generic 'AI powered CUET platform' message. Claims about admission, percentile or rank require validated evidence and the relevant exam-year context.

### 1.4 Scope and sequencing

The core loop comes before breadth. Existing project concepts include NTA/Test Mode, Quick Practice, Full Mock, DU Compass, AI Mentor, AI Battle/Rival, Weakness/Radar and Command Center. Translate these into understandable student actions. Feature names can remain inside the relevant destination; they should not all demand equal home-screen attention.

The first release should make practice, reliable results, diagnosis, repair and verification work together. Social competition, elaborate characters, content feeds and extensive customization should earn their place through evidence. A bug-free answer save is a stronger trust signal than a polished celebratory animation after an inaccurate score.

# 2. Fifteen operating principles

### 2.1 Outcome before features

Every major screen should answer one student question: what can I do here, why does it matter, and how will I know it worked? Judge a feature by the behavior and learning it enables. A leaderboard that increases visits but discourages weaker students has not automatically succeeded.

Acceptance example: after a mock, a student can identify the first recommended skill and start an appropriate repair without having to interpret a dozen charts.

### 2.2 Value before commitment

Allow a short, useful guest experience before demanding account creation, a long goal questionnaire or payment. Five questions is a proposed entry test, not enough to diagnose broad ability. At its end, show actual answers, one restrained insight and what saving history enables.

Retain guest attempts locally or with a privacy-conscious temporary identity. On account creation, merge once using idempotent ownership transfer. Never discard the completed practice and force the student to restart.

### 2.3 Emotional feedback matters

Confirmation should feel responsive and supportive. Correct answers get concise feedback; mistakes get a specific explanation and a next step. Mobi, the contextual helper recovered from earlier discussion, is a proposed presentation layer, not a prerequisite for the learning engine.

The Duolingo character system demonstrates intentional feedback design [S01-S02]. Its business growth does not isolate the causal effect of animation [S03]. Test MarkMob feedback against comprehension and continuation, not delight ratings alone.

### 2.4 Trust through details

Trust is cumulative: clear sources, accurate grading, stable timers, honest pricing, understandable loading, visible save status and recoverable failures. Warm visuals help users enter an intimidating subject, but cannot compensate for incorrect content.

Phantom's official 2023 refresh explicitly frames the brand as friendly and inviting [S04]. Apply the lesson to exam uncertainty: explain difficult concepts without talking down to students.

### 2.5 Remove unnecessary decisions

Do not make a student choose among every mode whenever they open the product. Provide one recommended next move plus a clear way to choose another. A recommendation should reduce effort while preserving control, not hide the reasoning.

A student with ten minutes should be able to adjust session duration without navigating away and losing the recommendation's context.

### 2.6 Challenge category assumptions

Question whether students need more questions, more choices, more video or a more expensive commitment. The defensible alternative may be reliable diagnosis and fewer, better actions. Timeleft chooses much of the logistics for participants [S05]; the transferable mechanism is reducing preparation and coordination, not removing all user choice.

### 2.7 Design learning, not engagement theater

Reward demonstrated improvement, thoughtful review and follow-through. Logging in is not mastery. Completion means completing a useful learning task, not tapping through a reward screen.

Practice testing and distributed practice have strong support in the learning-techniques review [S07]. Exact review intervals and question counts here remain product hypotheses.

### 2.8 Make competition achievable

Use an optional small cohort with comparable subjects, exam year and opportunity to participate. Personal bests can be the default. Avoid a global score table dominated by students taking easier questions or more attempts.

Cohort size and membership changes must not silently manufacture rank gains. Explain the comparison basis, sample size and update window.

### 2.9 Use fewer gamification systems well

Start with a clear weekly completion goal and personal skill progress. Add another mechanic only if it improves a defined outcome. Research on feature richness found a context-specific overload pattern, not a universal optimal feature count [S08].

For each proposed mechanic, list the intended behavior, distortion risk, exit route and metric that would cause removal.

### 2.10 Preserve autonomy

Let students choose or change a goal, pause reminders, take rest days, use another task and leave competition. A missed day should not erase demonstrated learning. A student who returns after a gap should see a welcoming, achievable restart.

### 2.11 Completion needs meaning

A weekly progress ring is useful only if its denominator represents real work. Prefer '2 of 3 repair cycles completed' to '80 XP to unlock a chest'. Show a satisfying finish and give permission to stop.

The Apple Watch stand-reminder research supports a specific prompt affecting standing probability; it does not validate every progress-ring design [S09].

### 2.12 Personal progress builds motivation

Make the student compare present performance with their own comparable earlier work. Show the item count and conditions. Five correct answers after repeating the same questions are practice success, not proof of retained mastery.

Say '7 of 10 fresh questions correct today; earlier comparable set: 4 of 10' rather than 'Your ability increased 75%'.

### 2.13 Community amplifies value

Give students a place to share strategy, acknowledge completed learning and ask specific questions. Community requires moderation, norms and real support. A dormant chat tab is a feature, not a community.

Begin with structured weekly check-ins or small study groups. Keep achievement sharing optional and avoid automatically exposing marks or weakness areas.

### 2.14 Experiment rather than assume

Establish a baseline, define a hypothesis and compare learning-relevant outcomes across randomized groups where feasible. Novelty can inflate early interaction. Observe whether a design keeps working after the first week and across exam-season cohorts.

### 2.15 Brand emerges from repeated experience

The brand should repeatedly deliver accuracy, clarity, encouragement and progress. Tone, illustration, motion, response speed, question quality and payment support all contribute. Marketing can bring a student in; the repeated learning loop gives them a reason to recommend the product.

# 3. Transcript research: mechanisms and what transfers

### 3.1 Emotional design: visceral, behavioral and reflective layers

Use Don Norman's emotional-design lens as a design heuristic: immediate impression, quality of use and meaning afterward. On first contact, the product should look credible. During use, it should be fast, understandable and accurate. After a session, the student should feel that their effort led somewhere.

This framework is a conceptual lens, not a predictive equation for revenue. Do not imply that changing a gradient produces a known retention uplift.

| Layer | MarkMob expression | Failure to avoid |
| --- | --- | --- |
| Immediate impression | Focused headline, credible question sample, consistent typography. | A premium-looking shell with vague claims. |
| Quality of use | Stable exam flow, immediate input response, transparent result. | Pretty transitions that slow the student or hide errors. |
| Meaning afterward | A specific skill repaired and evidence to revisit. | A streak celebration with no learning consequence. |

### 3.2 Duolingo: emotional feedback and habit design

The transcript highlights reactions, lip syncing, idle states, celebrations and visible momentum. Official Duolingo posts establish character feedback and the 2022 animation work [S01-S02]. Official results show 40.5 million DAUs for Q4 2024 and 52.7 million for Q4 2025 [S03], with each period's definition preserved. These figures must not be presented as animation-caused growth.

Transfer the feedback intent: a correct action gets a clear response, an error gets a path forward, and a completed useful session gets an earned ending. Keep reaction time short and avoid inserting a reward interaction between every exam question. In formal test mode, the examination conditions take priority; feedback belongs after submission.

### 3.3 Phantom: friendliness in a difficult category

The transcript says 'Fantom' but its wallet, ghost and founder clues point to Phantom. The original wording stays unchanged in Appendix A; the synthesis uses Phantom. The official refresh is dated 21 June 2023 [S04].

For MarkMob, approachable design means explaining score denominators, question quality and admission uncertainty in ordinary language. A calm failure message with saved work matters more than a mascot smiling during a lost attempt. The video's app-store ranking and comparisons across categories were not verified; exclude them from business arguments.

### 3.4 Revolut: polish and a premium impression

The transcript describes rich onboarding, responsive charts, card motion and subtle reassurance. Treat these as observational design examples, not a controlled demonstration that motion raises revenue. A current official page supports Revolut's product presence [S13], not the causal claim.

Use tactile interaction only where it helps: inspect a point on a score history, reveal the evidence behind a recommendation, or move smoothly from result to repair. Do not add 3D for its own sake. MarkMob's proposed dark-and-volt identity can feel premium through restraint, hierarchy and consistency.

### 3.5 Hidden assumptions: Timeleft, Speak and Bevel

Timeleft handles venue, group and time; its official service description supports the reduced-planning model [S05]. Speak centers actual speaking and a Learn / Practice / Apply method [S06]. Bevel's official site identifies the health-coaching product [S14]; the transcript's 'Devil' is likely a transcription error. Their revenue, growth, funding and competitor claims remain unverified in this document.

| Category assumption | Opposite worth testing for MarkMob | Evidence needed |
| --- | --- | --- |
| More questions is more value. | Fewer questions chosen from a credible diagnosis can be more useful. | Delayed fresh-question outcomes and time efficiency. |
| Students should choose all their work. | Offer a reliable default plus an easy override. | Task clarity, initiation and completion without loss of autonomy. |
| More time inside the product is success. | Help students finish effective work and leave. | Learning cycles, useful return, student-reported confidence. |
| Exam preparation requires a big purchase. | Deliver a useful low-commitment starting loop. | Conversion, affordability and contribution margin. |
| AI must be visible everywhere. | Make intelligence visible through a good next action. | Accuracy, explainability and trust rather than AI button clicks. |

A competitor's business-model constraint can create a strategic opening, but incumbents are not categorically unable to copy a feature. Durability comes from better data, reliable content, execution, trust and repeated outcomes.

### 3.6 The seven gamification patterns

| Pattern | Mechanism | MarkMob decision |
| --- | --- | --- |
| PBL fallacy | Points, badges and leaderboards can reward a proxy instead of the job. | Tie recognition to meaningful, verified work; audit for easy-question farming. |
| Achievable local competition | A relevant peer group can feel more reachable than a global table. | Optional comparable cohorts; personal improvement by default. |
| Feature-richness overload | The game layer can consume attention needed for the task. | Ship one or two mechanisms first; remove mechanics that obstruct learning. |
| Streak trap | Loss of a streak can convert agency into obligation. | Weekly goals, rest days and welcoming re-entry; no loss of skill records. |
| Variable reward magnitude | An uncertain reveal can produce anticipation. | Use occasional nonessential celebration; never randomize access to learning. |
| Completion drive | A bounded visible task invites finishing. | Repair-cycle progress with an honest denominator and terminal state. |
| Competence feedback | Evidence of becoming better supports a meaningful reason to return. | Fresh verification, comparable personal progress and careful confidence labels. |

Gamification evidence is nuanced. The 2024 meta-analysis supports effects on intrinsic motivation and basic psychological needs with competence effects more limited [S10]. The Habitica research found counterproductive effects within its studied samples [S11]; it does not establish harm in every user or every gamified product. The original transcript's platform anecdotes are illustrative unless independently supported.

### 3.7 The three addictive architectures

The transcript describes variable reinforcement, endless progression and social comparison as mutually reinforcing architectures. Preserve the insight that system structure matters more than decorative rewards. Do not equate every surprise with a variable-ratio schedule: uncertain reward size after a fixed action and uncertain number of actions until a reward are different mechanisms.

| Architecture | Useful observation | Product boundary |
| --- | --- | --- |
| Craving machine | Uncertainty can sustain attention independent of satisfaction. | Keep required study content and progress predictable; no paid random rewards. |
| Infinite game | Accumulated progress can make leaving feel like a loss. | Offer meaningful finishes; never erase earned mastery for inactivity. |
| Invisible scoreboard | Visible comparison can turn behavior into identity and status. | Opt-in sharing and fair comparison; avoid humiliation and forced disclosure. |

The transcript's assertions about matchmaking algorithms, dopamine equivalence, universally permanent identity and inability to quit are stronger than the verified evidence available here. Do not present them as neuroscience facts or design requirements. The goal is willing, useful return, not making an exam student unable to stop.

### 3.8 The student's emotional journey

Before practice: uncertainty and task avoidance. During practice: effort, friction and occasional frustration. After a result: vulnerability or pride. During diagnosis: the need for understandable meaning. During repair: the need for manageable challenge. During verification: the need for honest evidence. On return: the need for remembered context.

Design the transition after a poor mock with particular care. Lead with 'Here's the first thing to work on' rather than a red wall of weakness labels. Preserve the result and the mistakes; encouragement must not blur the facts.

# 4. Information architecture and end-to-end UX

### 4.1 Three primary destinations

**Practice** contains quick practice, topical sessions and exam simulation. **Improve** contains next best move, error review, repair history and verification. **My Goal** contains chosen subjects, preparation plan, weekly progress and carefully contextualized DU exploration. Profile, billing and notification settings sit outside the core study hierarchy.

On desktop, a side navigation can expose these destinations. On mobile, use three labeled bottom tabs. Avoid icon-only navigation. Maintain stable names across web and app, even if internal feature codenames differ.

### 4.2 First visit: useful work before signup

1. Show a specific outcome-led landing page and one primary guest action.
2. Ask for a subject only if needed to serve relevant questions. Explain why.
3. Start a five-question practice with clear progress and no formal ability claim.
4. Show correct answers, explanations and a modest sample insight.
5. Offer account creation to save the work and build history. Explain the benefit.
6. After signup, carry the completed work forward and suggest a short next action.

If the user chooses a full mock first, allow that flow with transparent save requirements. Do not silently imply a five-question sample is an exam-equivalent baseline.

### 4.3 Returning home

Priority order: unfinished valid session; an evidence-based next best move; upcoming verification; weekly learning goal; optional subject practice and full mock. An unfinished session may take the highest slot without deleting or reranking the improvement card. Explain why a resume action appears.

Keep hero content short enough to fit a typical mobile first viewport: title, recommended task, reason, time estimate and CTA. Supporting history belongs below or behind an explanation sheet.

### 4.4 Mock flow

Before start: duration, subject, item count, marking policy version and submission behavior. During the mock: current question, timer, navigator, clear flag state and explicit saved/syncing/error status. After submit: authoritative grading, totals with denominator, review affordance and a path to improvement.

Do not show correctness while an exam-equivalent mock is running. If a session has offline support, establish the local durability and server reconciliation rules before advertising it. A browser tab being open is not proof that the answers reached the server.

### 4.5 Post-mock sequence

**Result -> Diagnosis -> Priority -> Repair -> Verification -> Reflection.** Result says what happened. Diagnosis summarizes patterns that the data supports. Priority chooses the next bounded action. Repair provides explanation and practice. Verification checks fresh performance after an appropriate gap. Reflection records what helped and adapts the next plan.

A student can inspect any mistake without accepting the recommended task. Recommendations should be helpful defaults rather than gates that prevent ordinary practice.

### 4.6 Result page hierarchy

Display the official score for the configured mock, then attempted/correct/wrong/unanswered counts. Provide score context without fabricated percentile. Show one or two actionable patterns instead of declaring everything weak. Place 'Your next best move' immediately after the concise diagnosis. Keep charts and full question review accessible below.

If grading is pending or answer-key corrections are in progress, say so. A recalculated score needs a visible explanation and should trigger recommendation recomputation.

### 4.7 Repair session

Begin with the reason for this session and a clear boundary: for example, '8 questions, about 10 minutes'. Include a concise worked explanation when the concept requires it, then guided questions and fresh practice. Immediate practice feedback can be appropriate here. Track explanations viewed separately from answers attempted.

End with a bounded completion state. State what was done and what remains uncertain. Schedule or offer a fresh verification; do not label mastery solely from repeating the same items.

### 4.8 Verification and reflection

Fresh item families matter more than visually shuffled options. Show the item count, conditions and comparison limits. If there is improvement, celebrate specifically. If the evidence is ambiguous, say the check is encouraging but too small to establish a stable change. If performance is worse, offer a different explanation or smaller repair without punishment.

Reflection should be one optional prompt, such as 'What helped most?' with choices including explanation, practice, pacing and still unclear. Do not burden the student with a mandatory survey after every task.

# 5. Visual direction and UI specification

### 5.1 Design intent

Historical project preferences favor deep charcoal (#0B0B0B), volt (#D2F000), a real established logo and a premium restrained interface. Use these as starting context, not a verified current design-system inventory. The figures use a text wordmark because an official logo asset was not supplied. Use the actual logo from the repository for production.

Avoid a dashboard filled with floating translucent tiles. Prefer solid surfaces, clear type, purposeful borders, vertical lists and one dominant action. A strong identity is consistent, not excessively decorated.

### 5.2 Proposed tokens

| Token | Proposed value | Use |
| --- | --- | --- |
| background | #0B0B0B | Primary app background. |
| surface | #171717 | Solid cards and sheets. |
| surface-raised | #202020 | Selected or elevated surface. |
| text-primary | #F5F5F2 | Main readable text. |
| text-secondary | #B3B6AD | Supporting copy; verify contrast at final size. |
| accent | #D2F000 | Primary action and active progress. |
| accent-ink | #161B00 | Text over volt surfaces. |
| success | #8DD7A2 | Positive outcomes with words or icons. |
| caution | #F4C777 | Limited evidence or attention needed. |
| error | #EF9C9C | Errors with corrective instructions. |
| border | #383A34 | Visible grouping and input boundaries. |

Spacing scale: 4, 8, 12, 16, 24, 32 and 48 CSS px. Card radius: proposed 16 px. Page margin on mobile: 16-20 px. Body text: 16 px starting point, with readable line spacing; never shrink important rationale text merely to fit the card. Use tabular numerals for marks, count and time. All token values require visual and accessibility verification in the final product.

### 5.3 Recommendation card anatomy

Eyebrow: 'YOUR NEXT BEST MOVE'. Action title: 'Repair subject-verb agreement'. Summary: 'You missed 6 of 15 eligible questions across 3 recent mocks.' Metadata: '8 questions · about 10 min'. Primary CTA: 'Start repair'. Secondary: 'Why this?' Supporting line: 'Based on your last 3 English mocks'.

The card should have one dominant CTA. Confidence is evidence confidence, not a promise of marks. If displayed, explain 'Good evidence' in the details sheet. Prefer a short rationale with a direct link to actual source questions over a vague AI badge.

### 5.4 Responsive behavior

Mobile: one column, full-width CTA, rationale wraps naturally, metadata stays readable, detail sheet can become a full page at large text sizes. Desktop: card expands to a maximum readable width with supporting evidence beside it only when that does not compete with the action. Never compress the entire dashboard into miniature desktop tiles on a phone.

The 'Why this?' sheet should support deep links, keyboard focus management and dismissal without resetting the parent page. If the action is not available, keep a clear recovery action rather than a permanently disabled unexplained button.

### 5.5 Figures included in this PDF

The visual reference pages show a mobile home, desktop result page, annotated card, evidence detail, card states, motion/state guidance and a deterministic recommendation architecture. These are schematic design directions with invented sample data. They are neither screenshots of the live product nor a claim that the real backend supports the displayed metrics.

> Figure 1: Mobile home with one supported next action, an honest time commitment, weekly completion and three labeled destinations. (See the vector illustration in the PDF.)
> Figure 2: Result page prioritizes the progression from authoritative result to diagnosis, repair and fresh verification. (See the vector illustration in the PDF.)
> Figure 3: Card anatomy consists of a concrete action, evidence, time and question count, primary CTA and explanation entry. (See the vector illustration in the PDF.)
> Figure 4: Evidence detail exposes correct, wrong and unanswered counts, eligible families, source attempts and uncertainty. (See the vector illustration in the PDF.)
> Figure 5: Cold start, thin evidence, ready, due verification, stale history and service error have different truthful states. (See the vector illustration in the PDF.)
> Figure 6: Authorized history and reviewed content feed deterministic selection and a versioned snapshot before UI or optional AI text. (See the vector illustration in the PDF.)

# 6. Emotional feedback, motion and microcopy

### 6.1 Motion should communicate a state change

Proposed budgets: pressed feedback around 100 ms; small state transitions 150-220 ms; result or completion transitions 220-350 ms; occasional optional milestone animation up to 500 ms. These are working design budgets rather than empirical optimal timings. Earlier guidance mentioned 100-500 ms. Do not delay usable controls while an animation finishes.

| Moment | Response | Boundary |
| --- | --- | --- |
| Answer selected | Immediate selected state and accessible announcement where needed. | Do not reveal correctness in mock mode. |
| Repair answer correct | Concise confirmation and explanation access. | No fullscreen reward for each question. |
| Repair answer wrong | Neutral correction, useful explanation and retry path. | No shaming, lost XP or character distress. |
| Session saved | Small stable save confirmation. | Confirmation only after durable acceptance. |
| Repair finished | Short progress transition and specific achievement copy. | Distinguish practice completion from mastery. |
| Verification improved | Highlight the comparable fresh-question evidence. | Do not imply guaranteed CUET score gain. |
| Returning after a gap | Welcome and a manageable next action. | No guilt countdown or erased progress. |

Reduced motion replaces nonessential movement with immediate or short fade state changes. Never rely on sound, haptics, motion or color alone. Reserve a lightweight mascot reaction for moments where it adds meaning; keep it absent during high-concentration exam work.

### 6.2 Copy system

Prefer concrete verbs and evidence. 'Try 8 fresh questions on inference' is stronger than 'Unlock your academic superpowers'. 'You missed 4 of 9 questions' is clearer than 'AI detected severe weakness'.

| Situation | Suggested copy |
| --- | --- |
| First diagnosis | 'This is a starting signal. A few more questions will help us choose confidently.' |
| Well-supported pattern | 'This pattern appeared in 3 recent mocks. Start with a short repair.' |
| Missing timing | 'We can assess answers, but timing data is incomplete.' |
| Sparse content | 'We do not have enough reviewed questions for this repair yet. Try the related review.' |
| Return after break | 'Welcome back. Pick up with a small next step.' |
| Verification success | 'You answered 7 of 10 fresh questions correctly. Your earlier check was 4 of 10.' |
| Ambiguous result | 'Promising check. More fresh questions are needed before calling this stable progress.' |
| Temporary error | 'Your previous result is saved. We could not load a new recommendation. Try again.' |

### 6.3 Mobi behavior contract

Mobi should use known session context, not pretend to know feelings or unseen history. It can encourage a first repair, explain an unfamiliar metric or acknowledge verified progress. Avoid universal praise after every tap and avoid telling the student they are 'behind' without a chosen plan and valid comparison.

If conversational AI is used, factual fields must be supplied from the trusted service. AI can simplify an explanation within those facts. It cannot invent marks, replace deterministic scoring or diagnose psychological traits from answers.

# 7. Retention loops, bounded goals and community

### 7.1 Four useful return loops

| Loop | Trigger | Student action | Value earned | Next reason to return |
| --- | --- | --- | --- | --- |
| Skill repair | Completed mock reveals a reliable gap. | Finish focused repair. | Better understanding and practice. | Fresh verification due. |
| Spaced retrieval | A learned skill reaches a review date. | Complete a fresh short check. | Evidence of retention or a new repair need. | Adjusted review date. |
| Weekly completion | Student chooses realistic weekly work. | Finish meaningful learning cycles. | A bounded week of progress. | Choose next week's plan. |
| Social support | An opt-in peer or mentor check-in. | Share strategy or acknowledge effort. | Support and accountable learning. | Next agreed check-in. |

The loop should end when the student's task is complete. A healthy exit can strengthen trust and make the next return more likely to be intentional.

### 7.2 Weekly goals instead of punishment

Offer a starter goal such as three useful cycles per week, with a smaller option and the ability to edit it. This is a proposed default. Count a cycle only after diagnosis-informed work and an eligible check, or clearly label an earlier stage as partial. If checks cross week boundaries, credit the completed cycle at verification and separately record effort on the original day.

Define the week in the student's chosen timezone. Do not reset the plan during travel or silently use server UTC. Historical streaks may remain visible if already part of the product; provide pause and recovery rather than erasing learning.

### 7.3 Reminders

Ask for permission after value has been demonstrated. Let students choose study windows and channels. Use a conservative frequency cap, quiet hours and easy mute controls. Send a reminder only if the action is still valid and useful. Cancel reminders for completed, invalidated or dismissed tasks.

An example message is 'Your inference check is ready: 5 fresh questions, about 6 minutes.' Do not tell students a pet will suffer or their future admission is at risk if they skip tonight.

### 7.4 Competition and integrity

A verified-performance leaderboard needs a comparable test definition, reviewed items, controlled attempt policy, sufficient sample and honest rank handling. Do not mix a 5-question easy drill with a full exam simulation. Never count repeated attempts as independent evidence. Show a cohort minimum; suppress a rank when the group is too small or the comparison is unsuitable.

Anti-cheat can combine eligibility rules, anomaly review and appeal. Treat suspicious timing as a flag, not proof of misconduct. If rewards have real value, define stronger integrity controls before launch. Students can choose private progress without losing core study functionality.

### 7.5 Community design

Start with a specific purpose: a subject study group, weekly repair challenge or moderated Q&A. Establish posting norms, a way to report abuse and a real response process. Human connection is valuable; parasocial attachment is not an implementation requirement.

Recognition should acknowledge useful help and real work. Avoid a volume contest that rewards low-quality replies. A good community metric is whether questions get useful answers, not total messages.

# 8. Website, app, growth, pricing and brand

### 8.1 Landing-page structure

Hero: outcome, sample action and credible product preview. Proof: a real explanation and transparent question provenance. Mechanism: mock -> repair -> fresh check. Fit: subjects and relevant exam year. Pricing: complete terms. FAQ: accuracy, access, saving, refunds/support and what admission guidance can or cannot promise. Footer: contact and policies.

Use real DU photographs only with appropriate permission and attribution when required. Do not substitute imagined campus imagery for real locations. Show genuine product screens once they exist; keep illustrative concept screens explicitly labeled.

### 8.2 App launch logic

A native app is worthwhile if it improves study continuity, reliable saving, lightweight access or helpful permitted reminders. The same learning contract should hold on web and app. Avoid a relaunch that discards histories or creates incompatible scoring.

Before launch, test account continuity, guest merge, offline and sync claims, session resume, subscription entitlements, accessibility and delayed verification across devices. If offline practice exists, distinguish downloaded reviewed content from online AI functionality.

### 8.3 Growth tied to proof

Shareable output can show a real completed repair or a weekly summary with privacy controls. Avoid making public marks the only share option. Referral rewards should be predictable and understandable. Content marketing can teach a specific recurring error and show how a repair works. Campus communities can provide distribution when the product delivers value worth discussing.

Growth experiments should be measured by activated students and useful cycles, not merely installations or clicks. A viral mechanic that brings users who never complete meaningful work is not automatically healthy growth.

### 8.4 Pricing as part of trust

Historical context mentions ₹69/month with small credit purchases; a recovered earlier response mentions ₹99 Pro through 31 July 2027 with no auto-renewal. Those are conflicting historical descriptions, not verified current prices. The agent must inspect current billing configuration and owner intent before implementing or publishing either.

Regardless of price, state plan duration, renewal terms, included usage, AI limits, taxes where applicable, cancellation and refund/support policy clearly. Do not sell basic correctness or the ability to see one's already-earned score as an artificial upgrade. If advanced coaching is paid, leave a useful free fallback and explain the distinction.

### 8.5 Economics

Track cost per completed useful cycle alongside revenue. Separate reviewed question delivery, database reads/writes, AI explanation generation, notification delivery and support. AI tokens and request counts should not be estimated only from DAU: a power user may consume far more than a casual user.

Reuse trusted explanations and precomputed topic aggregates where valid. Recalculate recommendation statistics when history changes rather than reading the entire history on every page render. Do not compromise grading or data isolation for lower cost.

### 8.6 Brand behavior checklist

A brand touchpoint should be understandable, accurate, encouraging and recognizably MarkMob. The same tone applies to landing-page copy, explanations, error messages, payment receipts and support. Keep a small shared vocabulary: mock, repair, fresh check, progress, goal. Explain internal AI feature names when students encounter them.

# 9. 'Your next best move': UX contract

### 9.1 Purpose

The card answers: 'Given my actual eligible history and the time I have, what useful task should I do next, and why?' It produces one primary task, a reason linked to evidence, a duration estimate and a clear action. The details view may offer alternatives. It must never imply historical evidence when only a generic starter rule is available.

### 9.2 Supported action types

| Type | Trigger | Typical action |
| --- | --- | --- |
| resume | A valid incomplete session exists. | Continue the saved session. |
| diagnostic | Insufficient reliable evidence. | Answer a short reviewed diagnostic. |
| concept_repair | Repeated topic errors with usable repair content. | Explanation plus targeted practice. |
| pacing_practice | Reliable timing suggests a speed problem. | Timed fresh set with pacing feedback. |
| error_review | Mistakes exist but a topic diagnosis is weak. | Review a small set of actual errors. |
| verification | A completed repair is due for a fresh check. | Unseen comparable questions. |
| spaced_review | Previously verified material is due for retrieval. | Short fresh retrieval session. |
| mixed_practice | No supported high-priority gap. | Balanced practice in selected subjects. |

Availability is a prerequisite. Never recommend a task whose content, permission, entitlement or route cannot be resolved. 'Resume' can occupy a top slot as a workflow priority without counting as a weakness recommendation.

### 9.3 Visible fields and disclosure

Always show action title, concise rationale, time/count, primary CTA and the basis label. Show a provisional badge when evidence is limited. The rationale should make a falsifiable claim: counts, topic and source window can be inspected. It should not expose identifiers or backend jargon to students.

The 'Why this?' view includes source attempts, eligible question count, correct/wrong/unanswered counts, exclusions, recency, confidence meaning and why the selected action outranks alternatives. Link to the student's own question review where available.

### 9.4 Controls

Allow duration adjustment, another task, dismissal with optional reason and evidence inspection. Duration adjustment must re-check that the task remains pedagogically meaningful and content is sufficient. If eight questions are needed for the planned check, shortening to three must change the description and confidence implications.

A dismissal should not mark a skill fixed. It can temporarily suppress the same presentation, using a transparent cooldown. Repeated dismissals may mean the system's action is unsuitable, not that the student lacks motivation.

### 9.5 Loading and stability

Use a stable skeleton with realistic space for the title, rationale and CTA. If a valid recommendation already exists, show it with its timestamp while refresh occurs. Avoid reshuffling the top action on every tap or because a few milliseconds of background processing changed a tie.

A retained card must be invalidated when its evidence or content becomes unsafe to use, its action is completed, or its authorization no longer holds. A stale history snapshot can be displayed honestly if within the configured validity rules; otherwise use a fallback.

### 9.6 State and copy matrix

| State | Visible behavior | CTA |
| --- | --- | --- |
| New user | 'Let's find a useful starting point.' No history claim. | Try diagnostic. |
| Thin history | 'Early signal from 6 eligible questions. Let's check it.' | Check this skill. |
| Ready | Specific task with evidence-backed reason. | Start repair / check. |
| In progress | Resume with completed count and saved status. | Continue. |
| Repaired, check not due | Acknowledge work; show review timing and another action. | Practise another skill. |
| Verification due | 'Check this on fresh questions.' | Start fresh check. |
| Stale history | Date shown; 'A fresh set will update your next move.' | Refresh with practice. |
| History unavailable | Honest loading failure without fabricated diagnosis. | Retry / choose practice. |
| No eligible content | Explain the unavailable repair and offer a related valid task. | Review related errors. |
| No strong weakness | Positive but bounded language. | Mixed practice / review due. |
| Subject changed | Recompute for selected subjects; preserve old history separately. | Start relevant task. |
| Entitlement blocked | Explain included access and a useful free alternative. | Start available alternative. |

### 9.7 Example card with illustrative history

'Your next best move' / 'Repair subject-verb agreement' / 'You missed 6 of 15 eligible questions across 3 recent English mocks.' / '8 questions · about 10 min' / 'Start repair' / 'Why this?'

This fixture describes observed performance, not a promise that the student will recover six marks or gain a particular percentile. The 8-question task is proposed session content; it is distinct from the 15-question evidence sample.

# 10. Data model and eligibility

### 10.1 Authoritative records

| Entity | Minimum fields | Reason |
| --- | --- | --- |
| Student settings | user_id, selected subject IDs, exam year, timezone, goal settings, consent flags. | Relevance, reminders and policy boundaries. |
| Attempt | attempt_id, user_id, mode, subject_id, started_at, submitted_at, status, grading_version, scoring_policy_id, history_revision. | Eligible history and reproducible grading. |
| Response | attempt_id, question_version_id, selected_option, final_outcome, active_time_ms nullable, timing_quality, hints/exposure flags. | Answer evidence and optional pacing evidence. |
| Question version | question_id, version, item_family_id, subject_id, topic_id, syllabus_version, key, review_status, active flag. | Content validity, topic meaning and duplicate control. |
| Topic aggregate | user_id, topic_id, evidence_window, counts, sessions, effective_sample, last_seen, source_revision. | Fast deterministic recommendation inputs. |
| Repair session | session_id, user_id, recommendation_id, topic_id, source_snapshot, selected_items, state, completed_at. | Connect recommended work to its completion. |
| Verification | verification_id, repair_session_id, fresh item families, conditions, counts, completed_at. | Distinguish practice from evidence of retention. |
| Recommendation | recommendation_id, user_id, action type, reason codes, evidence snapshot, policy version, content bundle, validity times. | Audit, resume and experimentation. |
| Action event | event_id, user_id, recommendation_id, event_name, timestamp, experiment assignment. | Deduplicated outcome measurement. |

These names are proposed logical entities. They need not become new physical tables if equivalent records already exist. Store UTC timestamps; use the student's timezone when presenting dates or computing chosen weekly goals.

### 10.2 Eligibility rules

A weakness recommendation uses server-submitted, authoritatively graded attempts owned by the authenticated student. Default proposal: use selected relevant subjects, current compatible syllabus, reviewed active questions and valid scoring versions. Exclude incomplete attempts from weakness aggregates; handle resume separately. Exclude invalidated questions and ambiguous keys from performance analysis until resolved.

Use unassisted first eligible exposures for diagnostic and verification evidence. Repeated questions, explanation-assisted answers and practice retries can be useful for learning, but must be labeled and excluded from independent ability evidence. If the same item family recurs, downweight or use one chosen exposure according to the versioned policy.

Never infer skipped questions as incorrect concept knowledge. Unanswered items contribute to omission analysis; an expiry cluster might suggest pacing, but only when the attempt and timing context support that inference.

### 10.3 Topic taxonomy

Use a stable reviewed mapping from question to subject/topic and optional concept. Track the taxonomy version. A question with several concepts should use an explicit allocation policy rather than full-counting it in every topic. Avoid creating artificial strength by changing topic labels after the fact.

Version corrections must trigger affected aggregates and recommendations to recompute. A historical evidence panel should explain when a key or mapping correction changed a recommendation.

### 10.4 Timing quality

Active answer time is not identical to wall-clock time. Background tabs, device sleep, interruptions, navigation and offline periods can contaminate it. Keep quality flags and null values rather than encoding missing time as zero. Use reviewed item difficulty and cohort timing only when sufficiently sampled; raw fastest time is not a meaningful benchmark.

Pacing advice should require several reliable responses across more than one eligible session. If those conditions fail, use answer evidence or a dedicated timed diagnostic. Never call a student careless merely because an answer was fast.

### 10.5 Exam rules

Read current CUET and subject rules from official exam publications before implementing scoring or admission guidance. This document deliberately does not hardcode marks, negative marking, duration, syllabus weight or DU admission formulas. Each mock records its scoring policy. If comparing different policies, show counts or a justified normalized measure and disclose the change.

### 10.6 Provisional policy values

Starting values for staging: recent window up to 30 days; at most 10 relevant submitted attempts; recency half-life 14 days; provisional topic signal from 5 independent eligible items; stronger signal from at least 12 items across 3 sessions. These are product parameters for evaluation, not validated statistical guarantees.

Confidence labels must combine sample breadth, freshness, data quality and agreement. Calling 12 answers 'high confidence' without calibration would be misleading. Until calibrated, label categories 'limited evidence', 'developing evidence' and 'good evidence' with their meaning shown.

# 11. Reliable recommendation policy

### 11.1 Deterministic first; AI for expression

The recommendation engine should select from trusted actions using versioned rules and computed evidence. It must operate without an LLM. If AI rephrases the rationale, it receives structured facts and an allowed vocabulary. Reject unsupported facts or invalid output and fall back to deterministic copy.

An AI-generated explanation should not change action type, counts, dates, topic, confidence or eligibility. The system needs traceable reason codes, not a free-form paragraph that engineers cannot reproduce.

### 11.2 Preparation pipeline

1. Authorize the user and read settings.
2. Read a consistent history revision and eligible content catalog revision.
3. Filter attempts, responses and item families under the configured policy.
4. Aggregate topic outcomes and timing quality.
5. Generate valid candidate actions.
6. Apply workflow and review priorities.
7. Rank eligible learning candidates with a reproducible score.
8. Resolve a concrete reviewed content bundle and available route.
9. Persist a snapshot with evidence, policy version and expiry.
10. Return the card and details payload; record impression only when actually visible.

If relevant history changes during computation, retry from the current revision or decline to publish the older snapshot. Never combine counts from one revision with source references from another.

### 11.3 Estimating a topic signal

For each topic, compute independent eligible correct (C), wrong (W) and unanswered (U). For answer-accuracy evidence, denominator is C+W; report U separately. Weighted counts can use w = 2^(-age_days/14), after duplicate-family control, with the half-life versioned.

Use an explicit Beta prior for a smoothed planning estimate, for example Beta(1,1): posterior mean p = (1 + weighted_correct) / (2 + weighted_answered). This is a proposed ranking input, not a calibrated exam-success probability. Weighted observations require caution: a formal Beta posterior is only exact for an appropriate Bernoulli model, not arbitrary fractional recency weights and correlated items. Label the result as a heuristic smoothed estimate unless the statistical model is validated.

Track effective sample size n_eff = (sum w)^2 / sum(w^2), but do not confuse it with independent observations when items or sessions are correlated. Session breadth and unique item families remain separate confidence checks.

### 11.4 Candidate ranking

For eligible concept-repair candidates, a transparent initial score can be:

priority = 0.35 * gap + 0.25 * repetition + 0.20 * relevance + 0.10 * freshness + 0.10 * feasibility.

All components are bounded 0-1 and defined in the policy. Gap may be 1-p; repetition describes independent sessions where the error pattern appears; relevance uses selected subjects and reviewed exam/topic metadata; freshness measures recency; feasibility checks time fit and available repair content. Weights are proposed defaults for experiments, not learned causal effects.

Gate sparse evidence before ranking. Use tie-breaks by stronger evidence, most recent supported issue, then stable topic ID. Preserve a current valid action unless a meaningful higher-priority candidate appears. A low-sample topic must not win simply because its raw accuracy is 0/1.

### 11.5 Priority overrides

Resume is a workflow decision. Due verification can take priority over another repair because the previous learning cycle needs a check, provided the student has enough time and fresh content exists. Spaced reviews can be batched rather than allowing a large queue to crowd out all new study. A near-exam plan may emphasize timing and relevant revision, but the exam date must be known and the policy explicit.

Do not use paid entitlement as a positive weakness score. Availability filters can remove inaccessible tasks, but payment status is not evidence of what the student most needs to learn.

### 11.6 Omission and pacing candidates

If unanswered questions cluster late in an exam with reliable navigation and timing evidence, propose a pacing check rather than automatically calling the topic weak. If wrong answers are spread across a topic and time is ordinary, a concept repair may be more suitable. If both occur, explain the uncertainty and choose the smallest diagnostic that distinguishes them.

A time-on-question ratio requires a suitable baseline and valid active time. Do not compare an easy definition with a long passage using one global time limit.

### 11.7 Content selection

Resolve reviewed active items compatible with the subject, syllabus, language and task. Include diversity across concept variants. Avoid recently exposed item families in verification. Keep question ID, version, key and explanation attached to the session so edits cannot silently change a running task.

If too few items exist, reduce the session only when the educational goal remains honest; otherwise choose an error review or diagnostic. Do not generate unreviewed questions on the critical path and present them as trusted verification.

### 11.8 Guardrails for language

Allowed: '6 of 15 eligible questions were incorrect'; 'This appeared across 3 recent mocks'; 'A fresh check can help establish whether the repair held'. Disallowed without validated models: 'This will add 18 marks'; 'You have a 92% admission chance'; 'Your IQ is low'; 'AI knows this is your weakest skill'.

Do not use the wrong-answer count as recoverable exam marks. Expected score uplift would require calibrated task success, transfer, actual scoring, item distribution and uncertainty. For the first release, show observation and purpose rather than a made-up gain prediction.

### 11.9 Worked illustrative fixture

| Topic | Independent eligible outcomes | Session breadth | Interpretation | Action |
| --- | --- | --- | --- | --- |
| Subject-verb agreement | C=9, W=6, U=1 | 3 recent mocks | Repeated answer pattern with enough reviewed repair items. | Primary concept repair. |
| Inference | C=1, W=3, U=0 | 1 mock | Too thin for a confident weakness conclusion. | Diagnostic candidate. |
| Vocabulary | C=13, W=3, U=0 | 3 mocks | More stable answers; some review potential. | Lower-priority practice. |
| Reading pace | 8 usable timing samples, several exclusions | 1 mock | Timing quality/breadth insufficient. | Do not diagnose pacing yet. |

The example card uses '6 of 15' because answer accuracy excludes the one unanswered item. The evidence view must show the additional omission, so the student sees how the count was derived. No fixture row comes from actual MarkMob student records.

# 12. API, persistence and AI contracts

### 12.1 Proposed endpoints

| Operation | Request | Response / behavior |
| --- | --- | --- |
| GET /v1/me/next-move | Auth context; optional time budget; no trusted user_id parameter. | Versioned current card or a supported fallback state. |
| GET /v1/me/next-move/{id}/evidence | Authorized recommendation ID. | Counts and permitted source references owned by that student. |
| POST /v1/me/next-move/{id}/start | Idempotency-Key; recommendation version. | Existing or new resolved session, never duplicate sessions on retry. |
| POST /v1/me/next-move/{id}/dismiss | Reason enum optional; idempotency key. | Records feedback/cooldown, does not mark mastery. |
| POST /v1/me/sessions/{id}/submit | Server-validated answers and session revision. | Durable submission state and grading job/result. |
| POST /v1/me/sessions/{id}/reflection | Optional structured response. | Saves reflection separately from performance. |

These are illustrative routes. Align with the application's actual router and schema. Protect server ownership and apply database row-level security where used. A UUID is not an authorization boundary.

### 12.2 Example response: illustrative fixture

```json
{
  "schema_version": "1.0",
  "recommendation_id": "fixture-nextmove-001",
  "policy_version": "nextmove-v1-proposal",
  "state": "ready",
  "action_type": "concept_repair",
  "subject_id": "english",
  "topic_id": "subject_verb_agreement",
  "title": "Repair subject-verb agreement",
  "reason_code": "repeated_topic_errors",
  "rationale": "You missed 6 of 15 eligible questions across 3 recent English mocks.",
  "evidence": {
    "source_attempt_ids": ["fixture-a1", "fixture-a2", "fixture-a3"],
    "correct": 9,
    "wrong": 6,
    "unanswered": 1,
    "answered_denominator": 15,
    "unique_item_families": 16,
    "eligible_sessions": 3,
    "history_revision": "fixture-r17",
    "catalog_revision": "fixture-c4",
    "evidence_label": "good_evidence",
    "evidence_label_calibrated": false
  },
  "task": {
    "question_count": 8,
    "estimated_minutes": 10,
    "content_bundle_id": "fixture-reviewed-repair-b1",
    "cta": "Start repair"
  },
  "generated_at": "2026-10-11T18:20:00Z",
  "valid_until": "2026-10-12T18:20:00Z",
  "illustrative_fixture": true
}
```

The 24-hour validity is illustrative. Persist the authoritative fields in the service; the client must not change counts or select an arbitrary bundle ID. A production payload should omit fixture flags and IDs only after replacing them with actual validated data.

### 12.3 Consistency and idempotency

Persist recommendation -> session -> submission -> grading -> repair/verification linkage. Use a transaction or equivalent guarantees for durable state changes. Enforce unique submission and idempotency semantics so a network retry does not grade twice or allocate duplicate repair sessions.

If two devices start the same recommendation, resume the same valid session or explain which session is active. A content correction can invalidate a bundle; the service must return a recoverable state rather than starting a stale one.

### 12.4 Refresh triggers

Recompute after newly graded mock/diagnostic data, answer-key or taxonomy changes, repair completion, due verification updates, selected-subject changes, meaningful preference changes and expiry. Invalidate authorization-sensitive data immediately when access or ownership changes. Dismissal updates presentation eligibility; it does not rewrite answer history.

Use per-user and revision-aware cache keys. Cache public question metadata separately from student performance. Do not cache a personalized card solely by topic or URL where another user can receive it.

### 12.5 AI copy contract

Input: selected action, trusted title, allowed source counts, approved confidence wording, time estimate and tone rules. Output: a short rationale only, with no new numbers or inferred traits. Validate length, allowed facts and structured schema. Prefer template copy when the validator cannot establish equivalence.

Log model/provider version and validation failure category without exposing unnecessary student data. Service outage or budget exhaustion must not remove the deterministic card. No prompt content should be allowed to override authorization or grading rules.

### 12.6 Performance proposal

Compute aggregates on relevant events and serve the current snapshot quickly. Initial internal target: recommendation response p95 under 500 ms for a warm valid snapshot; this is a proposed service SLO and must be measured. The frontend can remain useful while computation is pending.

For web UX, use Google's verified field thresholds: LCP at or below 2.5 seconds, INP at or below 200 ms, CLS at or below 0.1 at the 75th percentile [S12]. Lab performance is useful for diagnosis but is not a substitute for real-device field results.

# 13. Verification, mastery and adaptation

### 13.1 Distinguish stages

Observed gap -> repair started -> repair completed -> fresh check completed -> delayed check retained. Each stage has a distinct status. An explanation viewed is not a completed repair. A completed practice task is not proof of long-term mastery.

Proposed initial timing: offer a fresh check after a useful gap, often the next day, and consider a later review after several days. Specific timing must be tested by topic and study context; it is not derived as an exact interval from the learning review [S07]. Near the exam, use a feasible review window and describe the limitation.

### 13.2 Freshness requirements

A verification uses unseen item families under comparable conditions and compatible syllabus. No hints or visible answers until submission. At least a minimal reviewed sample must be available. If items were leaked, exposed or reused, label the task practice and do not use it as fresh verification.

Compare like with like: subject, topic allocation, difficulty, help conditions and scoring policy. When comparability is weak, show descriptive counts without a definitive change claim.

### 13.3 Outcome language

Early gain: 'Today's fresh check looks better.' Repeated gain: 'The improvement appeared again on a later fresh set.' Mixed evidence: 'Results vary; let's check another version of the skill.' Decline: 'This still needs work; try a different explanation.'

A mastery label requires a calibrated policy with item quality, sample size and persistence conditions. Until then, prefer status labels such as 'practised', 'fresh check completed' and 'retained on later check'.

### 13.4 Adaptation rules

If the student passes an eligible fresh check, move to a spaced-review candidate and another useful skill. If they struggle, consider a smaller concept step, a different explanation format or another diagnostic. Repeatedly assigning the same eight questions is not adaptation.

If content repeatedly fails or explanations are reported incorrect, quarantine the affected items and exclude them from recommendation evidence. Update histories after correction rather than blaming students for bad keys.

# 14. Failure handling, privacy and accessibility

### 14.1 Failure cases

| Failure | Required behavior |
| --- | --- |
| History API timeout | Keep valid known state if safe; explain refresh failure; provide ordinary practice. |
| Grading incomplete | Show pending state; do not recommend from provisional incorrect outcomes. |
| Answer-key correction | Regrade affected results, recompute aggregates, explain changed evidence. |
| Too little topic coverage | Diagnostic or error review, with a limited-evidence label. |
| Question bundle disappears | Resolve another reviewed bundle or explain unavailability. |
| Offline interruption | Preserve local work if supported; clearly separate local save from server acceptance. |
| Duplicate start/submit | Return the existing authoritative session/result. |
| Subject or syllabus switch | Filter current recommendation relevance; preserve separate past records. |
| AI copy failure | Deterministic approved rationale. |
| Comparison group too small | Suppress rank and show personal progress. |
| User declines reminders | Core study remains available; do not keep reprompting. |

### 14.2 Student data

Use the least personal data needed to recommend learning. Keep raw responses and sensitive profile information out of public sharing and unrestricted analytics logs. Define retention and deletion behavior. Students may be minors: assess consent, parental and regional requirements with the applicable current policy and legal review before implementing those flows. This document does not state a definitive legal compliance conclusion.

Explain what history influences a recommendation and provide access to one's own data. If exporting or deleting an account, specify effects on histories, community posts and aggregate analytics. Do not silently repurpose marks for advertising targeting.

### 14.3 Accessibility requirements

Use WCAG 2.2 AA as a proposed web target, with native-platform equivalents verified separately. W3C's target-size criterion has a 24-by-24 CSS pixel minimum with exceptions [S15]; aim for generous 44-48 px primary controls as a product choice, not as the universal WCAG AA threshold.

Support keyboard navigation, visible focus, screen-reader names, correct headings, readable large text, sufficient contrast, reduced motion and non-color error meaning. Announce changes to a recommendation without unexpectedly moving focus. Charts need a readable table or summary. Save states and errors must be understandable without animation.

### 14.4 Performance is emotional design

Test on slower Android devices and constrained mobile connections, not only a high-end desktop. Load key text and actions before optional animation assets. Keep timers stable despite rendering work. Avoid layout shifts when the card rationale arrives. Error recovery should preserve what the student already did.

# 15. Analytics and learning measurement

### 15.1 North Star

Proposed North Star: **weekly students completing a meaningful learning cycle**. A complete cycle links an eligible observed need, focused repair and an eligible fresh verification. Keep delayed retention as a stronger follow-up metric. Do not count a cycle repeatedly when the student retries a reused check.

Track a separate early activation metric because first-visit students cannot always complete a delayed cycle on day zero: guest/practice completion, usable result viewed, improvement task started and completed. Define these explicitly before comparing conversion.

### 15.2 Event contract

| Event | When emitted | Key properties |
| --- | --- | --- |
| next_move_impression | Card actually visible under defined visibility rules. | recommendation_id, policy_version, state, experiment_id. |
| next_move_reason_opened | Evidence panel opens. | recommendation_id, source revision. |
| next_move_started | Server confirms valid session creation/resume. | session_id, recommendation_id, action_type. |
| next_move_dismissed | Dismissal persisted. | optional reason enum, cooldown policy. |
| repair_completed | Completion validated by service. | eligible item counts, topic_id. |
| verification_completed | Fresh check graded. | freshness status, conditions, outcome counts. |
| delayed_check_completed | Later eligible retrieval graded. | time gap, topic_id, comparison eligibility. |
| learning_cycle_completed | Unique valid repair/check linkage qualifies. | cycle_id, user_id, policy_version. |
| content_issue_reported | Student flags a specific question/explanation. | question_version_id, issue category. |
| recommendation_fallback | Service uses a fallback. | category and quality issue; no unnecessary raw answers. |

Deduplicate with event IDs. Distinguish client impressions from server-confirmed outcomes. Do not emit a new impression for every component rerender. Preserve anonymous-to-account identity continuity with a documented consent and merge policy.

### 15.3 Metrics and denominators

Card initiation = unique valid starts / unique eligible card viewers. Repair completion = completed repairs / started repairs. Verification return = eligible checks completed / checks that became due and available. Learning-cycle rate = users with a valid cycle / eligible active users, with eligibility definition shown. Track absolute counts alongside rates.

D1/D7/D30 product retention means meaningful eligible activity in the specified day window, not a notification click alone. Use a consistent cohort timezone and definition. Report activation-based cohorts separately from signup-based cohorts. New exam cycles and subject changes can alter behavior, so compare seasonal cohorts carefully.

### 15.4 Outcome and guardrail measures

Learning outcome: comparable fresh performance, later retention and pattern recurrence. Experience: comprehension of recommendation, task success, confidence calibration and trust. Business: paid conversion, contribution margin and support burden. Guardrails: content error rate, save/submission failures, recommendation invalidity, reminder opt-outs, anxiety-related feedback and unfair comparison reports.

Do not optimize card CTR while correctness declines. A user may click an alarming message more often; that does not justify the message.

# 16. Experiments and user research

### 16.1 First usability questions

Can a student explain why the recommended action appears? Can they identify what the sample count means? Can they start, shorten, decline and inspect the task? Do they understand that a repair is different from a fresh verification? Can they recover after interruption without losing confidence in the result?

Use moderated sessions across first-time, regular and near-exam contexts. Five to eight interviews can expose recurring usability problems, but do not interpret that as statistically representative product validation. Include students on small phones and slower connections.

### 16.2 Proposed experiment backlog

| Experiment | Hypothesis | Primary measure | Guardrail |
| --- | --- | --- | --- |
| Next-action card vs feature dashboard | A clear default reduces decision friction. | Valid repair starts and completed cycles. | Autonomy and wrong-task reports. |
| Evidence rationale vs generic AI language | Specific basis improves calibrated trust. | Rationale comprehension and completion. | Overconfidence from sparse data. |
| Guest practice before signup | Early value improves qualified activation. | Completed starter flow and saved-history conversion. | Guest data loss and cost. |
| Weekly goal vs daily streak emphasis | Bounded goals sustain useful work with less pressure. | Useful weekly returns and delayed checks. | Drop-off, guilt feedback and opt-outs. |
| Small progress acknowledgment | Concise feedback helps continuation. | Repair completion and comprehension. | Latency and distraction. |
| Time-budget control | Fit improves action completion. | Completed valid tasks per recommendation. | Too-small tasks misrepresented as learning. |

### 16.3 Experimental discipline

Predefine hypothesis, primary outcome, exposure rules, randomization unit, runtime, exclusions and stopping rules. Sticky assignment at student level is often sensible; do not switch treatments on every visit. Check logging integrity and sample-ratio mismatch. Account for repeated observations from the same student.

Choose sample size from baseline rates and a meaningful detectable effect with an analyst. Do not invent a universal 'run until 100 users' rule. A learning outcome may require a longer observation window than click-through. An apparent win confined to a one-day novelty spike should not justify permanent rollout.

### 16.4 Negative results and removals

Keep a decision log. If a mechanic improves taps but not completion or learning, simplify or remove it. If evidence copy increases trust but also increases mistaken certainty, change the language. If a card repeatedly lacks reviewed content, improve the content catalog rather than hiding the gap with confident AI text.

# 17. Roadmap and acceptance gates

### 17.1 Sequence

| Phase | Deliverable | Exit evidence |
| --- | --- | --- |
| Foundation | Audit current schema, rules, save reliability, reviewed catalog and event definitions. | Reproducible authoritative result and reliable history. |
| Core loop | Deterministic next move, explanation, repair and fresh verification. | End-to-end fixtures and usable student walkthroughs. |
| Trust and quality | Evidence panel, failure states, correction handling, accessibility and measured performance. | Passing acceptance scenarios and traceable history. |
| Retention | Weekly goals, optional reminders and spaced-review scheduling. | Useful-return evidence and acceptable opt-outs. |
| Growth and polish | Real product proof, optional sharing, contextual motion and carefully scoped community. | Activated growth and learning guardrails. |

Use this ordering instead of promising fixed delivery dates before engineering discovery. Ship behind flags and stage with test users. Existing histories must remain interpretable through version changes.

### 17.2 Must-pass acceptance scenarios

1. A new student receives a labeled diagnostic, never invented history.
2. A single wrong item cannot produce a strong weakness label.
3. Repeated family exposures do not inflate independent sample counts.
4. Assisted practice does not count as unassisted verification.
5. Unanswered items are shown separately and not automatically treated as conceptual errors.
6. Missing/low-quality timing cannot produce a pacing diagnosis.
7. A scored attempt retains the scoring and question-key versions used.
8. An invalidated answer key triggers recomputation and clear changed-result copy.
9. Counts, source references and card rationale agree with the same history revision.
10. A student cannot retrieve another student's card, attempts or evidence links.
11. Concurrent/retried start creates or resumes one authoritative task.
12. Retried submit does not grade or credit the cycle twice.
13. A card always launches an available compatible reviewed bundle.
14. Verification avoids previously exposed item families under the configured policy.
15. A completed repair becomes a due-check state, not automatically 'mastered'.
16. A changed subject filters relevance without deleting earlier progress.
17. Stale or unavailable history uses an honest fallback.
18. AI outage or invalid copy leaves a useful deterministic card.
19. Dismissal does not rewrite history or mark learning complete.
20. Reduced motion, keyboard use, screen readers and large text preserve task access.
21. Notification refusal does not block study.
22. The metric pipeline distinguishes impressions, starts, practice and qualified cycles.
23. Rankings exclude unsuitable comparisons and expose their basis.
24. Pricing and entitlements match current approved configuration.

### 17.3 Verification layers

Unit tests should cover eligibility, score components, confidence gates and copy arithmetic. Integration tests should cover ownership, grading revisions, bundle availability, transactions and idempotency. End-to-end checks should follow guest entry -> saved history -> next move -> repair -> fresh check -> progress. Visual checks should cover key states at small phone, large text and desktop sizes.

Use deterministic fixtures with sparse, contradictory, stale, corrected, duplicate and timing-missing histories. Production rollout should observe invalid recommendations and content error reports. A visually correct card with a broken source link is a failed handoff.

# 18. Agent brief and implementation rules

### 18.1 Copy-ready task brief

Implement MarkMob's 'Your next best move' as an evidence-based learning-action service and a restrained responsive card. Inspect the repository and production-equivalent schema first. Reuse authoritative grading, question versions and student ownership boundaries. Build deterministic eligibility and ranking, then a reviewed content resolver, persistent evidence snapshots, idempotent start, clear card states and the repair-to-verification linkage. Make the service useful without AI. Add optional AI phrasing only after fact validation and deterministic fallback work.

Preserve current brand assets and existing confirmed owner decisions. The supplied UI figures are direction, not production screenshots. All fixture histories are invented. Do not seed those counts as real progress, do not predict exam marks without validation, and do not implement punitive streak loss as a requirement. Instrument meaningful learning cycles and their guardrails. Demonstrate the must-pass scenarios before rollout.

### 18.2 Definition of done

A reviewer can start with a real eligible test-user history, reproduce why the action won, open the source evidence, start an available reviewed repair, finish it without losing work, perform a fresh check, and see accurately qualified progress. The same flow works across web/mobile layouts and supported interruption conditions. A cold-start student gets a truthful diagnostic alternative. Every recommendation has policy and evidence revisions sufficient for debugging.

### 18.3 Deliverables expected from the implementing agent

Return schema mapping, actual files changed, policy configuration, fixture tests, API contract, UI states, event definitions, correction/recomputation behavior and measured validation results. List unresolved product decisions separately from completed work. Never claim deployment, real-user testing, legal approval or learning uplift unless actually performed and evidenced.

### 18.4 Open decisions

Confirm MarkMob versus MockMob, the official logo, current pricing/renewal terms, selected exam year and authoritative exam documents, reviewed topic taxonomy, guest retention behavior, verification scheduling, comparison cohort policy and data retention. Determine whether existing question content has enough fresh item families per priority topic. Set calibrated confidence labels only after evaluating historical and fresh performance.

These decisions do not prevent a staging implementation of the core contracts, but they affect safe and accurate production behavior. Record them explicitly rather than hiding assumptions in code.

# 19. Final product evaluation rubric

| Criterion | A strong release demonstrates | A weak release looks like |
| --- | --- | --- |
| Clarity | Student knows the next task and why it matters. | Many equally prominent features and vague AI language. |
| Accuracy | Counts, scoring, sources and recommendations agree. | Plausible copy unsupported by history. |
| Agency | Student can inspect, adjust, decline and return. | Guilt, locked choices or punishment for a gap. |
| Learning | Repair connects to fresh and later checks. | XP or repeat questions substitute for evidence. |
| Craft | Fast, stable, accessible and restrained interactions. | Animation masks slow or unreliable flows. |
| Retention | Students return for useful progress and support. | Endless reward chasing with unclear benefit. |
| Brand | Repeated product experience matches the promise. | Premium marketing paired with inaccurate results. |
| Business | Clear pricing and sustainable cost per useful cycle. | Hidden terms and unchecked AI consumption. |

Use this rubric during design reviews and release decisions. A strong MarkMob experience combines a credible learning loop, low decision friction, warm feedback and honest proof. The recommendation card is the visible entry point; the underlying content, scoring and evidence system makes the promise real.

# Appendix A. Complete supplied transcript

The text below preserves every source line in the uploaded file. Transcription errors, incomplete sentences, promotional interludes, numerical claims and speaker changes are deliberately retained. Do not interpret this appendix as independently verified research. The companion source file retains the original bytes; PDF line wrapping is purely typographic.

**L001** Tim: There's a reason Duolingo, Revolut, and Fantom all go up. And it's the same hidden edge I found designing for startups and tech giants alike for the last decade. It's called emotional design: the art of making products feel engaging, personal, and alive.

**L002** Tim:  And in this video I'll show you how to use it to build apps people love and keep coming back to. Let's be honest: these days, anyone can build something fast.

**L003** Tim:  We have APIs, no-code tools, AI models—all the ingredients are out there. It's easier than ever to build things and ship features.

**L004** Tim:  Which means just being useful isn't enough anymore. The real edge is in how your product makes people feel when they open it.

**L005** Tim:  Does it feel smooth, delightful, playful, or even premium? Or does it just feel like every other app?

**L006** Tim:  Now, of course, winning products still come from a mix of smart things, like having a solid business model, good timing, maybe even a strong community. The list goes on.

**L007** Tim:  But more and more, the thing that truly separates good from great is design that connects. Design that feels intentional.

**L008** Tim:  Design that turns users into fans. There's this quote from Reed Hastings, Netflix co-founder, and it really nails the point: the product has to be so good people want to talk about it.

**L009** Tim:  And in a world where every product has the same access to tech, that's your long-term edge. Not the code, not the features.

**L010** Tim:  It's how your product leaves people feeling when they close the tab or swipe away. Now, before we dig into one of the best examples of emotional design translating into serious business growth, if you're wondering how this might apply to your product or your business, we open up a couple free design strategy consultations each month at 6 up.

**L011** Tim:  So feel free to sign up in the link down below if that sounds interesting. Now, with that, let's look at Duolingo and how they used the like, feedback, and character motion to pull users in and keep them coming back.

**L012** Tim:  Because Duolingo didn't just create another language learning app. They built a product that responds to you in real time, and in a way that actually feels human.

**L013** Tim:  In 2022, they introduced a full character animation system. This included things like facial reactions, lip syncing with audio, and idle animations that made their characters feel alive, even when you weren't doing anything.

**L014** Tim:  And this wasn't just for show. Duolingo's data shows that after these animations were rolled out, their daily active users more than doubled: from 14.2 million to over 34 million within 2 years.

**L015** Tim:  On top of that, their paid subscribers also more than doubled in that same timeframe. Of course, again, growth like that comes from a mix of smart moves, like adding new languages, improving the curriculum, running solid marketing campaigns, etc.

**L016** Tim:  But what's interesting is that Duolingo's own team has highlighted character animation as one of the major reasons people stay engaged. On several occasions, CEO Louis von Ahn has pointed out that the app's delightful experience, which includes these animations, sets it apart in a space full of dry, functional apps.

**L017** Tim:  And that connection isn't random. These animations aren't just eye candy; they're emotional feedback.

**L018** Tim:  They create loops that keep people engaged. When you answer a question correctly or make a mistake, you don't just get a green checkmark; you feel encouraged, corrected, and even cheered on.

**L019** Tim:  Those quick reactions help boost engagement by triggering emotional feedback loops, something that the UX legend Don Norman talks a lot about in his book "Emotional Design." But how can you use this in your own product?

**L020** Tim:  Well, if your product relies on repeated user behavior—like check-ins, journaling, or habit logging—add micro-interactions that give instant emotional feedback. A subtle bounce, a glow, a sparkle.

**L021** Tim:  These little things can make confirmation moments feel a little more rewarding. Also, celebrate the small wins.

**L022** Tim:  This will reinforce engagement once again. You know, success dates don't need to be huge, but they should feel intentional.

**L023** Tim:  Also, if you're like Duolingo and you have a mascot of some sort, use the mascot to show expressions, to encourage users. Because emotions are contagious.

**L024** Tim:  This can be small nods, smiles, or animated reactions that make the experience feel more human. And lastly, if you want to give the user a feeling of momentum, include nice progress animations.

**L025** Tim:  This can be anything, like using motion to show streaks—just like Duolingo—or showing different levels, showing journals completed, whatever gives a sense of building something over time. The goal here is to make the feedback feel human, not just functional.

**L026** Tim:  Because that kind of emotional layer can quietly build a strong connection between the user and your product. Even something super simple, when done well, can make the experience feel more alive and more worth coming back to.

**L027** Tim:  So Duolingo built habits by using design to make people feel good about using the app. And that feeling is one of the main reasons their users keep showing up.

**L028** Tim:  But what happens when your users aren't trying to form habits, when they instead are trying to get over skepticism? That's one of the big challenges that crypto apps face, and the problem that Fantom set out to solve with the help of emotional design and animation.

**L029** Tim:  Let's start by just dropping the bomb: crypto UX is notoriously clunky. And Fantom knew that.

**L030** Tim:  So when they rolled out a full brand refresh in mid-2023, they didn't just change their logo. They overhauled everything and brought in animation to shift perception.

**L031** Tim:  They animated their ghost mascot, they added playful animations during wallet creation, and they put a bunch of effort into making each interaction feel playful and approachable. The goal was clear here: make crypto feel less scary and more human.

**L032** Tim:  And it's obviously worked. Today, Fantom is one of crypto's most used wallets, recently becoming the second-highest-ranked app in the utilities category in the U.S. app store, beating apps like WhatsApp and Instagram.

**L033** Tim:  Now, just like Duolingo, Fantom's growth rode the wave of market momentum and smart business execution. But what really made them stand out was how design-led they were from the jump.

**L034** Tim:  Their CEO, Brandon Milman, has been super clear about that: this wasn't just another wallet. From day one, the team focused on polish, on craft, and on building something that actually felt good to use.

**L035** Tim:  In his own words, "Polish matters. We're a design-led company that takes time to craft, polish products."

**L036** Tim:  And that mindset paid off. Because while most wallets were built by developers for other developers, Fantom focused on consumers.

**L037** Tim:  Their goal was to onboard the next billion people to Web3, and that meant investing in crisp, emotional UI and animations. So when designing in spaces that feel intimidating, complex, or where the stakes are really high—like finance, crypto, health, or insurance, for example—remember these principles.

**L038** Tim:  Polish builds trust. Treat visual details, motion, and transitions as core product features, not fluff.

**L039** Tim:  Every little micro-interaction is a trust signal. Also, try to keep it approachable.

**L040** Tim:  Friendly visuals and warm, playful details make heavy topics feel a little lighter, and that goes a long way in building confidence. Build for people, not just pros.

**L041** Tim:  Don't just assume that users know the rules. Design flows that make sense to everyday people, especially if you're reaching beyond early adopters.

**L042** Tim:  Performance matters, but what really sticks is how the product feels when someone taps, swipes, or waits. Giving the users smooth feedback is going to increase their confidence with your product.

**L043** Tim:  As an agency that has experience helping drive big design results in the crypto industry, we tried to share some of our learnings by writing case studies about our wins every now and then. If you're interested in that, there's a link below for that too.

**L044** Tim:  Now we've seen how character and delight create trust. But trust isn't the end goal for everyone.

**L045** Tim:  So let's explore how emotional design and motion can be used in an even more lucrative way: to sell luxury. Which brings us to Revolut.

**L046** Tim:  Revolut's been investing in design and animation for years, but what's super interesting is how their design glow up has tracked right alongside their push into more of the premium space. As they've moved up market, their visual language has gotten way more polished, and it's pretty clear that they've been intentional about this: aligning how the product feels with where they want the business to go.

**L047** Tim:  Take the first-time user experience as an example. They don't just drop you into a boring signup flow.

**L048** Tim:  Instead, you get rich visuals, super smooth transitions, and right away it feels like you're stepping into something premium. I mean, even their charts leveled up.

**L049** Tim:  You don't just look at your spending data; you feel it. You drag your finger and the graph responds with a soft glow, turning numbers into something way more tactile.

**L050** Tim:  The same thing with their cards. You don't just see a static image; you get a full, full 3D moment there.

**L051** Tim:  The card flips, rotates, catches light. It's clean, it's intentional, and it's honestly just kind of satisfying.

**L052** Tim:  And these little details, like subtle animations in security flows or onboarding, provide that sense of trust without trying too hard. None of these design details shout at you, but together they create something way more premium.

**L053** Tim:  And in fintech in particular, where trust literally affects how much users spend, that kind of polish translates straight into revenue. So here's the big takeaway: nail the first impression.

**L054** Tim:  Spend time to polish your onboarding, polish your welcome moments, to immediately communicate quality, trust, and care. Add subtle moments of delight—like animations, like fades, and hover effects, or gestures.

**L055** Tim:  Build that emotion and make touchpoints feel intentional. Make interactions feel dynamic.

**L056** Tim:  So tactile charts, responsive feedback, or animated cards that just turn basic features into something that feels elevated and engaging. Now, if you found this video helpful at all, you'll probably love the video here somewhere.

**L057** Tim:  Also, if you're building a product, a website, or a brand, and you want to find out how to boost your sales, there's an app that seats you at dinner with 5 strangers. You don't pick them or the restaurant.

**L058** Tim:  About 2 years in, it was on track for $16 million a year. The one by betting against what every app for meeting people assumed.

**L059** Tim:  I call that the hidden assumption. And if your product's already working, betting against yours is one of the moves that big apps in your space can't easily copy.

**L060** Tim:  So in this video, I'm going to show you how to spot your category's hidden assumption and build the opposite, using 3 companies that did it. And the last one goes straight at how the leaders make their money.

**L061** Tim:  I'm Tim, by the way. I have spent over a decade designing software for companies like Spotify.

**L062** Tim:  So why some apps break away from their category is honestly what I think about all day. Now, lots of categories run on a belief about the user that never really gets said out loud, and the leader usually built its whole business on it.

**L063** Tim:  So when a newer company builds the opposite, the leader usually can't copy it without risking the product that pays its bills. And the clearest example starts at a dinner table with 5 strangers.

**L064** Tim:  That dinner app is TimeLeft, an app for meeting new people. And that whole space assumed you wanted to look someone up first: profiles, bios, photos, swiping.

**L065** Tim:  TimeLeft built the opposite. Its homepage said it in 6 words.

**L066** Tim:  No bios. No swiping.

**L067** Tim:  No planning. You took a personality quiz, got matched with a group, and only learned the restaurant just before dinner.

**L068** Tim:  All you had to do was just show up. The founder put it like this: you're not going to choose the people.

**L069** Tim:  You're not going to choose the place. And by August 2025, TimeLeft was bringing together about 120,000 people a month.

**L070** Tim:  Now, look at how Bumble followed. In June 2026, Bumble launched a separate app for group meetups called Plants.

**L071** Tim:  And in August, it said its move away from the swipe would happen gradually, so it wouldn't disrupt the ecosystem. Think about it: swiping is how its main app works, and it still built a whole second app to drive the opposite.

**L072** Tim:  TimeLeft flipped what users want to do. Speak flipped how much effort they're willing to put in, and it made a lot more money.

**L073** Tim:  Speak is a language app. In a category mostly built around a quick game you tap through, its CEO, Connor Swick, called those language games ways to feel less bad about using your phone when you're bored.

**L074** Tim:  So Speak built its lessons around saying things out loud. And when fun and results pulled apart, he said, "We will pick efficacy 100% of the time."

**L075** Tim:  And in November 2025, Speak announced more than $100 million in annualized revenue. Now, that's really hard for the game-style app to copy.

**L076** Tim:  They can add speaking, and some have. But putting talking first would ask way more of their users than the game they signed up for.

**L077** Tim:  The first two changed how people used the app. The last one changed what they have to buy, which hits the leaders right where they make their money.

**L078** Tim:  Devil is a health tracking app. In a category that assumed serious tracking meant buying a ring or a band, plus a membership, Devil built the opposite: software only, running on the watch you already wear.

**L079** Tim:  Co-founder Aditya Agarwal said, "A $500 ring or band is out of reach for a lot of people." And by October 2025, Devil said it had grown more than 8 times in a year, and it had just raised a Series A from General Catalyst.

**L080** Tim:  Now, here's why it's hard for the leaders to follow. For ring and band makers, the device is a big part of the business.

**L081** Tim:  So telling you to just use the watch you already own means telling you to skip what they sell. So that's the hidden assumption.

**L082** Tim:  And the one worth betting against is usually the one the leader in your category makes its money from, because that's the one it can't afford to drop. This week, write down what the big apps in your category all assume about the user, and circle the one their business depends on.

**L083** Tim:  That's what I listen for with clients. Postdocs.ai and AI grant-writing tools was built as if you wanted the full draft at once.

**L084** Tim:  You'd write a paragraph, and in their founder's words, boom, you got 20 pages. So we helped them shape a plan step that made that surprise after a generation much smaller.

**L085** Tim:  Now, if you want to talk through your category's hidden assumption with me one-on-one, I do free design strategy calls every month at my agency's 6 up. Links down below.

**L086** Tim:  And if you like this video, you'll probably enjoy this video where I break down the invisible scoreboard. I've studied hundreds of gamification implementations for mobile apps, and here's the thing: the 3 elements every app adds first—like points, badges, and leaderboards—are also the 3 most documented failures in product history.

**L087** Tim:  Meanwhile, Strava built 180 million users without a traditional badge in sight. An Apple Watch drove a 49.5% behavior change in 160,000 people purely through completion drive.

**L088** Tim:  The Apple one is kind of wild, and we'll come back to it, because how they did it is probably the most important point out of all of the 7 research-backed patterns I'm going to cover in this video. You're going to see what kind of gamification actually works, what's theater, and the specific mechanics the best retaining apps in the world are actually using.

**L089** Tim:  By the way, I'm Tim. I've spent over a decade designing software for companies like Spotify, and I've helped clients reach the top of the U.S. app store working on exactly these kinds of problems.

**L090** Tim:  Now, pattern 1 is what I call the PBL fallacy. PBL stands for Points, Badges, and Leaderboards.

**L091** Tim:  The 3 mechanics every app reaches for first. And the reason this leads to the video is because of what happened in 2024.

**L092** Tim:  LinkedIn quietly retired its community top-voice gold badges. Their internal read was that badge-motivated users had been producing quantity over quality, chasing the badge instead of sharing expertise.

**L093** Tim:  And this isn't new; it's actually history repeating. Foursquare scrapped mayorships and badges in 2014 after their data showed gamification drove check-ins but not the discovery behavior the business actually needed.

**L094** Tim:  Google News killed its badge system for the same exact reason. The gamification OG, Yukai Chou, put it best: "PBL is the scoreboard of a game, not the game itself."

**L095** Tim:  You want to walk into a baseball stadium, look at the scoreboard, and feel motivated to play baseball, right? Most apps, though, build the scoreboard and forget to build the game.

**L096** Tim:  So let's look at the counterexample: Strava. 180 million registered users, and the engagement number that genuinely shocked me. Strava users average 1 hour of real-world activity for every 2 minutes spent in the app.

**L097** Tim:  That's not a retention network; that's more like an influence network. The mechanism doing most of the work is segments.

**L098** Tim:  A segment is any user-defined stretch of road or trail. Run it, and your time gets logged on a leaderboard sorted by age and gender cohort.

**L099** Tim:  Now, that sounds like a leaderboard, which I just told you is kind of broken. But here's the difference: Strava didn't build one global leaderboard.

**L100** Tim:  They built thousands of hyper-local micro-competitions. The hill on your morning route.

**L101** Tim:  The segment outside your office. These competitions are winnable, and winnability is the strongest predictor of competitive motivation.

**L102** Tim:  A 2022 Science Direct study confirmed this. Kudos on Strava.

**L103** Tim:  The small social acknowledgment when someone completes a run increased future run frequency. And the social side has compounded fast.

**L104** Tim:  Strava's clubs grew 59% in 2024 alone, and the platform handed out 14 billion kudos in 2025. Strava's lesson for founders is direct: enable users to compete more locally.

**L105** Tim:  Engineer the size of the competition rather than inflating empty metrics. And before we keep going here, if you want to chat about how any of these patterns would apply to your app, we open up a few free design strategy calls monthly at 6 up.

**L106** Tim:  You can grab your spot in the link below. Now, so far this might suggest the answer is just to add the right kinds of mechanics.

**L107** Tim:  More features, but smarter ones. That's where pattern 3 comes in, and it's the most counterintuitive of the 7: the S-curve problem.

**L108** Tim:  A 2025 peer-reviewed study in Frontiers in Psychology found that gamification feature richness follows an S-shaped curve. Adding features helps engagement up to a point.

**L109** Tim:  After that point, more features actually reverse engagement. The empirical proof here is Habitica, probably the most aggressively gamified productivity app ever built.

**L110** Tim:  Daily tasks become quests. Habits become character stats.

**L111** Tim:  Missing a task damages your HP. The peer-reviewed study on Habitica found that 100% of participants experienced counterproductive effects.

**L112** Tim:  Users got so absorbed in managing the game layer that actual productivity behavior got buried. This is cognitive overload disguised as engagement.

**L113** Tim:  If you're stacking streaks plus points plus badges, pattern 4 is the streak trap. Research from the Decision Lab found that streaks gradually shift from motivational to obligational the longer they run.

**L114** Tim:  Users move from "I want to do this" to "I can't miss today." The canonical case here is Snapchat.

**L115** Tim:  A 2023 Belgium study of almost 2,500 adolescents found that streak frequency correlates with FOMO, problematic smartphone use, and reduced social media self-control. In 2024, the Nevada Attorney General filed litigation against Snapchat, and the EU Digital Fairness Act, heading toward a legislative proposal in late 2026, is specifically aiming at addictive streak mechanics.

**L116** Tim:  So if you're shipping a streak in 2026, know this: the longer it runs, the more it shifts toward obligation. And you're shipping into space that's now being monitored by regulators.

**L117** Tim:  That doesn't mean streaks are universally bad, of course. Duolingo has run hundreds and hundreds of experiments on theirs, and the version they ship today obviously retains users.

**L118** Tim:  But notice how they ship it. Users choose their goal level.

**L119** Tim:  They can buy a streak freeze. The mechanic is wrapped in agency.

**L120** Tim:  A streak you can't pause, can't influence, and can't escape is the design researchers are currently flagging. Okay, so if streaks burn out at day 31, what works instead?

**L121** Tim:  Pattern 5 is variable reward magnitude. Anticipation, not loss aversion.

**L122** Tim:  The gap between knowing a reward is coming and not knowing how big it is. That's one of the strongest engagement signals in all of product design.

**L123** Tim:  Take the example of Game Blazers. A fantasy car game where the pack-opening flow is the heart of the product.

**L124** Tim:  The product has 3 stages: anticipation—you tap a pack, no idea what's inside, could be junk, could be the rare you've been chasing for weeks; reveal—cards flip one at a time. Each card resets the anticipation cycle.

**L125** Tim:  Same data, but one. Game Blazers app at 6 up.

**L126** Tim:  And we do this for a lot of clients, including Free. Apple Watch thing I told you was possibly the most important part of this entire video.

**L127** Tim:  Here's what they actually did: they built the entire system around one principle, completion drive. And that's how they got 49.5% behavior change in 160,000 people.

**L128** Tim:  The activity ring system is possibly the most underrated gamification design pattern in consumer tech. They got 3 rings: move, exercise, stand.

**L129** Tim:  Close all 3 to complete your day. The system runs on one principle from cognitive psychology: the Gestalt principle of closure.

**L130** Tim:  The brain is hardwired to perceive incomplete patterns as demanding completion. A 90% filled circle creates an open loop, and the brain wants to close it.

**L131** Tim:  Users who regularly close rings are 48% less likely to experience poor sleep quality. This is exactly what great gamification design is all about.

**L132** Tim:  The mechanic produces real-world positive outcomes, not engagement theater. And here's the part most founders miss: Apple's rings work because they make you want to finish what you started.

**L133** Tim:  Anticipation toward closure. That's the engine.

**L134** Tim:  If you can choose which lever your app runs on, completion drive is a strong alternative. Pattern 7.

**L135** Tim:  The 2024 Springer Nature meta-analysis on gamification found something brutal. Gamification reliably improves a user's perception of autonomy and relatedness, but has minimal impact on competence—the one psychological need most tied to long-term intrinsic motivation.

**L136** Tim:  Most apps engineer recognition and forget to engineer mastery. Peloton is the cleanest counterexample of this.

**L137** Tim:  Members who use the social and output features work out 15% more frequently. But the mechanism isn't competition; it's competence feedback.

**L138** Tim:  Output is measured in real time. Personal records get auto-flagged.

**L139** Tim:  The 100 ride badge means something because it represents 100 actual rides. That's not theater; that's evidence of skill development.

**L140** Tim:  Chess.com runs the same play with ELO ratings. Garmin's training readiness and body battery scores do it in fitness wearables.

**L141** Tim:  Build mechanics that signal you got better at the actual thing, not mechanics that signal you opened the app a lot. Now, if you found this breakdown helpful at all and you're wondering how this might apply, everyone thinks Duolingo is the gold standard of gamification.

**L142** Tim:  But there are apps that took the same ingredients and assembled them into something that users genuinely cannot stop using. Not because the content is great, but because the architecture is doing something to their brain they don't even realize.

**L143** Tim:  And in this video, I'm going to break down the 3 specific psychological mechanisms driving it. One that creates an itch users can't scratch.

**L144** Tim:  Let's start with the first one, something I call the craving machine. In the 1930s, B.F.

**L145** Tim:  Skinner put animals in boxes and gave them food pellets on unpredictable schedules. Sometimes pressing the lever gave food.

**L146** Tim:  Sometimes 10 presses got nothing. Sometimes 1 press gave a jackpot.

**L147** Tim:  What he discovered was that this unpredictable reward schedule produced the most compulsive behavior of any reinforcement pattern. The animals couldn't stop.

**L148** Tim:  Not because they were hungry, because they were craving. And here's the key: this is not pleasure, this is craving.

**L149** Tim:  Variable ratio reinforcement doesn't make you happy. It keeps your brain in a constant chase for the next hit.

**L150** Tim:  The same mechanism behind slot machines: activating dopamine pathways nearly identical to gambling. Duolingo uses a version of this.

**L151** Tim:  XP after each lesson. It's predictable.

**L152** Tim:  It's nice. But let's take a look at an app called Finch.

**L153** Tim:  Over 14 million downloads. 675,000 ratings at 4.9 stars on iOS. Apple's editor's choice.

**L154** Tim:  It sounds insanely wholesome, right? So this is how it works: you raise a virtual bird by completing real-life self-care tasks.

**L155** Tim:  Journaling. Breathing exercises.

**L156** Tim:  Mood check-ins. Your little bird grows up, you're building healthy habits.

**L157** Tim:  What could possibly be manipulative about that? Here's Finch enters craving machine territory.

**L158** Tim:  You pick a location for your bird from a rotating set of destinations. 3 options for free users, 9 for paid. You commit, and then your bird adventures into that location every day, potentially for weeks.

**L159** Tim:  Each location has 15 to 20 unique discoveries your bird might bring back. Some days your bird finds something amazing.

**L160** Tim:  Other days nothing special. You can't predict.

**L161** Tim:  Keep you near a 50% win rate. Players experience it as "Some games I crush."

**L162** Tim:  Some games my teammates are terrible. But the algorithm is controlling the ratio.

**L163** Tim:  You climb 100 points one week. In that system, add an element of surprise.

**L164** Tim:  A bonus reward they didn't expect. A milestone that comes early.

**L165** Tim:  The best systems are mostly trackable with. But there's a second mechanism that prevents them from ever walking away.

**L166** Tim:  Something I call the infinite game. Have you ever been on day 47 of a streak and felt genuine anxiety about breaking it?

**L167** Tim:  Not because the streak really matters; it objectively doesn't. But the thought of losing 47 days of progress physically hurts.

**L168** Tim:  That's loss aversion. Humans feel the pain of losing something roughly twice as intensely as the pleasure of gaining the equivalent.

**L169** Tim:  And the smartest apps have turned this into an architecture. Duolingo uses streaks, but a Duolingo streak is a single thread.

**L170** Tim:  Break it, lose or count. The streak freeze is smart, but it's still fundamentally one counter.

**L171** Tim:  One number. At 6 up, we designed a diamond streak system for a client FreeCash that takes this a step further.

**L172** Tim:  Streaks don't just count; they unlock diamonds. Hit 7 days, first diamond.

**L173** Tim:  Hit 42 days, a new one. Miss a day, and you risk losing the diamonds you accumulate.

**L174** Tim:  The freeze has to be earned. The diamond path isn't infinite, but it's much longer than a weekly reset.

**L175** Tim:  And each milestone feels like something you genuinely earned and don't want to give up. This connects to a deeper principle: the refusal to create terminal achievement states.

**L176** Tim:  The most addictive apps never let you finish. League of Legends resets its rank ladder every season. 5 hours climbing to platinum, then you drop back down to gold when the season flips.

**L177** Tim:  There is no winning in these systems. But the third mechanism makes these systems truly unescapable.

**L178** Tim:  This one I call the invisible scoreboard. As humans, we have a deep instinct to compare ourselves to other people.

**L179** Tim:  Someone checks their fitness tracker, not for their own steps, but to see how they stack up against a friend. That's social comparison theory.

**L180** Tim:  And the most addictive apps don't just enable it; they build their entire experience around it. Strava has over 180 million registered athletes competing on segments.

**L181** Tim:  Specific routes rank by fastest time. The leaderboard is so powerful that in 2025 and early 2026, Strava had to delete 3.9 million activities because users were gaming the system.

**L182** Tim:  People were uploading e-bike rides as regular bike rides just to climb the rankings. We're talking about

**L183** Speaker 2: We're doing a bike rides just to climb the rankings. We're talking about no prize money, no sponsorship, no financial reward whatsoever.

**L184** Speaker 2:  Users were willing to manipulate the results over a position on a leaderboard that gives them nothing but bragging rights. That tells you everything about the force of social comparison.

**L185** Speaker 2:  Now, Palatin takes this further with parasocial relationships. Instructors like Koda Rigsby and Ali Love have become celebrities.

**L186** Speaker 2:  Users attend classes to see their instructor. They even follow the instructor's life updates.

**L187** Speaker 2:  This emotional bond transforms Palatin from a fitness tool into a social community. And here's the insight: in an age where AI can replicate almost infinite game streak and nobody knows, but the moment their progression is visible on a leaderboard, the moment their diamond tier is a status symbol, others can see.

**L188** Speaker 2:  Quitting stops being about losing progress. It becomes about publicly admitting you stopped.

**L189** Speaker 2:  The social layer turns engagement into identity. And identity is the one thing people never voluntarily walk away from.

**L190** Speaker 2:  This is what founders should care about more than anything else in their return. It transforms personal goals into status goals.

**L191** Speaker 2:  Two, build community dynamics. Not just features.

**L192** Speaker 2:  Palatin proves human connection amplifies gamification in ways that mechanics alone can't match. Three, design your metrics as a mirror, not just a report.

**L193** Speaker 2:  When users see their stats, they should immediately think about how they compare to other people. Now, the TL;DR for any founder watching this: we talked about three things.

**L194** Speaker 2:  The craving machine. Unpredictable rewards that keep users chasing.

**L195** Speaker 2:  Not a vending machine, but a system where the next hit could come on the very next action or 10 actions from now. The infinite game.

**L196** Speaker 2:  Loss aversion and the refusal to let users finish. Streaks that compound into something worth keeping.

**L197** Speaker 2:  A product that never says you're done. And lastly, the invisible scoreboard.

**L198** Speaker 2:  Social comparison that turns engagement into a status game. And locks the other two mechanisms in place permanently.

**L199** Speaker 2:  One core truth. It's not what these apps reward.

**L200** Speaker 2:  It's how they structure the reward. The difference between a Duolingo streak and a full progression addiction system is the difference between decoration and architecture.

**L201** Speaker 2:  Now, if you found this breakdown useful and you're thinking about how to apply these principles for your own app, or last time we.

# Appendix B. Transcript coverage map

| Lines | Source material | Treatment in this reference |
| --- | --- | --- |
| L001-L010 | Emotional design, usefulness, business factors, word of mouth and promotional transition. | Sections 1-3, 8; promotion preserved in Appendix A. |
| L011-L025 | Duolingo characters, growth claims, emotional feedback, micro-interactions, wins and momentum. | Sections 2-3, 6-7; causal growth caveat and verified animation sources. |
| L026-L038 | Fantom/Phantom, ghost refresh, polish, approachability and consumer trust. | Sections 3, 5-6, 14; name normalization separate from raw source. |
| L039-L051 | Revolut, first impression, premium visuals, tactile charts and subtle motion. | Sections 3, 5-6, 8; revenue claims kept unverified. |
| L052-L079 | Hidden assumptions, Timeleft, Bumble, Speak, Devil/Bevel and grant-tool example. | Sections 2-3, 8, 18; simplified planning and outcome-first strategy. |
| L080-L098 | PBL failures, Strava segments, achievable competition, kudos and agency promotion. | Sections 3, 7, 15-16; fair comparison and integrity requirements. |
| L099-L113 | Feature richness, Habitica, streaks, Snapchat, legal claims and Duolingo agency. | Sections 3, 7, 14, 16; scoped studies and current-law verification requirement. |
| L114-L135 | Variable magnitude, pack reveals, Apple rings, closure, competence and personal records. | Sections 3, 6-7, 13, 15; corrected Apple figure and mastery distinction. |
| L136-L160 | Craving, Skinner, variable ratios, Finch, matchmaking assertions and surprise. | Section 3; distinguish mechanisms, flag unsupported neuroscience and algorithms. |
| L161-L178 | Loss aversion, FreeCash diamonds, endless progression and social comparison. | Sections 3, 7; bounded completion and preserved learning. |
| L179-L201 | Strava manipulation, Peloton, parasocial bonds, identity, community and recap. | Sections 3, 7-8, 15; optional sharing, integrity and real support. |

This index is thematic. Every line remains available in Appendix A even when the analytical treatment rejects or qualifies its claim. The source supplied no original video URLs or timecodes, so the range labels are source-file line numbers.

# Appendix C. Source register and claim audit

### C.1 Verified research and official references

Accessed 11 October 2026. Dates below refer to publication or reporting periods when stated. Source descriptions are deliberately concise and do not imply claims beyond their scope.

| ID | Reference and link | Supports / limitation |
| --- | --- | --- |
| S01 | Duolingo, How a cast of characters can help you learn a language, 10 Nov 2020. https://blog.duolingo.com/building-character/ | Character feedback and design intent; not causal business uplift. |
| S02 | Duolingo, How Duolingo animates its world characters, 10 Nov 2022. https://blog.duolingo.com/world-character-visemes/ | Idle behavior, voice and lip-sync animation system. |
| S03 | Duolingo shareholder letters, Q4 FY2024 and Q4 FY2025, filed with SEC. https://www.sec.gov/Archives/edgar/data/1562088/000156208825000039/q4fy24duolingo12-31x24shar.htm ; https://www.sec.gov/Archives/edgar/data/1562088/000162828026012246/q4fy25duolingo12-31x25shar.htm | Period-specific DAU totals, not attribution to animation. |
| S04 | Phantom, Introducing Phantom's new brand identity, 21 Jun 2023. https://phantom.com/learn/blog/introducing-phantom-s-new-brand-identity | Official friendly-brand refresh and ghost direction. |
| S05 | Timeleft official website. https://timeleft.com/ | Service handles venue, group and time; not verified revenue. |
| S06 | Speak official website. https://www.speak.com/ | Speaking-focused Learn / Practice / Apply positioning; not revenue causality. |
| S07 | Dunlosky et al., Improving Students' Learning With Effective Learning Techniques, 2013. https://doi.org/10.1177/1529100612453266 ; https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html/comment-page-1 | Review supporting practice testing and distributed practice; no exact MarkMob schedule. |
| S08 | Sun et al., Is more always better? An S-shaped impact of gamification feature richness, Frontiers in Psychology, 2025. https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1671543/full | Context-specific feature-richness and intention findings; not universal optimum. |
| S09 | Apple research, A Large-Scale Observational Study of the Causal Effects of a Behavioral Nudge. https://machinelearning.apple.com/research/large-scale-observational ; https://openreview.net/forum?id=4NocV3GQRG9 | Stand reminders, over 160,000 subjects, standing probability increase up to 49.5%; not rings effect. |
| S10 | Li et al., Gamification enhances student intrinsic motivation, perceptions of autonomy and relatedness, but minimal impact on competency, 2024. https://link.springer.com/article/10.1007/s11423-023-10337-7 | Meta-analysis and systematic review; average effects with contextual limits. |
| S11 | Diefenbach and Müssig, Counterproductive effects of gamification: An analysis on the example of the gamified task manager Habitica, 2019. https://www.sciencedirect.com/science/article/pii/S1071581918305135 ; https://epub.ub.uni-muenchen.de/77668/ | Counterproductive effects in studied Habitica samples; not all users everywhere. |
| S12 | Google, Web Vitals, updated 31 Oct 2024. https://web.dev/articles/vitals | LCP, INP and CLS thresholds and 75th-percentile field evaluation. |
| S13 | Revolut official news and product context. https://www.revolut.com/news/ | Company context only; does not establish motion-caused premium revenue. |
| S14 | Bevel official website. https://www.bevel.health/ | Product identity/context; transcript growth and funding not verified here. |
| S15 | W3C, Understanding SC 2.5.8 Target Size (Minimum). https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html | WCAG target-size rule and exceptions; larger controls are a proposed design choice. |

### C.2 Claims retained but not promoted as facts

| Transcript claim or issue | Status and handling |
| --- | --- |
| Duolingo animation made DAUs double from 14.2M to over 34M. | Official totals and animation work checked separately. Causal attribution is not established. |
| Phantom ranked second in utilities, beating WhatsApp/Instagram. | Ranking, date and category basis unverified; exclude from decision evidence. |
| Timeleft $16M annual trajectory / 120,000 participants monthly. | Not verified here. Service mechanism is the supported lesson. |
| Bumble launched 'Plants' in June 2026 and gradual swipe transition in August. | Name/date/product claims unverified; not an implementation premise. |
| Speak $100M annualized revenue and founder quotation. | Not verified here; speaking-first method supported by official site. |
| 'Devil' 8x growth and General Catalyst Series A. | Likely Bevel transcription; growth/funding unverified. |
| LinkedIn, Foursquare and Google News all failed for the same exact PBL reason. | Overgeneralized causal narrative; use as hypotheses, not established equivalence. |
| Strava 180M users, 1 hour activity per 2 minutes app use, clubs +59%, 14B kudos, 3.9M deletions. | Numerical claims and reporting periods not independently established in this pass. |
| 2022 ScienceDirect study proves winnability is the strongest predictor. | Specific study not identified from the supplied description. |
| All Habitica users experience harm. | Study participants are not all users. Scoped correction included [S11]. |
| EU proposal timing, Nevada Snapchat litigation and Belgian adolescent study. | Current legal/status details not verified. Do not implement legal conclusions from transcript. |
| Apple rings caused 49.5% behavior change. | Corrected: stand-reminder standing-probability estimate, up to 49.5% [S09]. |
| Closing rings makes poor sleep 48% less likely. | Source and causality not verified here; exclude from product ROI claims. |
| Peloton social/output users work out 15% more frequently. | Selection effects and specific source unverified. |
| Finch download/rating figures and discovery mechanics. | Current totals and detailed product mechanics unverified. |
| Matchmaking secretly controls a 50% win ratio. | Not demonstrated by the source; do not repeat as algorithm fact. |
| Variable rewards use dopamine pathways nearly identical to gambling. | Neuroscience equivalence not established here. |
| Losses feel exactly twice as bad; identity is never voluntarily abandoned. | Context-dependent behavioral generalization, not universal law. |
| FreeCash diamond loss and freeze mechanics. | Agency anecdote; no requirement to reproduce coercive progression. |
| Earlier Duolingo retention figure of 84%. | Recovered context without definition/source; do not benchmark MarkMob against it. |

### C.3 Decisions vs evidence

The design tokens, five-question guest entry, ranking weights, sample gates, review windows, time budgets, event definitions, API routes and roadmap are proposed specifications. Their specificity makes them reviewable; it does not make them empirically proven. Replace or calibrate them with actual repository constraints, reviewed content and measured user outcomes.

# Appendix D. Knowledge-base indexing guide

Suggested document tags: MarkMob, MockMob, CUET, product strategy, UX, emotional design, gamification, retention, brand, next best move, recommendation engine, mock history, question quality, fresh verification, analytics, agent handoff.

Chunk by section and subsection, keeping a table with its introductory meaning and preserving source IDs. Separate raw transcript chunks from specification chunks so a quoted video assertion is not retrieved as a production requirement. Attach metadata: version=1.0; authored_date=2026-10-11; evidence_type=verified_source/transcript_claim/proposal/fixture/historical_context; relevant_section; source_id where applicable.

Prefer the Markdown companion for retrieval. Keep the PDF for visual review. Preserve this document's uncertainty labels in summaries. When citing an algorithm or threshold, retrieve its associated caveat and version. Keep fixtures out of any real-user progress database.

Suggested agent instruction: 'Use this reference for product intent and proposed acceptance criteria. Inspect current code and configuration before implementation. Treat source claims, proposals and illustrative histories as distinct. Show evidence for actual changes and validation. Do not claim guaranteed learning uplift, admission outcomes or exact historical completeness.'


Source preservation checksum (SHA-256): `f08f2017539b4fd6e2543b0f01c6856ad70df850ac7ab3041ee696b8f1417076`. Original source: 201 lines, 31954 bytes.
