// Accountancy: original MockMob teaching, reconciled against NCERT Accountancy Part I (Reprint 2026-27).
import { unitBase, makeCard, choice, shares, sub, fmt, frac, ratioText, lcd, over, rupees } from './helpers.mjs';

const NCERT_ADMISSION = { id: 'ncert-admission', url: 'https://ncert.nic.in/textbook/pdf/leac102.pdf', label: 'NCERT Accountancy Part I, ch. 2 Admission of a Partner (sections 2.3, 2.4, 2.7)', permission: 'reference only; MockMob explanations and examples are original' };
const NCERT_RETIREMENT = { id: 'ncert-retirement', url: 'https://ncert.nic.in/textbook/pdf/leac103.pdf', label: 'NCERT Accountancy Part I, ch. 3 Retirement/Death of a Partner (section 3.3)', permission: 'reference only; MockMob explanations and examples are original' };

// ---------- Sacrificing and gaining ratios ----------
const ratioUnit = unitBase({
  subject: 'accountancy', chapter: 'Change in Profit Sharing Ratio', conceptId: 'sacrificing_gaining', id: 'accountancy-sacrificing-gaining', version: 2, order: 10,
  title: 'Sacrificing and gaining ratios', minutes: 7, skill: 'Calculation',
  summary: 'Work out who gave up profit share and who gained it, one partner at a time.',
  objectives: ['Calculate a partner’s sacrifice or gain from old and new shares', 'Turn individual sacrifices into a sacrificing ratio', 'Know when the old ratio is also the sacrificing ratio'],
  examLink: 'CUET Accountancy questions on admission, retirement and change in ratio usually need this step before goodwill or capital adjustments.',
  sourceRefs: [NCERT_ADMISSION, NCERT_RETIREMENT],
});
function sacrificeVariant(oldShare, newShare) {
  const answer = sub(oldShare, newShare), den = lcd([oldShare, newShare]);
  return { type: 'numeric', prompt: `A partner’s old share is ${fmt(oldShare)} and new share is ${fmt(newShare)}. What is the partner’s sacrifice?`, inputHint: 'Type a fraction, for example 1/10', answer: fmt(answer).replace('−', '-'),
    explanation: `Sacrifice = old share − new share = ${over(oldShare, den)} − ${over(newShare, den)} = ${fmt(answer)}.`, calc: { op: 'sacrifice', old: oldShare, new: newShare } };
}
function sacrificingRatioVariant(oldRatio, newRatio, names) {
  const o = shares(oldRatio), n = shares(newRatio), den = lcd([...o, ...n]);
  const s = o.map((share, i) => sub(share, n[i]));
  const parts = s.map(([a, b]) => a * (den / b));
  const ratio = ratioText(parts);
  return { type: 'ratio', prompt: `${names[0]} and ${names[1]} share profits ${oldRatio.join(':')}. ${names[2]} is admitted and the new ratio ${names.join(':')} is ${newRatio.join(':')}. What is the sacrificing ratio of ${names[0]} and ${names[1]}?`, inputHint: 'Type a ratio, for example 2:1',
    answer: ratio, explanation: `${names[0]}: ${over(o[0], den)} − ${over(n[0], den)} = ${fmt(s[0])}. ${names[1]}: ${over(o[1], den)} − ${over(n[1], den)} = ${fmt(s[1])}. So the sacrificing ratio is ${ratio}.`, calc: { op: 'sacrificing_ratio', old: oldRatio, new: newRatio } };
}
function gainVariant(oldRatio, newRatio, names, who) {
  const o = shares(oldRatio), n = shares(newRatio), g = sub(n[who], o[who]), den = lcd([o[who], n[who]]);
  return { type: 'numeric', prompt: `${names.join(', ')} share profits ${oldRatio.join(':')}. They agree to share ${newRatio.every(x => x === newRatio[0]) ? 'equally' : `in the ratio ${newRatio.join(':')}`} from now on. What is ${names[who]}’s gain?`, inputHint: 'Type a fraction',
    answer: fmt(g).replace('−', '-'), explanation: `Gain = new share − old share = ${over(n[who], den)} − ${over(o[who], den)} = ${fmt(g)}.`, calc: { op: 'gain', old: oldRatio, new: newRatio, partner: who } };
}
const worked = (() => { const o = shares([3, 2]), n = shares([5, 3, 2]); return { o, n, a: sub(o[0], n[0]), b: sub(o[1], n[1]) }; })();
const equalised = (() => { const o = shares([3, 2, 1]), n = shares([1, 1, 1]); return o.map((share, i) => sub(share, n[i])); })();
ratioUnit.blocks = [
  { id: 'ratio-why', type: 'reading', kind: 'explanation', title: 'Why this matters',
    body: 'Whenever partners change how they share profit — a partner joins, a partner retires, or everyone simply agrees a new ratio — some shares fall and some rise. The partners whose shares fall are compensated, for example through the new partner’s premium for goodwill, so most questions on reconstitution start by asking who sacrificed and who gained.' },
  { id: 'ratio-rule', type: 'reading', kind: 'explanation', title: 'Start with the change in share',
    body: 'For each partner, sacrifice = old share − new share. Gain = new share − old share. Use a common denominator before subtracting. A positive sacrifice means the share fell; a negative sacrifice means it rose.',
    formula: 'Sacrifice = Old share − New share · Gain = New share − Old share' },
  { id: 'ratio-steps', type: 'reading', kind: 'steps', title: 'The four-line method',
    steps: ['Write each partner’s old share and new share as fractions.', 'Put all of them over one common denominator.', 'Subtract old − new for every partner.', 'Positive results are sacrifices. Write them as a ratio in lowest terms.'] },
  { id: 'ratio-worked', type: 'reading', kind: 'worked_example', title: 'Work one partner at a time',
    body: 'A and B used to share 3:2. C joins, and the new ratio A:B:C is 5:3:2. A: 3/5 − 5/10 = 1/10. B: 2/5 − 3/10 = 1/10. A and B sacrifice equally, so the sacrificing ratio is 1:1.',
    rows: [['Partner', 'Old share', 'New share', 'Sacrifice'], ['A', over(worked.o[0], 10), over(worked.n[0], 10), fmt(worked.a)], ['B', over(worked.o[1], 10), over(worked.n[1], 10), fmt(worked.b)]],
    calc: { op: 'sacrificing_ratio', old: [3, 2], new: [5, 3, 2], expect: '1:1' } },
  { id: 'ratio-gain-worked', type: 'reading', kind: 'worked_example', title: 'No new partner: someone still gains',
    body: `X, Y and Z share 3:2:1 and decide to share equally. Over 6: X goes from 3/6 to 2/6, a sacrifice of ${fmt(equalised[0])}. Y stays at 2/6, so nothing changes. Z goes from 1/6 to 2/6, a gain of ${fmt(sub(frac(2, 6), frac(1, 6)))}. Z must compensate X.`,
    rows: [['Partner', 'Old (over 6)', 'New (over 6)', 'Change'], ['X', '3/6', '2/6', `Sacrifice ${fmt(equalised[0])}`], ['Y', '2/6', '2/6', 'No change'], ['Z', '1/6', '2/6', `Gain ${fmt(sub(frac(2, 6), frac(1, 6)))}`]],
    calc: { op: 'gain', old: [3, 2, 1], new: [1, 1, 1], partner: 2, expect: '1/6' } },
  { id: 'ratio-contrast', type: 'reading', kind: 'mistake', title: 'The old ratio is not a universal shortcut',
    body: 'The old ratio describes the starting shares. The new ratio describes the final shares. Neither automatically describes the change. When a new ratio is given, compare the shares. Use the old ratio as the sacrificing ratio when the incoming share is taken in that ratio.',
    note: 'If a question says nothing about how the new partner takes the share, assume it comes from the old partners in their old ratio.' },
  { id: 'ratio-check', type: 'numeric', kind: 'knowledge_check', title: 'Try it', prompt: 'A partner’s old share is 3/5 and new share is 1/2. What did the partner sacrifice?', inputHint: 'Type a fraction, for example 1/10', answer: '1/10',
    explanation: '3/5 − 1/2 = 6/10 − 5/10 = 1/10. This is an unscored learning check.', calc: { op: 'sacrifice', old: [3, 5], new: [1, 2] } },
  { id: 'ratio-check-old', type: 'choice', kind: 'knowledge_check', title: 'Try a shortcut question', prompt: 'A and B share 3:2. C is admitted for 1/5 share, which C takes from A and B in their old ratio. What is the sacrificing ratio of A and B?',
    options: ['3:2', '1:1', '4:1', '2:3'], answer: 0, optionNotes: [null, '1:1 would be right only if A and B gave up equal amounts.', '4:1 is the ratio of the remaining 4/5 to C’s 1/5, not a sacrifice.', '2:3 reverses the partners.'],
    explanation: 'C takes the share in the old ratio, so A gives 3/5 of 1/5 = 3/25 and B gives 2/5 of 1/5 = 2/25. The sacrificing ratio is 3:2 — here the old ratio does apply.' },
  { id: 'ratio-check-new', ...sacrificingRatioVariant([3, 2], [4, 3, 3], ['A', 'B', 'C']), kind: 'knowledge_check', title: 'Now a calculated ratio' },
];
const ratioCards = [
  makeCard(ratioUnit, { id: 'accountancy-ratio-formula', version: 2, objective: 'Recall which share comes first', title: 'Sacrifice and gain formulas', cue: 'Sacrifice looks back: old minus new. Gain looks forward: new minus old.', variants: [
    { type: 'reveal', prompt: 'Complete the formula: sacrifice = …', answer: 'Old share − New share', explanation: 'A sacrifice is how much a share fell, so start from the old share.' },
    choice('Which expression gives a continuing partner’s gain?', ['New share − Old share', 'Old share − New share', 'New ratio × incoming share', 'Old share ÷ New share'], 0, 'A gain is how much a share rose, so start from the new share.', { optionNotes: [null, 'That is the sacrifice.', 'That is how an incoming share is split, not a gain.', 'A ratio of shares does not measure the change.'] }),
  ] }),
  makeCard(ratioUnit, { id: 'accountancy-ratio-sacrifice-calc', objective: 'Calculate one partner’s sacrifice', title: 'Calculate a sacrifice', cue: 'Common denominator first, then old − new.', variants: [
    sacrificeVariant(frac(2, 5), frac(1, 4)), sacrificeVariant(frac(2, 3), frac(1, 2)), sacrificeVariant(frac(3, 4), frac(3, 5)), sacrificeVariant(frac(1, 2), frac(2, 5)),
  ] }),
  makeCard(ratioUnit, { id: 'accountancy-ratio-sacrificing', objective: 'Find a sacrificing ratio from a new ratio', title: 'Sacrificing ratio from a new ratio', cue: 'When the new ratio is given, compare shares; do not reuse the old ratio.', variants: [
    sacrificingRatioVariant([2, 1], [5, 3, 2], ['X', 'Y', 'Z']), sacrificingRatioVariant([1, 1], [7, 5, 4], ['P', 'Q', 'R']), sacrificingRatioVariant([3, 2], [4, 3, 3], ['A', 'B', 'C']),
  ] }),
  makeCard(ratioUnit, { id: 'accountancy-ratio-gain-calc', objective: 'Calculate a gain when existing partners change ratio', title: 'Calculate a gain', cue: 'Gain = new − old. Only partners whose share rises gain.', variants: [
    gainVariant([2, 2, 1], [1, 1, 1], ['A', 'B', 'C'], 2), gainVariant([4, 3, 2], [1, 1, 1], ['L', 'M', 'N'], 2), gainVariant([3, 2, 1], [1, 1, 1], ['X', 'Y', 'Z'], 2),
  ] }),
  makeCard(ratioUnit, { id: 'accountancy-ratio-reading', objective: 'Interpret the result of the calculation', title: 'Read the result correctly', cue: 'A minus sign on a sacrifice means a gain.', variants: [
    choice('Your working gives B’s sacrifice as −1/12. What does that mean?', ['B gains 1/12', 'B sacrifices 1/12', 'There must be an arithmetic error', 'B’s share is unchanged'], 0, 'Old − new is negative only when the new share is larger, so B’s share rose by 1/12.', { optionNotes: [null, 'A sacrifice is positive; the minus sign tells you the share went up.', 'Negative results are normal when a partner’s share rises.', 'An unchanged share gives exactly 0.'] }),
    choice('When is the old profit-sharing ratio also the sacrificing ratio?', ['When the new partner takes the share from the old partners in their old ratio', 'Always, on every admission', 'Whenever a new ratio is given', 'Only when partners share equally'], 0, 'If the incoming share is taken in the old ratio, every old partner gives up the same proportion of their share.', { optionNotes: [null, 'Not when the new ratio is given separately; then compare shares.', 'When a new ratio is given you must calculate old − new.', 'Equal sharing is not the condition.'] }),
  ] }),
];

