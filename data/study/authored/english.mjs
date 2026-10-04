// English: vocabulary facts come verbatim from WordNet 3.0 (licence retained); contrasts, prompts
// and reading passages are original MockMob practice text. Task types follow the CUET UG 2026
// English syllabus: factual/narrative/literary passages, choosing the correct word, synonyms and antonyms.
import { readFileSync } from 'node:fs';
import { unitBase, makeCard, choice } from './helpers.mjs';
import { synset, antonyms } from '../../../scripts/learning/lib/wordnet.mjs';

const license = readFileSync('data/study/sources/WORDNET-LICENSE.txt', 'utf8');
const WORDNET = { id: 'wordnet-3.0', url: 'https://wordnet.princeton.edu/', label: 'WordNet 3.0', permission: 'WordNet license', license };
const SYLLABUS = { id: 'cuet-2026-english-syllabus', url: 'https://cuet.nta.nic.in/', label: 'CUET (UG) 2026 syllabus, English 101 (NTA)', permission: 'reference only; topic list used to choose task types' };
const ORIGINAL = { id: 'mockmob-original-passages', url: 'https://www.mockmob.in/learn', label: 'MockMob original practice passages', permission: 'original MockMob text written for practice; not an exam passage' };

// word: [offset, example index (must contain the word or a listed spelling), relation for the third task]
const SETS = [
  { n: 1, title: 'Clear or unclear: words about expression', theme: 'expression', words: { lucid: ['00429355', 1, 'antonym:unclear'], concise: ['00546646', 0, 'antonym:prolix'], coherent: ['00464513', 0, 'synonym:logical'], ambiguous: ['00102201', 1, 'antonym:unambiguous'], obscure: ['00431004', 0, 'synonym:vague'] },
    contrast: 'Lucid, concise and coherent all praise clear expression, but each praises something different: lucid is about being easy to understand, concise is about saying much in few words, and coherent is about parts that fit together logically. Ambiguous and obscure name two different problems: an ambiguous sentence has more than one possible meaning; an obscure one is not clearly understood or expressed at all.' },
  { n: 2, title: 'How people respond: words about attitude', theme: 'attitude', words: { candid: ['00764484', 2, 'synonym:frank'], sceptical: ['02463847', 0, 'synonym:doubting', ['skeptical']], gullible: ['00163315', 0, 'antonym:wary'], reluctant: ['00811969', 1, 'antonym:eager'], benevolent: ['02661446', 0, null] },
    contrast: 'Sceptical and gullible sit at opposite ends: a sceptical listener doubts a claim, while a gullible one is easily tricked because of being too trusting. Candid describes how directly someone speaks. Reluctant (not eager) describes willingness, and benevolent (intending or showing kindness) describes intention.' },
  { n: 3, title: 'Fair or unfair: words about judgement', theme: 'judgement', words: { impartial: ['01723308', 0, 'antonym:partial'], biased: ['01723091', 0, 'synonym:one-sided'], arbitrary: ['00718924', 0, null], rational: ['01925372', 2, 'antonym:irrational'], prudent: ['01898129', 0, 'antonym:imprudent'] },
    contrast: 'Impartial and biased are opposites: one shows no favouritism, the other favours one side. Arbitrary, rational and prudent describe how a decision is reached: on individual preference or impulse (arbitrary), on reason (rational), or with careful, sensible judgement (prudent).' },
  { n: 4, title: 'Effort and energy: words about how people work', theme: 'effort', words: { diligent: ['00754107', 0, 'antonym:negligent'], meticulous: ['00984879', 0, null], tenacious: ['02327569', 3, 'synonym:persistent'], lethargic: ['00875712', 0, 'antonym:energetic'], resilient: ['02280566', null, null] },
    contrast: 'Diligent and meticulous both involve care: diligent stresses perseverance in carrying out tasks, meticulous stresses extreme care with details. Tenacious adds stubbornness. Resilient is about recovering after setbacks, and lethargic — lacking alertness or activity — is the opposite of energetic.' },
  { n: 5, title: 'How much and how important: words about amount', theme: 'amount', words: { abundant: ['00013887', 0, 'antonym:scarce'], scarce: ['00016756', 0, 'antonym:abundant'], substantial: ['00625055', 0, 'synonym:significant'], trivial: ['02165432', 1, 'antonym:important'], frugal: ['02421364', 2, 'synonym:economical'] },
    contrast: 'Abundant and scarce are opposites in quantity. Substantial (fairly large) and trivial (of little substance or significance) are about size and importance. Frugal is about avoiding waste — it describes how resources are used, not how many there are.' },
  { n: 6, title: 'Lasting or passing: words about time', theme: 'time', words: { transient: ['01756292', 2, 'synonym:ephemeral'], durable: ['01439496', 0, 'synonym:lasting'], perpetual: ['00595299', 4, 'synonym:constant'], obsolete: ['00669021', 0, 'antonym:current'], inevitable: ['00343015', 0, 'antonym:avoidable'] },
    contrast: 'Transient (lasting a very short time) and durable (existing for a long time) are opposites in time, and perpetual goes further: continuing indefinitely without interruption. Obsolete looks back — no longer in use — while inevitable looks forward: incapable of being avoided.' },
];
const EXISTING = new Set(['candid', 'lucid', 'ambiguous', 'diligent', 'prudent', 'frugal', 'concise', 'obscure', 'resilient', 'meticulous', 'benevolent', 'arbitrary', 'coherent', 'inevitable', 'substantial', 'abundant', 'reluctant', 'obsolete', 'impartial', 'sceptical']);
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);
const wordRegex = forms => new RegExp(`\\b(${forms.join('|')})\\b`, 'i');

