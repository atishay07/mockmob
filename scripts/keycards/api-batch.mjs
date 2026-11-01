#!/usr/bin/env node
// Key cards drafts and independent reviews through the Claude Message Batches API (1 Nov 2026).
//
//   node scripts/keycards/api-batch.mjs author  (--books=leph1,lech2 | --codes=leph101,leph102) [--dry-run] [--force]
//   node scripts/keycards/api-batch.mjs review  (--books=...          | --codes=...)            [--dry-run] [--force] [--chunk=50]
//   node scripts/keycards/api-batch.mjs collect <batchId>
//   node scripts/keycards/api-batch.mjs status  <batchId>
//
// author   One request per chapter PDF (a code that already has ncert-books/drafts/<code>.json is skipped without --force).
//          Reserves budget in scripts/pipeline/lib/budgetLedger.mjs, submits ONE Message Batch, prints the batch id and saves a
//          run record to tmp/keycards-api/<batchId>.json.
// review   Same for the independent reviews (the draft must exist; cards that already have a verdict are skipped without
//          --force). A draft of more than 50 cards goes out as several requests so a reply always fits its max_tokens.
// collect  Polls until the batch has ended (progress every 60 s), then writes ncert-books/drafts/<code>.json or
//          ncert-books/reviews/<code>.json from each succeeded result (matched by custom_id, never by position), records
//          errored / expired / refused / truncated results in the run record, and settles the ledger reservation with the
//          actual cost taken from the usage in the results.
// status   Prints the batch's counts.
//
// The files written are exactly the shapes the pipeline already reads, so afterwards:
//   node scripts/keycards/validate.mjs --machine-only --subject=<subject>      (machine checks, free)
//   node scripts/keycards/review-merge.mjs                                       (after the reviews are collected)
//   node scripts/keycards/validate.mjs --subject=<subject>
//
// --dry-run builds every request, writes them to tmp/keycards-api/dryrun-<kind>-<n>.jsonl, prints the request count and the
// estimated cost, and makes no API call and no ledger reservation.
//
// Money: model claude-opus-5-5 at USD 4 / 20 per million input / output tokens, 50% for the Batch API. The reservation is the
// conservative maximum (standard price, every reply filling max_tokens); collect settles it with the real usage. There is no
// owner ceiling (31 Oct 2026), but CUET_CONTENT_LIMIT_USD stops one run, and the ledger refuses a reservation it cannot hold.
//
// Environment: ANTHROPIC_API_KEY, else the first line of C:\Users\atish\MockMob-keys\anthropic-api-key.txt (or the file named
// by ANTHROPIC_API_KEY_FILE); the key is never printed. CUET_BUDGET_LEDGER (default: the main checkout's
// data/pipeline-budget.sqlite). KEYCARDS_NCERT_DIR / KEYCARDS_DRAFTS_DIR / KEYCARDS_REVIEWS_DIR as in lib.mjs.
// KEYCARDS_API_DIR moves tmp/keycards-api.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { CHAPTERS, SUBJECT_OPTIONS, chaptersFor } from '../../data/cuet_syllabus.js';
import { NCERT_KINDS } from '../../data/keycards.js';
import { ROOT, cardHash, draftsDir, pdfDir, pdfText, readJSON, reviewsDir, writeJSON } from './lib.mjs';

// ---------------------------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------------------------

export const MODEL = 'claude-opus-5-5';
export const LEDGER_MODEL = 'claude-opus-5-5-batch';
/** USD per million tokens (standard); the Batch API charges 50%. Cache writes cost 1.25x input, cache reads 0.1x (the brief's formula). */
export const PRICES = Object.freeze({ inputPerMillion: 4, outputPerMillion: 20, batchFactor: 0.5, cacheWriteFactor: 1.25, cacheReadFactor: 0.1 });
export const MAX_TOKENS = Object.freeze({ author: 32000, review: 16000 });
export const CHARS_PER_TOKEN = 3.2;
/** For the "likely" cost only: replies are assumed to use this share of max_tokens. The reservation never uses it. */
export const LIKELY_OUTPUT_SHARE = 0.4;
export const REVIEW_CHUNK = 50;
export const POLL_MS = 60_000;
const BATCH_BYTES_LIMIT = 256 * 1024 * 1024; // the Message Batches API limit per batch
const SPEC_FILE = path.join(ROOT, 'docs/brain/intel-1031/KEYCARDS-CONTENT-SPEC.md');
const SYLLABUS_DIR = path.join(ROOT, 'data/CUET 2026');
const CACHE = Object.freeze({ type: 'ephemeral' });
const CUSTOM_ID = /^[A-Za-z0-9_-]{1,64}$/; // the Batches API's custom_id pattern
const BATCH_ID = /^[A-Za-z0-9_-]{3,100}$/;

export const apiDir = () => (process.env.KEYCARDS_API_DIR ? path.resolve(process.env.KEYCARDS_API_DIR) : path.join(ROOT, 'tmp', 'keycards-api'));

// ---------------------------------------------------------------------------------------------------------------
// Book codes -> subject
// ---------------------------------------------------------------------------------------------------------------

/** NCERT code prefix (four letters) -> subject, and the CUET section option the book belongs to (null: none). */
export const BOOK_FAMILIES = Object.freeze({
  leph: Object.freeze({ subject: 'physics', option: null }),
  lech: Object.freeze({ subject: 'chemistry', option: null }),
  lemh: Object.freeze({ subject: 'mathematics', option: 'B1' }), // B1 chapters only
  lehs: Object.freeze({ subject: 'history', option: null }),
  legy: Object.freeze({ subject: 'geography', option: null }),
  lepy: Object.freeze({ subject: 'psychology', option: null }),
  lesy: Object.freeze({ subject: 'sociology', option: null }),
  lecs: Object.freeze({ subject: 'computer_science', option: 'B1' }), // Section A + B1
  leip: Object.freeze({ subject: 'computer_science', option: 'B2' }), // Section A + B2 (Informatics Practices)
  lebo: Object.freeze({ subject: 'biology', option: null }),
  leps: Object.freeze({ subject: 'political_science', option: null }),
  lebs: Object.freeze({ subject: 'business_studies', option: null }),
  leac: Object.freeze({ subject: 'accountancy', option: null }),
  leec: Object.freeze({ subject: 'economics', option: null }), // leec1 Macroeconomics, leec2 Microeconomics
  keec: Object.freeze({ subject: 'economics', option: null }), // Indian Economic Development
});

const SUBJECT_LABELS = Object.freeze({
  physics: 'Physics', chemistry: 'Chemistry', mathematics: 'Mathematics', history: 'History', geography: 'Geography',
  psychology: 'Psychology', sociology: 'Sociology', computer_science: 'Computer Science / Informatics Practices', biology: 'Biology',
  political_science: 'Political Science', business_studies: 'Business Studies', accountancy: 'Accountancy', economics: 'Economics',
});

/** Subject, option and book family of a four-letter prefix ("leph"), a book code ("leph1") or a chapter code ("leph101"). */
export function bookSubject(code) {
  const m = /^([a-z]{4})(?:(\d)(?:\d{2})?)?$/.exec(String(code ?? '').trim().toLowerCase());
  const family = m && Object.hasOwn(BOOK_FAMILIES, m[1]) ? BOOK_FAMILIES[m[1]] : null;
  if (!family) throw new Error(`unknown NCERT book code "${code}" (known prefixes: ${Object.keys(BOOK_FAMILIES).join(', ')})`);
  return { family: m[1], bookCode: m[2] ? `${m[1]}${m[2]}` : null, subject: family.subject, option: family.option };
}

/** The live CUET 2026 chapters a card of this subject may use (retired chapters are not in the table; options filter sections). */
export const allowedChapters = (subject, option = null) => chaptersFor(subject, option ? { option } : {});

/** Is this chapter's NCERT reference the given chapter code (a span such as Ch 1-2 covers both chapter files)? */
function refersTo(chapter, code, chapterNo) {
  const ref = chapter.ncert;
  if (!ref?.code || ref.code.slice(0, 5) !== code.slice(0, 5)) return false;
  return ref.code === code || (Array.isArray(ref.span) && chapterNo >= ref.span[0] && chapterNo <= ref.span[1]);
}

/**
 * What the pipeline knows about one chapter PDF: subject, option, book name, printed chapter number (the book's own numbering:
 * Part 2 books continue it), the NCERT title when the syllabus table names this exact file, and the syllabus chapters that
 * point at it.
 */
