// Class leagues on the website (src/components/class/, src/app/class/): what the source must keep, read as text. Every surface
// draws nothing while the switch is off; the mounts on the Sunday Mock's and the Mob's surfaces are one line each; the Sunday
// Mock page keeps its one volt key; the join page carries its code through sign-up; the browser never touches a table.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n'); // a Windows checkout has CRLF
const DIR = 'src/components/class/';
const files = readdirSync(new URL(`../../${DIR}`, import.meta.url)).filter((f) => /\.jsx?$/.test(f));

test('every class surface draws nothing while the switch is off (the status read answers 404 or 401)', () => {
  const hook = read(`${DIR}useClassLeague.js`);
  assert.match(hook, /if \(r\.status === 404 \|\| r\.status === 401\) \{ off = true; return \{ status: 'off', data: null \}; \}/);
  assert.match(read(`${DIR}ClassBlock.jsx`), /if \(league\.status === 'off'\) return null;/);
  assert.match(read(`${DIR}ClassMobEntry.jsx`), /if \(league\.status === 'off' \|\| league\.status === 'loading'\) return null;/);
  assert.match(read(`${DIR}ClassTodayCard.jsx`), /if \(hold \|\| league\.status !== 'ready'\) return null;/);
  assert.match(read(`${DIR}ClassResultLine.jsx`), /if \(!f\) return null;/);
  // The preview draws the feature off unless a fixture asks for it, as production is.
  assert.match(read('src/app/preview/arena/previewClass.js'), /fixture\.get\('class'\) \|\| 'off'/);
});

test('the mounts are small and self-contained', () => {
  assert.match(read('src/components/sunday/SundayPage.jsx'), /<ClassBlock \/>/);
  assert.match(read('src/components/sunday/SundayTodayCard.jsx'), /return <><SundayCard hold=\{hold\} \/><ClassTodayCard hold=\{hold\} \/><\/>;/);
  assert.match(read('src/components/sunday/SundayResultRow.jsx'), /<ClassResultLine week=\{week\} subject=\{attempt\?\.subject \|\| null\} \/>/);
  const mob = read('src/components/mob/MobPage.jsx');
  assert.equal((mob.match(/<ClassMobEntry \/>/g) || []).length, 2, 'in a Mob above its members, and under the start when there is none');
});

test('one volt key per view: on the Sunday Mock page every class key is quiet; only a dialog\'s own key and the join page are volt', () => {
  const block = read(`${DIR}ClassBlock.jsx`);
  const outside = block.slice(block.indexOf('function Fresh('));
  assert.doesNotMatch(outside, /cls-key--volt|volt\b/, 'Fresh, InClass and the block draw quiet keys only');
  assert.match(block.slice(block.indexOf('function CreateDialog('), block.indexOf('function SettingsDialog(')), /cls-key cls-key--volt/);
  assert.doesNotMatch(read(`${DIR}ClassTodayCard.jsx`), /cls-key--volt/, 'Today keeps its lead card\'s volt');
  assert.doesNotMatch(read(`${DIR}ClassMobEntry.jsx`), /cls-key--volt/);
  const join = read(`${DIR}ClassJoin.jsx`);
  assert.equal((join.match(/data-page-primary=""/g) || []).length, 3, 'one primary in each of the three signed states');
});

test('the join page carries the code through sign-up and log-in, and the public page shows no count or name of anyone', () => {
  const join = read(`${DIR}ClassJoin.jsx`);
  assert.match(join, /rememberClassCode\(code\);\n\s*router\.push\(signupPathFor\(classPath\(code\)\)\);/);
  assert.match(join, /loginPathFor\(classPath\(code\)\)/);
  assert.doesNotMatch(join, /members|membersLine/, 'no member count on the public page');
  const page = read('src/app/class/[code]/page.jsx');
  assert.match(page, /robots: \{ index: false, follow: false/);
  assert.doesNotMatch(page, /supabase|lookup\(/i, 'the link preview reads nothing about the class');
});

test('browser code never touches a table or an rpc; it only calls /api/class', () => {
  for (const f of files) {
    const text = read(`${DIR}${f}`);
    assert.doesNotMatch(text, /supabase/i, f);
    for (const [, path] of text.matchAll(/['"`](\/api\/[a-z/-]+)/g)) assert.match(path, /^\/api\/class(\/|$)/, `${f} calls ${path}`);
  }
});

test('the words: no exclamation marks, no arrows on keys, no rank or percentile anywhere on a class surface', () => {
  for (const f of [...files.map((x) => `${DIR}${x}`), 'src/lib/classLeague/model.mjs']) {
    const text = read(f).replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    const strings = [...text.matchAll(/'([^'\\\n]{6,})'|"([^"\\\n]{6,})"|`([^`\\\n]{6,})`|>([^<>{}\n]{6,})</g)].map((m) => m[1] || m[2] || m[3] || m[4]);
    for (const s of strings) {
      assert.doesNotMatch(s, /!(?!=)/, `${f}: ${s}`);
      assert.doesNotMatch(s, /→|->(?!\w)|»/, `${f}: ${s}`);
      assert.doesNotMatch(s, /\b(percentile|topper|leaderboard|top \d+|highest mark)\b/i, `${f}: ${s}`);
    }
  }
});
