// U2 (owner's decision, 15 Nov 2026): wherever a screen invites a student with no finished set to begin, the key reads
// "Start 10 questions" and opens Practice with that set chosen. One constant (src/lib/firstSet.mjs), imported at every place,
// and none of the six older wordings left behind. U3: those keys and the scene's failed-load key mark data-page-primary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIRST_SET_COUNT, FIRST_SET_HREF, FIRST_SET_LABEL, firstSetHref } from '../../src/lib/firstSet.mjs';

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

const PLACES = [
  'src/lib/today/firstWeek.mjs', // Today, first week
  'src/components/review/ReviewPage.jsx', // Your papers, empty
  'src/components/revise/ReviseRun.jsx', // Revise, empty
  'src/components/LearningNextAction.jsx', // Progress, next step
  'src/components/ai/RecordView.jsx', // Marks trend, empty record
  'src/components/ai/askDoors.mjs', // Ask Mobi page, empty record door
  'src/components/ai/AskMobiPanel.jsx', // Ask Mobi sheet, new student
  'src/components/ai/askSuggestions.mjs', // Ask Mobi sheet, record asks with no record
  'src/app/(app)/leaderboard/LeaderboardPageClient.jsx', // Your standing, empty
  'src/components/du/CompassPro.jsx', // Colleges projection, no papers
];

test('the first set has one name and one door', () => {
  assert.equal(FIRST_SET_COUNT, 10);
  assert.equal(FIRST_SET_LABEL, 'Start 10 questions');
  assert.equal(FIRST_SET_HREF, '/dashboard?mode=quick&count=10');
  assert.equal(firstSetHref('accountancy'), '/dashboard?subject=accountancy&mode=quick&count=10');
  assert.equal(firstSetHref(null), FIRST_SET_HREF);
  assert.equal(firstSetHref('../x?y'), FIRST_SET_HREF, 'an id that is not a subject id is left out');
});

test('every place that invites the first set imports the shared label, and no older wording is left', () => {
  const OLD = /Start a set\b|Take a 10-question check|Practise 10 questions first|Start a practice session|>Start 10 questions</;
  for (const f of PLACES) {
    // Your standing's ranked state keeps "Start a practice session": that student has mocks, so it is not the first step.
    const src = f.includes('leaderboard') ? read(f).slice(read(f).indexOf("state === 'ready' && !standing")) + read(f).slice(0, read(f).indexOf('export default')) : read(f);
    assert.match(src, /firstSet\.mjs['"]/, `${f} imports the shared first set`);
    assert.match(src, /FIRST_SET_LABEL/, `${f} uses the shared label`);
    assert.doesNotMatch(src, OLD, `${f} has no older wording`);
  }
});

test('the first-set keys and the failed-load scene key are the page primary, so the shell Start key steps back (U3)', () => {
  assert.match(read('src/components/ui/Skeleton.jsx'), /ui-state__action--primary" data-page-primary="">Try again/);
  assert.match(read('src/components/revise/ReviseRun.jsx'), /rvs-next--wide" data-page-primary="" href=\{href\}>\{FIRST_SET_LABEL\}/);
  assert.match(read('src/components/ai/RecordView.jsx'), /btn-volt sm mk-press" data-page-primary="" onClick=\{\(\) => onNavigate\(FIRST_SET_HREF\)\}>\{FIRST_SET_LABEL\}/);
  const saved = read('src/app/(app)/saved/SavedPageClient.jsx');
  assert.match(saved, /sv-empty__link" data-page-primary=""/);
  assert.match(saved, /data-page-primary="" onClick=\{loadSaved\}>Try again/);
});
