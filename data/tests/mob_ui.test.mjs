// The Mob's screens (docs/design-decisions/pass-1016e/SOCIAL-SPEC.md sections 7, 14 and 15), checked as source: the words
// are plain (no arrows, no exclamation marks, no 24-hour times, no emoji), the styles carry none of the owner's banned
// looks (ALL-CAPS labels, glow, transition: all, blur on content), dialogs are centred at every width, and no screen
// decides a plan: Free and Pro come from the server's view (the `plan` object), never from the account on the page.
// Run: node --test data/tests/mob_ui.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const dir = resolve(root, 'src/components/mob');
const screens = readdirSync(dir).filter((f) => /\.(jsx|js)$/.test(f)).map((f) => `src/components/mob/${f}`);
const css = read('src/components/mob/mob.css');

// The text a student can read: JSX text between tags and string or template literals, without comments.
function visibleText(source) {
  const noComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const out = [];
  for (const m of noComments.matchAll(/(?<![=-])>([^<>{}=;()]+)</g)) out.push(m[1]);
  for (const m of noComments.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*?)\1/g)) out.push(m[2]);
  // A path, a query or a class list is code, not something a student reads.
  return out.map((t) => t.trim()).filter((t) => /[A-Za-z]/.test(t) && !/^[\w./:@#?&=${}()[\]-]+$/.test(t) && !t.startsWith('/') && !/\$\{[^}]*\}\//.test(t));
}

test('the screens have a source to check', () => {
  assert.ok(screens.length >= 12, screens.join(', '));
  assert.ok(screens.includes('src/components/mob/MobPage.jsx') && screens.includes('src/components/mob/MobExtras.jsx'));
});

test('the copy is plain: no arrows, no exclamation marks, no 24-hour times, no emoji', () => {
  for (const file of screens) {
    const text = visibleText(read(file));
    for (const t of text) {
      assert.doesNotMatch(t, /[→⟶»←↗↘]|&rarr;|&larr;|->/, `${file}: ${t}`);
      assert.doesNotMatch(t, /[A-Za-z0-9.'’)]!(?!=)/, `${file}: an exclamation mark in "${t}"`);
      assert.doesNotMatch(t, /\b([01]\d|2[0-3]):[0-5]\d\b(?!\s?(AM|PM))/, `${file}: 24-hour time in "${t}"`);
      assert.doesNotMatch(t, /\p{Extended_Pictographic}/u, `${file}: emoji in "${t}"`);
    }
  }
});

test('the copy names no build or app internals, and never ranks or shames', () => {
  const banned = /\b(staging|localhost|supabase|MOB_ENABLED|api\/|undefined|null)\b|leaderboard|\brank(s|ed|ing)?\b(?! of)|hurry|last chance|only \d+ (seats|days|hours)|you are falling behind|everyone else/i;
  for (const file of screens) {
    for (const t of visibleText(read(file))) {
      // "never a ranking" is the Mob's own promise; the words that would rank or pressure are what is banned.
      if (/never a ranking|never ranked/i.test(t)) continue;
      assert.doesNotMatch(t, banned, `${file}: ${t}`);
    }
  }
});

test('the styles carry none of the banned looks', () => {
  assert.doesNotMatch(css, /text-transform:\s*uppercase/i, 'no ALL-CAPS labels');
  assert.doesNotMatch(css, /transition:\s*all\b/i, 'no transition: all');
  assert.doesNotMatch(css, /backdrop-filter/i, 'no blur on content');
  assert.doesNotMatch(css, /text-shadow|drop-shadow/i, 'no glow');
  assert.doesNotMatch(css, /background-clip:\s*text/i, 'no gradient text');
  assert.doesNotMatch(css, /letter-spacing:\s*0?\.[1-9]/, 'no tracked labels');
  // The one gradient is the loading shimmer on a skeleton, which is functional.
  const gradients = [...css.matchAll(/^[^\n]*gradient[^\n]*$/gm)].map((m) => m[0]);
  assert.ok(gradients.every((g) => /\.mob-skel\b/.test(g)), gradients.join('\n'));
  assert.doesNotMatch(css, /border-(left|right)(-width)?:\s*[2-9]px/i, 'no thick coloured side borders');
});

test('dialogs are centred at every width, with 16 px left on a phone, and every state of motion has a reduced version', () => {
  const dialog = css.match(/\.mob-dialog \{[^}]*\}/)?.[0] || '';
  assert.match(dialog, /inset:\s*0/);
  assert.match(dialog, /margin:\s*auto/);
  assert.match(dialog, /width:\s*min\(440px,\s*calc\(100vw - 32px\)\)/);
  assert.doesNotMatch(css, /inset:\s*auto 0 0 0/, 'no bottom sheet: the dialog stays centred on a phone');
  assert.doesNotMatch(css, /border-radius:\s*20px 20px 0 0/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.mob-dialog\[open\]/);
  assert.match(css, /data-motion='reduced'/);
});

test('targets are 44 px or more: keys, tabs, chips, colours, icons and rows', () => {
  for (const sel of ['.mob-key', '.mob-tab', '.mob-chip', '.mob-input', '.mob-icon', '.mob-link', '.mob-colour', '.mob-menu__item', '.mob-row-btn']) {
    const rule = css.match(new RegExp(`${sel.replace('.', '\\.')} \\{[^}]*\\}`))?.[0] || '';
    assert.match(rule, /(min-)?(height|width):\s*(4[4-9]|[5-9]\d)px/, `${sel} has no 44 px floor`);
  }
});

test('no screen decides a plan: Free and Pro come from the server view', () => {
  for (const file of screens) {
    const source = read(file);
    assert.doesNotMatch(source, /isPremium|user\??\.plan|user\??\.tier|subscription/, `${file} reads the account's plan`);
  }
  // The screens draw what plan says.
  assert.match(read('src/components/mob/MobPlan.jsx'), /data\.plan\.canStartAnother/);
  assert.match(read('src/components/mob/MobExtras.jsx'), /data\.plan\.canMakeExtra/);
  assert.match(read('src/components/mob/MobHistory.jsx'), /data\.plan\.pro/);
});

test('every Mob write names its Mob, and the runner and the join page send the Mob and extra paper they mean', () => {
  const hook = read('src/components/mob/useMob.js');
  assert.match(hook, /UNSCOPED = new Set\(\['\/api\/mob', '\/api\/mob\/join'\]\)/);
  assert.match(hook, /mob: current\.current/);
  assert.match(read('src/lib/mob/model.mjs'), /mobId: mob\.id/);
  assert.match(read('src/lib/mob/model.mjs'), /extra: extra\.id/);
});

test('the Mob page is behind MOB_ENABLED and the join page is not indexed', () => {
  assert.match(read('src/app/(app)/mob/page.jsx'), /MOB_ENABLED !== 'true'\) notFound\(\)/);
  const join = read('src/app/join/[code]/page.jsx');
  assert.match(join, /MOB_ENABLED !== 'true'\) notFound\(\)/);
  assert.match(join, /robots:\s*\{\s*index:\s*false/);
});
