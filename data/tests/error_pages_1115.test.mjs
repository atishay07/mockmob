// Production pass, 15 Nov 2026, findings T1 / B4 (no error page anywhere: a crash showed Next's bare "Application error") and
// T2 (an internal design brief shipped hidden in every page). Static checks of the error pages, the offline page and the
// preview that crashes on purpose. The pure helpers are tested in src/components/errors/errorReport.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const exists = (path) => existsSync(new URL(`../../${path}`, import.meta.url));

const ERROR_FILES = ['src/app/error.js', 'src/app/global-error.js', 'src/app/(app)/error.js', 'src/app/(app)/test/error.js'];

test('every error page exists, is a client component and exports what Next 16 calls', () => {
  for (const file of ERROR_FILES) {
    assert.ok(exists(file), `${file} exists`);
    const code = read(file);
    assert.match(code, /^'use client';/, `${file} starts with 'use client'`);
    assert.match(code, /export default function \w+\(\{ error, reset, unstable_retry: retry \}\)/, `${file} takes error, reset and unstable_retry`);
    assert.ok(!/export const metadata|generateMetadata/.test(code), `${file} exports no metadata (not allowed in an error file)`);
  }
});

test('the global error page replaces the root layout: its own html, body, theme and styles', () => {
  const code = read('src/app/global-error.js');
  assert.match(code, /<html lang="en" data-theme=\{theme\} suppressHydrationWarning>/);
  assert.match(code, /<body className="ge-body"/);
  // The theme the way the root layout sets it: Day unless the visitor chose Night, read before paint and on the client.
  assert.match(code, /localStorage\.getItem\('\$\{THEME_KEY\}'\)==='dark'\?'dark':'light'/);
  assert.match(code, /const THEME_KEY = 'mm:theme:v1';/);
  assert.match(read('src/app/layout.js'), /localStorage\.getItem\('mm:theme:v1'\)==='dark'\?'dark':'light'/);
  // Both palettes inline, nothing imported that needs the app's CSS.
  assert.match(code, /:root\{--ge-bg:#f3efe6/);
  assert.match(code, /:root\[data-theme='dark'\]\{--ge-bg:#12110e/);
  assert.ok(!/import ['"][^'"]+\.css['"]/.test(code), 'no stylesheet import');
  assert.match(code, /<meta name="viewport"/);
  // A plain link home: a full load when the whole app failed.
  assert.match(code, /<a className="ge-key" href="\/">\{ERROR_COPY\.toHome\}<\/a>/);
});

test('each page says the right thing and offers one volt key and one quiet way out', () => {
  const root = read('src/app/error.js');
  assert.match(root, /className="view app-shell snf"/, 'the not-found page\'s frame');
  assert.match(root, /<Logo \/>/);
  assert.match(root, /href="\/"/);
  assert.match(root, /signedIn \? ERROR_COPY\.toToday : ERROR_COPY\.toHome/);
  assert.match(root, /useContext\(AuthContext\)/, 'never useAuth(), which throws outside its provider');
  const app = read('src/app/(app)/error.js');
  assert.match(app, /href="\/today"/);
  assert.match(app, /linkLabel=\{ERROR_COPY\.toToday\}/);
  const paper = read('src/app/(app)/test/error.js');
  assert.match(paper, /line=\{ERROR_COPY\.paperLine\}/);
  assert.match(paper, /retryLabel=\{ERROR_COPY\.paperRetry\}/);
  assert.match(paper, /href="\/dashboard"/);
  assert.match(paper, /linkLabel=\{ERROR_COPY\.toPractice\}/);
  const state = read('src/components/errors/ErrorState.jsx');
  assert.equal((state.match(/ui-state__action--primary/g) || []).length, 1, 'one volt key');
  assert.match(state, /data-page-primary=""/, 'the shell\'s Start key goes quiet beside it');
  assert.match(state, /reportError\(error, where\)/);
  assert.ok(!/error\.message|error\.stack|\{error\}/.test(state.replace(/error=\{error\}/g, '')), 'no error text or stack on screen');
});

test('the paper page only promises what the runner keeps: a draft written after every change', () => {
  const runner = read('src/app/(app)/test/TestPageClient.jsx');
  // The runner's draft code as the test-screen lane left it (W1-A, 15 Nov 2026): one writer, called after every change.
  assert.match(runner, /window\.localStorage\.setItem\(draftKey, value\)/, 'the draft is written');
  assert.match(runner, /writeDraft\(key, draft\);\s*\}, \[questions, answers, visited, marked, selectionMeta, endsAt, idx, key, loading, generationKey, pendingSubmission, writeDraft/, 'after every answer, mark and move');
  assert.match(runner, /if \(saved && \(late \|\| resumableDraft\(saved, match\)\)\) \{/, 'and read back when the runner mounts');
  assert.match(runner, /setAnswers\(saved\.answers \|\| \{\}\)/);
});

test('no error copy, offline copy or error file text uses an exclamation mark', () => {
  const visible = (code) => code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const file of [...ERROR_FILES, 'src/components/errors/ErrorState.jsx', 'src/components/errors/errorCopy.mjs']) {
    const strings = visible(read(file)).match(/'[^'\n]*'|"[^"\n]*"|>[^<>{}\n]+</g) || [];
    for (const s of strings) assert.ok(!/[A-Za-z.] *!(?!=)/.test(s), `${file}: ${s}`);
  }
  const offline = read('public/offline.html').replace(/<script>[\s\S]*?<\/script>/g, (s) => s.replace(/!==?|!navigator|!\w/g, ''));
  const text = offline.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ');
  assert.ok(!text.includes('!'), 'offline page text');
});

test('the offline page works with no network: everything inline, Try again reloads, the theme as the site sets it', () => {
  const html = read('public/offline.html');
  assert.ok(!/<link[^>]+stylesheet/i.test(html), 'no stylesheet link');
  assert.ok(!/<script[^>]+src=/i.test(html), 'no script file');
  assert.ok(!/<img/i.test(html), 'no image file');
  assert.ok(!/url\(/i.test(html), 'no CSS url');
  assert.match(html, /<svg class="logo-b"/, 'the wordmark is inline');
  assert.match(html, /<button type="button" id="retry">Try again<\/button>/);
  assert.match(html, /location\.reload\(\)/);
  assert.match(html, /localStorage\.getItem\('mm:theme:v1'\)==='dark'\?'dark':'light'/);
  assert.match(html, /:root\[data-theme='dark'\]\{--bg:#12110e/);
  assert.match(html, /<meta name="viewport"/);
  // The service worker still serves it and precaches it.
  assert.match(read('public/sw.js'), /caches\.match\('\/offline\.html'\)/);
});

test('T2: the hidden design brief is gone from every page', () => {
  const layout = read('src/app/layout.js');
  assert.ok(!layout.includes('data-impeccable-contract'));
  assert.ok(!layout.includes('DIRECTION_CONTRACT'));
  assert.ok(!layout.includes('IMPECCABLE'));
});

test('the crash preview is development only, and the root page\'s hand-off to the global page is too', () => {
  const page = read('src/app/preview/crash/page.jsx');
  assert.match(page, /if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
  const root = read('src/app/error.js');
  assert.match(root, /if \(process\.env\.NODE_ENV !== 'production' && error\?\.mmPreviewGlobal\) throw error;/);
  // No route imports the preview except the Arena preview.
  assert.ok(!read('src/app/(app)/error.js').includes('preview'));
  assert.ok(!read('src/app/global-error.js').includes('preview'));
});