export function describeCode(code) {
  const m = /^([a-z]{4})(\d)(\d{2})$/.exec(String(code ?? ''));
  if (!m) throw new Error(`"${code}" is not a chapter code (four letters and three digits, for example lebs101)`);
  const { subject, option } = bookSubject(code);
  const bookCode = `${m[1]}${m[2]}`;
  const position = Number(m[3]);
  const refs = CHAPTERS.filter((c) => c.subject === subject && c.ncert?.code?.startsWith(bookCode));
  const first = refs.length ? refs[0].ncert.chapter - Number(refs[0].ncert.code.slice(5)) + 1 : 1;
  const chapterNo = first + position - 1;
  const exact = refs.find((c) => c.ncert.code === code);
  return {
    code, bookCode, position, subject, option, chapterNo,
    book: refs[0]?.ncert.book ?? bookCode,
    title: exact?.ncert.title ?? null,
    primaryKeys: CHAPTERS.filter((c) => c.subject === subject && refersTo(c, code, chapterNo)).map((c) => c.key),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The prompts
// ---------------------------------------------------------------------------------------------------------------

/** The importance rule of spec section 3 as the owner changed it on 31 Oct 2026 (the spec still says "about 60% must"). */
export const IMPORTANCE_OVERRIDE = [
  '- **`importance`:**',
  '  - `"must"` is for the points a CUET paper most likely tests: core definitions, formulas, headed lists, comparison tables, and facts',
  '    that past papers ask. Use it sparingly: about 25% of a chapter\'s cards and never more than 30% (owner, 31 Oct 2026: 68% "must"',
  '    made the mark meaningless; scripts/keycards/tier.mjs re-tiers every chapter to its top quarter afterwards, so yours is a first pass).',
  '  - `"good"` covers the rest, including illustrations and asides.',
].join('\n');

export function loadSpecText(file = SPEC_FILE) {
  if (!existsSync(file)) throw new Error(`Key cards content spec not found: ${file}`);
  return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

/** Section `n` of the spec (heading included), up to the next numbered section. */
export function specSection(spec, n) {
  const head = new RegExp(`^## ${n}\\. .*$`, 'm').exec(spec);
  if (!head) throw new Error(`KEYCARDS-CONTENT-SPEC.md has no "## ${n}." section: update scripts/keycards/api-batch.mjs`);
  const rest = spec.slice(head.index);
  const next = /^## \d+\. /m.exec(rest.slice(head[0].length));
  return (next ? rest.slice(0, head[0].length + next.index) : rest).trim();
}

/** The parts of the spec the prompts carry word for word (sections 2 to 5), with the importance rule replaced. */
export function specParts(spec = loadSpecText()) {
  const kinds = specSection(spec, 2).replace(/\n\*\*English[\s\S]*$/, '').trim(); // no NCERT book, no English deck here
  const importance = /- \*\*`importance`:\*\*\n(?: {2}.*\n)+/;
  const record = specSection(spec, 3);
  if (!importance.test(record)) throw new Error('KEYCARDS-CONTENT-SPEC.md section 3 no longer has the importance rule: update scripts/keycards/api-batch.mjs');
  return { kinds, record: record.replace(importance, `${IMPORTANCE_OVERRIDE}\n`), howMany: specSection(spec, 4), checks: specSection(spec, 5) };
}

// The words the blank check refuses (data/keycards.js STOPWORDS); the test pins every one against isStopword.
export const STOPWORD_LIST = ('a an and are as at be been being but by can could did do does for from had has have he her his how i if in into is it its '
  + 'may might more most must no not of on or our shall should so such than that the their them then there these they this those to was we were what '
  + 'when where which while who whom why will with would you your also any all each other only own same some very one two three per under over about '
  + 'between both after before during above below up down out off again further once here following given correct option options statement statements '
  + 'true false choose select answer question').split(/\s+/);

const AUTHOR_INTRO = `You write "Key cards" for MockMob, an exam-preparation app for Indian students sitting CUET (UG) after Class 12. A Key card is one flash card built from one exact line of the current NCERT Class 12 textbook (Reprint 2026-27).

Each request gives you, in the user message: (1) the official CUET 2026 syllabus text of one subject, with the list of ALLOWED CHAPTERS (each has a chapterKey); (2) the full text of ONE NCERT chapter PDF, page by page. You reply with one JSON object (the output schema is enforced) that holds the cards for that PDF.

Nobody repairs a card by hand. Machines check every card (section 5). A card that fails a check is quarantined and never reaches a student, and an independent reviewer then judges the survivors against the printed text. So write cards that are exact, standalone, unambiguous and worth a student's memory, and cover the CUET-listed part of the chapter completely (section 4): a loose card is worse than no card, and a missed definition is a gap.`;

const AUTHOR_SOURCES = `## 1. Sources (binding)
- The owner's rule (D202) is that NCERT's exact language is kept, with the reference, because "that language is what fetches them marks".
- The text you are given is the current NCERT Class 12 chapter PDF (Reprint 2026-27), extracted as plain text in reading order. \`quote\` is the exact NCERT text a card rests on: copy it from that text, word for word, in the same order. Never paraphrase, summarise, reorder, improve, or splice together text that is not adjacent. Never use an ellipsis.
- Fix only extraction artefacts. For example "t he" is "the", a lost dash makes "commonmanagement" for "common management", and a word split by a hyphen at the end of a line is one word. Page furniture (the running head, the page number, the line "Reprint 2026-27") is not part of any sentence: leave it out of a quote that runs over a page break.
- Paraphrase is allowed in exactly one place: the optional \`note\` field (at most about 160 characters, shown below the card as "In short" for explanation (D202)).
- Page reference = the printed book page number, not the PDF page index. Every PDF page in your text starts with a marker line [[PRINTED PAGE n]]: n is the number printed in the page corner, and it is the number for source.page. Cite the page where the quote starts. A page without a printed number is marked [[NO PRINTED PAGE NUMBER: do not cite]]: no card rests on it. Never copy a marker line into any field.
- The extraction can interleave two columns, side boxes, captions and table cells. Prefer a quote that is one clean contiguous run. Reassemble a split sentence only when you are certain of its reading order, and then word for word. If a table or formula comes out too garbled to quote exactly, leave it out: never add a symbol or word the text does not have.
- Leave out exercises, review questions, activities, project ideas, weblinks, pedagogical hints, chapter objectives and contents lists, and "Do you know?" trivia, unless a line there is itself a definition or fact the CUET syllabus covers.
- **Chapters outside the CUET 2026 syllabus get no cards.** **Topics an NCERT chapter covers that CUET 2026 does not list get no cards either.** This matters most for Economics and Biology, where the CUET unit lists name sub-topics. If nothing in the PDF is covered, return an empty cards array and say why in coverageNotes.
- Every card's chapterKey is one of the ALLOWED CHAPTERS of the subject. Chapter assignment follows the CUET 2026 unit lists, not only the NCERT chapter the text sits in (for example CUET puts revenue and producer's equilibrium under "Production and Costs", and the effects of shifts in demand and supply under "The Theory of the firms under perfect competition"). One PDF can feed several allowed chapters. Copy \`chapter\` and \`unit\` exactly from the entry of the chapterKey you chose. The chapterKey rule is subject + "." + slug(name), where slug lowercases, turns "&" into "and", replaces every run of non-alphanumerics with "-" and trims "-".`;

const CARD_BUDGET = `In this reply the coverage note of the paragraph above is a coverageNotes entry (section 9).
Output budget: your reasoning and the JSON together must fit in about 30,000 tokens and one card costs about 230 tokens, so never write more than about 90 cards. For a very long chapter keep the highest-value points: definitions, headed lists, comparison tables, formulas and the facts exams test.`;

const KIND_BUILD = `## 6. How each kind is built (the shape check enforces this exactly)
Q means the card's quote. A "fragment" is a run of words exactly as written in Q (a leading number or bullet such as "1." "(a)" "-" may be dropped).
- definition: front is a question or "Define X" that names the term (add the author if NCERT names one). back is Q, or a part of Q: NCERT's defining sentence(s).
- term: Q is ONE sentence that names its subject, at most about 140 characters. front is Q with each blanked word replaced by ____, so front with the blanks filled back in equals Q. blanks lists the blanked words in order. back is Q, which holds the term inside the full sentence.
- key_line: built like term, for an important statement with 1-3 key words blanked (2 at most is better, 1 is best).
- list, types and steps: front asks for the items ("Name the four features of X", "Types of X", "Steps in X, in order"). Q is the NCERT passage that contains EVERY item you give in back (never stop at a lead-in line that ends in a colon). back is one item per line, each line a fragment of Q: NCERT's exact item title, optionally followed by NCERT's own first explanatory sentence when it is short. back is at most about 700 characters.
- difference: front names both sides and the basis ("X vs Y: the difference on basis"). Q is the comparison-table row exactly as extracted (row label and cells); if the extraction does not give the row as one contiguous run, leave that row out. back is the cells, one per line, each a fragment of Q.
- formula: front is "Formula: X". Q is the NCERT sentence or line that holds the formula as printed. back is the formula, then (on further lines) what each symbol means in NCERT's words, every line a fragment of Q.
- entry: front is "Journal entry / treatment: situation". Q is the entry as NCERT shows it. back is the entry, one line per line, each a fragment of Q.
- fact: front is a who / when / where / how-many question. back is Q, or a part of Q, or one short label line (at most 80 characters) followed by NCERT's own sentence(s) taken from Q.
- example: front gives NCERT's example or case with the concept hidden. back is a part of Q, or a short label line naming the concept (at most 80 characters) followed by NCERT's own line(s) from Q.
- quote: front is "Who said / in which document: '...'". Q holds the quoted words and NCERT's attribution. back is a part of Q.

Examples (front | back | quote), all from published decks:
- definition: "Define management (Harold Koontz and Heinz Weihrich)." | back = quote = "Management is the process of designing and maintaining an environment in which individuals, working together in groups, efficiently accomplish selected aims."
- term: "____ is the force that binds all the other functions of management." with blanks ["Coordination"] | back = quote = "Coordination is the force that binds all the other functions of management."
- key_line: "Each testis has about ____ compartments called testicular lobules" with blanks ["250"] | back = quote = "Each testis has about 250 compartments called testicular lobules"
- list: "Name the input resources needed to do a task." | back "money / materials / equipment / persons required to do a particular task" (one per line) | quote "Input resources are money, materials, equipment and persons required to do a particular task."
- types: "Types of objectives of management." | back "organisational objectives / social objectives / personal or individual objectives" (one per line) | quote "Objectives can be classified into organisational objectives, social objectives and personal or individual objectives."
- difference: "Functional vs divisional structure: the difference on formation (functional first, divisional second)." | back "Formation is based on functions / Formation is based on product lines and is supported by functions." (one per line) | quote "Formation Formation is based on functions Formation is based on product lines and is supported by functions."
- formula: "Formula: the sacrifice by a partner." | back "Old Share of Profit - New Share of Profit" | quote "The sacrifice by a partner is equal to : Old Share of Profit - New Share of Profit"
- fact: "When was the Berlin Wall built, and when did the people break it?" | back = quote = "Built in 1961 to separate East Berlin from West Berlin, this more than 150 kilometre long wall stood for 28 years and was finally broken by the people on 9 November 1989."
- quote: "Who said: 'The United Nations was not created to take humanity to heaven, but to save it from hell.'" | back = quote = "The United Nations was not created to take humanity to heaven, but to save it from hell." - Dag Hammarskjold, the UN's second Secretary-General.`;

const AUTHOR_QUALITY = `## 7. Quality rules (the last review round flagged 24% of the cards; these are the reasons, avoid them)
1. A blank must be the one mark-carrying word or short phrase that only one answer fits: a technical term, a name, a number or a date. Never blank a verb, an adjective or a common word with synonyms ("harmony", "evenly", "translating plans" were all flagged). If no word in the line has a unique fill, make the card a question-style kind (definition, fact, list, types) instead of term or key_line.
2. At most 2 blanks per card; 1 is better.
3. The front must stand alone. Never start a front with "It", "This", "These", "They" or a lowercase fragment. Pick a quote span that names its subject, or use a question kind whose front names it.
4. term and key_line fronts are the quote with blanks, so their quotes must be at most about 140 characters.
5. No trivia: no time-bound statistics, no case-story numbers, no examples that only illustrate (unless the example itself is what exams ask), no etymology. Biology: the scientist tied to a discovery IS tested; keep those. Political Science: who, when, which event, treaty, party, organisation or leader IS tested; keep those.
6. No duplicates: one card per point. Do not re-card summary points already carded from the body. Make every front specific to its own point, so no two cards of a subject can share a front.
7. list, steps and types: the quote must contain every item in back. Never stop at a lead-in line that ends in a colon.
8. Exact printed forms: copy ratios, equations and formulas linearly exactly as your text shows them (for example "9:3:3:1"); never keep an extraction artefact ("longterm", "t he") in a quote.
9. Importance: mark must sparingly (section 3); illustrations and asides are good.
10. source.section is the NCERT heading as printed above the quote (for a card from the end-of-chapter recap use the printed heading, for example "Summary", "Recap" or "Points to Remember").`;

const CHECK_DETAILS = `How the checks read a card, so you can pass them:
- Normalising keeps only lowercase letters and digits: case, punctuation, spaces and hyphens never matter, but every word and number of the quote must be there, in the same order, as one unbroken run of the page text. One changed, dropped or added word fails the card.
- A blank is never a stopword. The stopwords are: ${STOPWORD_LIST.join(' ')}. Spelled-out "one", "two" and "three" are stopwords too; digits are fine ("250"). A blank of several words fails only when every word is a stopword. A blank's words must not appear anywhere else in the front.
- front must not start with It, Its, This, These, They, Those, Such, Thus, Hence, So, Therefore, However, Moreover, Alternatively, Also, Here, "In other words", "Not only that" or "On the other hand", and its first word must not be a bare lowercase word. Start with a capital letter, a digit or a blank.
- Sizes: front at most 140 characters; back at most 420 characters (700 for list, steps and types); note at most 160.
- Two cards of a subject may not share a front, nor a quote of the same kind.`;

const AUTHOR_IDS = `## 8. Ids
id = kc.<subject>.<chapter-slug>.<kind-short>-<slug>. chapter-slug is the part of the chapterKey after the first dot. kind-short is: definition def, term term, key_line kl, list list, difference diff, steps steps, types types, formula formula, fact fact, example ex, entry entry, quote quote. slug is 2 to 6 lowercase words (a-z and 0-9 only) joined by "-" that say what the card is about, for example "kc.business_studies.planning.def-planning-importance". Nothing else after the chapter-slug may contain a dot, a capital, a space or an underscore. Every id in your reply is unique. The id is stable: never reuse an id for different content.`;

const AUTHOR_REPLY = `## 9. Your reply
One JSON object (the schema is enforced):
- code, subject, book, chapterNo: copy them from the chapter header.
- cards: in book order, with order 10, 20, 30, ... following the book from its first page to its last. v is 1. asked is 0 (you cannot know past CUET papers: never guess). note is "" unless one plain line of explanation really helps (at most about 160 characters).
- coverageNotes: an array. Leave it empty unless a chapterKey ends with fewer than 15 cards because the chapter is genuinely short or only partly on the CUET 2026 syllabus, or unless the whole PDF is off the syllabus; then add {chapterKey, note}: one sentence saying what is left out and why.`;

let authorSystemMemo = null;
/** The author's system text. Built once and never changed per request, so the prompt-cache prefix is byte-identical. */
export function buildAuthorSystem(spec = null) {
  if (!spec && authorSystemMemo) return authorSystemMemo;
  const p = specParts(spec ?? loadSpecText());
  const text = [AUTHOR_INTRO, AUTHOR_SOURCES, p.kinds, p.record, `${p.howMany}\n${CARD_BUDGET}`, `${p.checks}\n\n${CHECK_DETAILS}`, KIND_BUILD, AUTHOR_QUALITY, AUTHOR_IDS, AUTHOR_REPLY].join('\n\n');
  if (!spec) authorSystemMemo = text;
  return text;
}

const REVIEW_INTRO = `You are the independent reviewer of MockMob "Key cards". MockMob is an exam-preparation app for Indian students sitting CUET (UG) after Class 12. A Key card is one flash card built from one exact line of the current NCERT Class 12 textbook (Reprint 2026-27). Another author wrote the cards you receive. You judge them against the printed text and the CUET 2026 syllabus. You may only judge: you never edit a card.

Each request gives you, in the user message: (1) the official CUET 2026 syllabus text of the subject, with the list of ALLOWED CHAPTERS; (2) the full text of the NCERT chapter PDF the cards were written from, page by page (every page starts with a marker line [[PRINTED PAGE n]], n being the page number printed in the page corner); (3) the cards to review, one JSON object per line. Nothing else is known about how a card was made: judge only what you see.`;

const REVIEW_QUESTIONS = `## The four questions (answer every one, for every card)
- exact: is "quote" NCERT's exact wording on the cited printed page (or on the page before or after it, for a line that crosses a page)? Are front and back derived from it as the card rules below require (section 6 of the rules)? Is the chapter right? Chapter assignment follows the CUET 2026 unit lists, not only the NCERT chapter the text sits in: read the syllabus text before you call a chapter wrong. A card whose chapter is wrong gets exact:false with a reason that starts "CHAPTER:". A quote that paraphrases, drops, adds or reorders words, or that you cannot find on the cited page, is not exact.
- important: is it worth a CUET student's memory (definitions, headed lists, tables, formulas, facts exams test), and is it inside the CUET 2026 syllabus? Trivia, time-bound statistics, case-story filler, etymology and points the syllabus does not list are not important. When two cards in your list test the same point, the weaker one is not important (reason "DUPLICATE: same point as <id>").
- unambiguous: can a student give exactly one right answer from the front alone? Each blank must be a mark-carrying word (a term, name, number or date) with one right fill, not a word with obvious synonyms. The front must stand on its own: no dangling "It" or "This", no lowercase fragment. A front that another card's back would answer equally well is ambiguous.
- importanceRight: is "must" versus "good" sensible? "must" is for the points a CUET paper most likely tests: core definitions, formulas, headed lists, comparison tables, key facts. About a quarter of a chapter's cards are "must": a "must" on a minor line is wrong, and so is a "good" on the chapter's central definition or formula.

Be strict. When unsure, set the flag false and say why. The reason is short (one sentence), required when any flag is false, and "" when all four are true.`;

const REVIEW_REPLY = `## Your reply
One JSON object: {"reviews": [...]} with exactly one entry per card, in the order given, each carrying the card's id copied exactly as written, then exact, important, unambiguous, importanceRight (true or false) and reason. Do not skip a card and do not add one.`;

let reviewSystemMemo = null;
/** The reviewer's system text (identical for every review request). */
export function buildReviewSystem(spec = null) {
  if (!spec && reviewSystemMemo) return reviewSystemMemo;
  const p = specParts(spec ?? loadSpecText());
  const rules = `## What a good card is (the rules the author followed)\n${p.kinds}\n\n${p.record}\n\n${KIND_BUILD}\n\n${AUTHOR_QUALITY}`;
  const text = [REVIEW_INTRO, REVIEW_QUESTIONS, rules, REVIEW_REPLY].join('\n\n');
  if (!spec) reviewSystemMemo = text;
  return text;
}

// ---------------------------------------------------------------------------------------------------------------
// Output schemas (structured outputs: objects closed, every property required, no unsupported keywords)
// ---------------------------------------------------------------------------------------------------------------

const str = (description) => ({ type: 'string', ...(description ? { description } : {}) });
const only = (type, value) => ({ type, enum: [value] });

/** The JSON schema of one author reply: the draft file's shape (ncert-books/drafts/<code>.json) with every field required. */
export function authorSchema({ code, subject, option = null, book, chapterNo }) {
  const keys = allowedChapters(subject, option).map((c) => c.key);
  return {
    type: 'object',
    additionalProperties: false,
    required: ['code', 'subject', 'book', 'chapterNo', 'cards', 'coverageNotes'],
    properties: {
      code: only('string', code),
      subject: only('string', subject),
      book: only('string', book),
      chapterNo: only('integer', chapterNo),
      cards: {
        type: 'array',
        description: 'The Key cards of this PDF in book order. Empty when nothing in the PDF is on the CUET 2026 syllabus.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'v', 'subject', 'chapterKey', 'chapter', 'unit', 'kind', 'quote', 'front', 'back', 'blanks', 'source', 'importance', 'asked', 'tags', 'order', 'note'],
          properties: {
            id: str('kc.<subject>.<chapter-slug>.<kind-short>-<slug>, unique'),
            v: only('integer', 1),
            subject: only('string', subject),
            chapterKey: { type: 'string', enum: keys, description: 'One of the allowed chapterKey values.' },
            chapter: str('The stored name of the chosen chapter, copied from the allowed list.'),
            unit: str('The CUET unit of the chosen chapter, copied from the allowed list.'),
            kind: { type: 'string', enum: [...NCERT_KINDS] },
            quote: str('The exact NCERT text the card rests on, copied word for word from the chapter text. No ellipsis, no page markers.'),
            front: str('The prompt shown to the student. At most about 140 characters; stands alone.'),
            back: str('The answer, derived from the quote as the rules for the kind require.'),
            blanks: { type: 'array', items: { type: 'string' }, description: 'term and key_line only: the blanked words in order; otherwise empty.' },
            source: {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'book', 'code', 'chapterNo', 'page', 'section'],
              properties: {
                kind: only('string', 'ncert'),
                book: only('string', book),
                code: only('string', code),
                chapterNo: only('integer', chapterNo),
                page: { type: 'integer', description: 'The printed page number (from the [[PRINTED PAGE n]] marker) where the quote starts.' },
                section: str('The NCERT heading as printed above the quote.'),
              },
            },
            importance: { type: 'string', enum: ['must', 'good'] },
            asked: only('integer', 0),
            tags: { type: 'array', items: { type: 'string' } },
            order: { type: 'integer', description: '10, 20, 30, ... in book order.' },
            note: str('Empty, or one plain line of explanation (at most about 160 characters).'),
          },
        },
      },
      coverageNotes: {
        type: 'array',
        description: 'Usually empty. One entry per chapterKey left short or off-syllabus, saying why.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['chapterKey', 'note'],
          properties: { chapterKey: { type: 'string', enum: keys }, note: str() },
        },
      },
    },
  };
}

