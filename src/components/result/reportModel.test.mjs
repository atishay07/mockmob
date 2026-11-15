// T4 (15 Nov 2026): the result's report sheet. The reasons, the request the route accepts, and the error words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REPORT_REASONS, REPORT_INTERACTION, REPORT_COPY, NOTE_MAX, checkReport, cleanNote, reportRequest, reportErrorLine, sentLine } from './reportModel.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (p) => readFileSync(root + p, 'utf8');

const attempt = { id: 'att-1', subject: 'accountancy' };
const row = { verdict: 'wrong', d: { givenIndex: 1 }, q: { correctIndex: 2 } };

test('five reasons, in the order the sheet lists them, plain sentence case', () => {
  assert.deepEqual(REPORT_REASONS.map((r) => r.id), ['wrong_key', 'unclear', 'off_syllabus', 'typo', 'other']);
  assert.deepEqual(REPORT_REASONS.map((r) => r.label), ['Wrong answer key', 'The question is unclear', 'Not in the CUET syllabus', 'Typo or formatting', 'Something else']);
  for (const r of REPORT_REASONS) assert.match(r.label, /^[A-Z][^!]*[^.!]$/, `${r.id}: sentence case, no full stop, no exclamation`);
});

test('the request is one the interact route accepts: its interaction type, flow context and a metadata object', () => {
  const route = read('src/app/api/questions/[id]/interact/route.js');
  const types = route.match(/VALID_INTERACTION_TYPES\s*=\s*new Set\(\[([\s\S]*?)\]\)/)[1];
  const flows = route.match(/VALID_FLOW_CONTEXTS\s*=\s*new Set\(\[([\s\S]*?)\]\)/)[1];
  assert.match(types, new RegExp(`'${REPORT_INTERACTION.type}'`));
  assert.match(flows, new RegExp(`'${REPORT_INTERACTION.flow}'`));
  const body = reportRequest({ reason: 'wrong_key', note: '  Option C is right.  ', attempt, row });
  assert.equal(body.interaction_type, 'report');
  assert.equal(body.flow_context, 'review');
  assert.equal(body.session_id, 'att-1');
  assert.equal(typeof body.metadata, 'object');
  assert.equal(body.dwell_ms, undefined, 'a report needs no dwell time');
  assert.deepEqual(body.metadata, {
    source: 'result_analysis', reason: 'wrong_key', note: 'Wrong answer key. Option C is right.', detail: 'Option C is right.',
    attempt_id: 'att-1', subject: 'accountancy', verdict: 'wrong', given_index: 1, correct_index: 2,
  });
});

test('the moderator reads the reason in words: the moderation page prints metadata.note', () => {
  const moderation = read('src/app/(app)/moderation/ModerationPageClient.jsx');
  assert.match(moderation, /reportMeta\.note/);
  assert.equal(reportRequest({ reason: 'typo', note: '', attempt, row }).metadata.note, 'Typo or formatting.');
  assert.equal(reportRequest({ reason: 'typo', note: '', attempt, row }).metadata.detail, null);
});

test('a reason is needed; Something else needs a few words; the note is tidied and cut at the limit', () => {
  assert.deepEqual(checkReport({}), { ok: false, field: 'reason', line: REPORT_COPY.pickReason });
  assert.deepEqual(checkReport({ reason: 'nope' }), { ok: false, field: 'reason', line: REPORT_COPY.pickReason });
  assert.deepEqual(checkReport({ reason: 'other', note: '   ' }), { ok: false, field: 'note', line: REPORT_COPY.needNote });
  assert.deepEqual(checkReport({ reason: 'other', note: 'The graph is missing' }), { ok: true });
  assert.deepEqual(checkReport({ reason: 'unclear' }), { ok: true });
  assert.equal(cleanNote(' a \n\n b '), 'a b');
  assert.equal(cleanNote('x'.repeat(NOTE_MAX + 50)).length, NOTE_MAX);
  assert.throws(() => reportRequest({ reason: null, note: 'x', attempt, row }), /REPORT_REASON_REQUIRED/);
});

test('confirmed only on the server yes; a repeat says so; every failure says what to do and keeps the form', () => {
  assert.equal(sentLine({ interaction_id: 'i1' }), 'Thanks. We will check this question.');
  assert.equal(sentLine({ interaction_id: null, duplicate: true }), REPORT_COPY.sentDuplicate);
  assert.match(reportErrorLine({ kind: 'network' }), /No connection/);
  assert.match(reportErrorLine({ status: 429 }), /later/);
  assert.match(reportErrorLine({ status: 401 }), /Reload/);
  assert.match(reportErrorLine({ status: 410 }), /no longer/);
  assert.equal(reportErrorLine({ status: 500 }), 'Your report did not send. Try again.');
  for (const line of [REPORT_COPY.sentTitle, REPORT_COPY.sentDuplicate, reportErrorLine({ status: 500 }), reportErrorLine({ kind: 'network' })]) {
    assert.doesNotMatch(line, /!|→|->/);
  }
});

test('the result page never asks with window.prompt, and reports through this model', () => {
  const page = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.doesNotMatch(page, /window\.prompt\(/);
  assert.match(page, /reportRequest\(/);
  assert.match(read('src/components/result/ReportSheet.jsx'), /REPORT_REASONS/);
});
