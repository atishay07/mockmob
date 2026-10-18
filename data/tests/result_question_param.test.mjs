// ?q=N on the result page (release 7; Today's weak chapters, Last paper and the reel's last key link to /result/{id}?q=N).
// It opens that question's row in Your mistakes and brings it into view, and it NEVER starts a repair: a repair can spend an
// AI credit, so it is only ever the student's own press (coordinator decision, 18 Oct).
// Run: node --test data/tests/result_question_param.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { questionFromSearch } from '../../src/components/result/questionParam.mjs';

const source = readFileSync(new URL('../../src/app/(app)/result/[id]/ResultPageClient.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('?q=N names a question only when it is a whole number from 1 to the paper\'s last question', () => {
  assert.equal(questionFromSearch('?q=3', 10), 3);
  assert.equal(questionFromSearch('q=10', 10), 10);
  assert.equal(questionFromSearch('?part=mistakes&q=7', 50), 7, 'it sits beside ?part=');
  assert.equal(questionFromSearch('?q=1', 1), 1);
  // Unknown or out of range: no question, the page opens as usual.
  for (const search of ['', '?', '?q=', '?q=0', '?q=-2', '?q=11', '?q=3.5', '?q=1e1', '?q=abc', '?q=%20', '?q=03', '?q=99999', '?p=3', null, undefined]) {
    assert.equal(questionFromSearch(search, 10), null, `${JSON.stringify(search)} names no question`);
  }
  assert.equal(questionFromSearch('?q=1', 0), null, 'a paper with no questions');
  assert.equal(questionFromSearch('?q=1', null), null);
  assert.equal(questionFromSearch('?q=1', undefined), null);
});

test('the ?q effect only jumps (no repair option), and a repair is started nowhere from the URL', () => {
  const effect = source.match(/const fromUrl = useRef\(null\);\n  useEffect\(\(\) => \{[\s\S]*?\n  \}, \[attempt, analysis, jumpTo\]\);/);
  assert.ok(effect, 'the effect is on the result page');
  const body = effect[0];
  assert.match(body, /questionFromSearch\(window\.location\.search, analysis\.rows\.length\)/);
  assert.match(body, /if \(n\) jumpTo\(n\);/, 'jumpTo with the number alone');
  assert.doesNotMatch(body, /repair\s*:|autoRepair|AutoRepair|instant/i, 'no { repair: true }, no autoRepair');
  // jumpTo sets autoRepair only when asked to repair; the ?q path never asks.
  const jump = source.match(/const jumpTo = useCallback\(\(number, \{ repair = false[\s\S]*?\n  \}, \[analysis, runIds, engaged, orderedMistakes\]\);/);
  assert.ok(jump, 'jumpTo is unchanged in shape');
  assert.equal([...jump[0].matchAll(/setAutoRepair\(/g)].length, 1);
  assert.match(jump[0], /if \(repair\) setAutoRepair\(row\.q\.id\);/);
  // Every place that sets autoRepair on the page: the reset when a paper loads, jumpTo's guarded call, the start of a repair
  // from the next-move key, and (W-032) the retry gate dropping a stale one. None is reachable from the ?q effect.
  const sites = [...source.matchAll(/setAutoRepair\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(sites.sort(), ['first.q.id', 'null', 'null', 'row.q.id'].sort());
  // The fourth site only ever CLEARS the value, and only for the mistake that has just been revealed: it can never start a repair.
  const reveal = source.match(/const reveal = \(row, how\) => \{[\s\S]*?\n  \};/);
  assert.ok(reveal, 'the retry gate reveal is on the page');
  assert.match(reveal[0], /if \(autoRepair === row\.q\.id\) setAutoRepair\(null\);/);
  assert.equal([...reveal[0].matchAll(/setAutoRepair\(/g)].length, 1);
});
