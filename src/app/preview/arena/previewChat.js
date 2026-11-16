// Development-only fixtures for Ask Mobi as a chat (16 Nov 2026): the doubt thread, its 2 questions, tonight's set and the
// report of a reply, answered in the live routes' shapes with NO model call. Needs &ai=live (the wallet open).
//   POST /api/ai/mentor/chat
//     replyKind 'doubt'    a written answer that opens a doubt: its thread (one follow-up) and 2 new questions
//     replyKind 'model' + threadId   the follow-up of that doubt, free
//     replyKind 'tonight'  tonight's set from the record, free
//     words that sound like distress: the fixed support reply, free
//   &chat=slow      the answer after 12 s, to see the wait
//   &chat=fail      the reply failed (502): nothing charged, in the thread
//   &chat=cap       this month's AI limit reached (429 user_limit_reached)
//   &chat=nochecks  the doubt answered with no questions attached: the chapter chips ask for them
//   &ai=network     the first answer is lost on the way; Retry sends the same request and gets it (never a second charge)
//   &ai=failure     the provider failed (503)
//   POST /api/mobi/thread   op 'answer' marks a pick (the key is option B of each question), op 'checks' returns 2 questions
//   POST /api/ai/mentor/report   the server's yes (&report=fail refuses it)
// A doubt spends one credit from the preview wallet, once per request id, like the server's receipt.
import { needsSupport, SUPPORT_REPLY } from '@/services/ai/supportCheck';
import { MOBI_JOB_CREDITS } from '@/lib/creditCopy.mjs';

const DOUBT_REPLY = [
  'The sacrificing ratio is the share of profit the old partners give up so that the new partner can have a share.',
  'Work it out in three steps:\n1. Write each old partner’s old share.\n2. Write each one’s new share, after the new partner comes in.\n3. Old share minus new share is what that partner gave up.',
  'Take A and B sharing 3:2. C comes in for 1/5, and the new ratio is 12:8:5.\nA gave up 3/5 − 12/25 = 3/25.\nB gave up 2/5 − 8/25 = 2/25.\nSo the sacrificing ratio is 3:2.',
  'When the question says nothing about how the share is given, the old partners give it in their old ratio, so the sacrificing ratio is the old ratio.',
].join('\n\n');

const FOLLOW_UP_REPLY = 'Yes. If C takes the whole 1/5 from A alone, only A gives something up: A’s new share is 3/5 − 1/5 = 2/5 and B stays at 2/5. The sacrificing ratio is then 1:0, and the new ratio is 2:2:1.';

const option = (index, text) => ({ index, text });
const CHECKS = (chapter) => [
  {
    checkQuestionId: 'pv-check-1', chapter,
    question: 'X and Y share profits 3:1. Z is admitted for 1/4th share, which X and Y give in their old ratio. What is the sacrificing ratio of X and Y?',
    options: [option(0, '1:1'), option(1, '3:1'), option(2, '1:3'), option(3, '9:3:4')],
  },
  {
    checkQuestionId: 'pv-check-2', chapter,
    question: 'P and Q share profits 5:3. R is admitted and takes 1/8th from P alone. What is the sacrificing ratio of P and Q?',
    options: [option(0, '5:3'), option(1, '1:0'), option(2, '0:1'), option(3, '1:1')],
  },
];
const KEY = { 'pv-check-1': 1, 'pv-check-2': 1 };
const WHY = {
  'pv-check-1': 'Nothing says how the share is given, so X and Y give it in their old ratio, 3:1.',
  'pv-check-2': 'Only P gives up a share, so P’s sacrifice is 1/8 and Q’s is nothing: 1:0.',
};

const TONIGHT = {
  when: 'tonight', reviseDue: 4, line: 'Start with Revise: 4 cards are due.',
  chapters: [
    { subject: 'accountancy', subjectName: 'Accountancy', chapter: 'Partnership Fundamentals', lost: 30 },
    { subject: 'accountancy', subjectName: 'Accountancy', chapter: 'Goodwill', lost: 20 },
  ],
  rules: ['Read the ratio as shares of the whole before you compare.'],
  traps: [{ trapType: 'missed_not', phrase: 'A missed NOT or EXCEPT', caught: 3, chances: 7 }],
};

const answered = new Map();
const lostOnce = new Set();

