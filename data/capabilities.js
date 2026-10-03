// Public product truth. Deployment flags never constitute academic release evidence.
export const LAUNCH_SUBJECT_IDS = ['english', 'accountancy', 'business_studies', 'economics'];
// runtimeAi opens PrepOS model replies and the Score Recovery tutor. Opened 4 Oct 2026 by the owner:
// reservation + runtime guard + monthly cap migrations applied to production, USD 25/IST-month cap,
// verified prices (docs/brain/reports/ai-migrations-dry-run-2026-10-04.json).
// aiCommerce opens paid AI purchases (PrepOS top-up checkout, charged Rival battles). It stays closed
// until a real captured top-up and the Rival atomic-submission migration are verified.
export const RELEASE_GATES = Object.freeze({ content: false, authenticatedJourney: false, stagingPayments: false, economics: false, runtimeAi: true, aiCommerce: false });
export const CAPABILITY_REGISTRY_VERSION = '2026-10-02.1';
// Inventory purposes are distinct. A count from one purpose never proves another.
export const INVENTORY_POLICIES = Object.freeze({
  ordinary: 'Ordinary library questions that pass the publication and family-hold policy.',
  recovery_eligible: 'Evidence-managed questions eligible for recovery probes and fresh checks.',
  original_sample: 'Original MockMob sample content; not historical exam material.',
  verified_historical: 'Verified historical exam material with a recorded source. None is claimed today.',
});
export const CAPABILITIES = Object.freeze({
  practice: { id: 'practice', version: 1, state: 'available', subjects: 'available_inventory', entitlement: 'credits_or_access', inventoryPolicy: 'ordinary', href: '/dashboard', reason: 'Timed practice from the ordinary library. The exact set is confirmed at launch; you are not charged if it cannot be built.' },
  review: { id: 'review', version: 1, state: 'available', subjects: 'attempted', entitlement: 'free', href: '/review' },
  recovery: { id: 'recovery', version: 1, state: recoveryReleased() ? 'available' : 'blocked_content', subjects: LAUNCH_SUBJECT_IDS, entitlement: 'free_allowance_or_access', href: '/recovery', reason: recoveryReleased() ? 'Investigate, repair and return for fresh checks on available pathways.' : 'Recovery pathways are awaiting permitted sources and independent calibration. You can review mistakes or continue ordinary practice.' },
  admission: { id: 'admission', version: 1, state: 'available', subjects: [], entitlement: 'free', href: '/cuet-cutoff-calculator', reason: 'Sourced historical comparisons; no admission probabilities.' },
  aiTopUps: { id: 'aiTopUps', version: 1, state: aiCommerceReleased() ? 'available' : 'paused', entitlement: 'purchase', reason: aiCommerceReleased() ? 'PrepOS credit top-ups are on sale.' : 'New PrepOS top-ups are paused. Your monthly PrepOS credits work, and existing credits are preserved.' },
  decisionCoaching: { id: 'decisionCoaching', version: 1, state: 'not_released', subjects: LAUNCH_SUBJECT_IDS, entitlement: 'free', reason: 'Decision experiments will follow the complete recovery release.' },
  optionalAi: { id: 'optionalAi', version: 2, state: runtimeAiReleased() ? 'available' : 'paused', entitlement: 'monthly_wallet', reason: runtimeAiReleased() ? 'PrepOS model replies use your monthly PrepOS credits. Questions about your own record are always free.' : 'PrepOS model replies and new credit top-ups are paused until funding, verified prices and credit reservations pass staging checks. Questions about your own record stay free, and your existing credits are preserved.' },
});
// Evidence ladder for product claims (decision: docs/brain/DECISION-2026-10-03-DIFFERENTIATOR.md).
// Each level needs its own evidence; a later level never implies an earlier one was skipped.
// 'unverified' means this checkout cannot see the evidence (for example, what production runs).
export const EVIDENCE_LEVELS = Object.freeze(['researchHypothesis', 'sourceImplementation', 'academicValidation', 'stagingVerification', 'liveAvailability']);
export const DIFFERENTIATORS = Object.freeze({
  repairThatHolds: { role: 'primary', capability: 'recovery', claim: 'Find the reasoning slip behind a repeated mistake, repair it, and check later on fresh questions whether the repair held.',
    evidence: { researchHypothesis: true, sourceImplementation: true, academicValidation: false, stagingVerification: false, liveAvailability: false },
    detail: 'One candidate pathway (sacrificing and gaining ratios) passes software consistency; academic review and cohort calibration are pending.' },
  trustworthyPractice: { role: 'supporting', capability: 'practice', claim: 'Questions carry versioned evidence; corrections are recorded and affected results are excluded or recalculated.',
    evidence: { researchHypothesis: true, sourceImplementation: true, academicValidation: false, stagingVerification: false, liveAvailability: 'unverified' },
    detail: 'Correction history and invalidation are in saved migrations; no student-facing provenance view yet; signed evidence records are paused with the content worker.' },
  goalAwarePreparation: { role: 'supporting', capability: 'admission', claim: 'Sourced DU eligibility and subject choices shape which subjects to prioritise.',
    evidence: { researchHypothesis: true, sourceImplementation: true, academicValidation: 'not_applicable', stagingVerification: false, liveAvailability: 'unverified' },
    detail: 'Maintenance only. Competitors offer similar eligibility tools; this is useful, not defensible.' },
});
/** A differentiator may be advertised only when every level up to live availability is true. */
export function differentiatorClaimable(id, registry = DIFFERENTIATORS) {
  const d = registry[id];
  return Boolean(d) && EVIDENCE_LEVELS.every(level => d.evidence[level] === true || d.evidence[level] === 'not_applicable');
}
// Practice modes as capabilities. Labels come from here, not from page copy. Premium modes
// give access and selection rules; they do not make the free library academically inferior.
export const MODE_CAPABILITIES = Object.freeze({
  quick: { id: 'mode.quick', version: 1, state: 'available', entitlement: 'credits_or_access', inventoryPolicy: 'ordinary',
    free: 'Credits per session. The launch check shows any included set you can use.', pro: 'Included with Pro' },
  full: { id: 'mode.full', version: 1, state: 'available', entitlement: 'credits_or_access', inventoryPolicy: 'ordinary',
    free: 'Credits per session', pro: 'Included with Pro' },
  smart: { id: 'mode.smart', version: 1, state: 'available', entitlement: 'access', inventoryPolicy: 'ordinary',
    free: 'Needs Pro', pro: 'Included: weights selection toward chapters you have missed' },
  nta: { id: 'mode.nta', version: 1, state: 'available', entitlement: 'access', inventoryPolicy: 'ordinary',
    free: 'Needs Pro', pro: 'Included: 50 questions, 60 minutes, exam-style console. Original practice content, not official papers.' },
});
export function modeCapability(modeId) {
  return MODE_CAPABILITIES[modeId] || null;
}
export function runtimeAiReleased(gates = RELEASE_GATES) {
  return gates.runtimeAi === true;
}
export function aiCommerceReleased(gates = RELEASE_GATES) {
  return gates.runtimeAi === true && gates.aiCommerce === true;
}
export function recoveryReleased(gates = RELEASE_GATES) {
  return gates.content === true && gates.authenticatedJourney === true;
}
export function newOfferReleased(gates = RELEASE_GATES) {
  return recoveryReleased(gates) && gates.stagingPayments === true && gates.economics === true;
}
export const TARGET_OFFER = Object.freeze({ planId: 'pro_cuet_2027_v2', rupees: 299, expires: '31 July 2027', state: 'not_released' });
export const CURRENT_OFFER = Object.freeze(newOfferReleased() ? { ...TARGET_OFFER, state: 'available' } : { planId: 'pro_cuet_2027', rupees: 99, expires: '31 July 2027' });
export const RECOVERY_PACKAGING_ROWS = [
  ['Five-question baseline', 'One per launch subject', 'Included'],
  ['Daily ordinary practice', 'One included 10-question set', 'Unlimited available practice'],
  ['New recovery episodes', 'One complete episode per week', 'All available pathways'],
  ['Delayed checks for started episodes', true, true],
  ['Full mocks', 'One sample per launch subject where supported', 'Full, Smart and NTA access'],
  ['Results and explanations', true, true],
  ['Saved questions', '25 saves', 'Unlimited saves'],
  ['DU eligibility and historical cutoffs', true, true],
  ['Recovery history and planning', 'Basic episode history', 'Full history, priorities and playbook'],
];