export const facts = [];
const entries = SETS.flatMap(set => Object.entries(set.words).map(([word, [offset, exampleIndex, relation, spellings = []]]) => {
  const s = synset(offset);
  if (!s.words.includes(word)) throw new Error(`Sense does not contain ${word}`);
  const example = exampleIndex === null ? null : s.examples[exampleIndex];
  const forms = [word, ...spellings];
  if (example !== null && !wordRegex(forms).test(example)) throw new Error(`Example for ${word} does not contain it`);
  let rel = null;
  if (relation) {
    const [kind, target] = relation.split(':');
    const pool = kind === 'synonym' ? s.words : antonyms(s);
    if (!pool.includes(target)) throw new Error(`${target} is not a WordNet ${kind} of ${word}`);
    rel = { kind, target };
  }
  facts.push({ word, offset, line: s.line });
  return { set: set.n, word, offset, definition: s.definition, example, forms, spellings, relation: rel, synonyms: s.words.filter(w => !forms.includes(w)), opposites: antonyms(s) };
}));
const bySet = n => entries.filter(e => e.set === n);
// Deterministic distractors: same-set meanings test near distinctions; other-set words for relations.
const rotate = (list, k) => list.slice(k).concat(list.slice(0, k));
function meaningVariant(e) {
  const others = rotate(bySet(e.set).filter(x => x.word !== e.word), e.word.length % 4).slice(0, 3);
  const options = rotate([e, ...others], e.word.charCodeAt(0) % 4);
  return { type: 'choice', context: e.example || undefined, prompt: `${e.example ? "In this sentence, what" : "What"} does “${e.word}”${e.spellings.length ? ` (also spelled ${e.spellings.join(", ")})` : ""} mean?`, options: options.map(o => o.definition), answer: options.indexOf(e),
    optionNotes: options.map(o => o === e ? null : `That is the meaning of “${o.word}”.`), explanation: `${e.word}: ${e.definition}.`, word: e.word, task: 'meaning' };
}
function gapVariant(e) {
  if (!e.example) return { type: 'text', prompt: `Which word means: ${e.definition}?`, inputHint: 'Type the word', answer: e.word, accept: e.spellings, explanation: `${e.word}: ${e.definition}.`, word: e.word, task: 'spelling' };
  return { type: 'text', context: e.example.replace(wordRegex(e.forms), '_____'), prompt: 'Type the missing word.', hint: `It means: ${e.definition}`, inputHint: 'Type the word', answer: e.word, accept: e.spellings,
    explanation: `“${e.example}” — ${e.word}: ${e.definition}.`, word: e.word, task: 'gap_fill' };
}
function relationVariant(e) {
  if (!e.relation) return null;
  const banned = new Set([...e.forms, ...e.synonyms, ...e.opposites, e.relation.target]);
  const pool = entries.filter(x => x.set !== e.set && !banned.has(x.word) && !x.synonyms.includes(e.word) && !x.opposites.includes(e.word));
  const others = rotate(pool, (e.word.length * 7) % pool.length).slice(0, 3).map(x => x.word);
  const options = rotate([e.relation.target, ...others], e.word.length % 4);
  const label = e.relation.kind === 'synonym' ? 'closest in meaning to' : 'opposite in meaning to';
  return { type: 'choice', prompt: `Which word is ${label} “${e.word}”?`, options, answer: options.indexOf(e.relation.target),
    optionNotes: options.map(o => o === e.relation.target ? null : `“${o}” means: ${entries.find(x => x.word === o).definition}.`),
    explanation: `${capital(e.relation.target)} is a WordNet ${e.relation.kind === 'synonym' ? 'synonym' : 'antonym'} of ${e.word} in this sense (${e.definition}).`, word: e.word, task: e.relation.kind };
}