export function previewChat(url, method, init, fixture, json) {
  if (method !== 'POST') return null;
  const later = (reply, status = 200, ms = 1100) => new Promise((resolve) => setTimeout(() => resolve(json(reply, status)), ms));
  let body = {};
  try { body = JSON.parse(init?.body || '{}'); } catch { body = {}; }

  if (url.pathname === '/api/ai/mentor/report') {
    if (fixture.get('report') === 'fail') return later({ error: 'Failed to record the report.' }, 500, 500);
    return later({ ok: true, reported: true }, 201, 500);
  }

  if (url.pathname === '/api/mobi/thread') {
    if (body.op === 'answer') {
      const id = body.checkQuestionId;
      if (!(id in KEY)) return later({ ok: false, error: 'invalid_pick', message: 'That is not one of the questions offered on this doubt.' }, 422, 300);
      const first = !answered.has(id);
      if (first) answered.set(id, body.pick);
      const pick = answered.get(id);
      const key = KEY[id];
      const options = CHECKS('x').find((q) => q.checkQuestionId === id).options;
      const right = pick === key;
      return later({
        ok: true, replayed: !first,
        result: { right, pick, key: { index: key, text: options[key].text }, picked: { index: pick, text: options[pick]?.text || '' }, explanation: WHY[id], line: right ? 'Right. The idea held on a new question.' : 'Not this time. The key and the explanation are below.' },
      }, 200, 600);
    }
    if (body.op === 'checks') return later({ ok: true, checks: CHECKS(body.chapter || 'Change in Profit Sharing Ratio'), checksNote: null }, 200, 900);
    return later({ ok: false, error: 'invalid_request', message: 'That could not be done.' }, 422, 200);
  }

  if (url.pathname !== '/api/ai/mentor/chat') return null;
  const live = ['live', 'network', 'failure'].includes(fixture.get('ai'));
  const kind = fixture.get('chat') || 'ok';
  window.__previewChatRequests?.push(body);
  if (typeof body.message === 'string' && needsSupport(body.message)) {
    return later({ ok: true, runtimeState: 'record', sessionId: 'preview-session', response: { reply: SUPPORT_REPLY, actions: [], origin: 'safety' } }, 200, 400);
  }
  if (body.replyKind === 'tonight') {
    return later({
      ok: true, runtimeState: 'record', sessionId: 'preview-session', tonight: TONIGHT,
      response: { reply: 'Here is tonight’s set, from your own practice.', origin: 'record', actions: [{ label: 'Start Revise, 4 cards', route: '/review/revise' }, { label: 'Practise 10 Partnership Fundamentals questions', route: '/test?subject=accountancy&mode=quick&count=10&chapter=Partnership+Fundamentals' }] },
    }, 200, 900);
  }
  // A reply about one question of a MockMob paper keeps the client's older fixture (replyKind 'model' with no thread).
  if (body.replyKind === 'model' && !body.threadId) return null;
  if (!live) return null;
  if (fixture.get('ai') === 'failure') return later({ ok: false, message: 'Mobi could not answer just now. Your credit was not used.', charged: 0 }, 503, 900);
  if (kind === 'fail') return later({ ok: false, error: 'unusable_output', message: 'Mobi could not write a reliable answer this time. No credits were used.', charged: 0 }, 502, 1400);
  if (kind === 'cap') return later({ ok: false, error: 'user_limit_reached', message: 'You’ve reached this month’s AI limit. It resets on 1 December. No credits were used.', charged: 0 }, 429, 1000);

  const receipts = (window.__previewRepairIds ||= new Set());
  if (body.threadId) {
    return later({
      ok: true, runtimeState: 'live', sessionId: 'preview-session',
      thread: { id: body.threadId, followUpsLeft: 0, followUpsMax: 1, subject: 'accountancy', chapter: 'Change in Profit Sharing Ratio' },
      response: { reply: FOLLOW_UP_REPLY, actions: [], origin: 'model', charge: { kind: 'prepos_credit', amount: 0 } },
    }, 200, 1200);
  }
  const id = `doubt:${body.requestId}`;
  const first = !receipts.has(id);
  for (let i = 0; i < MOBI_JOB_CREDITS; i += 1) receipts.add(i ? `${id}:${i}` : id);
  const chapter = typeof body.chapter === 'string' && body.chapter ? body.chapter : 'Change in Profit Sharing Ratio';
  const subject = typeof body.subject === 'string' && body.subject ? body.subject : 'accountancy';
  const reply = {
    ok: true, runtimeState: 'live', sessionId: 'preview-session',
    thread: { id: `pv-thread-${body.requestId}`, followUpsLeft: 1, followUpsMax: 1, subject, chapter },
    checks: kind === 'nochecks' ? [] : CHECKS(chapter),
    checksNote: kind === 'nochecks' ? 'Pick the chapter and Mobi adds 2 new CUET-style questions on it to test this.' : null,
    response: {
      reply: DOUBT_REPLY, origin: 'model', charge: { kind: 'prepos_credit', amount: first ? MOBI_JOB_CREDITS : 0 },
      actions: [{ label: `Practise 10 ${chapter} questions`, route: `/test?subject=${encodeURIComponent(subject)}&mode=quick&count=10&chapter=${encodeURIComponent(chapter)}` }],
    },
  };
  if (fixture.get('ai') === 'network' && !lostOnce.has(body.requestId)) {
    lostOnce.add(body.requestId);
    return new Promise((_, reject) => setTimeout(() => reject(new TypeError('Illustrative: the answer was lost on the way')), 1200));
  }
  return later(reply, 200, kind === 'slow' ? 12_000 : 1500);
}