// ---------- Revaluation ----------
const revalUnit = unitBase({
  subject: 'accountancy', chapter: 'Admission of Partner', conceptId: 'revaluation', id: 'accountancy-revaluation', version: 1, order: 20,
  title: 'Revaluation of assets and liabilities', minutes: 7, skill: 'Treatment',
  summary: 'Decide which side of the Revaluation Account each change goes to, then share the result correctly.',
  objectives: ['Place each change on the debit or credit side of the Revaluation Account', 'Calculate the net gain or loss', 'Share it among the old partners in their old ratio'],
  examLink: 'CUET questions often give four or five changes and ask for the gain or loss, or one partner’s share of it.',
  sourceRefs: [NCERT_ADMISSION],
});
const revalItems = [{ label: 'Machinery increased', amount: 10000, side: 'credit' }, { label: 'Stock decreased', amount: 4000, side: 'debit' }, { label: 'Unrecorded liability found', amount: 2000, side: 'debit' }, { label: 'Creditors reduced', amount: 1000, side: 'credit' }];
const net = items => items.reduce((s, i) => s + (i.side === 'credit' ? i.amount : -i.amount), 0);
const revalNet = net(revalItems);
function revalNetVariant(items) {
  const n = net(items);
  return { type: 'numeric', prompt: `On admission of a partner: ${items.map(i => `${i.label.toLowerCase()} by ${rupees(i.amount)}`).join('; ')}. What is the net ${n >= 0 ? 'gain' : 'loss'} on revaluation (in ₹)?`, inputHint: 'Type the amount in rupees',
    answer: String(Math.abs(n)), explanation: `Gains (credit): ${items.filter(i => i.side === 'credit').map(i => rupees(i.amount)).join(' + ') || '₹0'}. Losses (debit): ${items.filter(i => i.side === 'debit').map(i => rupees(i.amount)).join(' + ') || '₹0'}. Net ${n >= 0 ? 'gain' : 'loss'} = ${rupees(Math.abs(n))}.`, calc: { op: 'revaluation_net', items: items.map(({ amount, side }) => ({ amount, side })) } };
}
function revalShareVariant(amount, gain, ratio, names, who) {
  const share = amount * ratio[who] / ratio.reduce((s, x) => s + x, 0);
  return { type: 'numeric', prompt: `${names.join(' and ')} share profits ${ratio.join(':')}. A new partner joins and revaluation shows a net ${gain ? 'gain' : 'loss'} of ${rupees(amount)}. How much is credited or debited to ${names[who]}’s capital (in ₹)?`, inputHint: 'Type the amount in rupees',
    answer: String(share), explanation: `Only the old partners share it, in their old ratio: ${rupees(amount)} × ${ratio[who]}/${ratio.reduce((s, x) => s + x, 0)} = ${rupees(share)} ${gain ? 'credited' : 'debited'} to ${names[who]}.`, calc: { op: 'revaluation_share', amount, ratio, partner: who } };
}
const sideVariant = (change, credit, why) => choice(`On revaluation: ${change}. Which side of the Revaluation Account?`, ['Credit side (a gain)', 'Debit side (a loss)'], credit ? 0 : 1, why, { optionNotes: credit ? [null, 'This change increases the firm’s net worth, so it is a gain.'] : ['This change reduces the firm’s net worth, so it is a loss.', null] });
revalUnit.blocks = [
  { id: 'reval-why', type: 'reading', kind: 'explanation', title: 'Why revalue before admitting a partner',
    body: 'Book values may no longer match current values. Before a new partner joins, assets are revalued, liabilities are reassessed, and anything unrecorded is brought into the books. The result belongs to the partners who ran the firm until now, so the gain or loss goes to the old partners in their old profit-sharing ratio.' },
  { id: 'reval-sides', type: 'reading', kind: 'contrast', title: 'Which side does each change go to?',
    rows: [['Credit side (gain)', 'Debit side (loss)'], ['Increase in an asset', 'Decrease in an asset'], ['Decrease in a liability', 'Increase in a liability'], ['Unrecorded asset brought in', 'Unrecorded liability brought in']],
    note: 'Ask one question: does this change make the firm better off (credit) or worse off (debit)?' },
  { id: 'reval-worked', type: 'reading', kind: 'worked_example', title: 'A complete example',
    body: `A and B share 3:2 and admit C. ${revalItems.map(i => `${i.label}: ${rupees(i.amount)}`).join('. ')}. Gains total ${rupees(11000)}; losses total ${rupees(6000)}. Net gain ${rupees(revalNet)}, shared 3:2: A gets ${rupees(3000)}, B gets ${rupees(2000)}. C gets nothing from it.`,
    rows: [['Change', 'Debit (loss)', 'Credit (gain)'], ...revalItems.map(i => [i.label, i.side === 'debit' ? rupees(i.amount) : '', i.side === 'credit' ? rupees(i.amount) : '']), ['Totals', rupees(6000), rupees(11000)], ['Net gain, transferred to A and B in 3:2', rupees(revalNet), '']],
    calc: { op: 'revaluation_net', items: revalItems.map(({ amount, side }) => ({ amount, side })), expect: String(revalNet) } },
  { id: 'reval-entries', type: 'reading', kind: 'steps', title: 'The journal entries in one line each',
    steps: ['Increase in an asset: Asset A/c Dr. To Revaluation A/c.', 'Decrease in an asset: Revaluation A/c Dr. To Asset A/c.', 'Increase in a liability: Revaluation A/c Dr. To Liability A/c.', 'Decrease in a liability: Liability A/c Dr. To Revaluation A/c.', 'Gain transferred: Revaluation A/c Dr. To old partners’ capital accounts (old ratio).', 'Loss transferred: Old partners’ capital accounts Dr. (old ratio) To Revaluation A/c.'] },
  { id: 'reval-mistake', type: 'reading', kind: 'mistake', title: 'The two most common slips',
    body: 'Sharing the revaluation result with the new partner, or sharing it in the new ratio. Both are wrong: the new partner was not there while those values changed.' },
  { id: 'reval-check-entry', type: 'choice', kind: 'knowledge_check', title: 'Try it', prompt: 'A building is revalued upward by ₹20,000 on admission. Which entry records it?',
    options: ['Building A/c Dr. To Revaluation A/c', 'Revaluation A/c Dr. To Building A/c', 'Building A/c Dr. To Partners’ Capital A/cs', 'Revaluation A/c Dr. To Partners’ Capital A/cs'], answer: 0,
    optionNotes: [null, 'That records a decrease in the building’s value.', 'The gain passes through the Revaluation Account first.', 'That entry transfers a final gain, not one asset change.'],
    explanation: 'An increase in an asset is a gain: debit the asset, credit Revaluation A/c. This is an unscored learning check.' },
  { id: 'reval-check-share', type: 'numeric', kind: 'knowledge_check', title: 'Share the result', prompt: 'Revaluation shows gains of ₹12,000 and losses of ₹7,000. A and B share 3:2 and admit C. How much is credited to A (in ₹)?', inputHint: 'Type the amount in rupees', answer: '3000',
    explanation: 'Net gain = ₹12,000 − ₹7,000 = ₹5,000. A’s share in the old ratio = ₹5,000 × 3/5 = ₹3,000.', calc: { op: 'revaluation_share', amount: 5000, ratio: [3, 2], partner: 0 } },
];
const revalCards = [
  makeCard(revalUnit, { id: 'accountancy-reval-side', objective: 'Place a change on the correct side', title: 'Debit or credit side', cue: 'Better off: credit. Worse off: debit.', variants: [
    sideVariant('the value of machinery increases', true, 'An increase in an asset is a gain, so it is credited.'),
    sideVariant('a liability is found to be higher than recorded', false, 'An increase in a liability is a loss, so it is debited.'),
    sideVariant('an unrecorded liability is brought into the books', false, 'An unrecorded liability is a loss when brought in, so it is debited.'),
    sideVariant('creditors are reduced', true, 'A decrease in a liability is a gain, so it is credited.'),
    sideVariant('stock is written down', false, 'A decrease in an asset is a loss, so it is debited.'),
  ] }),
  makeCard(revalUnit, { id: 'accountancy-reval-who', objective: 'Know who shares the result', title: 'Who shares the revaluation result', cue: 'Old partners, old ratio.', variants: [
    choice('On admission of a partner, who shares the gain or loss on revaluation?', ['The old partners, in their old ratio', 'All partners, in the new ratio', 'The old partners, in the new ratio', 'The new partner alone'], 0, 'The values changed while the old partners ran the firm, so the result is theirs in the old ratio.', { optionNotes: [null, 'The new partner did not share in those changes.', 'The new ratio applies to future profits, not past value changes.', 'The new partner has no claim on it.'] }),
    { type: 'reveal', prompt: 'Complete: on admission, the balance of the Revaluation Account is transferred to …', answer: 'the old partners’ capital accounts, in their old profit-sharing ratio', explanation: 'A credit balance (gain) is credited to them; a debit balance (loss) is debited to them.' },
  ] }),
  makeCard(revalUnit, { id: 'accountancy-reval-net', objective: 'Calculate the net result', title: 'Calculate net gain or loss', cue: 'Add the credit side, add the debit side, then compare.', variants: [
    revalNetVariant([{ label: 'Machinery increased', amount: 15000, side: 'credit' }, { label: 'Stock decreased', amount: 6000, side: 'debit' }, { label: 'Creditors increased', amount: 3000, side: 'debit' }]),
    revalNetVariant([{ label: 'Building increased', amount: 8000, side: 'credit' }, { label: 'Furniture decreased', amount: 5000, side: 'debit' }, { label: 'Unrecorded liability found', amount: 7000, side: 'debit' }]),
    revalNetVariant([{ label: 'Land increased', amount: 20000, side: 'credit' }, { label: 'Unrecorded asset found', amount: 2500, side: 'credit' }, { label: 'Debtors decreased', amount: 4500, side: 'debit' }]),
  ] }),
  makeCard(revalUnit, { id: 'accountancy-reval-share', objective: 'Share the result among old partners', title: 'One partner’s share', cue: 'Net result × that partner’s old share.', variants: [
    revalShareVariant(6000, true, [2, 1], ['X', 'Y'], 0), revalShareVariant(4000, false, [3, 1], ['P', 'Q'], 1), revalShareVariant(15000, true, [3, 2], ['A', 'B'], 1),
  ] }),
  makeCard(revalUnit, { id: 'accountancy-reval-entry', objective: 'Choose the journal entry', title: 'Revaluation journal entries', cue: 'Asset up: Asset Dr. Asset down: Revaluation Dr.', variants: [
    choice('Stock is reduced by ₹3,000 on revaluation. Which entry?', ['Revaluation A/c Dr. To Stock A/c', 'Stock A/c Dr. To Revaluation A/c', 'Partners’ Capital A/cs Dr. To Stock A/c', 'Stock A/c Dr. To Partners’ Capital A/cs'], 0, 'A decrease in an asset is a loss: debit Revaluation, credit the asset.', { optionNotes: [null, 'That records an increase in stock.', 'The loss goes through the Revaluation Account first.', 'That is neither a revaluation entry nor a loss.'] }),
    choice('Creditors are found to be ₹2,000 less than recorded. Which entry?', ['Creditors A/c Dr. To Revaluation A/c', 'Revaluation A/c Dr. To Creditors A/c', 'Creditors A/c Dr. To Partners’ Capital A/cs', 'Revaluation A/c Dr. To Partners’ Capital A/cs'], 0, 'A decrease in a liability is a gain: debit the liability, credit Revaluation.', { optionNotes: [null, 'That records an increase in creditors.', 'The gain goes through the Revaluation Account first.', 'That transfers a final gain, not this change.'] }),
    choice('Revaluation shows a net loss. Which entry transfers it?', ['Old partners’ Capital A/cs Dr. To Revaluation A/c', 'Revaluation A/c Dr. To Old partners’ Capital A/cs', 'All partners’ Capital A/cs Dr. To Revaluation A/c', 'Revaluation A/c Dr. To New partner’s Capital A/c'], 0, 'A loss is debited to the old partners’ capitals in their old ratio.', { optionNotes: [null, 'That transfers a gain.', 'The new partner does not share it.', 'The new partner has no part in it.'] }),
  ] }),
];

export const accountancy = { units: [ratioUnit, revalUnit], cards: [...ratioCards, ...revalCards] };
