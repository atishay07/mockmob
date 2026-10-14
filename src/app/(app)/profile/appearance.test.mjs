import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme, resolveGlass } from '../../../../shared/theme.mjs';
import {
  THEME_KEY, GLASS_KEY, THEME_OPTIONS, GLASS_OPTIONS, readAppearance, writeAppearance, appearanceNote,
} from './appearance.mjs';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
  };
}

const blocked = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('SecurityError'); },
};

test('options use the app words and cover every value the boot script accepts', () => {
  assert.deepEqual(THEME_OPTIONS.map((o) => [o.id, o.label]), [['dark', 'Night'], ['light', 'Daylight']]);
  assert.deepEqual(GLASS_OPTIONS.map((o) => [o.id, o.label]), [['full', 'Full'], ['lite', 'Lite'], ['off', 'Off']]);
});

test('reading: saved values, junk ignored, blocked storage never throws', () => {
  assert.deepEqual(readAppearance(memoryStorage({ [THEME_KEY]: 'light', [GLASS_KEY]: 'off' })), { theme: 'light', glass: 'off', available: true });
  assert.deepEqual(readAppearance(memoryStorage({ [THEME_KEY]: 'sepia', [GLASS_KEY]: 'max' })), { theme: null, glass: null, available: true });
  assert.deepEqual(readAppearance(blocked), { theme: null, glass: null, available: false });
  assert.deepEqual(readAppearance(null), { theme: null, glass: null, available: false });
});

test('a saved choice is what the boot rules then pick, on any route', () => {
  const storage = memoryStorage();
  assert.equal(writeAppearance(storage, 'theme', 'light'), true);
  assert.equal(writeAppearance(storage, 'glass', 'lite'), true);
  assert.equal(resolveTheme({ saved: storage.getItem(THEME_KEY), pathname: '/profile' }), 'light');
  assert.equal(resolveGlass({ saved: storage.getItem(GLASS_KEY), coarsePointer: false }), 'lite');
  assert.equal(writeAppearance(storage, 'theme', 'dark'), true);
  assert.equal(resolveTheme({ saved: storage.getItem(THEME_KEY), pathname: '/' }), 'dark');
});

test('writing refuses junk and reports a browser that did not keep it', () => {
  const storage = memoryStorage();
  assert.equal(writeAppearance(storage, 'theme', 'blue'), false);
  assert.equal(writeAppearance(storage, 'glass', 'heavy'), false);
  assert.equal(writeAppearance(storage, 'font', 'big'), false);
  assert.equal(storage.getItem(THEME_KEY), null);
  assert.equal(writeAppearance(blocked, 'theme', 'dark'), false);
  assert.equal(writeAppearance(null, 'glass', 'off'), false);
});

test('status lines say where the choice lives', () => {
  assert.equal(appearanceNote('theme', 'dark', true), 'Night theme, kept on this device.');
  assert.equal(appearanceNote('glass', 'off', true), 'Glass off, kept on this device.');
  assert.match(appearanceNote('theme', 'light', false), /^Daylight theme for this visit\. /);
});