const vocabUnits = [], vocabCards = [];
for (const set of SETS) {
  const words = bySet(set.n);
  const unit = unitBase({ subject: 'english', chapter: 'Vocabulary', conceptId: 'vocabulary_context', id: `english-vocabulary-0${set.n}`, version: set.n === 1 ? 2 : 1, order: set.n,
    title: set.title, minutes: 5, skill: 'Vocabulary',
    summary: words.map(w => w.word).join(' · '),
    objectives: ['Recognise each word’s meaning in a sentence', 'Tell apart the words that are easy to confuse', 'Spell each word and know a synonym or opposite'],
    examLink: 'CUET English lists “Choosing the correct word” and “Synonyms and Antonyms” under Verbal Ability.', sourceRefs: [WORDNET, SYLLABUS] });
  unit.blocks = [
    { id: `vocab${set.n}-words`, type: 'reading', kind: 'word_set', title: 'Meet the words',
      words: words.map(w => ({ word: w.word, meaning: w.definition, example: w.example, synonym: w.relation?.kind === 'synonym' ? w.relation.target : w.synonyms[0] || null, opposite: w.relation?.kind === 'antonym' ? w.relation.target : w.opposites[0] || null, spellings: w.spellings })),
      note: 'Meanings and example phrases are quoted from WordNet 3.0. Each word is taught in one selected sense; context can call for another.' },
    { id: `vocab${set.n}-contrast`, type: 'reading', kind: 'contrast', title: 'Don’t mix them up', body: set.contrast },
    { id: `vocab${set.n}-check-1`, ...meaningVariant(words[0]), kind: 'knowledge_check', title: 'Try it' },
    { id: `vocab${set.n}-check-2`, ...meaningVariant(words[3]), kind: 'knowledge_check', title: 'One more' },
  ];
  vocabUnits.push(unit);
  for (const e of words) {
    const variants = [meaningVariant(e), gapVariant(e), relationVariant(e)].filter(Boolean);
    vocabCards.push(makeCard(unit, { id: `english-word-${e.word}`, version: EXISTING.has(e.word) ? 2 : 1, objective: 'Recall the word’s meaning, spelling and a related word', title: e.word, word: e.word, cue: `Make your own sentence with “${e.word}”.`, sourceFact: e.offset, variants }));
  }
}

// ---------- Reading: main idea ----------
const passage = (sentences) => sentences.join(' ');
const mainUnit = unitBase({ subject: 'english', chapter: 'Factual Passage', conceptId: 'main_idea', id: 'english-main-idea', version: 1, order: 10, title: 'Main idea and supporting detail', minutes: 6, skill: 'Reading',
  summary: 'Find the point the whole passage makes, and spot the three usual wrong options.',
  objectives: ['State the main idea of a short factual passage', 'Separate supporting details from the main idea', 'Recognise too-narrow, too-broad and not-stated options'],
  examLink: 'CUET English passages are factual, narrative or literary (up to 300 words) and almost always include a main-idea or title question.', sourceRefs: [ORIGINAL, SYLLABUS] });
