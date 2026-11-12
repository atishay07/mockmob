// "Ask Mobi" in miniature, on the home page's five-question sample result (13 Nov 2026). Pure: no React, no browser, no
// network, no model. The step is worked out from the visitor's own five answers only (which questions they missed and the
// chapter each sat in), so it never claims more than five answers can show. It is a truthful sketch of the product's Ask
// Mobi, which answers questions about your own record. Word for word as decided; change the words here.

export const ASK_FIRST = 'What should I do tonight?';
export const ASK_BUTTON = 'Ask Mobi what to do tonight';
export const ASK_CLOSING = 'That is Ask Mobi with five answers to go on. After a mock he reads your whole record.';

const WORDS = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' };
const words = (count) => WORDS[count] || String(count);

/** "Q2", "Q2 and Q4", "Q1, Q2 and Q5". */
function questionList(numbers) {
  const labels = numbers.map((n) => `Q${n}`);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

const AFTER = Object.freeze({
  id: 'after',
  ask: 'And after that?',
  reply: 'Take a full mock. The Mistake Lab then shows where every mark went, by chapter, by minute and by changed answer, and I pick your next step from that.',
});

/**
 * The one step for tonight, from `missed` (DemoDrill's list: [{ n, chapter, ... }], n is the 1-based question number).
 * Returns { step, lines, followUps: [{ id, ask, reply }] } in display order.
 */
export function askPlan({ missed = [] } = {}) {
  const list = Array.isArray(missed) ? missed : [];
  const m = list.length;
  if (m === 0) {
    return {
      step: 'Take one full mock: 50 questions in 60 minutes.',
      lines: ['Nothing slipped in these five, so start with the subject you trust least.'],
      followUps: [{ ...AFTER }],
    };
  }

  // Group by chapter in first-seen order; the top chapter has the most misses, the first seen wins a tie.
  const groups = [];
  for (const miss of list) {
    let group = groups.find((item) => item.chapter === miss.chapter);
    if (!group) {
      group = { chapter: miss.chapter, numbers: [] };
      groups.push(group);
    }
    group.numbers.push(miss.n);
  }
  const top = groups.reduce((best, group) => (group.numbers.length > best.numbers.length ? group : best), groups[0]);
  const k = top.numbers.length;
  const c = groups.length;

  let reason;
  let why;
  if (k >= 2) {
    reason = `It caught you ${words(k)} times in these five (${questionList(top.numbers)}).`;
    why = c === 1
      ? 'Every miss here was in it. One chapter, fixed properly, is tonight’s whole job.'
      : `It is where the most marks went: ${words(k)} of your ${words(m)} misses. One chapter fixed properly beats skimming ${words(c)}.`;
  } else if (m === 1) {
    reason = `It is the one question you missed (Q${top.numbers[0]}).`;
    why = 'It is the only thing these five flagged. One chapter, fixed properly, is a full night’s work.';
  } else {
    reason = `Each miss was in a different chapter, so start with the first (Q${top.numbers[0]}).`;
    why = `With one miss in each of ${words(c)} chapters, none stands out yet. A full mock has 50 questions, enough to show which one really costs you.`;
  }

  return {
    step: `Practise 10 on ${top.chapter}.`,
    lines: [reason, 'Read the reason after each answer before you move on.'],
    followUps: [{ id: 'why', ask: 'Why that one?', reply: why }, { ...AFTER }],
  };
}
