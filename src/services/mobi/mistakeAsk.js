// "Bring a mistake from any test": one more Ask Mobi ask kind, inside the SAME spend path as every signed-in written reply.
//
// No 'server-only' and no alias imports on purpose: src/services/mobi/mistakeDeps.js wires the wallet RPCs, the guarded
// provider call and the history store in, and data/tests/bring_mistake_1116.test.mjs wires fakes (and the real provider
// runtime with a fake client) in, so every rule below is tested without a database or a paid model.
//
// Order, always (each step ends the request before the next one can spend):
//   1. distress    the fixed support reply (Tele-MANAS 14416, 112) for words that sound like a student at risk, in the paste or
//                  in either answer box. Free, no model, no credit (src/services/ai/supportCheck.js, as the chat route).
//   2. request     readMistakeRequest: the paste is required and counted (1,500), the two answers are short (160 each), the
//                  subject is one of the student's own CUET subjects.
//   3. study?      studyCheck: too short, instructions aimed at Mobi, or plainly not a test question gets a short refusal. Free.
//   4. the ask     runModelReply (src/services/prepos/modelReply.js), exactly as a doubt or a question reply: ONE credit reserved
//                  under ONE operation key per student action (mm_ai_reserve_credits), marked executing, then the model, then
//                  commit, or release on any failure. The model call is ONE physical call (callOnce: the model allowlist, then
//                  reserve_runtime_ai with the student and plan, so the student's own monthly rupee cap in runtime_ai_budget
//                  applies and a failed or invalid call still counts there), with no JSON retry and no fallback.
//   5. the reply   readMistakeReply holds it to the contract. Invalid -> the credit is released and the student sees an honest
//                  error with Try again. The model's own "support" -> the credit is released too, and the student sees the
//                  fixed support reply (never model-written words).
//   6. unusable    The model's own "not a study question" (typed or photo) or "unreadable" (photo), lane web/1116n-price (owner,
//                  16 Nov 2026, 10:25 pm: a stream of random photos must cost something): the reservation is released as in
//                  step 5, then, only once the release went through, MISTAKE_UNUSABLE_CREDITS (1) is taken with the one-step
//                  consume (aiCreditWallet consumeAIWalletCredits, mm_ai_consume_credits) under a key derived only from the
//                  operation key (unusableKey), so the same ask can never take it twice. If that consume fails for any reason
//                  nothing is taken and the words say so. A release that failed (the credits are held and return by
//                  themselves) takes nothing more. The same ask sent again finds that charge (findUnusableCharge) and shows the
//                  same words, with no model call and no second charge.
//
// A photo of the question (lane web/1116-photo, 16 Nov 2026; switch data/mistake_photo.mjs): the same steps, in the same order,
// with MISTAKE_PHOTO_CREDITS (2) through the same one reserve, commit or release under the same one operation key. The photo
// goes to the model as an image part (callOnce `image`, OpenAI only) and is never stored or logged. Its own verdicts: the
// model's "unreadable" (blurred, cut off, no question) releases the 2 credits and then takes 1 (step 6), with fixed words; and
// before anything is shown,
// needsSupport runs on Mobi's reading of the photo ("read"): a match is the fixed support reply, the credits released.
import { createHash } from 'node:crypto';
import { runModelReply, operationKeyFor } from '../prepos/modelReply.js';
import { needsSupport, SUPPORT_REPLY } from '../ai/supportCheck.js';
import { LUNA_MODEL } from '../ai/providerCore.js';
import {
  MISTAKE_COPY, MISTAKE_EFFORT, MISTAKE_LIMITS, MISTAKE_MAX_TOKENS, MISTAKE_PHOTO_MAX_TOKENS, MISTAKE_PHOTO_ON, MISTAKE_TIMEOUT_MS,
  MISTAKE_UNUSABLE_CREDITS, cleanText, mistakeCredits, mistakeReplyText, mistakeSystemPrompt, mistakeUserMessage, readMistakeReply,
  readMistakeRequest, readStoredMistake, refusalFor, studyCheck, unusableLine,
} from './bringMistake.mjs';
import { mistakeChapters } from './mistakeChapters.mjs';
import { practiceKeeps } from './liveChapters.mjs';

