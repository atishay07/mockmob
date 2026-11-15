// Locks the DU CSAS 2026 cutoffs the app serves to what was checked against DU's PDFs on 15 Nov 2026
// (data/du-csas-2026/verification/REPORT.md). A re-parse or rebuild that changes a count or one of
// these cells fails here; if DU publishes a corrected list, re-run verify.py and update this file
// together with REPORT.md and the checked date in src/lib/du/sources.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DU_SOURCES, DU_CHECKED_ON, duSourceLine, formatDuDate } from '../../src/lib/du/sources.js';

const root = path.resolve(import.meta.dirname, '../../public/du/2026');
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
const offeringFiles = fs.readdirSync(path.join(root, 'offerings')).filter((f) => f.endsWith('.json'));
const offerings = Object.fromEntries(
  offeringFiles.map((f) => {
    const o = JSON.parse(fs.readFileSync(path.join(root, 'offerings', f), 'utf8'));
    return [o.id, o];
  })
);
const CATEGORIES = ['UR', 'OBC-NCL', 'SC', 'ST', 'EWS', 'SIKH', 'PwBD', 'KM', 'SGC', 'ORPHAN-FEMALE', 'ORPHAN-MALE'];
const allRows = Object.values(offerings).flatMap((o) => o.rows);

function rowOf(groupId, college, programme) {
  const rows = offerings[groupId].rows.filter((r) => r[0] === college && r[1] === programme);
  assert.equal(rows.length, 1, `${groupId}: ${college} / ${programme}`);
  return rows[0];
}
const cell = (row, round, category) => {
  const arr = row[1 + round];
  return arr === null ? undefined : arr[CATEGORIES.indexOf(category)];
};

test('verified totals: rows, colleges, programmes, categories and cells per round', () => {
  assert.deepEqual(index.meta.categories, CATEGORIES);
  assert.deepEqual(index.meta.rounds, ['round-1', 'round-2', 'round-3']);
  assert.equal(index.meta.offerings, 1393);
  assert.equal(index.meta.colleges, 67);
  assert.equal(index.groups.length, 73);
  assert.equal(index.groups.filter((g) => g.offerings > 0).length, 68);
  assert.equal(offeringFiles.length, 68);
  assert.equal(allRows.length, 1393);
  assert.equal(new Set(allRows.map((r) => r[0])).size, 67);
  assert.deepEqual(index.meta.scoreRange, [9.9016, 958.7147]);
  // Rows DU printed in each round (S.NO 1..N) and the scores printed in them.
  const perRound = [0, 1, 2].map((i) => ({
    rows: allRows.filter((r) => r[2 + i] !== null).length,
    cells: allRows.reduce((n, r) => n + (r[2 + i] ? r[2 + i].filter((v) => v !== null).length : 0), 0),
  }));
  assert.deepEqual(perRound, [
    { rows: 1393, cells: 8209 },
    { rows: 1393, cells: 6953 },
    { rows: 956, cells: 2154 },
  ]);
  for (const r of allRows) {
    for (const arr of r.slice(2)) {
      if (arr === null) continue;
      assert.equal(arr.length, 11);
      for (const v of arr) assert.ok(v === null || (typeof v === 'number' && v > 0 && v <= 1000), `${r[0]} / ${r[1]}: ${v}`);
    }
  }
});

test('verified cells: the five named colleges, read from the PDFs on 15 Nov 2026', () => {
  // Shri Ram College of Commerce, B.Com. (Hons.): Round 1 p45 S.NO 1079, Round 2 p36 S.NO 1079, not in Round 3.
  const srcc = rowOf('b-com-hons', 'Shri Ram College of Commerce', 'B.Com. (Hons.)');
  assert.deepEqual(srcc[2], [924.3009, 849.1369, 796.3987, 723.6367, 887.9131, null, 707.8404, 562.4688, 921.2, 823.3106, 898.157]);
  assert.deepEqual(srcc[3], [923.8384, 848.615, 796.3987, 723.6367, 887.9131, null, 681.2627, 519.2461, null, null, null]);
  assert.equal(srcc[4], null);
  // Hindu College, B.A. (Hons.) Political Science, Round 1 UR: the highest score in all three lists (p17 S.NO 396).
  const hinduPol = rowOf('b-a-hons-political-science', 'Hindu College', 'B.A. (Hons.) Political Science');
  assert.equal(cell(hinduPol, 1, 'UR'), 958.7147);
  assert.equal(cell(hinduPol, 2, 'UR'), 956.2602);
  assert.equal(cell(hinduPol, 2, 'SGC'), null);
  // Miranda House, B.A. (Hons.) English, Round 3 (p19 S.NO 487): three categories only.
  const mirandaEng = rowOf('b-a-hons-english', 'Miranda House (W)', 'B.A. (Hons.) English');
  assert.deepEqual(mirandaEng[4], [null, 756.714, null, 641.9364, null, null, 426.7049, null, null, null, null]);
  // Hansraj College, B.Com. (Hons.), Round 3 (p10 S.NO 241).
  const hansrajCom = rowOf('b-com-hons', 'Hansraj College', 'B.Com. (Hons.)');
  assert.deepEqual(hansrajCom[4], [896.629, 836.3163, null, null, null, null, null, null, null, null, null]);
  // Lady Shri Ram College, B.Sc. (Hons.) Mathematics, Round 2 (p22 S.NO 646).
  const lsrMaths = rowOf('b-sc-hons-mathematics', 'Lady Shri Ram College for Women (W)', 'B.Sc. (Hons.) Mathematics');
  assert.deepEqual(lsrMaths[3], [776.3898, 570.3611, 465.8045, 411.3434, 607.2364, null, null, null, null, null, null]);
  // Miranda House does not offer B.Com. (Hons.); SRCC offers only B.Com. (Hons.) and Economics of the five.
  assert.equal(offerings['b-com-hons'].rows.some((r) => r[0] === 'Miranda House (W)'), false);
  assert.equal(allRows.filter((r) => r[0] === 'Shri Ram College of Commerce').length, 2);
});