/** The JSON schema of one review reply: an object root holding the array the review files hold. */
export function reviewSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['reviews'],
    properties: {
      reviews: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'exact', 'important', 'unambiguous', 'importanceRight', 'reason'],
          properties: {
            id: str('The card id, copied exactly.'),
            exact: { type: 'boolean' },
            important: { type: 'boolean' },
            unambiguous: { type: 'boolean' },
            importanceRight: { type: 'boolean' },
            reason: str('Short; required when any answer is false; empty when all are true.'),
          },
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The user message
// ---------------------------------------------------------------------------------------------------------------

const tidy = (text) => String(text ?? '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

function optionNote(subject, option) {
  if (!option) return null;
  const label = SUBJECT_OPTIONS[subject]?.choices?.find((c) => c.id === option)?.label ?? option;
  return `OPTION: this book belongs to Section ${option} (${label}). The chapters listed below are those of Section ${option} plus the section every student of the subject sits; the other option's topics in the syllabus text are not yours (no cards for them).`;
}

/**
 * The first user block: the subject's CUET 2026 syllabus text and its allowed chapters. It depends only on subject and option
 * (nothing about the PDF), so every request of a subject shares one cached prefix.
 */
export function subjectBlockText({ subject, option = null, syllabusText }) {
  const lines = [`SUBJECT: ${SUBJECT_LABELS[subject] ?? subject} (subject id: ${subject})`];
  const note = optionNote(subject, option);
  if (note) lines.push(note);
  lines.push('', '=== CUET 2026 SYLLABUS TEXT (official, from the NTA subject syllabus PDF) ===', tidy(syllabusText), '');
  lines.push('=== ALLOWED CHAPTERS (use each chapterKey exactly as written; chapter and unit are copied from the same entry) ===');
  for (const c of allowedChapters(subject, option)) {
    const ref = c.ncert?.code
      ? `${c.ncert.book}, chapter ${Array.isArray(c.ncert.span) ? `${c.ncert.span[0]}-${c.ncert.span[1]}` : c.ncert.chapter}, "${c.ncert.title}" (${c.ncert.code})`
      : 'no NCERT chapter on record (a CUET topic only)';
    lines.push(`- chapterKey: ${c.key} | chapter: ${c.name} | unit: ${c.unit} | section: ${c.section ?? 'any'} | NCERT: ${ref}`);
  }
  return lines.join('\n');
}

/** Marker line of one PDF page: the printed page number, or a note for pages that carry none (cover, contents). */
export const pageMarker = (printed) => (printed >= 1 ? `[[PRINTED PAGE ${printed}]]` : '[[NO PRINTED PAGE NUMBER: do not cite]]');

/** The second user block: the chapter header and the whole chapter text, one marker line before each PDF page. */
export function chapterBlockText({ info, pages, offset }) {
  const first = 1 + offset;
  const last = pages.length + offset;
  const head = [
    '=== NCERT CHAPTER PDF ===',
    `code: ${info.code}`,
    `book: ${info.book}`,
    `chapter number: ${info.chapterNo}`,
    ...(info.title ? [`chapter title: ${info.title}`] : []),
    `subject: ${info.subject}`,
    `printed page numbers: ${Math.max(first, 1)} to ${last}`,
    `allowed chapters that name this PDF as their NCERT chapter: ${info.primaryKeys.length ? info.primaryKeys.join(', ') : 'none (the CUET unit lists decide)'}`,
    '',
    'The chapter text follows. Every PDF page starts with a marker line [[PRINTED PAGE n]]; n is the printed page number to cite.',
    '',
  ];
  const body = pages.map((page, i) => `${pageMarker(i + 1 + offset)}\n${tidy(page)}`);
  return `${head.join('\n')}\n${body.join('\n\n')}\n\n=== END OF CHAPTER TEXT ===`;
}

const textBlock = (text, cache = false) => ({ type: 'text', text, ...(cache ? { cache_control: CACHE } : {}) });

const AUTHOR_TAIL = 'Write the Key cards for this PDF now, following the rules in the system prompt. The output schema is enforced; reply with the JSON object only.';

/** One author request: { custom_id, params, meta }. `pages` is the raw text of each PDF page and `offset` the printed-page offset. */
export function buildAuthorRequest({ code, pages, offset, syllabusText }) {
  const info = describeCode(code);
  const schema = authorSchema(info);
  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS.author,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema } },
    system: [textBlock(buildAuthorSystem(), true)],
    messages: [{
      role: 'user',
      content: [
        textBlock(subjectBlockText({ subject: info.subject, option: info.option, syllabusText }), true),
        textBlock(`${chapterBlockText({ info, pages, offset })}\n\n${AUTHOR_TAIL}`),
      ],
    }],
  };
  const custom_id = `author-${code}`;
  return { custom_id, params, meta: { custom_id, kind: 'author', code, subject: info.subject, option: info.option, book: info.book, chapterNo: info.chapterNo, title: info.title, inputTokensEst: estimateInputTokens(params) } };
}

