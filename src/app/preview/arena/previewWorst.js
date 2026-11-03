// Development-only worst-case knobs for /preview/arena (break-ui, 16 Oct 2026). Every knob is an extra URL parameter, read
// where the fixture is chosen, so the components under test get the data through the same boundary as the demo data.
// Values are realistic or schema-backed: Google display names run to 60+ characters, an email local part may be 64
// characters and the whole address 254 (RFC 5321), a chapter name of 80 characters is the longest the bank could hold.
//   ?worst=1            long name, long email, 80-character chapter (the bundle most pages read)
//   ?name=long|one|hindi|emoji   ?email=long
//   ?chapter=long|hindi          every chapter name in a response body
//   ?credits=0|99999             practice and AI balances
//   ?papers=0|1|500              recent papers (Today trend, dashboard list)
//   ?score=zero|perfect          the result: 0 out of 200 or 200 out of 200 (40 questions at 5 marks)
//   ?colleges=long               long and Hindi college and programme names in My colleges
//   ?net=slow|fail               account reads take 6 seconds, or fail with 503
import { scoreSession } from '../../../../data/recovery';
import { fixtureFeed } from './previewFixtures';

export const WORST_NAMES = {
  long: 'Aleksandra Wiśniewska-Kowalczyk Montgomery-Featherstonehaugh III',
  one: 'J',
  hindi: 'आर्यन चतुर्वेदी',
  emoji: '🙂 Riya Sharma',
};
export const WORST_EMAIL = 'bartholomew.fitzgerald.montgomery-featherstonehaugh@northwind-industries-holdings-international.example.com';
export const WORST_CHAPTERS = {
  long: 'Accounting for Partnership Firms: Reconstitution, Admission, Retirement and Death',
  hindi: 'साझेदारी फर्मों का लेखांकन: पुनर्गठन, प्रवेश, अवकाश ग्रहण एवं साझेदार की मृत्यु',
};

export function worstOf(params) {
  const bundle = params.get('worst') === '1';
  const num = (key) => { const v = params.get(key); return v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v); };
  const name = WORST_NAMES[params.get('name') || (bundle ? 'long' : '')] || null;
  const chapterKey = params.get('chapter') || (bundle ? 'long' : '');
  return {
    on: bundle || ['name', 'email', 'chapter', 'credits', 'papers', 'score', 'colleges', 'net'].some((k) => params.has(k)),
    name,
    email: params.get('email') === 'long' || bundle ? WORST_EMAIL : null,
    chapter: WORST_CHAPTERS[chapterKey] || null,
    credits: num('credits'),
    papers: num('papers'),
    score: ['zero', 'perfect'].includes(params.get('score')) ? params.get('score') : null,
    colleges: params.get('colleges') === 'long' || bundle,
    net: ['slow', 'fail'].includes(params.get('net')) ? params.get('net') : null,
  };
}

/** Replace every `chapter` value in a response body, one distinct long name per original chapter. */
export function rechapter(body, name) {
  if (!name) return body;
  const seen = new Map();
  const walk = (value) => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => {
        if (k === 'chapter' && typeof v === 'string') {
          if (!seen.has(v)) seen.set(v, seen.size === 0 ? name : `${seen.size + 1}. ${name}`);
          return [k, seen.get(v)];
        }
        return [k, walk(v)];
      }));
    }
    return value;
  };
  return walk(body);
}

/** Recent papers for the Today trend and the dashboard list: n of them, newest first. */
export function worstSummaryItems(n) {
  return Array.from({ length: n }, (_, i) => {
    const marks = (i * 37) % 251;
    return { id: `fxw${i}`, subject: ['accountancy', 'economics', 'business_studies', 'english'][i % 4], mode: i % 3 === 0 ? 'full' : 'quick', correct: Math.round(marks / 5.2), wrong: 4, unattempted: 0, total: 50, marks, maxMarks: 250, completedAt: Date.now() - (i + 1) * 86_400_000 };
  });
}
export function worstAttemptList(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `preview-w${i}`, subject: ['accountancy', 'economics', 'business_studies', 'english'][i % 4], score: (i * 7) % 101, correct: (i * 3) % 11, wrong: 2, unattempted: 1, total: 10, completedAt: Date.now() - (i + 1) * 3_600_000 }));
}

/** A scored 40-question paper at 5 marks a question: 'zero' (nothing answered, 0 out of 200) or 'perfect' (200 out of 200). */
export function fixtureExtremeAttempt(kind) {
  const feed = fixtureFeed('accountancy');
  const questions = Array.from({ length: 40 }, (_, i) => {
    const q = feed[i % 2];
    return { id: `fixture-x${i + 1}`, chapter: q.chapter, difficulty: ['easy', 'medium', 'hard'][i % 3], question: q.body, explanation: q.explanation, options: q.options.map((o) => o.text), correctIndex: 'ABCD'.indexOf(q.correct_answer) };
  });
  const answers = {};
  const events = [];
  let at = 0; let seq = 1;
  questions.forEach((q) => {
    events.push({ seq: seq++, qid: q.id, at, type: 'visit' });
    if (kind === 'perfect') { answers[q.id] = q.correctIndex; events.push({ seq: seq++, qid: q.id, at: at + 20_000, type: 'answer', answer: q.correctIndex }); }
    at += 30_000;
  });
  events.push({ seq: seq++, qid: questions.at(-1).id, at, type: 'visit' });
  const scored = scoreSession(questions, answers, events);
  return { id: 'fixture-attempt', subject: 'accountancy', score: scored.score, correct: scored.correct, wrong: scored.wrong, unattempted: scored.unattempted, total: scored.total,
    completedAt: '2026-10-04T18:00:00.000Z', questionsSnapshot: questions, details: scored.details,
    selectionMeta: { scoringVersion: 'server_practice_v1', recovery: scored.recovery } };
}

export const WORST_COLLEGES = [
  ['Lady Shri Ram College for Women, University of Delhi (Women only)', 'B.A. (Hons) Applied Psychology with Mathematical Economics and Statistics'],
  ['श्री राम कॉलेज ऑफ कॉमर्स', 'बी.कॉम (ऑनर्स)'],
  ['Shaheed Sukhdev College of Business Studies', 'B.M.S.'],
  ['St. Stephen’s College', 'B.A. (Hons) Economics'],
  ['Shri Guru Gobind Singh College of Commerce', 'B.Com'],
];