test('verified cells: rows with blank columns between filled ones keep each score under its own category', () => {
  // Daulat Ram College, B.A. (Hons.) Psychology, Round 2 (p5 S.NO 142): SIKH and ORPHAN-MALE blank.
  const drc = rowOf('b-a-hons-psychology', 'Daulat Ram College (W)', 'B.A. (Hons.) Psychology');
  assert.deepEqual(drc[3], [872.1996, 799.265, 763.7343, 758.1468, 787.2494, null, 717.493, 566.2445, 872.1837, 403.7624, null]);
  // Acharya Narendra Dev College, B.Com. (Hons.), Round 1 (p1 S.NO 1): KM and ORPHAN-MALE after four blanks.
  const andc = rowOf('b-com-hons', 'Acharya Narendra Dev College', 'B.Com. (Hons.)');
  assert.deepEqual(andc[2], [718.5747, 569.0049, 484.8911, 139.9449, 628.5515, null, null, 283.6192, 717.1988, null, 241.2434]);
  // Aryabhatta College, B.A. (Hons.) English, Round 3 (p2 S.NO 28): one PwBD score and nothing else.
  const arya = rowOf('b-a-hons-english', 'Aryabhatta College', 'B.A. (Hons.) English');
  assert.deepEqual(arya[4], [null, null, null, null, null, null, 347.4187, null, null, null, null]);
  // The lowest score in all three lists: Rajdhani College, B.Sc. (Hons.) Chemistry, Round 2 SC.
  assert.equal(cell(rowOf('b-sc-hons-chemistry', 'Rajdhani College', 'B.Sc. (Hons.) Chemistry'), 2, 'SC'), 9.9016);
});

test('the verification run on file found no mismatch and covers the served data', () => {
  const dir = path.resolve(import.meta.dirname, '../du-csas-2026/verification');
  const results = JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8'));
  assert.equal(results.mismatches, 0);
  assert.deepEqual(Object.values(results.verdict_inputs), [true, true, true, true]);
  for (const s of index.meta.sources) assert.equal(results.documents[s.id].sha256, s.sha256, `${s.id} is the file that was checked`);
  assert.equal(results.totals.cells_compared_all_rounds, (1393 + 1393 + 956) * 11);
  assert.equal(results.totals.served_cells_all_rounds, 8209 + 6953 + 2154);
});

test('every source records what it is and when it was checked; the cutoff line reads from it', () => {
  assert.equal(DU_CHECKED_ON, '2026-11-15');
  for (const s of DU_SOURCES) {
    assert.ok(s.title && s.printedTitle && s.issuer && s.use && s.url, s.id);
    assert.match(s.releasedOn, /^2026-\d{2}-\d{2}$/);
    assert.equal(s.checkedOn, '2026-11-15');
    assert.ok(s.checked.length > 20, s.id);
    assert.equal(s.documentDate, null, `${s.id}: no date is printed on the document`);
  }
  assert.deepEqual(DU_SOURCES.map((s) => s.round), [null, 1, 2, 3]);
  assert.equal(formatDuDate('2026-11-15'), '15 Nov 2026');
  assert.equal(duSourceLine(1), 'Source: Delhi University CSAS (UG) 2026, round 1. Checked 15 Nov 2026.');
  assert.equal(duSourceLine('round-3'), 'Source: Delhi University CSAS (UG) 2026, round 3. Checked 15 Nov 2026.');
  assert.equal(duSourceLine(), 'Source: Delhi University CSAS (UG) 2026, rounds 1 to 3. Checked 15 Nov 2026.');
  assert.equal(duSourceLine(4), '');
});