const cardLine = (c) => JSON.stringify({
  id: c.id, kind: c.kind, chapterKey: c.chapterKey, page: c.source?.page, section: c.source?.section, importance: c.importance,
  front: c.front, back: c.back, quote: c.quote, ...(Array.isArray(c.blanks) && c.blanks.length ? { blanks: c.blanks } : {}), ...(c.note ? { note: c.note } : {}),
});

/** One review request over `cards` (a chunk of a draft): { custom_id, params, meta }. */
export function buildReviewRequest({ code, pages, offset, syllabusText, cards, chunk = 1, chunks = 1 }) {
  const info = describeCode(code);
  const ids = cards.map((c) => c.id);
  const list = [
    `=== CARDS TO REVIEW (part ${chunk} of ${chunks}: ${cards.length} card${cards.length === 1 ? '' : 's'}) ===`,
    'One JSON object per line. Return exactly one review per card, in this order, with the id copied exactly.',
    '',
    ...cards.map(cardLine),
  ].join('\n');
  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS.review,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema: reviewSchema() } },
    system: [textBlock(buildReviewSystem(), true)],
    messages: [{
      role: 'user',
      content: [
        textBlock(subjectBlockText({ subject: info.subject, option: info.option, syllabusText }), true),
        textBlock(chapterBlockText({ info, pages, offset }), true),
        textBlock(list),
      ],
    }],
  };
  const custom_id = `review-${code}-${chunk}`;
  return {
    custom_id, params,
    meta: {
      custom_id, kind: 'review', code, subject: info.subject, option: info.option, book: info.book, chapterNo: info.chapterNo, chunk, chunks,
      cardIds: ids, cardHashes: Object.fromEntries(cards.map((c) => [c.id, cardHash(c)])), inputTokensEst: estimateInputTokens(params),
    },
  };
}

/** Split a draft's cards into review requests' worth. */
export const chunkCards = (cards, size = REVIEW_CHUNK) => {
  const n = Math.max(1, Math.ceil(cards.length / Math.max(1, size)));
  const per = Math.ceil(cards.length / n); // even parts rather than 50 + 3
  return Array.from({ length: n }, (_, i) => cards.slice(i * per, (i + 1) * per)).filter((part) => part.length);
};

// ---------------------------------------------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------------------------------------------

const textOf = (block) => (typeof block === 'string' ? block : String(block?.text ?? ''));
/** Characters the model reads: system, user text, and the output schema. */
function requestChars(params) {
  let n = 0;
  for (const b of params.system ?? []) n += textOf(b).length;
  for (const m of params.messages ?? []) for (const b of Array.isArray(m.content) ? m.content : [m.content]) n += textOf(b).length;
  return n + JSON.stringify(params.output_config?.format?.schema ?? {}).length;
}
export const estimateInputTokens = (params) => Math.ceil(requestChars(params) / CHARS_PER_TOKEN);

/**
 * The cost of requests before they run. Micro-dollars are tokens x USD-per-million, so they are exact integers here.
 *   reserveMicro      conservative maximum: standard price, estimated input, every reply filling max_tokens (the ledger holds this)
 *   batchMaxMicro     the same at the Batch API's 50%
 *   batchLikelyMicro  input at batch price plus replies at LIKELY_OUTPUT_SHARE of max_tokens at batch price
 */
export function estimateCost(requests) {
  const rows = requests.map((r) => ({ custom_id: r.custom_id, inputTokens: estimateInputTokens(r.params), maxTokens: r.params.max_tokens }));
  const inputTokens = rows.reduce((s, r) => s + r.inputTokens, 0);
  const maxOutputTokens = rows.reduce((s, r) => s + r.maxTokens, 0);
  const { inputPerMillion: pin, outputPerMillion: pout, batchFactor } = PRICES;
  const reserveMicro = Math.ceil(inputTokens * pin + maxOutputTokens * pout);
  return {
    requests: rows.length, inputTokens, maxOutputTokens, rows,
    reserveMicro,
    batchMaxMicro: Math.ceil(reserveMicro * batchFactor),
    batchLikelyMicro: Math.ceil((inputTokens * pin + Math.ceil(maxOutputTokens * LIKELY_OUTPUT_SHARE) * pout) * batchFactor),
  };
}

/**
 * The batch-price cost of one result's usage, in (fractional) micro-dollars: input_tokens + cache_creation_input_tokens x 1.25 +
 * cache_read_input_tokens x 0.1 at the input price, output_tokens at the output price, all x 0.5. Callers sum, then round up once.
 */
export function usageCostMicro(usage, { batch = true } = {}) {
  const n = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
  const u = usage ?? {};
  const inputUnits = n(u.input_tokens) + PRICES.cacheWriteFactor * n(u.cache_creation_input_tokens) + PRICES.cacheReadFactor * n(u.cache_read_input_tokens);
  const micro = inputUnits * PRICES.inputPerMillion + n(u.output_tokens) * PRICES.outputPerMillion;
  return batch ? micro * PRICES.batchFactor : micro;
}

export const usd = (micro) => `$${(micro / 1e6).toFixed(micro < 1e6 ? 3 : 2)}`;
const count = (n) => Number(n).toLocaleString('en-US');

// ---------------------------------------------------------------------------------------------------------------
// Reading results
// ---------------------------------------------------------------------------------------------------------------

const clean = (v) => (typeof v === 'string' ? v.replace(/\[\[(?:PRINTED PAGE[^\]]*|NO PRINTED PAGE[^\]]*)\]\]/gi, ' ').replace(/[ \t]{2,}/g, ' ').trim() : '');
const toInt = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);

const KIND_SHORT = Object.freeze({ definition: 'def', term: 'term', key_line: 'kl', list: 'list', difference: 'diff', steps: 'steps', types: 'types', formula: 'formula', fact: 'fact', example: 'ex', entry: 'entry', quote: 'quote' });
const idPattern = (subject, slug) => new RegExp(`^kc\\.${subject}\\.${slug.replace(/-/g, '\\-')}\\.[a-z][a-z0-9_]*-[a-z0-9]+(?:-[a-z0-9]+)*$`);
const slugWords = (text, max = 48) => {
  const s = String(text ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (s.length > max ? s.slice(0, max).replace(/-[^-]*$/, '') : s).replace(/^-+|-+$/g, '');
};

/** `id` if free in `taken`, else id-2, id-3, ...; the result is added to `taken`. */
export function uniqueId(id, taken) {
  let out = id;
  for (let k = 2; taken.has(out); k += 1) out = `${id}-${k}`;
  taken.add(out);
  return out;
}

/** Keep a well-formed id; rebuild a malformed one from its words; make it unique among `taken`. */
function settleId(raw, { subject, slug, kind, front }, taken) {
  let id = String(raw ?? '').trim();
  if (!slug || !idPattern(subject, slug).test(id)) {
    const short = KIND_SHORT[kind] ?? 'card';
    const tail = String(raw ?? '').split('.').pop(); // the words after the last dot, or the whole text when it has none
    const words = slugWords(tail.replace(new RegExp(`^${short}[-_\\s]+`, 'i'), '')) || slugWords(front) || 'card';
    id = `kc.${subject}.${slug || 'unknown'}.${short}-${words}`;
  }
  return uniqueId(id, taken);
}

/**
 * Ids must stay unique across a subject's drafts (validate.mjs quarantines a repeat). Renames a card whose id another draft
 * already has (suffix -2, -3...) and adds every id of `cards` to `taken`. Returns the renames as [from, to] pairs.
 */
export function dedupeIds(cards, taken) {
  const renamed = [];
  for (const card of cards) {
    const id = uniqueId(card.id, taken);
    if (id !== card.id) { renamed.push([card.id, id]); card.id = id; }
  }
  return renamed;
}

/**
 * One author card in the draft file's shape, key order as the existing drafts. Constants (v, asked, subject, source book / code /
 * chapter number, chapter name, unit) come from the request, not from the model; the card's words (quote, front, back, blanks)
 * are never touched except to trim and to drop a page marker the model may have copied. An over-long note is dropped (the note
 * is optional decoration; a long one would quarantine the whole card).
 */
export function normalizeCard(raw, ctx, index, taken = new Set(), warnings = []) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const entry = ctx.chapterByKey.get(c.chapterKey) ?? null;
  if (!entry) warnings.push(`card ${index + 1}: chapterKey "${c.chapterKey}" is not an allowed chapter (kept; validate.mjs will quarantine it)`);
  const chapterKey = typeof c.chapterKey === 'string' ? c.chapterKey : '';
  const slug = chapterKey.startsWith(`${ctx.subject}.`) ? chapterKey.slice(ctx.subject.length + 1) : '';
  const kind = typeof c.kind === 'string' ? c.kind : '';
  const front = clean(c.front);
  const card = {
    id: settleId(c.id, { subject: ctx.subject, slug, kind, front }, taken),
    v: 1,
    subject: ctx.subject,
    chapterKey,
    chapter: entry?.name ?? clean(c.chapter),
    unit: entry?.unit ?? clean(c.unit),
    kind,
    front,
    back: clean(c.back).replace(/\n[ \t]+/g, '\n'),
    quote: clean(c.quote),
    blanks: Array.isArray(c.blanks) ? c.blanks.map(clean) : [],
    source: { kind: 'ncert', book: ctx.book, code: ctx.code, chapterNo: ctx.chapterNo, page: toInt(c.source?.page), section: clean(c.source?.section) },
    importance: c.importance === 'must' ? 'must' : 'good',
    asked: 0,
    tags: Array.isArray(c.tags) ? c.tags.map(clean).filter(Boolean) : [],
    order: Number.isFinite(Number(c.order)) && c.order !== null && c.order !== '' ? Number(c.order) : (index + 1) * 10,
  };
  const note = clean(c.note);
  if (note && note.length <= 160 + 20) card.note = note;
  else if (note) warnings.push(`card ${index + 1}: note of ${note.length} characters dropped`);
  return card;
}