export const MISTAKE_MODE = 'mistake';
// The live-chapter read happens after the credits are committed (it only decides whether the answer's practice link names a
// chapter). The database client sets no timeout of its own, so it gets this long; past it the link is the subject's, and the
// answer the student paid for is never held up (second review, 16 Nov 2026).
export const CHAPTERS_WAIT_MS = 1500;
/** `promise`, or null once `ms` has passed. The timer never keeps the process alive and is cleared when the promise settles. */
export function within(promise, ms) {
  let timer = null;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve(null), ms); timer?.unref?.(); });
  return Promise.race([Promise.resolve(promise), late]).finally(() => clearTimeout(timer));
}
const NO_CHARGE = Object.freeze({ kind: 'included', creditUnits: 0, amount: 0 });

// ---- The saved turn and its replay: one pair ---------------------------------------------------------------------------------
// The student's own history (Your recent questions): the paste and Mobi's answer, owner-bound, deleted with the account. The 2
// checks live only inside this saved answer: never in the question bank, never shown to anyone else, never a paper.
// persistMistakeTurn writes the answer's payload with kind 'answer' and charge.reference = the operation key; findMistakeReplay
// reads it back by exactly those fields (REPLAY_FIELDS), so a lost answer is shown again instead of charged again.
// `db` is a Supabase client (supabaseAdmin() in mistakeDeps and the route; a fake in the tests).
export const REPLAY_FIELDS = Object.freeze({ kind: 'structured_payload->>kind', reference: 'structured_payload->charge->>reference' });

/**
 * Saves the turn. -> the session id, or null after logging why (a failed write is never silent; no student words logged).
 * A photo ask (`photo: true`): `question` is Mobi's reading of the photo (or the fixed photoQuestion words), and the session
 * and the answer are marked source 'photo'. The photo itself is never written: `response` is the reply body, which has no
 * photo in it.
 */
export async function persistMistakeTurn({ db, userId, question, response, photo = false, log = (line) => console.error(line) }) {
  const failed = (stage, error) => {
    try { log(JSON.stringify({ route: 'mentor_mistake', outcome: 'persist_failed', stage, code: error?.code || null, message: String(error?.message || error || '').slice(0, 160) })); } catch { /* logging never breaks the reply */ }
    return null;
  };
  const source = photo ? { source: 'photo' } : {};
  try {
    const { data, error } = await db.from('mentor_sessions').insert({ user_id: userId, title: String(question || '').slice(0, 56), metadata: { mode: MISTAKE_MODE, ...source } }).select('id').single();
    if (error || !data?.id) return failed('session', error || 'no_session_id');
    const { error: messagesError } = await db.from('mentor_messages').insert([
      { session_id: data.id, user_id: userId, role: 'user', content: question },
      { session_id: data.id, user_id: userId, role: 'assistant', content: response?.reply || '', structured_payload: { ...response, mode: MISTAKE_MODE, ...source } },
    ]);
    if (messagesError) return failed('messages', messagesError);
    return data.id;
  } catch (err) {
    return failed('exception', err);
  }
}

/** The stored answer of an ask already charged under `operationKey`, or null. A failed read throws (the caller says so). */
export async function findMistakeReplay({ db, userId, operationKey }) {
  const { data, error } = await db.from('mentor_messages').select('structured_payload')
    .eq('user_id', userId).eq('role', 'assistant').eq(REPLAY_FIELDS.kind, 'answer').eq(REPLAY_FIELDS.reference, operationKey)
    .limit(1).maybeSingle();
  if (error) throw Object.assign(new Error('replay_read_failed'), { code: error.code || null });
  return data?.structured_payload || null;
}

// ---- An ask Mobi had to read but cannot use: its one credit, and the read of it for the same ask sent again -----------------
export const UNUSABLE_ACTION = 'prepos_mistake_unusable';
// consumeAIWalletCredits' own check on the key (src/services/credits/aiCreditWallet.js); a key that fails it is never sent.
export const CONSUME_KEY_PATTERN = /^[A-Za-z0-9:_-]{8,200}$/;

