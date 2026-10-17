// Review fixtures for /preview/arena?view=review (LEARN-REVIEW-1017 packet P-LR1). Every number comes from the one student
// (data/tests/fixtures/review/*.json, P-LR0) through the real reviewBody(), so the page shows what GET /api/me/review would.
// ?review=student1018 (default, pass 1018) | one | done | zero | student (1017) | check | held | nothing | dedupe | empty | down | slow.
// Repairs written here are kept in memory for this tab, so a repaired mistake reopens free and is never offered again.
// Stems, options and explanations are illustrative, written for the preview, never real bank rows.
import student from '@/../data/tests/fixtures/review/student.json';
import checkPending from '@/../data/tests/fixtures/review/check_pending.json';
import zeroCredits from '@/../data/tests/fixtures/review/zero_credits.json';
import allHeld from '@/../data/tests/fixtures/review/all_held.json';
import onePaper from '@/../data/tests/fixtures/review/one_paper.json';
import nothingMissed from '@/../data/tests/fixtures/review/nothing_missed.json';
import reviseDedupe from '@/../data/tests/fixtures/review/revise_dedupe.json';
import empty from '@/../data/tests/fixtures/review/empty.json';
import recordDown from '@/../data/tests/fixtures/review/record_down.json';
import student1018 from '@/../data/tests/fixtures/review/student-1018.json';
import { reviewBody } from '@/../data/review_input.mjs';
import { SUBJECTS } from '@/../data/subjects';
import { fixtureRepairV3 } from './previewMock';
import { fixtureCheckField } from './previewRepairCheck';

// Pass 1018 (REVIEW-RESULT-1018 P-RR1): the mocks' student and its states. ?review=student1018 (default) | one | done | zero.
const one1018 = { ...student1018, papers: student1018.papers.filter((p) => p.id === 'm3'), items: student1018.items.filter((i) => i.paper === 'm3'), chapterQuestions: { m3: student1018.chapterQuestions.m3 } };
const done1018 = { ...student1018, items: student1018.items.map((i) => (i.ch === 'adm' && i.state === 'open' ? { ...i, state: 'repaired', repairedAt: '2026-10-17T20:10:00+05:30' } : i)) };
const zero1018 = { ...student1018, wallet: { ...student1018.wallet, aiCredits: 0, practiceCredits: 0 } };
const RECORDS = { student1018, one: one1018, done: done1018, zero: zero1018, student, check: checkPending, zero1017: zeroCredits, held: allHeld, one1017: onePaper, nothing: nothingMissed, dedupe: reviseDedupe, empty, down: recordDown };
const SAVED = new Set(['repaired', 'held', 'slipped']);
const subjectId = (v) => { const t = String(v || '').toLowerCase(); return SUBJECTS.find((s) => s.id === t || s.name.toLowerCase() === t)?.id || t.replace(/\s+/g, '_'); };

const OPTIONS = {
  adm: ["Old partners' capital accounts in the old ratio", "Old partners' capital accounts in the sacrificing ratio", "The new partner's capital account", 'A premium for goodwill account kept in the firm'],
  ret: ['In the old ratio', 'In the new ratio', 'In the gaining ratio', 'In the sacrificing ratio'],
  iss: ['Securities premium', 'Share capital', 'Capital reserve', 'Calls in arrears'],
  cfs: ['Operating activities', 'Investing activities', 'Financing activities', 'Cash and cash equivalents'],
  dis: ['Realisation account', "Partners' capital accounts", 'Bank account', "The partner's loan account"],
  pom: ['One boss for each worker', 'Many bosses for each worker', 'A gang plank between levels', 'Order in the workplace'],
  rat: ['Current assets and current liabilities', 'Cost of revenue from operations and average inventory', 'Debt and equity', 'Profit before interest and tax, and interest'],
};
const GENERIC = ['The first statement', 'The second statement', 'The third statement', 'The fourth statement'];
const EXPLAIN = {
  'm3:42': 'Goodwill brought in cash by the new partner is shared by the old partners in the ratio in which they give up their share, the sacrificing ratio, and is credited to their capital accounts.',
};

const kind = () => new URLSearchParams(window.location.search).get('review') || 'student1018';
function record() {
  const k = kind();
  const base = RECORDS[k] || student1018;
  if (base.state === 'unavailable' || base.state === 'empty') return base;
  const mem = (window.__previewReview ||= { key: null, repaired: new Map(), spent: 0 });
  if (mem.key !== k) Object.assign(mem, { key: k, repaired: new Map(), spent: 0 });
  const items = base.items.map((i) => (mem.repaired.has(`${i.paper}:${i.q}`) ? { ...i, state: 'repaired', repairedAt: mem.repaired.get(`${i.paper}:${i.q}`) } : i));
  const wallet = base.wallet ? { ...base.wallet, aiCredits: Number.isFinite(base.wallet.aiCredits) ? base.wallet.aiCredits - mem.spent : base.wallet.aiCredits } : base.wallet;
  return { ...base, items, wallet };
}

