// The handlers behind /api/me/playbook and /api/me/rules (spec tmp/mistake-lab-v4/SPEC.md 4.8, 4.10, 4.12), written
// against injected reads and writes so node tests can drive every branch without a database:
//   GET  /api/me/playbook[?subject=]  { active, startSheet }  the rule in force and the two start sheet strings
//   POST /api/me/playbook {ruleId}    { active }              "Use in my next mock": one rule in force per student
//   GET  /api/me/rules                { book, acrossMocks }   the Rule book and Across your mocks
// Validation is on the server: a rule id must parse, and must be in the student's own Rule book right now (a repair
// rule from their own committed repair, or a habit rule once the 3-mock gate has opened). Unknown fields are refused.
import { activeRule, buildRuleBook, bookRules, choosableRule, parseRuleId, ruleRows, startSheetLines, RULE_RULES } from '../../../data/rule_book.js';
import { buildAcrossMocks } from '../../../data/across_mocks.js';

export const PLAYBOOK_COPY = Object.freeze({
  badBody: 'Send one rule id, like {"ruleId":"habit:never_opened"}.',
  badRule: 'That is not a rule id.',
  notInBook: 'That rule is not in your Rule book yet.',
  noAttempt: 'Take a paper first. Your rules come from your papers.',
  unavailable: 'Your rules could not be loaded. Try again shortly.',
});

const SUBJECT = /^[a-z0-9_-]{1,40}$/;

/** { ruleId } from a POST body, or { error } with the message to send (422). */
export function parsePlaybookBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: PLAYBOOK_COPY.badBody };
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== 'ruleId' || typeof body.ruleId !== 'string') return { error: PLAYBOOK_COPY.badBody };
  if (!parseRuleId(body.ruleId)) return { error: PLAYBOOK_COPY.badRule };
  return { ruleId: body.ruleId };
}

/** A subject query value, or null when absent; undefined when malformed (the route answers 422). */
export function parseSubject(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  return SUBJECT.test(raw) ? raw : undefined;
}

/** The rule in force with its chapter and subject (a repair rule's, from the book), for the check and the start sheet. */
export function resolveRule(rule, book) {
  if (!rule) return null;
  const found = bookRules(book).find((r) => r.id === rule.id);
  return { ...rule, chapter: found?.chapter ?? null, subject: found?.subject ?? null };
}

/** GET /api/me/playbook. `sources` = { repairs, playbook } (src/lib/server/ruleBook.js loadRuleSources). */
export function playbookBody({ attempts, sources, subject = null }) {
  const book = buildRuleBook({ attempts, repairs: sources.repairs, playbook: sources.playbook });
  const active = activeRule(sources.playbook);
  return { active, startSheet: startSheetLines({ rule: resolveRule(active, book), attempts, subject }) };
}

/** GET /api/me/rules. */
export function rulesBody({ attempts, sources }) {
  return {
    book: buildRuleBook({ attempts, repairs: sources.repairs, playbook: sources.playbook }),
    acrossMocks: buildAcrossMocks({ attempts }),
  };
}

/**
 * POST /api/me/playbook: { status, body }. `write(rule, { anchorAttemptId })` keeps the rule (ruleBook.js writeRule).
 * The anchor is the student's newest attempt: recovery_playbook rows need one, and it marks the stretch the choice
 * belongs to (data/rule_book.js ruleInForce reads the newest row chosen before a mock started).
 */
export async function postPlaybook({ body, attempts, sources, write }) {
  const parsed = parsePlaybookBody(body);
  if (parsed.error) return { status: 422, body: { error: 'invalid_request', message: parsed.error } };
  const newest = [...(attempts || [])].sort((a, b) => (Number(b?.completedAt) || 0) - (Number(a?.completedAt) || 0))[0];
  if (!newest?.id) return { status: 422, body: { error: 'invalid_request', message: PLAYBOOK_COPY.noAttempt } };
  const book = buildRuleBook({ attempts, repairs: sources.repairs, playbook: sources.playbook });
  const rule = choosableRule(book, parsed.ruleId);
  if (!rule) return { status: 422, body: { error: 'invalid_request', message: PLAYBOOK_COPY.notInBook } };
  if (rule.text.length > RULE_RULES.maxText) return { status: 422, body: { error: 'invalid_request', message: PLAYBOOK_COPY.notInBook } };
  // The same choice again in the same stretch changes nothing (idempotent: the row and its time stay as they are).
  const current = ruleRows(sources.playbook)[0];
  if (current && current.id === rule.id && current.attemptId === newest.id) return { status: 200, body: { active: { id: current.id, kind: current.kind, text: current.text, since: current.since } } };
  const active = await write(rule, { anchorAttemptId: newest.id });
  return { status: 200, body: { active } };
}