/**
 * The consume's idempotency key, derived ONLY from the ask's operation key (operationKeyFor: 'prepos:' + the user id + ':' +
 * the request id, at most 160 characters; the request id is [A-Za-z0-9_-]{16,64}). A Supabase user id is a UUID, so the key is
 * '<operationKey>:unusable' (at most 169 characters). An older account's id may hold other characters (an email-keyed row):
 * then the key is 'prepos_unusable:' + the operation key's SHA-256 in hex (80 characters). Either way it always passes
 * CONSUME_KEY_PATTERN and the same operation key always gives the same key. Two operation keys do not share one: the first
 * form keeps the whole operation key ('prepos:...'), the second starts 'prepos_unusable:' and is a SHA-256.
 */
export function unusableKey(operationKey) {
  const key = typeof operationKey === 'string' ? operationKey : '';
  if (!key) return null;
  const plain = `${key}:unusable`;
  if (CONSUME_KEY_PATTERN.test(plain)) return plain;
  return `prepos_unusable:${createHash('sha256').update(key, 'utf8').digest('hex')}`;
}

/**
 * The credit an unusable ask took, read from the AI credit ledger by unusableKey (the consume writes that row in the same
 * transaction as the charge, so it is there exactly when the credit was taken). Owner-bound. -> { verdict, charged } | null.
 * A failed read throws (the caller says the outcome could not be confirmed). `db` is a Supabase client (supabaseAdmin()).
 */
export async function findUnusableCharge({ db, userId, operationKey }) {
  const key = unusableKey(operationKey);
  if (!key || !userId) return null;
  const { data, error } = await db.from('ai_credit_ledger').select('amount, metadata')
    .eq('user_id', userId).eq('idempotency_key', key).limit(1).maybeSingle();
  if (error) throw Object.assign(new Error('unusable_read_failed'), { code: error.code || null });
  const charged = Math.abs(Math.trunc(Number(data?.amount) || 0));
  if (!charged) return null;
  return { verdict: data?.metadata?.verdict === 'unreadable' ? 'unreadable' : 'not_study', charged };
}

/**
 * Takes MISTAKE_UNUSABLE_CREDITS once for an ask the model read but could not use. `consume` is aiCreditWallet's
 * consumeAIWalletCredits bound to the student (mistakeDeps). -> { used, taken }: `used` is what the ask used in all (the words
 * say it), `taken` what THIS request took (0 when the key was already spent). Any failure or throw: { used: 0, taken: 0 }.
 */
async function takeUnusable({ consume, operationKey, verdict }) {
  const idempotencyKey = unusableKey(operationKey);
  if (typeof consume !== 'function' || !idempotencyKey) return { used: 0, taken: 0 };
  try {
    const r = await consume({ amount: MISTAKE_UNUSABLE_CREDITS, action: UNUSABLE_ACTION, reference: operationKey, idempotencyKey, metadata: { verdict } });
    if (!r?.ok) return { used: 0, taken: 0 };
    const used = Math.max(0, Math.trunc(Number(r.charged) || 0));
    return { used, taken: r.idempotent ? 0 : used };
  } catch {
    return { used: 0, taken: 0 };
  }
}

/**
 * The model step for runModelReply: ONE call through the guarded provider runtime (`callOnce`, src/services/ai/providerCore.js),
 * then the strict reply check. `spendUser` is { userId, userTier } (replyDeps spendUserFor), so the call counts against this
 * student's own monthly cap. `onVerdict` hears the model's "not_study", "support" or "unreadable" (each releases the credit).
 * With a photo (`value.photo`): the photo system prompt, the image beside the user message, the larger output cap, and the
 * support check on Mobi's reading of the photo before the answer can stand.
 */
