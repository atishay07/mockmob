// Development-only fixture for "Bring a mistake from any test" (16 Nov 2026): POST /api/ai/mentor/mistake answered in the live
// route's shapes, with NO model call. The free steps run for real (the distress check, the request rules, the study check, from
// the same pure files the route uses); the model's part is a fixed illustrative answer that is put through the same reply
// contract (readMistakeReply), so the fixture cannot drift from what the server would accept. Needs &ai=live (the wallet open).
//   &mistake=ok        the answer, sure, with its 2 checks (the default)
//   &mistake=unsure    Mobi is not sure of the key: no answer named, how to work it out
//   &mistake=fail      the reply failed the contract: honest error, credit released, Try again
//   &mistake=cap       this month's AI limit reached (the existing over-cap words)
//   &mistake=refuse    the model's own "not a question from a test"
//   &mistake=none      no credits left (402)        &mistake=paused   written replies paused (503)
//   &mistake=slow      the answer after 8 s, to see Sending
//   &mistake=slower    the answer after 14 s, to see the second line of a long wait
//   &charged=0         with &mistake=unreadable or refuse: the free variant (by default they use MISTAKE_UNUSABLE_CREDITS, as the server does)
//   &mistake=lost      the first send's answer is lost on the way; Try again sends the same request and gets it
// A paid answer spends one credit from the preview wallet, once per request id, like the server's receipt (two for a photo).
//
// A photo of the question (lane web/1116-photo). The photo is checked by the same request rules (its bytes, its size), and the
// answer carries "read" (an illustrative reading of a coaching-sheet question) and the chapter, held to the same contract.
//   choose a photo with the form's key: the photo row at once, "Getting the photo ready" while the browser makes it ready
//   &mistake=slow        "Mobi is reading your photo" for 8 s, then the answer
//   &mistake=ok          answered from a photo (what Mobi read, the chapter's practice link); typed asks answer as before
//   &mistake=unreadable  Mobi could not read a question in the photo (the credits released)
//   &mistake=photooff    the server with the photo switch off (a photo refused with a 400; the panel drops its photo key)
//   &photo=off           the form with the photo switch off (no photo key; set by ArenaPreviewClient)
import { needsSupport, SUPPORT_REPLY } from '@/services/ai/supportCheck';
import { MISTAKE_COPY, MISTAKE_UNUSABLE_CREDITS, unusableLine, cleanText, mistakeCredits, mistakeReplyText, readMistakeReply, readMistakeRequest, refusalFor, studyCheck } from '@/services/mobi/bringMistake.mjs';
import { mistakeChapters } from '@/services/mobi/mistakeChapters.mjs';

const opts = (right, texts) => texts.map((text, i) => ({ text, right: i === right }));

// Illustrative model replies (accountancy, worked by hand: 3:2 with C at 1/5 gives 12:8:5).
const SURE = {
  kind: 'answer',
  tests: 'Working out the new profit-sharing ratio when a partner joins and the old partners give up share in their old ratio.',
  answer: { sure: true, text: '(a) 12:8:5' },
  why: 'C takes 1/5 of the profit, so A and B keep 4/5 between them. They split that 4/5 in their old ratio, 3:2.\nA gets 3/5 × 4/5 = 12/25 and B gets 2/5 × 4/5 = 8/25. C has 1/5 = 5/25.\nSo the new ratio is 12:8:5.',
  slip: 'You picked 3:2:1, which adds C as one part on top of 3:2. That gives C 1/6, not 1/5. Take C’s share out of the whole first, then split what is left.',
  checks: [
    { question: 'X and Y share profits in the ratio 2:1. Z is admitted for 1/4th share, which X and Y give up in their old ratio. What is the new ratio of X, Y and Z?', options: opts(0, ['2:1:1', '2:1:3', '6:3:4', '8:4:3']), reason: 'X and Y keep 3/4 and split it 2:1, so X has 1/2, Y has 1/4 and Z has 1/4: 2:1:1.' },
    { question: 'P and Q share profits equally. R is admitted for 1/3rd share. What is P’s share of the profit in the new ratio?', options: opts(2, ['1/2', '1/6', '1/3', '2/3']), reason: 'P and Q keep 2/3 between them and split it equally, so P has 1/3.' },
  ],
  chapter: 'admission of partner',
};
// What Mobi would read from a photo of the same coaching-sheet question (illustrative).
const READ = 'Q.14 A and B share profits in the ratio 3:2. C is admitted for 1/5th share. The new profit-sharing ratio of A, B and C will be:\n(a) 12:8:5\n(b) 3:2:1\n(c) 2:2:1\n(d) 12:8:4';
const UNSURE = {
  kind: 'answer',
  tests: 'Knowing the features a partnership must have under the Indian Partnership Act, 1932.',
  answer: { sure: false, text: null },
  why: 'The options look cut off, so Mobi cannot tell which one the key marks. Check each option against the four things every partnership needs: an agreement, two or more persons, a business, and sharing of its profits. The option that is not one of these is the answer.',
  slip: null,
  checks: [
    { question: 'Which of these is NOT needed for a partnership to exist?', options: opts(3, ['An agreement between the partners', 'At least two persons', 'Sharing of profits of a business', 'Registration of the firm']), reason: 'A partnership exists without registration; registration is optional under the Act.' },
    { question: 'A partnership is formed by:', options: opts(1, ['Birth into a family', 'An agreement between persons', 'An order of a court', 'Holding property jointly']), reason: 'A partnership comes from an agreement; a family business or joint property alone is not one.' },
  ],
};

