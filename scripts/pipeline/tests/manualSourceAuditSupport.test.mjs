import test from 'node:test';
import assert from 'node:assert/strict';
import {locateAuditQuote,auditSHA} from '../lib/manualSourceAuditSupport.mjs';
test('source locators tolerate PDF word spacing but retain exact bytes and Unicode offsets',()=>{
 const text='🌍 Heading. A capital re serve belongs to old partners. Unrelated paragraph.';
 const span=locateAuditQuote(text,'A capital reserve','old partners.');
 assert.equal(span.quote,'A capital re serve belongs to old partners.');
 assert.equal(text.slice(span.quote_start,span.quote_end),span.quote);
 assert.equal(span.page_text_sha256,auditSHA(text));
});
test('absent, invented, empty and repeated source locators fail closed',()=>{
 assert.throws(()=>locateAuditQuote('A genuine rule.','invented rule','rule.'),/missing/);
 assert.throws(()=>locateAuditQuote('A genuine rule.','A genuine','invented ending'),/missing/);
 assert.throws(()=>locateAuditQuote('A rule. A rule.','A rule','rule.'),/ambiguous/);
 assert.throws(()=>locateAuditQuote('A rule.','','rule.'),/nonempty/);
});
