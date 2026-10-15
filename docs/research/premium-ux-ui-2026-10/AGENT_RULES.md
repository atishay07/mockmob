# AI Design Agent Rules — Evidence-Qualified

These are our independent, product-oriented **recommendations [I]**, informed by the linked papers; they are **not direct orders from the video creators**. If an implementation rule conflicts with product requirements, actual data, WCAG, privacy, or law, the stricter real requirement wins.

## Source use / no hallucination (P0)

1. Before designing, identify the intended user, user task, actual data, current screen state and success criterion.
2. Match design suggestions to the relevant video paper. Cite evidence IDs (e.g., T003) in design notes rather than attributing them vaguely to 'best practices'.
3. Never say a creator recommended an option unless the timestamped transcript explicitly supports it. Never call a marketing video description an actual transcript.
4. Never say a sample screenshot is from a video unless it was extracted from the actual video with a verifiable timestamp.
5. Never invent usability-test results, A/B-test winners, conversion percentages, Figma files, brand approvals, pricing discounts, testimonials, or real usage metrics.
6. Treat a narrator's behavioral-science number as a **claim**, not independently established evidence. Independent evaluation is required before citing it as science.

## Information architecture / hierarchy (P0)

7. Choose ONE clear main action for a task-oriented screen; multiple equal calls to action need a documented reason.
8. Rank content by what helps the user decide next, not by back-end entity or ease of development.
9. Make essential data scan-friendly: value before label where appropriate, clear units, meaningful status and dates.
10. Progressive disclosure is appropriate for *secondary* functions; do not hide frequent/important controls just to look minimalist (S014).
11. Preserve navigation consistency, accessible labels and selected state (S016).
12. Prefer simple vertical content rhythm for dense consumer mobile screens; use a grid only when simultaneous comparison is useful.

## Onboarding / forms (P0)

13. Use visible editable defaults only when backed by real context or reasonable safe assumptions (T001, S015).
14. Never preselect consent, paid upgrades, data sharing or privacy-sensitive opt-ins just to increase conversion.
15. Let users experience some meaningful product value before an account wall when privacy and abuse prevention allow (T003).
16. Persist user-entered work through authentication wherever possible; do not engineer artificial sunk-cost pressure (T004).
17. Make progress truthful; never count steps a person has not completed (T002, S015).
18. Clarify what happens next (count, time, task) when accurate; use generic language when dynamic facts are unknown.

## Trust / commercial patterns (P0)

19. Present real fees and renewal terms clearly; never compare monthly and one-time amounts as if equivalent (T006).
20. If offering trials, state end date/period, reminder arrangements (only if real), price and cancellation path (T007).
21. Avoid invented crossed-out prices, discount badges, availability or urgency (T009).
22. Do not implement shame-based dismissal, fabricated countdown, coercive loss prompts or false data deletion (T005).
23. If a price is variable, say 'estimate/range' rather than presenting an unbacked fixed quote (T008).
24. Any claims of 'AI mentor' and 'personalization' must correspond to actually functioning system logic and known limits.

## Premium execution / visual systems (P1)

25. Start from content hierarchy and task logic, then specify typography roles, spacing scale and surfaces.
26. Use distinct product art direction; refuse generic gradient/glass/dashboard defaults unless the design brief actually requires them.
27. Prioritize actual screen or product preview over unrelated illustrations when proving utility (T007, T009).
28. Apply whitespace to separate concepts, not arbitrarily enlarge everything.
29. Use numerals with units and understandable comparison context; dates need locale and actual timezone when relevant.
30. Define component variants, density behavior, selected state, hover/focus, touch targets, loading and error states.
31. Motion needs a purpose (state change, continuity, feedback), with reduced-motion behavior and no essential information conveyed solely by animation.
32. Keep the essential action available on mobile but confirm a sticky CTA does not conceal content, keyboard, or assistive UI.
33. Cards should group meaningful items; do not create cards for every label purely to fill space.

## Implementation and evaluation (P0)

34. Verify working behavior against the design on actual small and large viewports.
35. Test empty, error, timeout, retry, partial, no-data and permission-denied states.
36. Test keyboard-only behavior, screen reader semantics, focus order, visible focus, text zoom, contrast and reduced motion; use WCAG 2.2 as baseline (S016).
37. Define test metrics **and guardrails** before choosing an allegedly high-conversion pattern.
38. Never mark a UX hypothesis as proven because an agent/creator says it 'feels premium'.
39. Include an explicit `DESIGN_DECISIONS.md` in a feature PR with user task, screen alternatives, reason, evidence IDs, tradeoffs, unresolved assumptions, screenshot comparisons and verification notes.
40. Run an anti-slop rubric review; do not ship solely based on pixel polish.

## Product-specific overlays [I]

### MockMob

- Every recommendation ('next best move') should explain the supporting history, confidence, and actionable subject/problem; if insufficient data, state that clearly and suggest the first diagnostic action.
- Give a free/guest test a truthful small experience before signup, where feasible; map guest progress to login.
- During exams, avoid distracting upsells; protect timer, answer persistence, network reconnection and submitted-state clarity.
- Explain AI uncertainty and credit/quota costs before irreversible model calls.
- Use real exam results rather than fake score dashboards to impress prospects.

### Circuit

- Separate Today (urgent/relevant), Discover (broader), People, Listings, Communities, Inbox and Profile by task and state; do not surface them as a noisy equal-weight mosaic.
- Verified identity and anonymous content require especially transparent permission and privacy affordances.
- Show campus-specific information and real event data; a polished empty state is better than fake activity.
- Favor list scanning on mobile, distinguish immediate action from exploration and expose location/time with clear context.

## PR review questions

1. What user decision does the page help with?
2. What do you remove without reducing useful information?
3. What does the primary action do *exactly*?
4. Which specific evidence IDs or user observations justify non-obvious choices?
5. What could mislead users here (progress, price, data, personalization, urgency)?
6. How does the screen behave in loading/error/no-data/permission/slow-device states?
7. How will we know whether the design is better rather than merely different?