const SUBJECTS = ['accountancy', 'economics', 'business_studies', 'english'];
const lost = new Set();

export function previewMistake(url, method, init, fixture, json) {
  if (url.pathname !== '/api/ai/mentor/mistake' || method !== 'POST') return null;
  let body = {};
  try { body = JSON.parse(init?.body || '{}'); } catch { return json({ ok: false, error: 'invalid_json_body', message: MISTAKE_COPY.badRequest, charged: 0 }, 400); }
  const later = (reply, status = 200, ms = 900) => new Promise((resolve) => setTimeout(() => resolve(json(reply, status)), ms));
  // The free steps, as the route runs them.
  if ([body.question, body.chosen, body.key].some((t) => typeof t === 'string' && (needsSupport(t) || needsSupport(cleanText(t))))) return later({ ok: true, kind: 'support', reply: SUPPORT_REPLY, charged: 0 }, 200, 300);
  const kind = fixture.get('mistake') || 'ok';
  const read = readMistakeRequest(body, { subjects: SUBJECTS, photoOn: kind !== 'photooff' });
  if (!read.ok) return later({ ok: false, error: read.error, message: read.message, charged: 0 }, read.http, 200);
  const value = { ...read.value, chapters: mistakeChapters(read.value.subject?.id) };
  const credits = mistakeCredits(value);
  const study = studyCheck(value);
  if (!study.ok) return later({ ok: true, kind: 'refused', reply: refusalFor(study.reason), charged: 0 }, 200, 300);

  if (kind === 'none') return later({ ok: false, error: 'insufficient_ai_credits', status: 'blocked', balance: 0, message: `This uses ${credits} ${credits === 1 ? 'credit' : 'credits'}. You have 0. Questions about your record are free.`, charged: 0 }, 402);
  // An ask the model itself judged unusable uses MISTAKE_UNUSABLE_CREDITS, as the server charges it (&charged=0: the free variant).
  // The words are the server's own (unusableLine), the amount is in the body, and the preview wallet goes down by it.
  const used = fixture.get('charged') === null ? MISTAKE_UNUSABLE_CREDITS : Math.max(0, Math.trunc(Number(fixture.get('charged')) || 0));
  const refusal = (verdict, extra = {}) => {
    const receipts = (window.__previewRepairIds ||= new Set());
    for (let i = 0; i < used; i += 1) receipts.add(`mistake-refused:${body.requestId}:${i}`);
    return { ok: true, kind: 'refused', reply: unusableLine(verdict, used), charged: used, charge: { kind: used ? 'prepos_credit' : 'none', creditUnits: used, amount: used }, ...extra };
  };
  if (kind === 'unreadable' && value.photo) return later(refusal('unreadable', { reason: 'unreadable' }), 200, 1600);
  if (kind === 'paused') return later({ ok: false, status: 'paused', message: 'AI features are paused for now. Your credits have not been used.', charged: 0 }, 503);
  if (kind === 'cap') return later({ ok: false, error: 'user_limit_reached', status: 'failed', message: 'You’ve reached this month’s AI limit. It resets on 1 December. No credits were used.', charged: 0 }, 429, 1200);
  if (kind === 'fail') return later({ ok: false, error: 'unusable_output', status: 'failed', message: `${MISTAKE_COPY.failed} No credits were used.`, charged: 0 }, 502, 1500);
  if (kind === 'refuse') return later(refusal('not_study'), 200, 1200);

  const modelReply = { ...(kind === 'unsure' ? UNSURE : SURE), ...(value.photo ? { read: READ } : {}) };
  const checked = readMistakeReply(JSON.stringify(modelReply), { request: value });
  if (!checked.ok) return later({ ok: false, error: 'unusable_output', message: `${MISTAKE_COPY.failed} No credits were used.`, charged: 0 }, 502);
  // One credit per request id (two for a photo), spent from the same preview wallet the chip and the price line read.
  const receipts = (window.__previewRepairIds ||= new Set());
  const id = `mistake:${body.requestId}`;
  const first = !receipts.has(id);
  receipts.add(id);
  if (credits > 1) receipts.add(`${id}:2`);
  const reply = {
    ok: true, kind: 'answer', origin: 'model', mistake: checked.mistake, reply: mistakeReplyText(checked.mistake), subject: value.subject,
    ...(value.photo ? { source: 'photo' } : {}),
    charge: { kind: 'prepos_credit', creditUnits: credits, amount: first ? credits : 0, reference: id }, replayed: !first, sessionId: 'preview-session',
  };
  if (kind === 'lost' && !lost.has(body.requestId)) {
    lost.add(body.requestId);
    return new Promise((_, reject) => setTimeout(() => reject(new TypeError('Illustrative: the answer was lost on the way')), 1200));
  }
  return later(reply, 200, kind === 'slower' ? 14_000 : kind === 'slow' ? 8000 : 1400);
}
