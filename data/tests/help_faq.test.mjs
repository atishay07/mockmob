import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAQ_ITEMS, FAQ_IDS, SUPPORT_EMAIL, SUPPORT_ROW, faqIdFrom } from '../../src/lib/helpFaq.mjs';
import { AI_CREDITS, PRACTICE_CREDITS } from '../../src/lib/creditCopy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('Help carries the same six questions as the app, with unique ids', () => {
  assert.deepEqual(FAQ_IDS, ['credits', 'history', 'nta', 'study-days', 'sign-in', 'offline']);
  assert.equal(new Set(FAQ_IDS).size, FAQ_IDS.length);
  for (const item of FAQ_ITEMS) assert.ok(item.question.endsWith('?') && item.answer.length >= 1, item.id);
});

test('credit words are the two names the site uses, and Practice credits are not said to renew', () => {
  const credits = FAQ_ITEMS.find((i) => i.id === 'credits').answer.join(' ');
  assert.ok(credits.includes(PRACTICE_CREDITS) && credits.includes(AI_CREDITS));
  assert.match(credits, /Practice credits do not renew/);
  assert.doesNotMatch(credits, /each shows when it renews/i);
});

test('plain copy: no exclamation, em dash, middle dot or emoji', () => {
  const all = FAQ_ITEMS.flatMap((i) => [i.question, ...i.answer]).join('\n') + SUPPORT_ROW.note;
  assert.doesNotMatch(all, /[!—·]/);
  assert.doesNotMatch(all, /\p{Extended_Pictographic}/u);
});

test('the support row writes to support@mockmob.in', () => {
  assert.equal(SUPPORT_EMAIL, 'support@mockmob.in');
  assert.match(SUPPORT_ROW.href, /^mailto:support@mockmob\.in/);
  assert.ok(FAQ_ITEMS.find((i) => i.id === 'sign-in').answer.join(' ').includes(SUPPORT_EMAIL));
});

test('?q and #hash open a real question only', () => {
  assert.equal(faqIdFrom('nta'), 'nta');
  assert.equal(faqIdFrom('#Sign-In'), 'sign-in');
  assert.equal(faqIdFrom('nope'), null);
  assert.equal(faqIdFrom(null), null);
});

test('Help is linked from the account menu and the footer, and the page exists', () => {
  assert.match(read('src/lib/arenaNavigation.js'), /label: 'Account', items: \[[^\]]*item\('help', 'Help', 'help'\)/);
  assert.match(read('src/components/MarketingFooter.jsx'), /\['Help', '\/help'\]/);
  assert.doesNotThrow(() => read('src/app/(app)/help/page.js'));
});

test('the arena menu offers Night, Daylight and Match device, tied to the same setting as Account', () => {
  const src = read('src/components/AppearanceSwitch.jsx');
  for (const word of ['Night', 'Daylight', 'Match device', 'setThemeMode', 'useThemeMode']) assert.ok(src.includes(word), word);
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.equal((shell.match(/<AppearanceSwitch \/>/g) || []).length, 2, 'sidebar and More sheet');
});
