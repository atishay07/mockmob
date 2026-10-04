// Business Studies: original MockMob teaching and scenarios, reconciled against NCERT Business
// Studies Part I (Reprint 2026-27): Organising p.20 and p.26; Controlling p.5, p.6 and p.8.
import { unitBase, makeCard, choice } from './helpers.mjs';

const NCERT_ORGANISING = { id: 'ncert-bst-organising', url: 'https://ncert.nic.in/textbook/pdf/lebs105.pdf', label: 'NCERT Business Studies Part I, ch. 5 Organising', permission: 'reference only; MockMob explanations and scenarios are original' };
const NCERT_CONTROLLING = { id: 'ncert-bst-controlling', url: 'https://ncert.nic.in/textbook/pdf/lebs108.pdf', label: 'NCERT Business Studies Part I, ch. 8 Controlling', permission: 'reference only; MockMob explanations and scenarios are original' };

// ---------- Delegation and decentralisation ----------
const delUnit = unitBase({
  subject: 'business_studies', chapter: 'Organising', conceptId: 'delegation_decentralisation', id: 'business-studies-delegation-decentralisation', version: 1, order: 10,
  title: 'Delegation and decentralisation', minutes: 6, skill: 'Scenario',
  summary: 'Tell a manager sharing work apart from a company spreading decision-making to every level.',
  objectives: ['Name the three elements of delegation and which way each flows', 'Know what can and cannot be delegated', 'Classify a scenario as delegation or decentralisation'],
  examLink: 'CUET Business Studies often describes a workplace situation and asks which concept, element or basis of difference it shows.',
  sourceRefs: [NCERT_ORGANISING],
});
const scenario = (text, isDelegation, why) => choice(`${text} Which concept does this show?`, ['Delegation', 'Decentralisation'], isDelegation ? 0 : 1, why, { optionNotes: isDelegation ? [null, 'Decentralisation is a top-management policy spreading authority to the lowest levels, not one manager sharing a task.'] : ['Delegation is one superior sharing authority with an immediate subordinate; this is a policy across levels.', null] });
const basis = (statement, isDelegation) => choice(`“${statement}” describes…`, ['Delegation', 'Decentralisation'], isDelegation ? 0 : 1, `${isDelegation ? 'Delegation' : 'Decentralisation'}: ${statement.charAt(0).toLowerCase()}${statement.slice(1)}.`, { optionNotes: isDelegation ? [null, 'Check the basis: this is the delegation side of the comparison.'] : ['Check the basis: this is the decentralisation side of the comparison.', null] });
delUnit.blocks = [
  { id: 'del-what', type: 'reading', kind: 'explanation', title: 'Delegation: sharing work, keeping answerability',
    body: 'A manager cannot do every task personally, so authority is passed down to a subordinate to act on the manager’s behalf. The subordinate accepts the duty to do the job well. But the manager is still answerable to their own superior for the final outcome.',
    note: 'Authority is delegated, responsibility is assumed, accountability is imposed.' },
  { id: 'del-elements', type: 'reading', kind: 'contrast', title: 'The three elements',
    rows: [['', 'Authority', 'Responsibility', 'Accountability'], ['Meaning', 'Right to command', 'Obligation to do the assigned task', 'Answerability for the outcome'], ['Can it be delegated?', 'Yes', 'Not entirely', 'Not at all'], ['Flows', 'Downward', 'Upward', 'Upward']],
    note: 'Authority given should match the responsibility: too much authority risks misuse; too little makes the person ineffective.' },
  { id: 'del-compare', type: 'reading', kind: 'contrast', title: 'Delegation vs decentralisation',
    rows: [['Basis', 'Delegation', 'Decentralisation'], ['Nature', 'Compulsory: no one can do every task alone', 'Optional policy chosen by top management'], ['Freedom of action', 'More control by superiors', 'Less control, more freedom for executives'], ['Status', 'A process for sharing tasks', 'The result of a top-management policy'], ['Scope', 'Narrow: a superior and immediate subordinate', 'Wide: extends to the lowest level'], ['Purpose', 'Lessen the manager’s burden', 'Give subordinates more autonomy']] },
  { id: 'del-worked', type: 'reading', kind: 'worked_example', title: 'Two situations, side by side',
    body: 'Ritu, a regional sales manager, lets Arjun approve customer discounts up to 5% this month. Ritu is still answerable to her own boss for the month’s sales. That is delegation. The board of a retail chain decides that every store manager will hire local staff and set local offers. That is decentralisation: a policy that spreads decision-making down to the lowest level.' },
  { id: 'del-mistake', type: 'reading', kind: 'mistake', title: 'The usual trap',
    body: 'Thinking that once a task is handed over, the manager is no longer answerable. Accountability cannot be delegated at all. A second trap: calling every handover “decentralisation”. Decentralisation is delegation extended systematically across levels as a policy.' },
  { id: 'del-check-element', type: 'choice', kind: 'knowledge_check', title: 'Try it', prompt: 'Which element cannot be delegated at all?', options: ['Accountability', 'Authority', 'Responsibility', 'All three can be delegated'], answer: 0,
    optionNotes: [null, 'Authority is exactly what is delegated.', 'Responsibility cannot be entirely delegated, but it is assumed by the subordinate.', 'Accountability always stays with the delegating manager.'], explanation: 'The manager remains answerable for the outcome even after delegating. This is an unscored learning check.' },
  { id: 'del-check-scenario', ...scenario('A company’s top management decides that branch heads in every city will approve their own budgets and purchases.', false, 'It is a policy decision by top management that extends authority across levels.'), kind: 'knowledge_check', title: 'Classify the situation' },
];
const delCards = [
  makeCard(delUnit, { id: 'bst-del-elements', objective: 'Know each element’s flow and whether it can be delegated', title: 'Elements of delegation', cue: 'Authority flows down; responsibility and accountability flow up.', variants: [
    choice('Which element of delegation flows downward, from superior to subordinate?', ['Authority', 'Responsibility', 'Accountability', 'None of them'], 0, 'Authority arises from formal position and flows down.', { optionNotes: [null, 'Responsibility flows upward, from subordinate to superior.', 'Accountability flows upward too.', 'Authority flows downward.'] }),
    choice('Accountability arises from…', ['Responsibility', 'Formal position', 'Delegated authority', 'Decentralisation'], 0, 'Responsibility is derived from authority, and accountability is derived from responsibility.', { optionNotes: [null, 'Formal position is the origin of authority.', 'Delegated authority is the origin of responsibility.', 'Decentralisation is a policy, not an element.'] }),
    { type: 'reveal', prompt: 'Complete: authority is delegated, responsibility is …, accountability is …', answer: 'assumed; imposed', explanation: 'The subordinate takes on the duty; answerability for the outcome is placed on the delegating manager.' },
  ] }),
  makeCard(delUnit, { id: 'bst-del-scenario', objective: 'Classify a workplace situation', title: 'Delegation or decentralisation?', cue: 'One manager and a subordinate: delegation. A policy across levels: decentralisation.', variants: [
    scenario('A production manager asks a supervisor to schedule this week’s night shift.', true, 'One superior shares authority for a task with an immediate subordinate.'),
    scenario('A bank’s head office decides that every branch manager can sanction small loans without head-office approval.', false, 'Top management’s policy spreads decision-making authority to lower levels across the organisation.'),
    scenario('A school principal, too busy to plan the annual day herself, gives a teacher authority to plan it.', true, 'It lessens the principal’s burden by sharing a task with a subordinate.'),
  ] }),
  makeCard(delUnit, { id: 'bst-del-basis', objective: 'Match each basis of difference', title: 'Bases of difference', cue: 'Compulsory, narrow, lessen burden: delegation. Optional, wide, autonomy: decentralisation.', variants: [
    basis('It is a compulsory act, because no individual can perform all tasks alone', true),
    basis('It is an optional policy decision of top management', false),
    basis('Its scope is narrow, limited to a superior and an immediate subordinate', true),
    basis('Its purpose is to give subordinates more autonomy', false),
  ] }),
  makeCard(delUnit, { id: 'bst-del-balance', objective: 'Match authority with responsibility', title: 'Authority must match responsibility', cue: 'Too much authority: misuse. Too little: ineffective.', variants: [
    choice('A subordinate is given far more authority than the assigned responsibility requires. What is the risk?', ['Misuse of authority', 'The subordinate becomes ineffective', 'Accountability passes to the subordinate', 'Nothing; more authority is always better'], 0, 'Authority beyond the responsibility can be misused.', { optionNotes: [null, 'That is the risk when responsibility exceeds authority.', 'Accountability cannot be delegated.', 'The two should be commensurate.'] }),
    choice('A subordinate must hit a sales target but cannot approve any discount or expense. What is the risk?', ['The subordinate may be ineffective', 'Misuse of authority', 'Decentralisation increases', 'The manager loses accountability'], 0, 'Responsibility greater than authority leaves the person unable to act.', { optionNotes: [null, 'Misuse arises from too much authority, not too little.', 'This is about one delegation, not a policy.', 'Accountability stays with the manager regardless.'] }),
  ] }),
];

