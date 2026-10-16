// node --test src/components/landing/landingCopy.test.mjs
// The landing's claims about the question bank and repeats must stay as true as the code behind them: the mock
// selector favours unanswered questions but promises nothing more (data/mock_question_selector.js), and Recovery
// checks fail rather than repeat when a bank runs dry. So no landing copy may say a question "never repeats".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { weakChapters } from './labStory.mjs';

const here = new URL('./', import.meta.url);
const read = (url) => readFileSync(url, 'utf8');
const PAGE = read(new URL('../../app/page.js', import.meta.url));
const LANDING = readdirSync(here)
  .filter((name) => /\.(jsx|mjs)$/.test(name) && !name.endsWith('.test.mjs'))
  .map((name) => [name, read(new URL(name, here))]);

test('no landing copy promises that questions never repeat', () => {
  for (const [name, source] of [['page.js', PAGE], ...LANDING]) {
    assert.doesNotMatch(source, /never\s+repeat/i, `${name} says "never repeat"`);
    assert.doesNotMatch(source, /no repeats|without repeats|zero repeats/i, `${name} promises no repeats`);
  }
});

test('the question bank and unlimited mocks are said at heading level, and always "with Pro"', () => {
  assert.match(PAGE, /<h2 className="lp-shelf__title"[^>]*>One question bank\. As many mocks as you want with Pro\.<\/h2>/);
  assert.match(PAGE, /Unlimited mocks with Pro, ₹\$\{OFFER\.oneTime\.rupees\} once\./, 'the pricing heading names unlimited mocks with Pro');
  assert.match(PAGE, /Unlimited mocks with Pro, ₹\$\{OFFER\.monthly\.rupees\} a month\./);
  // The hero's facts lead with the bank.
  const facts = PAGE.slice(PAGE.indexOf('<nav className="lp-proof"'), PAGE.indexOf('</nav>'));
  assert.ok(facts.indexOf('Unlimited mocks with Pro') < facts.indexOf('Two exam screens'), 'the bank fact comes first');
  // The shelf's note is honest that an answered question can come back.
  assert.match(PAGE, /one you have answered can come back/);
});

test('the bank counts are in the server HTML, read from the stored snapshot', () => {
  assert.match(PAGE, /export const revalidate = \d+;/);
  assert.match(PAGE, /<SubjectCount id=\{id\} initial=\{/);
  assert.match(PAGE, /<HeroLive initial=\{bankCounts\} \/>/);
});

test('the tour titles its chapter list as a ranked list, since it holds strengths too', () => {
  const tour = read(new URL('TourScreens.jsx', here));
  assert.match(tour, /<Frame title="Your chapters, weakest first"/);
  assert.doesNotMatch(tour, /Weak chapters across/);
  const rows = weakChapters();
  for (let i = 1; i < rows.length; i += 1) assert.ok(rows[i - 1].right / rows[i - 1].of <= rows[i].right / rows[i].of, 'weakest first');
});