/** A whole author reply as the draft file: { code, subject, book, chapterNo, cards, coverageNotes? }. */
export function normalizeDraft(data, meta, { takenIds = new Set() } = {}) {
  const warnings = [];
  if (!data || typeof data !== 'object' || !Array.isArray(data.cards)) throw new Error('reply has no cards array');
  const chapterByKey = new Map(allowedChapters(meta.subject, meta.option).map((c) => [c.key, c]));
  const ctx = { subject: meta.subject, book: meta.book, code: meta.code, chapterNo: meta.chapterNo, chapterByKey };
  const taken = new Set(takenIds);
  const cards = data.cards.map((raw, i) => normalizeCard(raw, ctx, i, taken, warnings));
  const draft = { code: meta.code, subject: meta.subject, book: meta.book, chapterNo: meta.chapterNo, cards };
  const notes = {};
  for (const n of Array.isArray(data.coverageNotes) ? data.coverageNotes : []) if (typeof n?.chapterKey === 'string' && clean(n.note)) notes[n.chapterKey] = clean(n.note);
  if (Object.keys(notes).length) draft.coverageNotes = notes;
  return { draft, warnings };
}

const VERDICT_KEYS = ['exact', 'important', 'unambiguous', 'importanceRight'];

/** One review reply as { entries, missing, extra, warnings }: entries keyed by id, in the order asked, a duplicate answer keeping the stricter. */
export function normalizeReviews(data, meta) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.reviews)) throw new Error('reply has no reviews array');
  const want = new Set(meta.cardIds);
  const got = new Map();
  const extra = [];
  const warnings = [];
  for (const r of data.reviews) {
    const id = typeof r?.id === 'string' ? r.id.trim() : '';
    if (!want.has(id)) { extra.push(id || '(no id)'); continue; }
    const entry = { id };
    for (const k of VERDICT_KEYS) entry[k] = r[k] === true;
    entry.reason = clean(r.reason);
    const prior = got.get(id);
    if (prior) {
      warnings.push(`two answers for ${id}: the stricter kept`);
      for (const k of VERDICT_KEYS) entry[k] = entry[k] && prior[k];
      entry.reason = [prior.reason, entry.reason].filter(Boolean).join(' / ');
    }
    got.set(id, entry);
  }
  for (const e of got.values()) if (!VERDICT_KEYS.every((k) => e[k]) && !e.reason) e.reason = 'reviewer gave no reason';
  const entries = meta.cardIds.filter((id) => got.has(id)).map((id) => got.get(id));
  return { entries, missing: meta.cardIds.filter((id) => !got.has(id)), extra, warnings };
}

const failure = (out, reason, detail) => ({ ...out, ok: false, reason, ...(detail ? { detail } : {}) });

/**
 * One line of the results file ({ custom_id, result }) for its request (`meta`), as an outcome:
 *   { custom_id, kind, code, ok, reason?, detail?, value?, warnings?, usage, costMicro }
 * Only succeeded results carry usage and cost; max_tokens and refusal are failures (and still cost what they used).
 */
export function parseResult(line, meta, { takenIds = new Set() } = {}) {
  const out = { custom_id: line?.custom_id ?? meta?.custom_id, kind: meta?.kind, code: meta?.code, ok: false, usage: null, costMicro: 0 };
  const result = line?.result;
  if (!result || typeof result !== 'object') return failure(out, 'no_result');
  if (result.type !== 'succeeded') {
    const e = result.error?.error ?? result.error;
    return failure(out, result.type || 'no_result', e ? `${e.type ?? 'error'}: ${e.message ?? ''}`.trim() : undefined);
  }
  const msg = result.message ?? {};
  out.usage = msg.usage ?? null;
  out.costMicro = usageCostMicro(msg.usage);
  if (msg.stop_reason === 'max_tokens') return failure(out, 'max_tokens', 'the reply hit max_tokens and its JSON is cut off');
  if (msg.stop_reason === 'refusal') return failure(out, 'refusal', msg.stop_details ? JSON.stringify(msg.stop_details) : 'refused');
  if (msg.stop_reason !== 'end_turn') return failure(out, `stop_reason:${msg.stop_reason}`);
  const text = (Array.isArray(msg.content) ? msg.content : []).filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('');
  if (!text.trim()) return failure(out, 'no_text');
  let data;
  try { data = JSON.parse(text); } catch (e) { return failure(out, 'bad_json', e.message); }
  try {
    if (meta.kind === 'author') {
      const { draft, warnings } = normalizeDraft(data, meta, { takenIds });
      return { ...out, ok: true, value: draft, warnings };
    }
    const { entries, missing, extra, warnings } = normalizeReviews(data, meta);
    return { ...out, ok: true, value: entries, missing, extra, warnings };
  } catch (e) {
    return failure(out, 'bad_shape', e.message);
  }
}

/**
 * Every result line matched to its request by custom_id (the file is in any order). { outcomes: Map(custom_id -> outcome),
 * unknown: [custom_id not in the batch], missing: [custom_id with no result line] }.
 */
export function collectOutcomes(lines, metas, opts = {}) {
  const byId = new Map(metas.map((m) => [m.custom_id, m]));
  const outcomes = new Map();
  const unknown = [];
  for (const line of lines) {
    const meta = byId.get(line?.custom_id);
    if (!meta) { unknown.push(line?.custom_id); continue; }
    if (outcomes.has(meta.custom_id)) continue; // a duplicate line never replaces the first
    outcomes.set(meta.custom_id, parseResult(line, meta, opts));
  }
  return { outcomes, unknown, missing: metas.filter((m) => !outcomes.has(m.custom_id)).map((m) => m.custom_id) };
}

// ---------------------------------------------------------------------------------------------------------------
// Files: run records, drafts, reviews
// ---------------------------------------------------------------------------------------------------------------

const draftFile = (code) => path.join(draftsDir(), `${code}.json`);
const reviewFile = (code) => path.join(reviewsDir(), `${code}.json`);
const recordFile = (batchId) => path.join(apiDir(), `${batchId}.json`);

/** Write JSON atomically (a half-written draft would be read by validate.mjs). */
export function writeJSONAtomic(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeJSON(tmp, value);
  renameSync(tmp, file);
}

export function saveRecord(record) {
  mkdirSync(apiDir(), { recursive: true });
  writeJSONAtomic(recordFile(record.batchId), record);
}

/** A submission that may have created a batch we never got the id of: tmp/keycards-api/unconfirmed-<reservation>.json. */
export function saveUnconfirmed(record) {
  mkdirSync(apiDir(), { recursive: true });
  writeJSONAtomic(path.join(apiDir(), `unconfirmed-${record.reservation.id}.json`), record);
}

export function loadRecord(batchId) {
  if (!BATCH_ID.test(String(batchId ?? ''))) throw new Error(`"${batchId}" is not a batch id (msgbatch_...)`);
  const file = recordFile(batchId);
  if (!existsSync(file)) throw new Error(`no run record for ${batchId} (expected ${file}); it was submitted from another checkout, or by hand`);
  return readJSON(file);
}

/**
 * Codes that are already in a batch nobody has collected (a run record with status "submitted"), or in a submission that failed
 * without a clear answer and may have created one (status "submit_unknown"): Map(code -> { batchId | null, file }) for this kind.
 */
export function pendingCodes(kind, dir = apiDir()) {
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    let rec;
    try { rec = readJSON(path.join(dir, name)); } catch { continue; }
    const open = rec?.status === 'submitted' && rec.batchId;
    if (rec?.kind !== kind || !(open || rec.status === 'submit_unknown')) continue;
    for (const code of rec.codes ?? []) if (!out.has(code)) out.set(code, { batchId: rec.batchId ?? null, file: name });
  }
  return out;
}

/** Ids of every card in the other drafts of a subject (a new card's id may not repeat one). */
export function takenIdsFor(subject, exceptCode) {
  const taken = new Set();
  const dir = draftsDir();
  if (!existsSync(dir)) return taken;
  for (const name of readdirSync(dir).filter((f) => /^[a-z]{4}[0-9a-z]{3}\.json$/.test(f))) {
    if (name === `${exceptCode}.json`) continue;
    try {
      const doc = readJSON(path.join(dir, name));
      if (doc?.subject === subject) for (const c of doc.cards ?? []) if (typeof c?.id === 'string') taken.add(c.id);
    } catch { /* a malformed file is validate.mjs's to report */ }
  }
  return taken;
}

// ---------------------------------------------------------------------------------------------------------------
// PDFs and the syllabus text
// ---------------------------------------------------------------------------------------------------------------

/** { pages: [raw text per PDF page], offset } for a chapter PDF, read through lib.mjs so the pages match the validator's; null when absent. */
export function loadChapterPages(code) {
  const pdf = pdfText(code);
  return pdf ? { pages: pdf.pages, offset: pdf.offset } : null;
}

function pdftotextBin() {
  const tried = [process.env.KEYCARDS_PDFTOTEXT, 'pdftotext', '/mingw64/bin/pdftotext', 'C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe'].filter(Boolean);
  for (const bin of tried) {
    try { execFileSync(bin, ['-v'], { stdio: 'ignore' }); return bin; } catch (e) { if (e.code !== 'ENOENT' && e.status !== undefined) return bin; }
  }
  throw new Error(`pdftotext not found (tried ${tried.join(', ')}); set KEYCARDS_PDFTOTEXT`);
}

// data/CUET 2026/<file>.pdf per subject id; the General Test is general_test.pdf (it has no NCERT book, so no card is authored for it)
const SYLLABUS_FILES = Object.freeze({ gat: 'general_test' });
const syllabusMemo = new Map();
/** The text of the subject's CUET 2026 syllabus PDF (data/CUET 2026/<subject>.pdf). */
export function readSyllabusText(subject) {
  if (syllabusMemo.has(subject)) return syllabusMemo.get(subject);
  const file = path.join(SYLLABUS_DIR, `${SYLLABUS_FILES[subject] ?? subject}.pdf`);
  if (!existsSync(file)) throw new Error(`CUET 2026 syllabus PDF not found: ${file}`);
  const text = tidy(execFileSync(pdftotextBin(), ['-enc', 'UTF-8', file, '-'], { maxBuffer: 32 * 1024 * 1024 }).toString('utf8').replace(/\f/g, '\n\n'));
  syllabusMemo.set(subject, text);
  return text;
}

