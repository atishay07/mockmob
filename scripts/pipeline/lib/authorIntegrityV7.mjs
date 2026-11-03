import { createHash } from 'node:crypto';
import { sourceMaterial } from './factoryEvidence.mjs';
import { presentationLint } from '../../../data/question_presentation.mjs';

// Author-side integrity for the CUET-fit contract. The exact-quote rule exists to avoid paying to validate unsupported items; it is
// not a correctness gate (blinded validators select their own evidence and judge entailment). The 2026 campaign lost 62 of 1,000
// candidates to it, 8 because a verbatim definition was shorter than 25 characters and 12 more because two verbatim spans were
// joined with a line break. Tolerance here is limited to formatting and text damage in the source extraction: no paraphrase passes.
const squash = t => String(t || '').normalize('NFKC').replace(/[­​]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const words = t => String(t || '').normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
const alnum = t => words(t).join(' ');

function inOrderCoverage(quoteWords, textWords) {
  let best = 0;
  const first = quoteWords[0];
  for (let start = 0; start < textWords.length; start++) {
    if (textWords[start] !== first) continue;
    let q = 0, t = start;
    const limit = start + Math.ceil(quoteWords.length * 1.6) + 5;
    while (q < quoteWords.length && t < Math.min(textWords.length, limit)) { if (textWords[t] === quoteWords[q]) q++; t++; }
    best = Math.max(best, q / quoteWords.length);
    if (best === 1) break;
  }
  return best;
}

export function classifyQuote(quote, corpus) {
  const exact = corpus.map(squash), q = squash(quote);
  if (q.length >= 25 && exact.some(t => t.includes(q))) return 'exact';
  const compact = corpus.map(alnum), a = alnum(quote);
  if (!a) return null;
  if (a.split(' ').length >= 2 || a.length >= 5) {
    // A complete short definition or line of a source.
    if (corpus.some(text => String(text).split(/[\r\n]+/).some(line => alnum(line) === a)) || compact.includes(a)) return 'whole_short';
  }
  const segments = String(quote).split(/[\r\n]+|…|\.{3}/).map(s => alnum(s)).filter(Boolean);
  if (segments.length && segments.every(s => s.length >= 5 && compact.some(t => t.includes(s)))) return 'segments';
  if (compact.some(t => t.includes(a)) && a.length >= 12) return 'formatting_only';
  const w = words(quote);
  if (w.length >= 8 && corpus.some(text => inOrderCoverage(w, words(text)) >= 0.85)) return 'fuzzy_extraction_damage';
  return null;
}

export function tolerantQuoteIntegrity(candidate, registry) {
  const quotes = candidate?.evidence_quotes;
  if (!Array.isArray(quotes) || !quotes.length) return { passed: false, reason: 'author_evidence_quotes_missing' };
  const corpus = sourceMaterial(registry, candidate.source_refs || []).filter(r => r.kind !== 'paper').map(r => r.text);
  const methods = quotes.map(q => classifyQuote(q, corpus));
  const failed = methods.filter(m => !m).length;
  const strong = methods.filter(m => m && m !== 'fuzzy_extraction_damage').length;
  const passed = failed === 0 && strong >= 1;
  return { passed, reason: passed ? null : 'author_evidence_quote_not_in_sources', supplied: quotes.length, verified: quotes.length - failed, methods };
}

// Cosmetic, deterministic and reversible: strip a uniform A-D label prefix that the author or repair added to every option.
export function normalizeOptionLabels(candidate) {
  const options = candidate?.options;
  if (!Array.isArray(options) || options.length !== 4 || !presentationLint(candidate).includes('option_label_prefix')) return { candidate, changed: false };
  const patterns = ['(A)', '(B)', '(C)', '(D)'], stripped = options.map((o, i) => {
    const m = String(o).match(new RegExp(`^\\s*(?:\\(${'ABCD'[i]}\\)|${'ABCD'[i]}[.)])\\s+(?!and\\s|or\\s|[-–—:])(\\S[\\s\\S]*)$`));
    return m ? m[1].trim() : null;
  });
  if (stripped.some(s => s === null) || patterns.length !== 4) return { candidate, changed: false };
  const next = { ...candidate, options: stripped };
  return presentationLint(next).includes('option_label_prefix') ? { candidate, changed: false } : { candidate: next, changed: true };
}

// Authoring addendum for the 'improved' arm. It answers failure patterns measured on the 1,000-candidate campaign (186 of 360 paid repairs
// were label prefixes that deterministic normalization removes for free, and several syllabus-mapping rejections were conventions the stem left implicit).
export const AUTHOR_ADDENDUM_V7_ID = 'author-addendum-v7.1';
export const AUTHOR_ADDENDUM_V7 = ' AUTHORING ADDENDUM v7.1. (1) Write each option as plain text with no leading label such as (A), A. or A); the system attaches letters. (2) For synonym and antonym items every option is a single word. (3) When the key depends on a standard convention, status or method, state it in the stem (for example whether the enterprise is financial or non-financial, or which method applies) instead of leaving it to be inferred. (4) In ordering items make each sentence’s link to its neighbours explicit with connectives or clear references, so exactly one order is defensible. (5) Test one supported idea; do not combine unrelated facts from different excerpts. (6) Keep the question answerable in about a minute by a prepared candidate: at most two calculation steps. (7) Keep the stem and all four options together under 110 words: the longest authenticated CUET question has 132, the median 47. Matching items use short list entries and a one-line stem.';
export function authoringAddendumV7(transport, job) {
  if (job?.author_addendum !== AUTHOR_ADDENDUM_V7_ID) return transport;
  return { generate: async (provider, body, options) => {
    if (provider !== 'openai' || options?.stage !== 'authoring') return transport.generate(provider, body, options);
    const revised = structuredClone(body), system = revised.input.find(r => r.role === 'system');
    system.content += AUTHOR_ADDENDUM_V7;
    const key = createHash('sha256').update(JSON.stringify({ addendum: AUTHOR_ADDENDUM_V7_ID, prior_key: options.key, body: revised })).digest('hex');
    return transport.generate(provider, revised, { ...options, key });
  } };
}
