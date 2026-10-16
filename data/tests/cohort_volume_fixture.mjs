// A synthetic, production-sized load for the cohort table refresh (data/tests/cohort_time_sql.test.mjs): about 1,800
// attempts, 35,000 answers, 20-question snapshots, a few hundred captured records with marks, presence and strike-outs.
// Deterministic (seeded), so a failure reproduces. Nothing here is real student data.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {{attempts?: number, users?: number, questions?: number, perPaper?: number, captured?: number, seed?: number, now?: number}} o
 * @returns {{questions: object[], attempts: object[]}} questions as live rows; attempts as table rows (jsonb as objects)
 */
export function buildVolume({ attempts = 1800, users = 450, questions = 120, perPaper = 20, captured = 300, seed = 11, now = Date.now() } = {}) {
  const rand = rng(seed);
  const int = (n) => Math.floor(rand() * n);
  const pick = (arr) => arr[int(arr.length)];

  const live = [];
  for (let i = 0; i < questions; i++) {
    const options = [0, 1, 2, 3].map((k) => `Question ${i} option ${'ABCD'[k]}: the statement that is number ${k} for item ${i}`);
    live.push({ id: `vq${i}`, question: `Synthetic question ${i}: which of the following is true about topic ${i % 17}?`, options, correct_index: int(4), status: 'live' });
  }

  const rows = [];
  for (let n = 0; n < attempts; n++) {
    const user = `vu${n % users}`;
    // 24 hours to 40 days ago, one minute apart at least, so the order of one student's attempts is unambiguous.
    const completed = now - 86_400_000 - Math.floor(rand() * 40 * 86_400_000) - n * 61_000;
    const chosen = new Set();
    while (chosen.size < perPaper) chosen.add(int(questions));
    const snap = [];
    const details = [];
    for (const qi of chosen) {
      const q = live[qi];
      // A few snapshots store an option with different case or spacing, or as an object: the hash reads them the same.
      const options = q.options.map((o, k) => {
        const r = rand();
        if (r < 0.03) return `  ${o.toUpperCase()}  `;
        if (r < 0.06) return { text: o };
        return o;
      });
      snap.push({ id: q.id, chapter: `Chapter ${qi % 17}`, question: q.question, options, correctIndex: q.correct_index });
    }
    // Rarely a question appears twice in one snapshot, and a detail is repeated: the first of each is the one that counts.
    if (rand() < 0.01) snap.push(clone(snap[0]));
    for (const q of snap.slice(0, perPaper)) {
      const r = rand();
      const given = r < 0.03 ? null : r < 0.58 ? q.correctIndex : (q.correctIndex + 1 + int(3)) % 4;
      details.push({ qid: q.id, givenIndex: given, isCorrect: given === q.correctIndex });
    }
    if (rand() < 0.01) details.push({ ...details[0], givenIndex: (details[0].givenIndex ?? 0) });
    rows.push({ id: `va${n}`, user_id: user, completed_at: new Date(completed).toISOString(), details, questions_snapshot: snap, selection_meta: { mode: 'practice' }, _ms: completed });
  }

  // Capture a record for the earliest attempt of each of the first `captured` students (those are the first answers).
  const firstOf = new Map();
  for (const r of rows) if (!firstOf.has(r.user_id) || r._ms < firstOf.get(r.user_id)._ms) firstOf.set(r.user_id, r);
  let done = 0;
  for (const r of firstOf.values()) {
    if (done >= captured) break;
    r.selection_meta = captureMeta(r, rand, done);
    done++;
  }
  for (const r of rows) delete r._ms;
  return { questions: live, attempts: rows };
}

const clone = (v) => JSON.parse(JSON.stringify(v));

function captureMeta(row, rand, idx) {
  const int = (n) => Math.floor(rand() * n);
  const timeline = [];
  const marks = [];
  const presence = [];
  const strikes = [];
  const changes = [];
  let t = 0;
  let seq = 0;
  const noAway = idx % 7 === 0; // some records carry no away data: a long gap there is a break
  const first = row.details;
  first.forEach((d, i) => {
    const qid = d.qid;
    seq++;
    timeline.push({ seq, qid, at: t, type: 'visit', ...(i === 0 ? {} : { via: i % 9 === 0 ? 'set' : 'next' }) });
    const dwell = 15_000 + int(110_000);
    if (rand() < 0.3) {
      seq++;
      strikes.push({ seq, qid, at: t + 4_000, option: int(4), on: true });
      if (rand() < 0.3) { seq++; strikes.push({ seq, qid, at: t + 9_000, option: int(4), on: false }); }
    }
    if (rand() < 0.1) { seq++; marks.push({ seq, qid, at: t + 6_000, marked: true }); }
    if (!noAway && rand() < 0.12) {
      seq++;
      presence.push({ seq, qid, at: t + 3_000, type: 'away' });
      seq++;
      presence.push({ seq, qid, at: t + 3_000 + 20_000 + int(180_000), type: 'back' });
    }
    if (Number.isInteger(d.givenIndex)) {
      seq++;
      timeline.push({ seq, qid, at: t + Math.floor(dwell / 2), type: 'answer', answer: d.givenIndex });
      if (rand() < 0.1) {
        // A change: the first pick was the key when the final answer is not (a move off the key), else another option.
        const key = row.questions_snapshot.find((q) => q.id === qid)?.correctIndex;
        const before = d.givenIndex !== key && rand() < 0.7 ? key : (d.givenIndex + 1) % 4;
        seq++;
        timeline.push({ seq, qid, at: t + Math.floor(dwell / 4), type: 'answer', answer: before });
        changes.push({ qid, at: t + Math.floor(dwell / 2), before, after: d.givenIndex, markEffect: 0 });
      }
    }
    t += dwell + (noAway && rand() < 0.02 ? 45 * 60_000 : 0);
  });
  seq++;
  const end = { seq, qid: first[first.length - 1].qid, at: t, reason: 'submit' };
  const sort = (a) => a.sort((x, y) => x.at - y.at || x.seq - y.seq);
  return {
    mode: 'practice',
    scoringVersion: 'server_snapshot_v1',
    client: idx % 4 === 3 ? { platform: 'android' } : { platform: 'web', appVersion: '2026.10.16' },
    recovery: {
      version: 1, scoring: 'server_snapshot', telemetry: 'self_reported',
      observed: { answerChanges: changes },
      timeline: sort(timeline), marks: sort(marks), presence: sort(presence), strikes: sort(strikes), end,
    },
  };
}