// ---------------------------------------------------------------------------------------------------------------
// The key, the client, the ledger
// ---------------------------------------------------------------------------------------------------------------

export const DEFAULT_KEY_FILE = path.join(os.homedir(), 'MockMob-keys', 'anthropic-api-key.txt');

/** The API key: ANTHROPIC_API_KEY, else the key file. Throws a message that names the places looked at, never the key. */
export function resolveApiKey({ env = process.env, readFile = (f) => readFileSync(f, 'utf8') } = {}) {
  const fromEnv = String(env.ANTHROPIC_API_KEY ?? '').trim();
  if (fromEnv) return fromEnv;
  const file = env.ANTHROPIC_API_KEY_FILE || DEFAULT_KEY_FILE;
  try {
    const text = String(readFile(file)).trim().split(/\r?\n/)[0].trim();
    if (text) return text;
  } catch { /* fall through to the message */ }
  throw new Error(`no Anthropic API key: set ANTHROPIC_API_KEY, or put the key on the first line of ${file}`);
}

export const makeClient = () => new Anthropic({ apiKey: resolveApiKey(), maxRetries: 2, timeout: 15 * 60 * 1000 });

/** The main checkout's ledger, shared by every worktree: <repo parent>/mockmob copy/data/pipeline-budget.sqlite. */
export const DEFAULT_LEDGER = path.resolve(ROOT, '..', 'mockmob copy', 'data', 'pipeline-budget.sqlite');

export function ledgerPath(env = process.env) {
  return env.CUET_BUDGET_LEDGER ? { file: path.resolve(env.CUET_BUDGET_LEDGER), explicit: true } : { file: DEFAULT_LEDGER, explicit: false };
}

/** Opens the persistent ledger. Never creates the default one: a missing file means a wrong path, not a fresh budget. */
export async function openLedger(file = null) {
  const target = file ? { file: path.resolve(file), explicit: true } : ledgerPath();
  if (!target.explicit && !existsSync(target.file)) throw new Error(`budget ledger not found at ${target.file}; set CUET_BUDGET_LEDGER to its path`);
  const { BudgetLedger } = await import('../pipeline/lib/budgetLedger.mjs');
  const ledger = new BudgetLedger(target.file);
  ledger.file = target.file;
  return ledger;
}

export class BudgetStop extends Error {}
export class UsageError extends Error {}

/** Mark an accepted batch's reservation 'submitted': the ledger's start-up sweep only turns 'reserved' rows of dead processes into holds that block everything. */
export function markSubmitted(ledger, reservationId, receipt) {
  ledger.db.prepare("UPDATE requests SET state='submitted', receipt_json=? WHERE id=? AND state='reserved'").run(JSON.stringify(receipt), reservationId);
}

const receiptBase = (kind) => ({ provider: 'anthropic', stage: `keycards-${kind}`, purpose: 'keycards', model: MODEL });

/**
 * A batch create() that threw. An HTTP 4xx (not 408 / 409) means no batch exists: the reservation is released at zero. Anything
 * else is unknown (the batch may exist): the full reservation stays committed as a bounded hold, like the factory's
 * unresolved holds, and nothing is resubmitted.
 */
export function handleCreateFailure(ledger, reservationId, error, { kind, est }) {
  const status = Number.isInteger(error?.status) ? error.status : null;
  const receipt = { ...receiptBase(kind), http_status: status, error: String(error?.message ?? error).slice(0, 500) };
  if (status !== null && status >= 400 && status < 500 && status !== 408 && status !== 409) {
    ledger.settle(reservationId, 0, { ...receipt, billing_basis: `HTTP ${status} rejected before a batch was created` });
    return 'released';
  }
  ledger.settle(reservationId, null, receipt);
  try {
    ledger.retainConservativeHold(reservationId, {
      model: LEDGER_MODEL, input_bound: est.inputTokens, output_bound: est.maxOutputTokens,
      input_rate: PRICES.inputPerMillion, output_rate: PRICES.outputPerMillion, tool_calls: 0, tool_rate: 0,
      pricing_source: 'Anthropic Message Batches, claude-opus-5-5: USD 4 / 20 per million tokens (standard; this bound ignores the 50% batch discount), per the 1 Nov 2026 build brief',
      contract_hash: 'scripts/keycards/api-batch.mjs', provider_request_id: `unconfirmed-batch-create:${reservationId}`,
      basis: 'batches.create() failed without a definite rejection: the batch may exist. The full conservative maximum stays committed; nothing is resubmitted.',
    });
  } catch { /* an invalid bound must stay a global block */ }
  return 'held';
}

// ---------------------------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------------------------

const defaultDeps = () => ({
  log: (...a) => console.log(...a),
  err: (...a) => console.error(...a),
  makeClient,
  openLedger,
  loadChapter: loadChapterPages,
  syllabusText: readSyllabusText,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => new Date(),
  preCheck: null, // set lazily: (draft) => reasons summary
});

const BOOK = /^[a-z]{4}\d?$/;
const CODE = /^[a-z]{4}\d{3}$/;

/** The chapter codes a command names: --codes as given, --books by the PDFs found (leph1 -> leph101...; leph -> both parts). */
export function expandCodes({ books = [], codes = [] }) {
  const out = new Set();
  for (const code of codes) {
    if (!CODE.test(code)) throw new UsageError(`"${code}" is not a chapter code (for example leph101)`);
    bookSubject(code);
    if (!existsSync(path.join(pdfDir(), `${code}.pdf`))) throw new UsageError(`no PDF for ${code} in ${pdfDir()}`);
    out.add(code);
  }
  if (books.length) {
    const files = existsSync(pdfDir()) ? readdirSync(pdfDir()) : [];
    for (const book of books) {
      if (!BOOK.test(book)) throw new UsageError(`"${book}" is not a book code (for example leph1)`);
      bookSubject(book);
      const found = files.filter((f) => /^[a-z]{4}\d{3}\.pdf$/.test(f) && f.startsWith(book)).map((f) => f.slice(0, -4));
      if (!found.length) throw new UsageError(`no chapter PDFs for book ${book} in ${pdfDir()}`);
      for (const code of found) out.add(code);
    }
  }
  if (!out.size) throw new UsageError('name the chapters with --books=leph1,lech2 or --codes=leph101,leph102');
  return [...out].sort();
}

/** Requests for `kind`, with what was skipped and why. */
export async function planSubmit(kind, args, d) {
  const codes = expandCodes(args);
  const pending = args.force ? new Map() : pendingCodes(kind);
  const requests = [];
  const skipped = [];
  for (const code of codes) {
    const open = pending.get(code);
    if (open) {
      skipped.push({ code, why: open.batchId ? `already in batch ${open.batchId} (collect it first, or use --force)` : `an earlier submission that failed without a clear answer (${open.file}) may have created a batch: check the Anthropic console, then use --force` });
      continue;
    }
    let draft = null;
    let todo = null;
    if (kind === 'author') {
      if (!args.force && existsSync(draftFile(code))) { skipped.push({ code, why: 'a draft exists (use --force to author it again)' }); continue; }
    } else {
      if (!existsSync(draftFile(code))) { skipped.push({ code, why: 'no draft yet (author it first)' }); continue; }
      draft = readJSON(draftFile(code));
      const cards = (Array.isArray(draft?.cards) ? draft.cards : []).filter((c) => c && typeof c.id === 'string');
      const existing = existsSync(reviewFile(code)) ? readJSON(reviewFile(code)) : [];
      const have = new Set((Array.isArray(existing) ? existing : []).map((v) => v?.id));
      todo = args.force ? cards : cards.filter((c) => !have.has(c.id));
      if (!todo.length) { skipped.push({ code, why: cards.length ? 'every card has a review (use --force to review again)' : 'the draft has no cards' }); continue; }
    }
    const chapter = d.loadChapter(code);
    if (!chapter) { skipped.push({ code, why: 'PDF text unavailable' }); continue; }
    if (chapter.offset === null) { skipped.push({ code, why: 'printed page numbers could not be detected in the PDF (validate.mjs could not check quotes either)' }); continue; }
    const base = { code, pages: chapter.pages, offset: chapter.offset, syllabusText: d.syllabusText(describeCode(code).subject) };
    if (kind === 'author') requests.push(buildAuthorRequest(base));
    else {
      const parts = chunkCards(todo, args.chunk ?? REVIEW_CHUNK);
      parts.forEach((cards, i) => requests.push(buildReviewRequest({ ...base, cards, chunk: i + 1, chunks: parts.length })));
    }
  }
  return { codes, requests, skipped };
}

function printEstimate(d, label, est) {
  d.log(`${label}: ${est.requests} request${est.requests === 1 ? '' : 's'}`);
  d.log(`  estimated input tokens : ${count(est.inputTokens)} (characters / ${CHARS_PER_TOKEN})`);
  d.log(`  maximum output tokens  : ${count(est.maxOutputTokens)} (max_tokens x requests)`);
  d.log(`  batch price (50%)      : about ${usd(est.batchLikelyMicro)} likely, ${usd(est.batchMaxMicro)} if every reply fills max_tokens`);
  d.log(`  conservative maximum   : ${usd(est.reserveMicro)} (standard price, max_tokens; this is what the ledger reserves)`);
}

function writeDryRun(kind, requests) {
  const dir = apiDir();
  mkdirSync(dir, { recursive: true });
  let n = 1;
  while (existsSync(path.join(dir, `dryrun-${kind}-${n}.jsonl`))) n += 1;
  const file = path.join(dir, `dryrun-${kind}-${n}.jsonl`);
  const body = `${requests.map(({ custom_id, params }) => JSON.stringify({ custom_id, params })).join('\n')}\n`;
  writeFileSync(file, body);
  return { file, bytes: Buffer.byteLength(body) };
}