const TREES = ['Many cities are planting trees along roads to fight summer heat.', 'Shade stops pavements and walls from absorbing as much sunlight during the day.', 'Leaves also release water vapour, which cools the air around them.', 'Residents of tree-lined streets often say their afternoons feel cooler.', 'Planners warn, however, that young trees need regular watering for their first few years if they are to survive.'];
const mainQuestion = (sentences, options, answer, checks, why) => ({ type: 'choice', context: passage(sentences), prompt: 'Which option best states the main idea of the passage?', options, answer, optionChecks: checks,
  optionNotes: checks.map(c => c.type === 'main' ? null : c.type === 'detail' ? 'True, but it is one supporting detail — too narrow.' : c.type === 'broad' ? 'Wider than anything the passage discusses — too broad.' : 'The passage never says this — not stated.'), explanation: why, task: 'main_idea' });
mainUnit.blocks = [
  { id: 'main-what', type: 'reading', kind: 'explanation', title: 'What a main idea is',
    body: 'The main idea is the point the whole passage makes. Details — examples, reasons, figures — exist to support it. A quick test: if most sentences can be read as evidence for an option, that option is the main idea.' },
  { id: 'main-worked', type: 'reading', kind: 'worked_example', title: 'See it on a short passage',
    passage: { label: 'Practice passage (written by MockMob)', sentences: TREES, highlight: { 0: 'Main claim', 1: 'Support', 2: 'Support', 3: 'Support', 4: 'Limit' } },
    body: 'Sentence 1 makes the claim; sentences 2–4 explain or illustrate it; sentence 5 adds a limit. A good main-idea option covers both the claim and the limit: street trees can cool a city, but they need care to survive.' },
  { id: 'main-traps', type: 'reading', kind: 'mistake', title: 'Three wrong options you will meet',
    rows: [['Trap', 'What it looks like', 'Why it is wrong'], ['Too narrow', 'One true detail, such as “Leaves release water vapour.”', 'It supports the main idea but is not the whole point'], ['Too broad', '“Cities face many environmental problems.”', 'The passage discusses only one'], ['Not stated', '“Trees are the cheapest way to cool a city.”', 'Cost is never mentioned']] },
  { id: 'main-check', ...mainQuestion(TREES, ['Street trees can make cities cooler, but young trees need care to survive.', 'Leaves release water vapour.', 'Cities face many environmental problems.', 'Trees are the cheapest way to cool a city.'], 0,
    [{ type: 'main' }, { type: 'detail', evidence: 'Leaves also release water vapour' }, { type: 'broad' }, { type: 'unsupported', absent: ['cheap', 'cost', 'price'] }], 'It covers the claim (sentence 1), the support (2–4) and the limit (5). This is an unscored learning check.'), kind: 'knowledge_check', title: 'Try it' },
];
const LIBRARY = ['Public libraries in several towns now lend more than books.', 'Some lend laptops to students who have no computer at home.', 'Others run evening classes in spoken English and basic accounts.', 'Librarians say the busiest hours are now after school ends.'];
const BUS = ['Electric buses are slowly replacing diesel buses on some city routes.', 'They produce no exhaust on the street, so the air near busy stops is cleaner.', 'They are also quieter, which drivers and passengers notice at once.', 'Their batteries, however, take hours to charge, so depots need careful timetables.'];
const NOTES = ['Handwritten notes can help students remember a lecture.', 'Writing by hand is slower than typing, so students must choose what matters.', 'That choice forces them to process the idea instead of copying every word.', 'Typed notes are often longer but less carefully selected.'];
const mainCards = [
  makeCard(mainUnit, { id: 'english-main-idea-find', objective: 'Choose the main idea of a short passage', title: 'Find the main idea', cue: 'Most sentences should support it.', variants: [
    mainQuestion(LIBRARY, ['Public libraries are offering new services beyond lending books.', 'Some libraries lend laptops to students.', 'Education in India is changing in many ways.', 'Libraries will soon stop lending books.'], 0, [{ type: 'main' }, { type: 'detail', evidence: 'Some lend laptops to students' }, { type: 'broad' }, { type: 'unsupported', absent: ['stop', 'soon'] }], 'Every later sentence is an example of libraries doing more than lending books.'),
    mainQuestion(BUS, ['Electric buses bring cleaner, quieter streets, though charging needs planning.', 'Electric buses are quieter.', 'Transport is changing around the world.', 'Electric buses are cheaper to buy than diesel buses.'], 0, [{ type: 'main' }, { type: 'detail', evidence: 'They are also quieter' }, { type: 'broad' }, { type: 'unsupported', absent: ['cheap', 'cost', 'price'] }], 'It includes the benefits (sentences 2–3) and the limit (sentence 4).'),
    mainQuestion(NOTES, ['Writing notes by hand can aid memory because it makes students select and process ideas.', 'Typing is faster than writing by hand.', 'Students have many ways to study.', 'Students should never type their notes.'], 0, [{ type: 'main' }, { type: 'detail', evidence: 'Writing by hand is slower than typing' }, { type: 'broad' }, { type: 'unsupported', absent: ['never', 'should'] }], 'Sentences 2–4 explain why handwritten notes help memory.'),
  ] }),
  makeCard(mainUnit, { id: 'english-main-idea-traps', objective: 'Name the trap in a wrong option', title: 'Name the trap', cue: 'Narrow, broad or not stated?', variants: [
    choice('An option repeats one example from the passage, word for word. What kind of wrong option is it usually?', ['Too narrow — a supporting detail', 'Too broad', 'Not stated in the passage', 'Always the right answer'], 0, 'A detail is true but supports the main idea rather than stating it.', { optionNotes: [null, 'Broad options go beyond the passage.', 'It is stated — that is what makes it tempting.', 'Being true is not enough; it must cover the whole passage.'] }),
    choice('An option makes a claim about cost, but the passage never mentions money. What kind of wrong option is it?', ['Not stated in the passage', 'Too narrow', 'Too broad', 'The main idea'], 0, 'If the passage gives no evidence for it, it cannot be the main idea.', { optionNotes: [null, 'Narrow options are true details from the passage.', 'Broad options generalise the topic; this adds a new claim.', 'It is not even supported.'] }),
  ] }),
  makeCard(mainUnit, { id: 'english-main-idea-test', objective: 'Recall the main-idea test', title: 'The main-idea test', cue: 'Claim + support + any limit.', variants: [
    { type: 'reveal', prompt: 'How do you test whether an option is the main idea?', answer: 'Most sentences in the passage should support it, and it should be neither a single detail nor wider than the passage.', explanation: 'Then check the option does not add anything the passage never says.' },
  ] }),
];