export function mistakeGenerate({ value, callOnce, spendUser, timeoutMs = MISTAKE_TIMEOUT_MS, onVerdict = () => {} }) {
  const photo = value?.photo || null;
  return async ({ requestKey }) => {
    let result;
    try {
      result = await callOnce({
        requestKey: `${requestKey}:mistake`.slice(0, 180), provider: 'openai', model: LUNA_MODEL, reasoningEffort: MISTAKE_EFFORT,
        systemPrompt: mistakeSystemPrompt({ photo: Boolean(photo) }), userMessage: mistakeUserMessage(value), context: null, jsonMode: true,
        maxTokens: photo ? MISTAKE_PHOTO_MAX_TOKENS : MISTAKE_MAX_TOKENS, timeoutMs, userId: spendUser?.userId ?? null, userTier: spendUser?.userTier ?? null,
        ...(photo ? { image: { mime: photo.mime, data: photo.data } } : {}),
      });
    } catch {
      result = { ok: false, errorKind: 'unknown' };
    }
    const usage = result?.usage || null;
    if (!result?.ok) return { ok: false, data: null, usage, failure: { kind: result?.errorKind || 'unknown' } };
    const read = readMistakeReply(result.raw, { request: value });
    if (!read.ok) return { ok: false, data: null, usage, schemaValid: false, failure: { kind: 'invalid_output', reason: read.reason } };
    if (read.kind !== 'answer') {
      onVerdict({ kind: read.kind });
      return { ok: false, data: null, usage, failure: { kind: read.kind } };
    }
    // What the photo shows is checked like typed words before anything is shown: distress in it is the fixed support reply.
    const seen = read.mistake.read;
    if (seen && (needsSupport(seen) || needsSupport(cleanText(seen)))) {
      onVerdict({ kind: 'support' });
      return { ok: false, data: null, usage, failure: { kind: 'support' } };
    }
    return { ok: true, data: read.mistake, usage, schemaValid: true, fallbackUsed: false };
  };
}

const held = (message) => /returns automatically/i.test(String(message || ''));
// A photo ask holds 2 credits: the words say so in the plural.
const creditWords = (message, credits = 1) => (held(message)
  ? (credits > 1 ? 'Your credits are held briefly and return automatically.' : 'Your credit is held briefly and returns automatically.')
  : 'No credits were used.');
const SUPPORT = (extra = {}) => ({ http: 200, kind: 'support', body: { ok: true, kind: 'support', reply: SUPPORT_REPLY, origin: 'safety', charge: NO_CHARGE, charged: 0, ...extra } });
const REFUSED = (reason, extra = {}) => ({ http: 200, kind: 'refused', body: { ok: true, kind: 'refused', reply: refusalFor(reason), origin: 'status', charge: NO_CHARGE, charged: 0, ...extra } });
/**
 * The refusal for the model's own "not_study" / "unreadable". `used`: what the ask used in all (the words); `taken`: what this
 * request took (charge and charged, as the answer path says them); `reply` overrides the words (the held case).
 */
const UNUSABLE = (verdict, { used = 0, taken = 0, reference = null, reply = null, replayed = false } = {}) => ({
  http: 200, kind: 'refused', ...(replayed ? { replayed: true } : {}),
  body: {
    ok: true, kind: 'refused', reason: verdict, reply: reply || unusableLine(verdict, used), origin: 'status',
    charge: taken > 0 ? { kind: 'prepos_credit', creditUnits: MISTAKE_UNUSABLE_CREDITS, amount: taken, reference } : NO_CHARGE,
    charged: taken, ...(replayed ? { replayed: true } : {}),
  },
});

/**
 * One "bring a mistake" ask. `user` is the STORED user (its plan sets the monthly cap). `deps`:
 *   wallet:     { reserve, markExecuting, commit, release }  (replyDeps' RPC wrappers, unchanged)
 *   callOnce:   the guarded single provider call (providers.js callProviderOnce)
 *   spendUser:  spendUserFor(user)
 *   findReplay: async (operationKey) -> the stored answer payload of an ask already charged, or null
 *   consume:    async ({ amount, action, reference, idempotencyKey, metadata }) -> consumeAIWalletCredits' result, for this
 *               student (the one-step charge of an ask Mobi cannot use); optional: without it nothing is taken
 *   findUnusable: async (operationKey) -> { verdict, charged } | null, the credit an unusable ask took (findUnusableCharge);
 *               throws when the read fails; optional
 *   now:        () => ms
 *   liveChapters: async (subjectId) -> Set of the chapter names Practice keeps from a link (liveChapters.mjs); optional
 * `photoOn` is the photo switch (data/mistake_photo.mjs); off, a photo field is refused with a 400 before anything else.
 * -> { http, kind, body, value?, saved? }   kind: 'support' | 'refused' | 'answer' | 'error'
 *    saved: { question, photo } on every support, refusal and answer: what the saved turn keeps (mistakeTurn below). It is
 *    marked as from a photo only when a checked photo was actually sent and read; before that (distress caught first, the
 *    switch off, a photo refused by its bytes, instructions in the note) it is the typed path: the words the student typed.
 */