// ---------- Planning and controlling ----------
const ctlUnit = unitBase({
  subject: 'business_studies', chapter: 'Controlling', conceptId: 'planning_controlling', id: 'business-studies-planning-controlling', version: 1, order: 20,
  title: 'Planning, controlling and the control process', minutes: 7, skill: 'Scenario',
  summary: 'See why planning and controlling depend on each other, and name each step of control in a real situation.',
  objectives: ['Explain how planning and controlling depend on each other', 'Order the five steps of the controlling process', 'Apply critical point control and management by exception'],
  examLink: 'CUET Business Studies frequently describes a manager’s action and asks which step of controlling it is.',
  sourceRefs: [NCERT_CONTROLLING],
});
const STEPS = ['Setting performance standards', 'Measurement of actual performance', 'Comparing actual performance with standards', 'Analysing deviations', 'Taking corrective action'];
const stepVariant = (text, index, why) => choice(`${text} Which step of controlling is this?`, STEPS, index, why, { optionNotes: STEPS.map((_, i) => i === index ? null : `“${STEPS[i]}” is step ${i + 1}; this situation is step ${index + 1}.`) });
ctlUnit.blocks = [
  { id: 'ctl-relationship', type: 'reading', kind: 'explanation', title: 'Planning and controlling need each other',
    body: 'Planning sets the standards; controlling checks whether performance matches them and corrects the gap. Without a plan there is nothing to control against, and a plan nobody checks is just a wish.',
    note: 'Planning without controlling is meaningless; controlling is blind without planning.' },
  { id: 'ctl-direction', type: 'reading', kind: 'contrast', title: '“Planning looks ahead, controlling looks back” — only partly true',
    rows: [['', 'Planning', 'Controlling'], ['Nature', 'Prescriptive: decides what should be done', 'Evaluative: checks what was done'], ['Looks', 'Ahead, but guided by past experience', 'Back at results, but corrective action improves the future'], ['Conclusion', 'Both look backward and forward', 'Both look backward and forward']] },
  { id: 'ctl-steps', type: 'reading', kind: 'steps', title: 'The five steps of controlling', steps: STEPS },
  { id: 'ctl-worked', type: 'reading', kind: 'worked_example', title: 'One month in a factory',
    body: 'Standard: 1,000 units a month with at most 2% defective. Measurement: 960 units, 3% defective. Comparison: output 40 units short, defects 1 point over. Analysis: a machine was down for two days and a new operator was untrained. Corrective action: repair schedule and operator training.',
    rows: [['Step', 'In this factory'], ...['Target 1,000 units, ≤2% defects', 'Counted 960 units, 3% defects', '40 units short; defects 1 point over', 'Machine downtime; untrained operator', 'Repair schedule; training'].map((x, i) => [STEPS[i], x])] },
  { id: 'ctl-focus', type: 'reading', kind: 'explanation', title: 'Where managers focus',
    body: 'Critical point control: watch the key result areas whose failure hurts the whole organisation, not every activity. Management by exception: only significant deviations beyond an accepted limit go to senior management; trying to control everything ends up controlling nothing.' },
  { id: 'ctl-check-step', ...stepVariant('A store manager finds sales were ₹8 lakh against a target of ₹10 lakh.', 2, 'Actual performance is being compared with the standard.'), kind: 'knowledge_check', title: 'Try it' },
  { id: 'ctl-check-mbe', type: 'choice', kind: 'knowledge_check', title: 'Which principle?', prompt: 'Labour cost may rise up to 2% without a report; only bigger increases go to senior managers. Which principle is this?',
    options: ['Management by exception', 'Critical point control', 'Setting performance standards', 'Decentralisation'], answer: 0,
    optionNotes: [null, 'Critical point control is about choosing the key areas to watch, not the reporting limit.', 'The standard already exists; this is about which deviations are reported.', 'This is a control principle, not an organising policy.'], explanation: 'Only significant deviations beyond the accepted limit are brought to management. This is an unscored learning check.' },
];
const ctlCards = [
  makeCard(ctlUnit, { id: 'bst-ctl-step', objective: 'Name the step in a situation', title: 'Which step of controlling?', cue: 'Set, measure, compare, analyse, correct.', variants: [
    stepVariant('A call centre decides each call must be answered within 30 seconds.', 0, 'A measurable standard is being set.'),
    stepVariant('A supervisor counts how many calls were answered within 30 seconds this week.', 1, 'Actual performance is being measured.'),
    stepVariant('A manager finds late deliveries were caused by a shortage of trucks.', 3, 'The causes of a deviation are being analysed.'),
    stepVariant('After finding the cause, the company hires two more delivery trucks.', 4, 'Action is taken to correct the deviation.'),
  ] }),
  makeCard(ctlUnit, { id: 'bst-ctl-order', objective: 'Order the steps', title: 'Order of the control process', cue: 'You cannot compare before you measure.', variants: [
    choice('What comes immediately after measuring actual performance?', ['Comparing actual performance with standards', 'Taking corrective action', 'Setting performance standards', 'Analysing deviations'], 0, 'Measurement gives the figure; the next step compares it with the standard.', { optionNotes: [null, 'Correction is the last step.', 'Standards are set first.', 'You analyse deviations after you have found them by comparing.'] }),
    { type: 'reveal', prompt: 'List the five steps of controlling in order.', answer: 'Set standards → measure actual performance → compare with standards → analyse deviations → take corrective action', explanation: 'Each step needs the output of the one before it.' },
  ] }),
  makeCard(ctlUnit, { id: 'bst-ctl-relationship', objective: 'Explain how planning and controlling depend on each other', title: 'Planning and controlling', cue: 'Planning gives the standards controlling needs.', variants: [
    choice('Controlling is said to be blind without…', ['Planning', 'Staffing', 'Directing', 'Decentralisation'], 0, 'Without planned standards there is nothing to compare performance with.', { optionNotes: [null, 'Staffing fills positions; it does not give the standards.', 'Directing guides people; standards come from plans.', 'That is an organising policy.'] }),
    choice('Which pair is correct?', ['Planning is prescriptive; controlling is evaluative', 'Planning is evaluative; controlling is prescriptive', 'Both are only backward-looking', 'Both are only forward-looking'], 0, 'Planning decides what should be done; controlling evaluates what was done.', { optionNotes: [null, 'This reverses them.', 'Both also look forward.', 'Both also look back.'] }),
  ] }),
  makeCard(ctlUnit, { id: 'bst-ctl-focus', objective: 'Tell the two focus principles apart', title: 'Critical point control or management by exception', cue: 'Key areas: critical point. Reporting only big deviations: exception.', variants: [
    choice('A factory watches labour cost closely because a 5% rise there hurts more than a 15% rise in postage. Which principle?', ['Critical point control', 'Management by exception', 'Measurement of performance', 'Delegation'], 0, 'It focuses control on a key result area.', { optionNotes: [null, 'Management by exception is about reporting only significant deviations.', 'That is a step, not a focus principle.', 'That is an organising concept.'] }),
    choice('Only deviations above 5% are reported to the general manager. Which principle?', ['Management by exception', 'Critical point control', 'Taking corrective action', 'Setting standards'], 0, 'Only significant deviations beyond a limit go to senior management.', { optionNotes: [null, 'Critical point control chooses which areas to watch.', 'Correction comes after the analysis.', 'The limit is a reporting rule, not the standard itself.'] }),
  ] }),
  makeCard(ctlUnit, { id: 'bst-ctl-direction', objective: 'Correct the “looking back only” claim', title: 'Is controlling only backward-looking?', cue: 'Corrective action improves future performance.', variants: [
    choice('“Controlling only looks back.” Why is this only partly true?', ['Its corrective action aims to improve future performance', 'Controlling happens before planning', 'Controlling ignores past results', 'Controlling sets the plan'], 0, 'Controlling reviews past performance, but its corrections shape the future.', { optionNotes: [null, 'Planning comes first.', 'It reviews past results.', 'Planning sets the plan.'] }),
  ] }),
];

export const businessStudies = { units: [delUnit, ctlUnit], cards: [...delCards, ...ctlCards] };