// ---------- Reading: stated, inferred, not supported ----------
const infUnit = unitBase({ subject: 'english', chapter: 'Narrative Passage', conceptId: 'explicit_inference', id: 'english-explicit-inference', version: 1, order: 20, title: 'Stated, inferred or not supported', minutes: 6, skill: 'Reading',
  summary: 'Decide whether a statement is said in the passage, follows from it, or only sounds plausible.',
  objectives: ['Tell an explicit statement from an inference', 'Back every inference with words from the passage', 'Reject statements that rely on outside knowledge or guesswork'],
  examLink: 'CUET reading questions often ask which statement is true, can be inferred, or is not supported by the passage.', sourceRefs: [ORIGINAL, SYLLABUS] });
const LABELS = ['Stated in the passage', 'Can be inferred', 'Not supported'];
const classify = (sentences, statement, kind, evidence, why) => ({ type: 'choice', context: passage(sentences), prompt: `“${statement}” — which is it?`, options: LABELS, answer: LABELS.indexOf(kind), evidence, statement,
  optionNotes: LABELS.map(l => l === kind ? null : l === LABELS[0] ? 'The passage never says this in so many words.' : l === LABELS[1] ? (kind === LABELS[0] ? 'You do not need to infer it; it is said directly.' : 'Nothing in the passage forces this conclusion.') : 'The passage gives evidence for it.'), explanation: why, task: 'inference' });