/** author / review: plan, estimate, then (not --dry-run) reserve, submit one batch, save the run record. Returns the exit code. */
export async function runSubmit(kind, args, d) {
  const plan = await planSubmit(kind, args, d);
  for (const s of plan.skipped) d.log(`skip ${s.code}: ${s.why}`);
  if (!plan.requests.length) { d.log(`nothing to ${kind}: every named chapter was skipped`); return 0; }
  const est = estimateCost(plan.requests);
  const byCode = new Map();
  for (const r of plan.requests) byCode.set(r.meta.code, (byCode.get(r.meta.code) ?? 0) + 1);
  const unmapped = [...byCode.keys()].filter((c) => !describeCode(c).primaryKeys.length);
  d.log(`${kind}: ${[...byCode.keys()].join(', ')}`);
  if (unmapped.length) d.log(`  note: no CUET 2026 chapter points at ${unmapped.join(', ')}; the model may return no cards for ${unmapped.length === 1 ? 'it' : 'them'}`);
  printEstimate(d, args.dryRun ? `[dry run] ${kind}` : kind, est);

  const body = plan.requests.map(({ custom_id, params }) => ({ custom_id, params }));
  for (const r of body) if (!CUSTOM_ID.test(r.custom_id)) throw new Error(`custom_id "${r.custom_id}" is not allowed by the Batches API`);
  const bytes = Buffer.byteLength(JSON.stringify({ requests: body }));
  if (bytes > BATCH_BYTES_LIMIT) throw new UsageError(`the batch would be ${(bytes / 1048576).toFixed(0)} MB; the API takes ${BATCH_BYTES_LIMIT / 1048576} MB. Submit fewer books at a time`);

  const limit = Number(process.env.CUET_CONTENT_LIMIT_USD);
  const overLimit = limit > 0 && est.reserveMicro / 1e6 > limit;
  if (args.dryRun) {
    const { file, bytes: size } = writeDryRun(kind, plan.requests);
    d.log(`  wrote ${file} (${(size / 1048576).toFixed(1)} MB)`);
    if (overLimit) d.log(`  warning: the conservative maximum is above CUET_CONTENT_LIMIT_USD=${limit}; a real run would stop`);
    return 0;
  }
  if (overLimit) throw new BudgetStop(`the conservative maximum ${usd(est.reserveMicro)} is above CUET_CONTENT_LIMIT_USD=${limit}: nothing submitted. Name fewer chapters or raise the limit`);

  const client = d.makeClient(); // a missing key stops here, before any reservation
  const ledger = await d.openLedger();
  let reservationId;
  try {
    try {
      ledger.assertHistoryReconciled();
      reservationId = ledger.reserve(LEDGER_MODEL, est.reserveMicro);
    } catch (e) {
      const s = ledger.snapshot();
      throw new BudgetStop(`budget guard refused the reservation of ${usd(est.reserveMicro)} (${e.message}); committed ${usd(s.committed_micro)} of ${usd(s.limit_micro)}, ${s.unresolved ?? 0} unresolved hold(s). Nothing was submitted`);
    }
    let batch;
    try {
      batch = await client.messages.batches.create({ requests: body }, { maxRetries: 0 });
    } catch (error) {
      let outcome = 'held';
      try { outcome = handleCreateFailure(ledger, reservationId, error, { kind, est }); } catch { /* the reservation stays as it is: a hold */ }
      if (outcome !== 'released') {
        // remember the chapters: running the same command again must not pay for them twice before somebody has looked
        saveUnconfirmed({ version: 1, batchId: null, kind, codes: [...byCode.keys()], status: 'submit_unknown', at: d.now().toISOString(), reservation: { id: reservationId, micro: est.reserveMicro }, error: String(error?.message ?? error).slice(0, 500), httpStatus: error?.status ?? null });
      }
      throw new Error(`batch submission failed (${error?.status ?? 'no HTTP status'}: ${String(error?.message ?? error).slice(0, 300)}). ${outcome === 'released' ? 'The reservation was released; fix the cause and run it again.' : `The batch may exist: check the Anthropic console before running again. ${usd(est.reserveMicro)} stays held in the ledger (reservation ${reservationId}).`}`);
    }
    d.log(`batch id: ${batch.id}`);
    saveRecord({
      version: 1, batchId: batch.id, kind, model: MODEL, createdAt: d.now().toISOString(), force: Boolean(args.force),
      codes: [...byCode.keys()], requests: plan.requests.map((r) => r.meta),
      reservation: { id: reservationId, micro: est.reserveMicro, ledger: ledger.file ?? null, ledgerModel: LEDGER_MODEL },
      estimate: { inputTokens: est.inputTokens, maxOutputTokens: est.maxOutputTokens, reserveMicro: est.reserveMicro, batchMaxMicro: est.batchMaxMicro, batchLikelyMicro: est.batchLikelyMicro },
      status: 'submitted', collectedAt: null, results: {}, usage: null, actualMicro: null, settledAt: null,
    });
    try {
      markSubmitted(ledger, reservationId, { ...receiptBase(kind), provider_batch_id: batch.id, codes: [...byCode.keys()], requests: plan.requests.length });
    } catch (e) {
      d.err(`warning: the batch is submitted and recorded, but the ledger row could not be marked submitted (${e.message}); the next ledger start-up may turn it into a hold`);
    }
    d.log(`  run record: ${recordFile(batch.id)}`);
    d.log(`  next: node scripts/keycards/api-batch.mjs collect ${batch.id}`);
    return 0;
  } finally {
    ledger.close();
  }
}

