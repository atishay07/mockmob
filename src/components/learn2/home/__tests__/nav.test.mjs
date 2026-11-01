// node --test src/components/learn2/home/__tests__/nav.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// arenaNavigation.js imports through the app's '@/' alias, which plain Node does not know: point that one specifier at the real file.
const source = readFileSync(new URL('../../../../lib/arenaNavigation.js', import.meta.url), 'utf8').replace("'@/../data/capabilities'", `'${new URL('../../../../../data/capabilities.js', import.meta.url).href}'`);
const { PRACTICE_PAGES, practicePages, arenaNavigation, placeTabs } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test('Practice pages read Practice, Learn, Your papers, Explore, Saved', () => {
  assert.deepEqual(practicePages({ learn2: true }).map((t) => t.label), ['Practice', 'Learn', 'Your papers', 'Explore', 'Saved']);
  assert.deepEqual(PRACTICE_PAGES.map((t) => t.label), ['Practice', 'Your papers', 'Learn', 'Explore', 'Saved'], 'the live order while Learn v2 is off');
});

test('the sidebar draws "Learn, Key cards" as the first sub-row of Practice', () => {
  const practice = arenaNavigation(false, { mob: true, learn2: true }).find((g) => g.id === 'practice');
  assert.deepEqual(practice.items.map((i) => i.label), ['Practice', 'Learn', 'Your papers', 'Explore', 'Saved']);
  const learn = practice.items[1];
  assert.equal(learn.sub, true);
  assert.equal(learn.hint, 'Key cards');
  assert.equal(learn.href, '/learn');
});

test('N1: Learn stands as its own place with one sub-row that opens Find', () => {
  const groups = arenaNavigation(false, { mob: true, learnPlace: true });
  assert.deepEqual(groups.map((g) => g.id), ['today', 'practice', 'learn', 'mob', 'you']);
  assert.deepEqual(groups.find((g) => g.id === 'practice').items.map((i) => i.label), ['Practice', 'Your papers', 'Explore', 'Saved']);
  const learn = groups.find((g) => g.id === 'learn');
  assert.deepEqual(learn.items.map((i) => i.label), ['Learn', 'Key cards to revise']);
  assert.equal(learn.items[0].place, true);
  assert.equal(learn.items[0].hint, null);
  assert.equal(learn.items[1].href, '/learn/find');
});

test('the tab row also draws on Learn\'s chapter and Find pages, not on the player', () => {
  for (const path of ['/learn', '/learn/c/accountancy.accounting-ratios', '/learn/find']) {
    const row = placeTabs(path, { study: true, learn2: true });
    assert.deepEqual(row?.tabs.map((t) => t.label), ['Practice', 'Learn', 'Your papers', 'Explore', 'Saved'], path);
  }
  assert.equal(placeTabs('/learn/run', { study: true, learn2: true }), null);
  assert.equal(placeTabs('/learn/c/x', { study: true }), null, 'only with Learn v2 on');
  assert.equal(placeTabs('/learn/c/x', { study: false }), null, 'only while Learn is on');
});