const MEERA = ['Meera reached the bus stop at 7:40 and kept checking her watch.', 'The 7:30 bus had already gone.', 'She took out her notes and began reading them under her breath.', 'When the next bus arrived, she was the first to climb in.'];
infUnit.blocks = [
  { id: 'inf-what', type: 'reading', kind: 'contrast', title: 'Three kinds of statement',
    rows: [['Kind', 'Test', 'Example from the passage below'], ['Stated', 'The passage says it directly', 'She began reading her notes.'], ['Can be inferred', 'It must be true because of what the passage says', 'She missed the 7:30 bus (she arrived at 7:40; it had gone).'], ['Not supported', 'It might be true, but nothing in the passage proves it', 'She was going to an exam.']] },
  { id: 'inf-worked', type: 'reading', kind: 'worked_example', title: 'Read it closely',
    passage: { label: 'Practice passage (written by MockMob)', sentences: MEERA, highlight: { 0: 'Arrives 7:40', 1: 'Bus already gone', 2: 'Reads notes' } },
    body: 'She kept checking her watch, so we can infer she was concerned about time. The notes might suggest a test, but the passage never says where she is going. That is the trap: plausible is not the same as supported.' },
  { id: 'inf-mistake', type: 'reading', kind: 'mistake', title: 'Watch for strong words and outside knowledge',
    body: 'Options with “always”, “never”, “only” or “all” usually claim more than a passage supports. And an inference must come from the passage itself, not from what you happen to know about the world.' },
  { id: 'inf-check', ...classify(MEERA, 'Meera missed the 7:30 bus.', LABELS[1], ['reached the bus stop at 7:40', 'The 7:30 bus had already gone'], 'Arriving at 7:40 after the 7:30 bus had gone means she missed it, though the passage never says “missed”. This is an unscored learning check.'), kind: 'knowledge_check', title: 'Try it' },
];
const RAVI = ['Ravi’s grandmother kept every letter she had ever received in a tin box.', 'On rainy afternoons she took the box down and read a few aloud.', 'Ravi noticed that she always smiled at the ones written in blue ink.', 'He never asked who had written them.'];
const SHOP = ['The shop opened at nine, but by half past eight a queue had formed outside.', 'A notice in the window announced half-price school bags for the first fifty customers.', 'The owner unlocked the door five minutes early.'];
const infCards = [
  makeCard(infUnit, { id: 'english-inference-classify', objective: 'Classify a statement against a passage', title: 'Stated, inferred or not supported', cue: 'Point to the words that prove it.', variants: [
    classify(RAVI, 'The grandmother read some letters aloud on rainy afternoons.', LABELS[0], ['On rainy afternoons she took the box down and read a few aloud'], 'The passage says this directly.'),
    classify(RAVI, 'The letters in blue ink were written by Ravi’s grandfather.', LABELS[2], [], 'It may sound likely, but the passage never says who wrote them.'),
    classify(SHOP, 'People were waiting before the shop opened.', LABELS[1], ['The shop opened at nine', 'by half past eight a queue had formed outside'], 'The shop opened at nine and a queue had formed by half past eight, so people were waiting before it opened — though the passage never says it in those words.'),
    classify(SHOP, 'All fifty bags were sold within ten minutes.', LABELS[2], [], 'Nothing in the passage tells us how fast the bags sold.'),
  ] }),
  makeCard(infUnit, { id: 'english-inference-strong-words', objective: 'Spot over-strong options', title: 'Strong words', cue: 'Always, never, only, all: check twice.', variants: [
    choice('An option says the character “never trusted anyone”. The passage shows her doubting one stranger. What is wrong with the option?', ['It claims far more than the passage supports', 'It is stated directly', 'It is a valid inference', 'Nothing; strong words are usually right'], 0, 'One doubtful moment does not support “never trusted anyone”.', { optionNotes: [null, 'The passage does not say this.', 'An inference must be forced by the text; this goes beyond it.', 'Strong words usually make an option harder to support.'] }),
  ] }),
  makeCard(infUnit, { id: 'english-inference-rule', objective: 'Recall what makes an inference valid', title: 'What makes an inference valid', cue: 'From the passage, not from outside knowledge.', variants: [
    { type: 'reveal', prompt: 'What makes an inference valid in a reading question?', answer: 'It must follow from the words of the passage, without needing outside knowledge or guesswork.', explanation: 'If you cannot point to the sentences that force the conclusion, choose “not supported”.' },
  ] }),
];

export const english = { units: [...vocabUnits, mainUnit, infUnit], cards: [...vocabCards, ...mainCards, ...infCards], wordnetFacts: facts };
