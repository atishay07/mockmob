// ARC-12 (R8): the diagnosis step of the signature journey, said on the mistake's own row. PURE.
//
// "Where your marks went" sorts every lost question into one ledger group (data/mistake_lab.js, one group a question, checked
// top to bottom). The row of that question says the same group in plain words, as knowledge, time or a decision, with the time
// it took when the paper's clock record has it. Nothing here is worked out again: the group is the server's, the seconds are the
// time read's own row, so the row and the ledger can never disagree. A question in no group (a held key, a paper without the
// ledger) says nothing.
import { spentLabel } from '../../../data/paper_trace.js';

const timed = (ms) => (Number.isFinite(ms) && ms > 0 ? spentLabel(ms / 1000) : null);

/** The words for one group; `t` is "45s" or null. */
export function diagnosisLine(groupId, { t = null, changed = false } = {}) {
  switch (groupId) {
    case 'changed_from_right': return 'Lost to a decision: it was right, then changed';
    case 'struck_key': return 'Lost to a decision: the key was crossed out';
    case 'long_stay': return t ? `Lost to time: ${t} on it, still wrong` : 'Lost to time: 2 minutes or more, still wrong';
    case 'quick_wrong': return t ? `Lost to a rush: answered in ${t}` : 'Lost to a rush: answered in under 20 seconds';
    case 'other_wrong': return `Lost to the idea, not time${t ? `: ${t} on it` : ''}${changed ? '' : ', no answer change'}`;
    case 'never_opened': return 'Never opened';
    case 'other_blank': return t ? `Opened for ${t}, left blank` : 'Opened, left blank';
    default: return null;
  }
}

/**
 * Map<questionNumber, groupId> from the ledger (lab.groups[].numbers). Only the ready ledger's groups say how a mark was lost;
 * the basic ledger ("Wrong answers", "Blanks") says nothing a row does not already show, so it gives an empty map.
 */
export function groupByNumber(ledger) {
  const out = new Map();
  if (!ledger || ledger.state !== 'ready') return out;
  for (const g of ledger.groups || []) {
    if (!g?.id || g.id === 'held') continue;
    for (const n of g.numbers || []) if (Number.isInteger(n) && !out.has(n)) out.set(n, g.id);
  }
  return out;
}

/** The row's line: { group, line } or null. `ms` is the time read's own milliseconds for this question (or null). */
export function rowDiagnosis(groups, { number, ms = null, changed = false } = {}) {
  const group = groups?.get?.(number) || null;
  const line = group ? diagnosisLine(group, { t: timed(ms), changed }) : null;
  return line ? { group, line } : null;
}