export async function runMistakeAsk({ user, body, gateOpen, deps, photoOn = MISTAKE_PHOTO_ON }) {
  // The typed path's saved question, exactly as before photos: what came in the box, cut to the box's length.
  const typed = { question: typeof body?.question === 'string' ? body.question.slice(0, MISTAKE_LIMITS.question) : '', photo: false };

  // 1. Distress first, on whatever words came, before the request is even checked (a long paste still reaches it). Both the
  //    words as sent and the words as the model would get them (cleanText), so an invisible character cannot split a phrase.
  //    With a photo, `question` is the student's note; what the photo shows is checked once Mobi has read it (step 5).
  const words = body && typeof body === 'object' ? [body.question, body.chosen, body.key].filter((t) => typeof t === 'string') : [];
  if (words.some((t) => needsSupport(t) || needsSupport(cleanText(t)))) return { ...SUPPORT(), saved: typed };

  // 2. The request (the photo checked by its bytes here).
  const read = readMistakeRequest(body, { subjects: user?.subjects, photoOn });
  if (!read.ok) return { http: read.http, kind: 'error', body: { ok: false, error: read.error, message: read.message, charged: 0 } };
  // MockMob's own chapter list for the subject: the model names the chapter only from it, and the reply is held to it.
  const value = { ...read.value, chapters: mistakeChapters(read.value.subject?.id) };
  const credits = mistakeCredits(value);

  // 3. Not a study question: a short refusal, free (the photo, if any, was not sent).
  const study = studyCheck(value);
  if (!study.ok) return { ...REFUSED(study.reason), saved: typed };
  // From here a photo goes to the model: what is saved of a verdict is the fixed words for a photo, never what it showed.
  const afterModel = value.photo ? { question: MISTAKE_COPY.photoQuestion, photo: true } : typed;

  // 4. The ask, through the one credit lifecycle every written reply uses: 1 credit typed, 2 with a photo.
  let verdict = null;
  const generate = mistakeGenerate({ value, callOnce: deps.callOnce, spendUser: deps.spendUser, onVerdict: (v) => { verdict = v; } });
  const out = await runModelReply({
    user, message: value.question || MISTAKE_COPY.photoQuestion, mode: MISTAKE_MODE, requestId: body?.requestId, creditCost: credits, tier: 'smart', gateOpen,
    context: null,
    deps: {
      ...deps.wallet, generate, now: deps.now,
      // runModelReply needs a non-empty reply to commit; the answer itself travels beside it.
      sanitize: (data) => ({ reply: mistakeReplyText(data), mistake: data }),
    },
  });

  if (out.status === 'answered') {
    let mistake = out.response.mistake;
    // The chapter is promised only where Practice will keep it (review, 16 Nov): in the live chapter list Practice reads. Not
    // in it, or the list not readable: no chapter, and the next step is the subject's link, as before.
    if (mistake.chapter) {
      let live = null;
      try { live = deps.liveChapters ? await within(deps.liveChapters(value.subject?.id), CHAPTERS_WAIT_MS) : null; } catch { live = null; }
      if (!practiceKeeps(live, mistake.chapter)) mistake = { ...mistake, chapter: null };
    }
    return {
      http: 200, kind: 'answer', value,
      saved: value.photo ? { question: mistake.read, photo: true } : { question: value.question, photo: false },
      body: {
        ok: true, kind: 'answer', origin: 'model', mistake, reply: out.response.reply, subject: value.subject,
        ...(value.photo ? { source: 'photo' } : {}),
        charge: { kind: 'prepos_credit', creditUnits: credits, amount: out.charged, reference: out.operationKey },
        usage: out.receipt, charged: out.charged,
      },
    };
  }
  // The model's own verdicts: the reservation was released by runModelReply; the student sees fixed words. Support is never
  // charged.
  if (verdict?.kind === 'support') return { ...SUPPORT(), saved: afterModel };
  if (verdict?.kind === 'not_study' || verdict?.kind === 'unreadable') {
    const kind = verdict.kind;
    // The release itself failed: the reservation is held and returns by itself. Nothing more is taken; the words say so.
    if (held(out.message)) return { ...UNUSABLE(kind, { reply: unusableLine(kind, 0).replace('Nothing was charged.', creditWords(out.message, credits)) }), saved: afterModel };
    // Released (runModelReply's own failure path, with no error from the release): 1 credit, once, for reading it.
    const operationKey = operationKeyFor(user?.id, body?.requestId);
    const released = out.status === 'failed' && out.error === 'unusable_output';
    const { used, taken } = released ? await takeUnusable({ consume: deps.consume, operationKey, verdict: kind }) : { used: 0, taken: 0 };
    // Already taken under this key by an earlier send (taken 0, used 1): the same words, saved once, the first time.
    const replayed = used > 0 && taken === 0;
    return { ...UNUSABLE(kind, { used, taken, reference: operationKey, replayed }), ...(replayed ? {} : { saved: afterModel }) };
  }
  // The same ask sent again after its answer was lost: the credit was taken once, so the stored answer is shown again. Never
  // a second model call, never a second charge.
  if (out.status === 'duplicate') {
    const key = operationKeyFor(user?.id, body?.requestId);
    let saved = null;
    let readFailed = false;
    try { saved = key && deps.findReplay ? await deps.findReplay(key) : null; } catch { readFailed = true; }
    const mistake = readStoredMistake(saved?.mistake, { chapters: value.chapters });
    if (mistake) {
      return { http: 200, kind: 'answer', value, replayed: true, body: { ok: true, kind: 'answer', origin: 'model', replayed: true, mistake, reply: mistakeReplyText(mistake), subject: saved.subject || value.subject, ...(value.photo ? { source: 'photo' } : {}), charge: { ...NO_CHARGE }, charged: 0 } };
    }
    // Review of 16 Nov: answered and charged once, but nothing to show again. Its own state, never a "Try again" (a new
    // request would take a second credit): where the answer may be, or that it was not saved and a new ask is a new credit.
    return { http: 409, kind: 'error', body: { ok: false, error: 'duplicate', status: 'duplicate', message: readFailed ? MISTAKE_COPY.duplicateSaved(credits) : MISTAKE_COPY.duplicateLost(credits), charged: 0 } };
  }
  // The same ask sent again after its reservation was released (runModelReply: 'resend', reserve said 'operation_released';
  // nothing reached the model). If Mobi's first look found nothing it could use and took its credit, the same words come back,
  // with nothing more taken. No such charge: runModelReply's own words (nothing was charged, send it again), which are true.
  // The read failed: whether a credit was taken is not known, so no words about it, and Try again sends the same request.
  if (out.status === 'resend') {
    const key = operationKeyFor(user?.id, body?.requestId);
    let found = null;
    try {
      found = key && deps.findUnusable ? await deps.findUnusable(key) : null;
    } catch {
      return { http: 503, kind: 'error', body: { ok: false, error: 'unconfirmed', status: 'unconfirmed', message: MISTAKE_COPY.lost, charged: 0 } };
    }
    if (found) return UNUSABLE(found.verdict === 'unreadable' ? 'unreadable' : 'not_study', { used: found.charged, taken: 0, replayed: true });
  }
  // Everything else is runModelReply's honest failure (paused, no credits, this month's AI limit, in progress, released), with
  // Mobi's words for an answer that could not be written.
  const message = out.error === 'unusable_output' || out.error === 'provider_error' || out.error === 'empty_reply'
    ? `${MISTAKE_COPY.failed} ${creditWords(out.message, credits)}`
    : out.message;
  return { http: out.http, kind: 'error', body: { ok: false, error: out.error || out.status, status: out.status, message, required: out.required, balance: out.balance, charged: 0 } };
}

/**
 * What the route saves for one ask's outcome (runMistakeAsk's return): { question, photo } for persistMistakeTurn, or null for
 * an error, and for an answer or a charged refusal shown again (it was saved the first time). A charged refusal is saved with
 * its charge (charge.amount), so Your recent questions says what it used.
 */
export function mistakeTurn(out) {
  if (!out || out.kind === 'error' || out.replayed) return null;
  if (!out.saved || typeof out.saved.question !== 'string') return null;
  return { question: out.saved.question, photo: out.saved.photo === true };
}
