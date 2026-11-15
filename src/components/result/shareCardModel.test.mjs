// F-C (15 Nov 2026): the result share card's lines. What the card says with the score on and off, with and without a name,
// that a blank paper has no card, the date in words, the share text with and without an invite link, and line wrapping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareCard, shareable, dateInWords, neutralLine, cardFileName, shareMessage, cardPalette, wrapWords, PLAIN_LINK, SITE_LINE } from './shareCardModel.mjs';

const AT = Date.parse('2026-11-15T15:30:00Z'); // 9:00 PM in India
const marks = { scored: 38, max: 50, right: 8, wrong: 2, blank: 0 };
const base = {
  subjectName: 'Accountancy', mode: 'quick', total: 10, marks, durationMs: 12 * 60_000 + 5_000, completedAt: AT,
  finding: { line: 'Partnership cost 6 of the 12 marks you missed.', chapter: 'Partnership' }, tomorrow: null,
  firstName: 'Asha', timeZone: 'Asia/Kolkata',
};

test('score on: the CUET score with its total, the counts, the time, the date in words and the chapter line', () => {
  const card = shareCard({ ...base, showScore: true, showName: true });
  assert.equal(card.eyebrow, 'Asha’s practice');
  assert.equal(card.subject, 'Accountancy, 10 questions');
  assert.deepEqual(card.score, { value: '38', total: '/ 50 marks', negative: false });
  assert.equal(card.done, null);
  assert.deepEqual(card.stats.map((s) => [s.label, s.value, s.note]), [['Right', '8', '+40'], ['Wrong', '2', '−2'], ['Blank', '0', '0'], ['Time', '12m 05s', null]]);
  assert.equal(card.date, '15 November 2026');
  // The page says "you missed" to the student; the card a friend reads does not.
  assert.equal(card.line, 'Partnership cost 6 of the 12 marks missed.');
  assert.equal(card.foot, SITE_LINE);
  assert.match(card.alt, /38 of 50 marks, 8 right, 2 wrong, 0 blank/);
});

test('score off: "10 questions done" and a chapter line with no marks in it; no score, no counts', () => {
  const card = shareCard({ ...base, showScore: false, showName: true });
  assert.equal(card.score, null);
  assert.equal(card.subject, 'Accountancy');
  assert.equal(card.done, '10 questions done');
  assert.equal(card.line, 'Next to work on: Partnership.');
  assert.deepEqual(card.stats.map((s) => s.label), ['Time']);
  for (const text of [card.eyebrow, card.subject, card.done, card.line, card.alt]) assert.doesNotMatch(text, /mark|right|wrong|38|50/i);
});

test('score off on a paper with nothing to work on says only what was done', () => {
  const card = shareCard({ ...base, marks: { scored: 50, max: 50, right: 10, wrong: 0, blank: 0 }, finding: { line: 'Every question right.', detail: null }, showScore: false });
  assert.equal(card.line, null);
  assert.equal(card.done, '10 questions done');
});

test('name off, or no name on the account: the eyebrow is the kind of paper only', () => {
  assert.equal(shareCard({ ...base, showName: false }).eyebrow, 'Practice');
  assert.equal(shareCard({ ...base, firstName: null, showName: true }).eyebrow, 'Practice');
  assert.equal(shareCard({ ...base, firstName: '  ', showName: true, mode: 'full' }).eyebrow, 'Full mock');
  assert.equal(shareCard({ ...base, mode: 'nta' }).eyebrow, 'Asha’s NTA paper');
});

test('a blank paper (nothing answered) has no card', () => {
  assert.equal(shareable({ scored: 0, max: 50, right: 0, wrong: 0, blank: 10 }), false);
  assert.equal(shareCard({ ...base, marks: { scored: 0, max: 50, right: 0, wrong: 0, blank: 10 } }), null);
  assert.equal(shareable(null), false);
  assert.equal(shareable({ scored: -1, max: 50, right: 0, wrong: 1, blank: 9 }), true);
});

test('a negative score keeps its minus sign; one question is singular', () => {
  const card = shareCard({ ...base, total: 1, marks: { scored: -1, max: 5, right: 0, wrong: 1, blank: 0 } });
  assert.deepEqual(card.score, { value: '−1', total: '/ 5 marks', negative: true });
  assert.equal(card.subject, 'Accountancy, 1 question');
  assert.equal(shareCard({ ...base, total: 1, marks: { scored: -1, max: 5, right: 0, wrong: 1, blank: 0 }, showScore: false }).done, '1 question done');
});

test('without a costliest-chapter line the tomorrow line is used; without either, no line', () => {
  const later = 'Tomorrow: these 2 mistakes come back in Revise. About 3 minutes.';
  assert.equal(shareCard({ ...base, finding: null, tomorrow: later }).line, later);
  assert.equal(shareCard({ ...base, finding: null, tomorrow: null }).line, null);
});

test('no recorded time: the time is left out, never shown as zero', () => {
  const card = shareCard({ ...base, durationMs: null });
  assert.equal(card.time, null);
  assert.deepEqual(card.stats.map((s) => s.label), ['Right', 'Wrong', 'Blank']);
  assert.deepEqual(shareCard({ ...base, durationMs: 0, showScore: false }).stats, []);
});

test('dateInWords and neutralLine', () => {
  assert.equal(dateInWords('2026-01-02T05:00:00Z', { timeZone: 'Asia/Kolkata' }), '2 January 2026');
  assert.equal(dateInWords(null), '');
  assert.equal(neutralLine('Business Studies cost all 12 marks you missed.'), 'Business Studies cost all 12 marks missed.');
  assert.equal(neutralLine(''), null);
});

test('the share text carries the invite link while invites are live, the plain site link otherwise', () => {
  const invite = { link: 'https://www.mockmob.in/r/K7P2M9X', shareText: 'Practising for CUET on MockMob. Join with my link and we both get 100 credits once you finish one practice.' };
  const withInvite = shareMessage(invite);
  assert.equal(withInvite.url, invite.link);
  assert.ok(withInvite.text.endsWith(invite.link));
  const plain = shareMessage(null);
  assert.equal(plain.url, PLAIN_LINK);
  assert.equal(plain.text, `Practising for CUET on MockMob. ${PLAIN_LINK}`);
  for (const m of [withInvite, plain]) assert.doesNotMatch(m.text, /!/);
});

test('file name and palettes', () => {
  assert.equal(cardFileName({ subjectName: 'Business Studies', completedAt: '2026-11-15T10:00:00Z' }), 'mockmob-business-studies-2026-11-15.png');
  assert.equal(cardFileName({}), 'mockmob-result.png');
  assert.equal(cardPalette('light').bg, '#f3efe6');
  assert.equal(cardPalette('dark').score, '#d2f000');
  // Volt is never text on Day paper (DESIGN.md, the Two Volts Rule).
  assert.notEqual(cardPalette('light').score.toLowerCase(), '#d2f000');
});

test('wrapWords keeps lines inside the width and ends a cut line with an ellipsis', () => {
  const measure = (s) => s.length * 10;
  assert.deepEqual(wrapWords('one two three', 1000, measure), ['one two three']);
  assert.deepEqual(wrapWords('aaaa bbbb cccc dddd', 90, measure, 3), ['aaaa bbbb', 'cccc dddd']);
  const cut = wrapWords('aaaa bbbb cccc dddd eeee ffff gggg', 90, measure, 2);
  assert.equal(cut.length, 2);
  assert.ok(cut[1].endsWith('…'));
  for (const line of cut) assert.ok(measure(line) <= 90);
});