const sumUsage = (rows) => rows.reduce((t, u) => {
  for (const k of ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']) t[k] += Number.isFinite(u?.[k]) ? u[k] : 0;
  return t;
}, { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 });

const notClean = (v) => !VERDICT_KEYS.every((k) => v?.[k] === true);

/**
 * Write one author draft. A draft that exists is never overwritten unless the run was --force (then the old one is kept in the
 * batch's folder); otherwise the new one is saved beside it for a look.
 */
function writeAuthorOutcome(record, draft, meta) {
  const file = draftFile(meta.code);
  const side = path.join(apiDir(), record.batchId);
  // collect run twice (a crash, a missing result): the same draft again is not a clash
  if (existsSync(file) && JSON.stringify(readJSON(file)) === JSON.stringify(draft)) return { status: 'written', file, cards: draft.cards.length };
  if (existsSync(file) && !record.force) {
    mkdirSync(side, { recursive: true });
    const aside = path.join(side, `${meta.code}.draft.json`);
    writeJSONAtomic(aside, draft);
    return { status: 'not_written', reason: 'a draft appeared meanwhile and --force was not set; the new one is saved beside the run record', file: aside, cards: draft.cards.length };
  }
  if (existsSync(file)) {
    mkdirSync(side, { recursive: true });
    writeJSONAtomic(path.join(side, `${meta.code}.previous.json`), readJSON(file));
  }
  mkdirSync(draftsDir(), { recursive: true });
  writeJSONAtomic(file, draft);
  return { status: 'written', file, cards: draft.cards.length };
}

/**
 * Merge the verdicts of every collected chunk of one code into ncert-books/reviews/<code>.json: the draft's order, the draft's
 * ids only, other entries kept. A verdict for a card edited since it was submitted is dropped (the reviewer judged the old text).
 */
function writeReviewOutcomes(code, parts) {
  const draftPath = draftFile(code);
  if (!existsSync(draftPath)) return { status: 'not_written', reason: 'the draft is gone' };
  const current = new Map((readJSON(draftPath).cards ?? []).filter((c) => c && typeof c.id === 'string').map((c) => [c.id, c]));
  const merged = new Map();
  const file = reviewFile(code);
  for (const v of existsSync(file) ? readJSON(file) : []) if (v && typeof v.id === 'string') merged.set(v.id, v);
  let stale = 0;
  let fresh = 0;
  for (const { meta, entries } of parts) {
    for (const e of entries) {
      const card = current.get(e.id);
      if (!card || cardHash(card) !== meta.cardHashes?.[e.id]) { stale += 1; merged.delete(e.id); continue; }
      merged.set(e.id, e);
      fresh += 1;
    }
  }
  const final = [...current.keys()].filter((id) => merged.has(id)).map((id) => merged.get(id));
  mkdirSync(reviewsDir(), { recursive: true });
  writeJSONAtomic(file, final);
  return { status: 'written', file, verdicts: fresh, stale, flagged: final.filter(notClean).length, total: final.length, of: current.size };
}

/** The machine checks (validate.mjs checks 1-5) over a fresh draft, for a first look at the quarantine count. Informational only. */
export async function defaultPreCheck(draft) {
  const { checkSubject } = await import('./validate.mjs');
  const { loadKeycardsSyllabus } = await import('../../src/lib/server/keycardsSyllabus.js');
  const { quarantined } = checkSubject(draft.subject, draft.cards, { syllabus: await loadKeycardsSyllabus(), machineOnly: true });
  const reasons = {};
  for (const q of quarantined) for (const r of q.reasons) { const k = r.split(':').slice(0, 2).join(':'); reasons[k] = (reasons[k] || 0) + 1; }
  return { cards: draft.cards.length, quarantined: quarantined.length, reasons };
}

async function waitForEnd(client, batchId, d) {
  let failures = 0;
  const started = d.now().getTime();
  for (;;) {
    let batch;
    try {
      batch = await client.messages.batches.retrieve(batchId);
      failures = 0;
    } catch (e) {
      failures += 1;
      if (failures >= 10) throw e;
      d.err(`  could not read the batch (${String(e?.message ?? e).slice(0, 120)}); trying again`);
      await d.sleep(POLL_MS);
      continue;
    }
    const c = batch.request_counts ?? {};
    const mins = Math.round((d.now().getTime() - started) / 60000);
    d.log(`  ${batchId}: ${batch.processing_status} (processing ${c.processing ?? 0}, succeeded ${c.succeeded ?? 0}, errored ${c.errored ?? 0}, expired ${c.expired ?? 0}, canceled ${c.canceled ?? 0}; waited ${mins} min)`);
    if (batch.processing_status === 'ended') return batch;
    await d.sleep(POLL_MS);
  }
}

/** Keep the raw results (text blocks and usage only) beside the run record: the audit trail for every failure and every cost. */
function saveRaw(batchId, lines) {
  const dir = path.join(apiDir(), batchId);
  mkdirSync(dir, { recursive: true });
  for (const line of lines) {
    if (!CUSTOM_ID.test(String(line?.custom_id ?? ''))) continue;
    const m = line.result?.message;
    const slim = m ? { ...m, content: (m.content ?? []).filter((b) => b?.type === 'text') } : undefined;
    writeJSONAtomic(path.join(dir, `${line.custom_id}.json`), { custom_id: line.custom_id, result: { ...line.result, ...(slim ? { message: slim } : {}) } });
  }
}

/** Wait for the batch, read every result line, match it to its request by custom_id, write the files, and fill in the record. No ledger access. */
async function applyResults(record, client, d) {
  const batch = await waitForEnd(client, record.batchId, d);
  const lines = [];
  for await (const line of await client.messages.batches.results(record.batchId)) lines.push(line);
  const { outcomes, unknown, missing } = collectOutcomes(lines, record.requests);
  saveRaw(record.batchId, lines);

  // Author ids stay unique across the subject: against its other drafts and against the drafts of this batch, in a fixed order.
  const inRun = new Map();
  for (const meta of record.requests.filter((m) => m.kind === 'author').sort((a, b) => a.custom_id.localeCompare(b.custom_id))) {
    const o = outcomes.get(meta.custom_id);
    if (!o?.ok) continue;
    const taken = new Set([...takenIdsFor(meta.subject, meta.code), ...(inRun.get(meta.subject) ?? [])]);
    const renamed = dedupeIds(o.value.cards, taken);
    if (renamed.length) o.warnings = [...(o.warnings ?? []), `${renamed.length} id(s) renamed to stay unique in the subject: ${renamed.map(([a, b]) => `${a} -> ${b}`).join('; ')}`];
    inRun.set(meta.subject, new Set([...(inRun.get(meta.subject) ?? []), ...o.value.cards.map((c) => c.id)]));
  }

  record.results = {};
  record.merged = {};
  const reviewParts = new Map();
  for (const meta of record.requests) {
    const o = outcomes.get(meta.custom_id);
    const base = { code: meta.code, ...(o?.warnings?.length ? { warnings: o.warnings } : {}), ...(o ? { costMicro: Math.ceil(o.costMicro) } : {}) };
    if (!o) { record.results[meta.custom_id] = { status: 'failed', code: meta.code, reason: 'no_result', detail: 'the batch ended without a result line for this request' }; continue; }
    if (!o.ok) { record.results[meta.custom_id] = { ...base, status: 'failed', reason: o.reason, ...(o.detail ? { detail: o.detail } : {}) }; continue; }
    if (meta.kind === 'author') {
      const written = writeAuthorOutcome(record, o.value, meta);
      const machineCheck = await (d.preCheck ?? defaultPreCheck)(o.value).catch((e) => ({ skipped: String(e?.message ?? e).slice(0, 120) }));
      record.results[meta.custom_id] = { ...base, ...written, machineCheck };
    } else {
      if (!reviewParts.has(meta.code)) reviewParts.set(meta.code, []);
      reviewParts.get(meta.code).push({ meta, entries: o.value });
      record.results[meta.custom_id] = { ...base, status: o.missing?.length ? 'written_partial' : 'written', verdicts: o.value.length, ...(o.missing?.length ? { missing: o.missing } : {}), ...(o.extra?.length ? { extra: o.extra } : {}) };
    }
  }
  for (const [code, parts] of reviewParts) {
    record.merged[code] = writeReviewOutcomes(code, parts);
    if (record.merged[code].status !== 'written') for (const { meta } of parts) record.results[meta.custom_id].status = 'not_written';
  }

  // Only succeeded requests are billed (their usage, including a refusal's or a truncated reply's).
  const billed = [...outcomes.values()].filter((o) => o.usage);
  record.usage = sumUsage(billed.map((o) => o.usage));
  record.actualMicro = Math.ceil(billed.reduce((s, o) => s + o.costMicro, 0));
  record.batch = { processing_status: batch.processing_status, request_counts: batch.request_counts ?? null, ended_at: batch.ended_at ?? null };
  record.unknownResults = unknown;
  record.missingResults = missing;
  record.status = 'written';
}

/** Settle the reservation with the actual cost. Returns a problem as text, or null (record.settledAt is then set). */
async function settleRecord(record, d) {
  if (record.missingResults?.length) return `${record.missingResults.length} request(s) have no result line: the reservation stays open until they are accounted for (run collect again)`;
  let ledger = null;
  try {
    ledger = await d.openLedger(record.reservation?.ledger && existsSync(record.reservation.ledger) ? record.reservation.ledger : null);
    const row = ledger.db.prepare('SELECT state FROM requests WHERE id=?').get(record.reservation.id);
    if (!row) return `reservation ${record.reservation.id} is not in the ledger ${ledger.file ?? ''}`;
    if (row.state !== 'settled') {
      ledger.settle(record.reservation.id, record.actualMicro, {
        ...receiptBase(record.kind), provider_batch_id: record.batchId, codes: record.codes,
        usage: { input_tokens: record.usage.input_tokens + record.usage.cache_creation_input_tokens + record.usage.cache_read_input_tokens, output_tokens: record.usage.output_tokens },
        usage_detail: record.usage, input_per_million: PRICES.inputPerMillion, output_per_million: PRICES.outputPerMillion, batch_discount: PRICES.batchFactor,
        billing_basis: 'Message Batches usage of the succeeded requests at 50% of the standard rates; errored, expired and canceled requests are not billed',
      });
      if (ledger.db.prepare('SELECT state FROM requests WHERE id=?').get(record.reservation.id)?.state === 'unresolved') {
        return `the actual cost ${usd(record.actualMicro)} is above the reservation ${usd(record.reservation.micro)}: the ledger marked it unresolved`;
      }
    }
    record.settledAt = d.now().toISOString();
    return null;
  } catch (e) {
    return `the ledger could not settle the reservation (${e.message})`;
  } finally {
    ledger?.close();
  }
}

/** collect <batchId>: wait for the end, write the files, record failures, settle the ledger. Returns the exit code. */
export async function runCollect(batchId, args, d) {
  const record = loadRecord(batchId);
  if (record.status === 'collected') {
    d.log(`${batchId} was collected at ${record.collectedAt}: ${summaryLine(record)}`);
    return 0;
  }
  if (record.status !== 'written' || record.missingResults?.length) {
    await applyResults(record, d.makeClient(), d); // writing is idempotent, so a second pass over the same results is safe
    saveRecord(record); // the files are written: never lose that fact if the ledger step fails
  }
  record.settleError = await settleRecord(record, d);
  if (!record.settleError) { record.status = 'collected'; record.collectedAt = d.now().toISOString(); }
  saveRecord(record);
  printCollectSummary(d, record);
  if (record.settleError) { d.err(`warning: ${record.settleError}`); return 1; }
  return Object.values(record.results).some((r) => r.status === 'failed' || r.status === 'not_written' || r.status === 'written_partial') ? 1 : 0;
}

const summaryLine = (record) => {
  const rows = Object.values(record.results ?? {});
  const bad = rows.filter((r) => r.status === 'failed').length;
  return `${rows.length - bad} of ${rows.length} request(s) succeeded, ${bad} failed, actual cost ${record.actualMicro === null ? 'unknown' : usd(record.actualMicro)}`;
};

function printCollectSummary(d, record) {
  d.log(`${record.batchId} (${record.kind}): ${summaryLine(record)}`);
  for (const meta of record.requests) {
    const r = record.results[meta.custom_id];
    if (!r) continue;
    const warn = r.warnings?.length ? ` [${r.warnings.length} note(s) in the run record]` : '';
    if (r.status === 'failed') d.log(`  FAILED ${meta.custom_id}: ${r.reason}${r.detail ? ` (${r.detail})` : ''}`);
    else if (meta.kind === 'author') {
      const mc = r.machineCheck;
      const check = mc?.quarantined !== undefined ? `; the machine checks would quarantine ${mc.quarantined} ${JSON.stringify(mc.reasons)}` : '';
      d.log(`  ${r.status} ${meta.code}: ${r.cards} cards${check}${r.status === 'not_written' ? ` -> ${r.file} (${r.reason})` : ''}${warn}`);
    } else d.log(`  ${r.status} ${meta.custom_id}: ${r.verdicts} verdicts${r.missing?.length ? `, ${r.missing.length} card(s) got none (run review again)` : ''}${warn}`);
  }
  for (const [code, m] of Object.entries(record.merged ?? {})) {
    d.log(m.status === 'written'
      ? `  ${code}: ${m.total} of ${m.of} cards now have a verdict, ${m.flagged} flagged${m.stale ? `, ${m.stale} stale verdict(s) dropped (card edited since)` : ''}`
      : `  ${code}: verdicts not written (${m.reason})`);
  }
  const u = record.usage ?? {};
  d.log(`  usage: ${count(u.input_tokens ?? 0)} input, ${count(u.cache_creation_input_tokens ?? 0)} cache-write, ${count(u.cache_read_input_tokens ?? 0)} cache-read, ${count(u.output_tokens ?? 0)} output tokens`);
  d.log(`  actual cost ${record.actualMicro === null ? 'unknown' : usd(record.actualMicro)} (reserved ${usd(record.reservation.micro)}); ${record.settledAt ? 'ledger settled' : 'ledger NOT settled'}`);
  if (record.status === 'collected') {
    const subjects = [...new Set(record.requests.map((m) => m.subject))];
    d.log(record.kind === 'author'
      ? `  next: node scripts/keycards/validate.mjs --machine-only --subject=${subjects.join(',')}   then   node scripts/keycards/api-batch.mjs review --codes=${record.codes.join(',')}`
      : '  next: node scripts/keycards/review-merge.mjs   then   node scripts/keycards/validate.mjs');
  }
}

/** status <batchId>: the batch's counts and, when this checkout submitted it, its run record. */
export async function runStatus(batchId, d) {
  if (!BATCH_ID.test(String(batchId ?? ''))) throw new UsageError(`"${batchId}" is not a batch id (msgbatch_...)`);
  const batch = await d.makeClient().messages.batches.retrieve(batchId);
  const c = batch.request_counts ?? {};
  d.log(`${batch.id}: ${batch.processing_status}`);
  d.log(`  processing ${c.processing ?? 0}, succeeded ${c.succeeded ?? 0}, errored ${c.errored ?? 0}, expired ${c.expired ?? 0}, canceled ${c.canceled ?? 0}`);
  d.log(`  created ${batch.created_at}${batch.ended_at ? `, ended ${batch.ended_at}` : `, expires ${batch.expires_at}`}`);
  const file = recordFile(batchId);
  if (existsSync(file)) {
    const rec = readJSON(file);
    d.log(`  run record: ${rec.kind} of ${rec.codes.join(', ')}; ${rec.status}${rec.actualMicro !== null && rec.actualMicro !== undefined ? `, actual cost ${usd(rec.actualMicro)}` : `, reserved ${usd(rec.reservation?.micro ?? 0)}`}`);
  }
  return 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------------------------------------------

export const USAGE = `Usage:
  node scripts/keycards/api-batch.mjs author  (--books=leph1,lech2 | --codes=leph101,leph102) [--dry-run] [--force]
  node scripts/keycards/api-batch.mjs review  (--books=...          | --codes=...)            [--dry-run] [--force] [--chunk=${REVIEW_CHUNK}]
  node scripts/keycards/api-batch.mjs collect <batchId>
  node scripts/keycards/api-batch.mjs status  <batchId>`;

const list = (v) => String(v).split(',').map((s) => s.trim()).filter(Boolean);

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command, books: [], codes: [], dryRun: false, force: false, chunk: null, batchId: null };
  if (!['author', 'review', 'collect', 'status'].includes(command)) throw new UsageError(command ? `unknown command "${command}"` : 'no command given');
  const submit = command === 'author' || command === 'review';
  for (const a of rest) {
    if (submit && a === '--dry-run') args.dryRun = true;
    else if (submit && a === '--force') args.force = true;
    else if (submit && a.startsWith('--books=')) args.books.push(...list(a.slice(8)));
    else if (submit && a.startsWith('--codes=')) args.codes.push(...list(a.slice(8)));
    else if (command === 'review' && a.startsWith('--chunk=')) {
      const n = Number(a.slice(8));
      if (!Number.isInteger(n) || n < 5 || n > 200) throw new UsageError('--chunk takes a whole number from 5 to 200');
      args.chunk = n;
    } else if (a.startsWith('--')) throw new UsageError(`unknown option ${a} for ${command}`);
    else if (!submit && !args.batchId) args.batchId = a;
    else throw new UsageError(`unexpected argument "${a}"`);
  }
  if (!submit && !args.batchId) throw new UsageError(`${command} needs a batch id`);
  return args;
}

/** Runs one command line; returns the exit code (0 ok, 1 failure, 2 the budget guard said no). */
export async function main(argv, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  try {
    const args = parseArgs(argv);
    if (args.command === 'collect') return await runCollect(args.batchId, args, d);
    if (args.command === 'status') return await runStatus(args.batchId, d);
    return await runSubmit(args.command, args, d);
  } catch (e) {
    if (e instanceof UsageError) { d.err(`error: ${e.message}\n${USAGE}`); return 1; }
    if (e instanceof BudgetStop) { d.err(`stopped: ${e.message}`); return 2; }
    d.err(`error: ${e?.message ?? e}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
