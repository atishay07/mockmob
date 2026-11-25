// The first-visit desktop note (owner LK320, 18 Nov 2026): phones only, the first visit only, gone for good at the cross,
// and never a jump in the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DESK_NOTE_KEY, DESK_NOTE_MEDIA, DESK_NOTE_VISIT_MS, DESK_NOTE_WORDS, deskNoteGate, deskNoteScript } from './desktopNoteGate.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const cfg = { key: DESK_NOTE_KEY, visit: DESK_NOTE_VISIT_MS, media: DESK_NOTE_MEDIA };

function world({ phone = true, stored = null, cookie = '', appView = false, blocked = false } = {}) {
  const attrs = appView ? { 'data-app-view': '1' } : {};
  const store = new Map(stored === null ? [] : [[DESK_NOTE_KEY, stored]]);
  const w = {
    matchMedia: (q) => ({ matches: q === DESK_NOTE_MEDIA && phone }),
    localStorage: {
      getItem: (k) => { if (blocked) throw new Error('blocked'); return store.has(k) ? store.get(k) : null; },
      setItem: (k, v) => { if (blocked) throw new Error('blocked'); store.set(k, v); },
    },
  };
  const d = { cookie, documentElement: { getAttribute: (k) => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = v; } } };
  return { w, d, attrs, store };
}

test('a first phone visit shows the note and remembers when the visit began', () => {
  const a = world();
  assert.equal(deskNoteGate(a.w, a.d, cfg), true);
  assert.equal(a.attrs['data-desk-note'], '1');
  assert.ok(Number(a.store.get(DESK_NOTE_KEY)) > 0);
});

test('it shows again on a reload during the first visit, never after it, and never once the cross was pressed', () => {
  const now = Date.now();
  assert.equal(deskNoteGate(...Object.values(world({ stored: String(now - 60_000) })).slice(0, 2), cfg), true, 'a minute in: still the first visit');
  assert.equal(deskNoteGate(...Object.values(world({ stored: String(now - DESK_NOTE_VISIT_MS - 1000) })).slice(0, 2), cfg), false, 'the next day: never again');
  const gone = world({ stored: 'x' });
  assert.equal(deskNoteGate(gone.w, gone.d, cfg), false);
  assert.ok(!('data-desk-note' in gone.attrs));
});

test('never on a wide screen, for a signed-in student, in the app view, or where storage is blocked', () => {
  for (const opts of [{ phone: false }, { cookie: 'sb-abc-auth-token=1' }, { appView: true }, { blocked: true }]) {
    const a = world(opts);
    assert.equal(deskNoteGate(a.w, a.d, cfg), false, JSON.stringify(opts));
    assert.ok(!('data-desk-note' in a.attrs));
  }
});

test('the page never jumps for it: server HTML, shown by an attribute set before the first paint; static; one sentence and a cross', () => {
  const note = read('./DesktopNote.jsx');
  assert.doesNotMatch(note, /'use client'|useEffect|useState/, 'a server component: no effect decides whether it shows');
  assert.ok(note.indexOf('<script id="mm-desk-note-gate"') < note.indexOf('<aside className="lp-desk-note"'), 'the gate runs before the note is parsed');
  const script = deskNoteScript();
  assert.doesNotThrow(() => new Function(script), 'it parses');
  assert.doesNotMatch(script, /\bimport\b|\brequire\(|\bexport\b/);
  assert.ok(script.length < 1200, `small enough to inline (${script.length} chars)`);
  assert.equal(DESK_NOTE_WORDS, 'MockMob works best on a laptop or desktop.');
  const css = read('../../app/r19-home-b.css');
  assert.match(css, /\.mm\.lp \.lp-desk-note \{ display: none; \}/, 'hidden unless the gate says so');
  assert.match(css, /html\[data-desk-note\] body \.mm\.lp \.lp-desk-note \{ display: flex;/);
  const block = css.slice(css.indexOf('.lp-desk-note'));
  assert.doesNotMatch(block.slice(0, 1400), /animation|transition/, 'static');
  const close = read('./DesktopNoteClose.jsx');
  assert.match(close, /localStorage\.setItem\(DESK_NOTE_KEY, 'x'\)/);
  assert.match(close, /removeAttribute\('data-desk-note'\)/);
  // 26 Nov 2026 (the council's verdict, tmp/council/2026-11-26-landing): the note is gone from the home page (it was the first
  // line a phone visitor read, and every sign-up comes from a phone). The component stays, unused there; the hero comes first.
  const page = read('../../app/page.js');
  assert.doesNotMatch(page, /<DesktopNote\b|import \{ DesktopNote \}/, 'the home page no longer draws the note');
  assert.match(page, /<main id="main-content">\s*(\{\/\*[\s\S]*?\*\/\}\s*)*<section className="lp-hero"/, 'the hero is the first thing in the page');
});
