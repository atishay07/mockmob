// The launch film's place on the home page (owner LK427, 23 Nov 2026): off for visitors until he says so, previewed by /?film=1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FILM_PREVIEW_PARAM, LAUNCH_FILM, LAUNCH_FILM_COPY, LAUNCH_FILM_ON, launchFilmShown, launchFilmSource } from './launchFilm.mjs';

const path = (rel) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const read = (rel) => readFileSync(path(rel), 'utf8');

test('the key is off for visitors and shows only with the preview query, until the switch is on', () => {
  assert.equal(LAUNCH_FILM_ON, false, 'off unless NEXT_PUBLIC_LAUNCH_FILM is set to true at build time');
  assert.equal(FILM_PREVIEW_PARAM, 'film');
  assert.equal(launchFilmShown({ on: false, search: '' }), false);
  assert.equal(launchFilmShown({ on: false, search: '?film=1' }), true);
  assert.equal(launchFilmShown({ on: false, search: '?film=0' }), false);
  assert.equal(launchFilmShown({ on: false, search: '?appnudge=1' }), false);
  assert.equal(launchFilmShown({ on: true, search: '' }), true);
  const jsx = read('src/components/landing/LaunchFilmKey.jsx');
  assert.match(jsx, /className="lf-key" hidden=\{!LAUNCH_FILM_ON\}/, 'the key is drawn hidden');
  assert.match(jsx, /launchFilmShown\(\{ search: window\.location\.search \}\)/);
});

test('the film is the approved cut, and its file is fetched only when the key is pressed', () => {
  assert.equal(LAUNCH_FILM.seconds, 82);
  for (const file of [LAUNCH_FILM.poster, LAUNCH_FILM.sources.full, LAUNCH_FILM.sources.lite]) {
    assert.match(file, /^\/video\/launch-5j-/, 'the cut is in the name');
    assert.ok(existsSync(path(`public${file}`)), file);
  }
  assert.ok(statSync(path(`public${LAUNCH_FILM.sources.full}`)).size < 12 * 1024 * 1024, 'the 720p file stays under 12 MB');
  assert.ok(statSync(path(`public${LAUNCH_FILM.sources.lite}`)).size < 6 * 1024 * 1024, 'the 480p file stays under 6 MB');
  assert.ok(statSync(path(`public${LAUNCH_FILM.poster}`)).size < 60 * 1024, 'the poster stays under 60 KB');
  assert.equal(launchFilmSource({}), LAUNCH_FILM.sources.full);
  assert.equal(launchFilmSource({ lite: true }), LAUNCH_FILM.sources.lite);
  assert.equal(launchFilmSource({ saveData: true }), LAUNCH_FILM.sources.lite);
  const jsx = read('src/components/landing/LaunchFilmKey.jsx');
  assert.match(jsx, /preload="none"/);
  assert.doesNotMatch(jsx, /<video[^>]*\ssrc=/, 'no source in the page: it is set on the press');
  assert.doesNotMatch(jsx, /autoPlay/);
  assert.match(jsx, /<dialog ref=\{dialogRef\}/, 'a native dialog: Esc closes it and the page behind is inert');
});

test('the words are plain, and the key sits with the hero links', () => {
  assert.equal(LAUNCH_FILM_COPY.key, 'Watch the 82-second launch film');
  for (const text of Object.values(LAUNCH_FILM_COPY)) assert.doesNotMatch(text, /[—!]|\p{Extended_Pictographic}/u, text);
  const page = read('src/app/page.js');
  assert.match(page, /className="lp-hero__tool">[^<]+<\/Link>\s*\{\/\*[^*]*\*\/\}\s*<LaunchFilmKey \/>/);
  // The hero film is its own switch: v10 since the owner's "switch it to live" (23 Nov 2026); the launch film's key is separate.
  assert.match(read('src/components/landing/heroFilmConfig.mjs'), /hero-v10-/);
});