function attemptFor(rec, paperId) {
  const paper = rec.papers.find((p) => p.id === paperId);
  if (!paper) return null;
  const byQ = new Map(rec.items.filter((i) => i.paper === paperId).map((i) => [i.q, i]));
  const snapshot = [];
  const details = [];
  for (let n = 1; n <= paper.questions; n += 1) {
    const item = byQ.get(n);
    const id = `${paperId}-q${n}`;
    const options = (item && OPTIONS[item.ch]) || GENERIC;
    const key = item?.key ? 'ABCD'.indexOf(item.key) : 1;
    const given = item?.state === 'blank' ? null : item ? (item.pick ? 'ABCD'.indexOf(item.pick) : key === 0 ? 2 : 0) : key;
    snapshot.push({ id, subject: subjectId(paper.subject), chapter: item ? (rec.chapters.find((c) => c.id === item.ch)?.name || 'Chapter') : 'Chapter', question: item ? `${item.stem}:` : `Question ${n} of this paper.`, options, correctIndex: key, explanation: (item && EXPLAIN[`${paperId}:${n}`]) || 'Illustrative explanation for the preview: the book reasons from the rule for this chapter to the correct option.' });
    details.push({ qid: id, givenIndex: given, isCorrect: item ? false : true });
  }
  return { id: paperId, subject: subjectId(paper.subject), completedAt: paper.at, total: paper.questions, correct: paper.right, wrong: paper.wrong, unattempted: paper.blank, questionsSnapshot: snapshot, details, answerReviewState: 'ready' };
}

function catalogFor(rec, subject) {
  const units = [];
  let order = 0;
  for (const [subjectName, list] of Object.entries(rec.lessons || student.lessons || {})) {
    if (!Array.isArray(list) || subjectId(subjectName) !== subject) continue;
    for (const l of list) {
      const chapter = rec.chapters.find((c) => c.id === l.ch)?.name || l.ch || 'General';
      units.push({ id: l.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), subject, chapter, conceptId: null, title: l.title, estimatedMinutes: l.min, read: Boolean(l.read), inProgress: false, status: l.read ? 'read' : 'new', cardCount: 4, order: (order += 1) });
    }
  }
  return { units };
}

/** Handles the Review endpoints while the preview shows Review; null for everything else. */
export function previewReview(url, method, init, fixture, json) {
  if (fixture.get('view') !== 'review') return null;
  const k = kind();
  if (url.pathname === '/api/me/review' && method === 'GET') {
    if (k === 'slow') return new Promise(() => {});
    const rec = record();
    if (rec.state === 'unavailable') return json({ version: 1, state: 'unavailable', message: 'Your mistakes did not load.', cause: 'REVIEW_ATTEMPTS_UNAVAILABLE' }, 503);
    return json(reviewBody(rec));
  }
  const rec = record();
  if (rec.state === 'unavailable' || rec.state === 'empty') return null;
  const att = url.pathname === '/api/attempts/summary' ? null : /^\/api\/attempts\/([^/]+)$/.exec(url.pathname);
  if (att && method === 'GET') {
    const a = attemptFor(rec, decodeURIComponent(att[1]));
    return a ? json(a) : null;
  }
  if (url.pathname === '/api/attempts/summary') {
    const items = rec.papers.map((p) => ({ id: p.id, subject: subjectId(p.subject), mode: p.kind === 'full mock' ? 'full' : 'quick', correct: p.right, wrong: p.wrong, unattempted: p.blank, total: p.questions, marks: p.score, maxMarks: p.of, completedAt: Date.parse(p.at), formatId: `${p.kind}:${subjectId(p.subject)}:q${p.questions}` }));
    return json({ items, nextCursor: null });
  }
  if (url.pathname === '/api/study/catalog') return json(catalogFor(rec, url.searchParams.get('subject')));
  if (url.pathname === '/api/recovery/repair' && method === 'POST') {
    const body = JSON.parse(init.body || '{}');
    const m = /^(.+)-q(\d+)$/.exec(String(body.questionId || ''));
    const item = m ? rec.items.find((i) => i.paper === m[1] && i.q === Number(m[2])) : null;
    if (!item) return null;
    const chapter = rec.chapters.find((c) => c.id === item.ch)?.name || 'Chapter';
    const check = fixtureCheckField(fixture.get('check') || 'ready');
    if (SAVED.has(item.state)) return json({ ...fixtureRepairV3({ stored: true, practiceChapter: chapter }), ...(check ? { check } : {}) });
    if (Number.isFinite(rec.wallet?.aiCredits) && rec.wallet.aiCredits < 1) return json({ ok: false, error: 'insufficient_ai_credits', balance: 0, message: 'This repair uses 1 AI credit. You have 0. Seeing the answer and trying again are still free.' }, 402);
    const mem = window.__previewReview;
    return new Promise((resolve) => setTimeout(() => {
      mem.repaired.set(`${item.paper}:${item.q}`, new Date(Date.parse(rec.now)).toISOString());
      mem.spent += 1;
      resolve(json({ ...fixtureRepairV3({ stored: false, practiceChapter: chapter }), wallet: { total: rec.wallet.aiCredits - 1, state: 'available' }, ...(check ? { check } : {}) }));
    }, 900));
  }
  return null;
}
