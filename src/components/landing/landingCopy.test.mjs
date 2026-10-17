// node --test src/components/landing/landingCopy.test.mjs
// The landing's claims about the question bank and repeats must stay as true as the code behind them: the mock
// selector favours unanswered questions but promises nothing more (data/mock_question_selector.js), and Recovery
// checks fail rather than repeat when a bank runs dry. So no landing copy may say a question "never repeats".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { weakChapters } from './labStory.mjs';

const here = new URL('./', import.meta.url);
const read = (url) => readFileSync(url, 'utf8');
const PAGE = read(new URL('../../app/page.js', import.meta.url));
const LANDING = readdirSync(here)
  .filter((name) => /\.(jsx|mjs)$/.test(name) && !name.endsWith('.test.mjs'))
  .map((name) => [name, read(new URL(name, here))]);

test('no landing copy promises that questions never repeat', () => {
  for (const [name, source] of [['page.js', PAGE], ...LANDING]) {
    assert.doesNotMatch(source, /never\s+repeat/i, `${name} says "never repeat"`);
    assert.doesNotMatch(source, /no repeats|without repeats|zero repeats/i, `${name} promises no repeats`);
  }
});

test('the question bank and unlimited mocks are said at heading level, and always "with Pro"', () => {
  assert.match(PAGE, /<h2 className="lp-shelf__title"[^>]*>One question bank\. As many mocks as you want with Pro\.<\/h2>/);
  assert.match(PAGE, /Unlimited mocks with Pro, ₹\$\{OFFER\.oneTime\.rupees\} once\./, 'the pricing heading names unlimited mocks with Pro');
  assert.match(PAGE, /Unlimited mocks with Pro, ₹\$\{OFFER\.monthly\.rupees\} a month\./);
  // The hero's facts lead with the full mock it links to; the unlimited claim is said once, on the shelf's heading,
  // not again one screen above it.
  const facts = PAGE.slice(PAGE.indexOf('<nav className="lp-proof"'), PAGE.indexOf('</nav>'));
  assert.ok(facts.indexOf('Full mocks') >= 0 && facts.indexOf('Full mocks') < facts.indexOf('Two exam screens'), 'the full-mock fact comes first');
  assert.doesNotMatch(facts, /Unlimited/, 'the hero facts do not repeat the shelf heading');
  // The shelf's note is honest that an answered question can come back.
  assert.match(PAGE, /an answered one can come back/);
});

test('the bank counts are in the server HTML, read from the stored snapshot', () => {
  assert.match(PAGE, /export const revalidate = \d+;/);
  assert.match(PAGE, /<SubjectCount id=\{id\} initial=\{/);
  assert.match(PAGE, /<HeroLive initial=\{bankCounts\} \/>/);
});

test('the tour titles its chapter list as a ranked list, since it holds strengths too', () => {
  const tour = read(new URL('TourScreens.jsx', here));
  assert.match(tour, /<Frame title="Your chapters, weakest first"/);
  assert.doesNotMatch(tour, /Weak chapters across/);
  const rows = weakChapters();
  for (let i = 1; i < rows.length; i += 1) assert.ok(rows[i - 1].right / rows[i - 1].of <= rows[i].right / rows[i].of, 'weakest first');
});

test('the full-repair key and its sheet sit outside the scaled repair panel, so no window clips them', () => {
  const cinema = read(new URL('LabCinema.jsx', here));
  const panel = cinema.slice(cinema.indexOf('function RepairPanel('), cinema.indexOf('function RepairSheet('));
  assert.doesNotMatch(panel, /lcr-more|<dialog/, 'the key is not inside the panel that ScrollStory scales');
  assert.match(cinema, /<div className="lc-scene__fit"[^>]*>.*<\/div>\s*\{key === 'repair' \? <RepairSheet on=\{on\} \/> : null\}/);
});

test('the Benchmarks scene shows the real benchmark levels and a question count the app offers', async () => {
  const { RIVAL_PROFILES } = await import('../../services/ai-rival/rivalProfiles.js');
  const { BENCH_LADDER, BENCH_COUNT, BENCH_DAILY } = await import('./benchLadder.mjs');
  const pct = (p) => `${Math.round(p.targetAccuracy * 100)}%`;
  const ladder = Object.fromEntries(BENCH_LADDER.map(([level, score]) => [level, score]));
  assert.equal(ladder['DU level'], pct(RIVAL_PROFILES.SRCC_DREAM));
  assert.equal(ladder['College level'], pct(RIVAL_PROFILES.HANSRAJ_LEVEL));
  assert.equal(ladder.Daily, pct(RIVAL_PROFILES.NORTH_CAMPUS_RIVAL));
  assert.equal(BENCH_DAILY, RIVAL_PROFILES.NORTH_CAMPUS_RIVAL);
  const arena = read(new URL('../ai/AIRivalArena.jsx', import.meta.url));
  const offered = arena.match(/\{\[([\d,\s]+)\]\.map\(\(count\)/);
  assert.ok(offered, 'the arena still lists its question counts');
  assert.ok(offered[1].split(',').map(Number).includes(BENCH_COUNT), `${BENCH_COUNT} questions is a count the arena offers`);
  const tour = read(new URL('TourScreens.jsx', here));
  assert.doesNotMatch(tour, /\b25 questions\b|'88%'|'82%'/, 'no hard-coded benchmark numbers in the scene');
});

test('no leaderboard of other students: the product shows only the student’s own standing', () => {
  // /leaderboard answers only the caller's own rank (the privacy hotfix of 17 Oct 2026), so the landing never sells a
  // board of other students: the feature is "Your standing".
  assert.doesNotMatch(PAGE, /'Leaderboard'|to the leaderboard|See the leaderboard|leaderboard points/i);
  assert.match(PAGE, /Your standing among MockMob students/);
  assert.match(PAGE, /cta: 'See your standing'/);
  for (const [name, source] of LANDING) assert.doesNotMatch(source, /leaderboard/i, `${name} names a leaderboard`);
});

test('Score Recovery delayed fresh checks are promised only while Recovery is released', async () => {
  const { recoveryCopy } = await import('./recoveryCopy.mjs');
  const soon = recoveryCopy('blocked_content');
  const text = Object.values(soon).filter((v) => typeof v === 'string').join(' ');
  assert.doesNotMatch(text, /days later|Check it holds|Open for every repair/i, 'a blocked Recovery is not sold as live');
  assert.equal(soon.soon, true);
  assert.equal(recoveryCopy('available').soon, false);
  // The page reads the copy from the real capability state, never a typed one.
  assert.match(PAGE, /recoveryCopy\(CAPABILITIES\.recovery\.state\)/);
  assert.doesNotMatch(PAGE, /days later|Check it holds/, 'page.js types no recovery promise of its own');
  const lab = read(new URL('MistakeLab.jsx', here));
  assert.doesNotMatch(lab, /each check unlocks on its day/);
});

test('the landing never says "41 subjects": counts and claims cover only the 15 public subjects', async () => {
  for (const [name, source] of [['page.js', PAGE], ...LANDING]) {
    assert.doesNotMatch(source, /(^|[^\d])41\s+(CUET\s+)?subjects/i, `${name} says 41 subjects`);
  }
  const { SAMPLE_SUBJECTS } = await import('./sampleSubjects.mjs');
  assert.equal(SAMPLE_SUBJECTS.length, 15);
});

test('the benchmark run is a whole number of right answers, and its clock follows from the numbers', async () => {
  const { BENCH_YOU, BENCH_COUNT, BENCH_RIGHT, BENCH_PACE, BENCH_DAILY, BENCH_USED, BENCH_ALLOWED } = await import('./benchLadder.mjs');
  assert.ok(Number.isInteger((BENCH_YOU * BENCH_COUNT) / 100), `${BENCH_YOU}% of ${BENCH_COUNT} is a whole number of answers`);
  assert.equal((BENCH_RIGHT * 100) / BENCH_COUNT, BENCH_YOU);
  const sec = (mmss) => mmss.split(':').reduce((m, s) => Number(m) * 60 + Number(s));
  assert.equal(sec(BENCH_USED), BENCH_COUNT * BENCH_PACE);
  // The clock is the time the app gives: createAIRivalBattle's default, whole minutes at the profile's pace plus two.
  const battle = read(new URL('../../services/ai-rival/createAIRivalBattle.js', import.meta.url));
  assert.match(battle, /Math\.max\(5, Math\.round\(\(count \* profile\.avgTimePerQuestion\) \/ 60\) \+ 2\)/, 'the app still sets the benchmark clock this way');
  assert.equal(sec(BENCH_ALLOWED), Math.max(5, Math.round((BENCH_COUNT * BENCH_DAILY.avgTimePerQuestion) / 60) + 2) * 60);
  assert.equal(BENCH_ALLOWED, '20:00');
  assert.ok(sec(BENCH_USED) <= sec(BENCH_ALLOWED), 'the run fits inside the time it had');
  const tour = read(new URL('TourScreens.jsx', here));
  assert.doesNotMatch(tour, /<b>52s<\/b>|useCountdown\(play, 4 \* 60/, 'no hard-coded pace or countdown');
});

// ---------- Round 12 truth checks: every claim on the page is true today, and gated claims switch with their gate ----------

test('college and DU benchmarks are sold only once paid AI opens; until then they are marked as opening soon', async () => {
  const { aiCommerceReleased } = await import('../../../data/capabilities.js');
  const { benchCopy, benchLadder, BENCH_LADDER } = await import('./benchLadder.mjs');
  const closed = benchCopy(false);
  assert.doesNotMatch(`${closed.body} ${closed.levels}`, /at daily, college or DU level|college and DU levels are Pro/i);
  assert.match(closed.levels, /college and DU levels open soon/);
  assert.doesNotMatch(closed.body, /college|DU level/i, 'the body names no level it cannot run');
  assert.match(PAGE, /points: \[BENCH\.levels, [^\]]*\], chip: BENCH\.levels,/);
  const rows = Object.fromEntries(benchLadder(false).map(([level, , mark]) => [level, mark]));
  assert.equal(rows['DU level'], 'soon');
  assert.equal(rows['College level'], 'soon');
  assert.ok(benchLadder(true).every(([, , mark]) => mark !== 'soon'), 'open, no level is marked soon');
  assert.doesNotMatch(benchCopy(true).body, /open soon/);
  // The page and the scene read the real gate, so the copy switches by itself.
  assert.deepEqual(BENCH_LADDER, benchLadder(aiCommerceReleased()));
  assert.match(PAGE, /const BENCH = benchCopy\(\);/);
  assert.match(PAGE, /body: BENCH\.body,/);
  assert.doesNotMatch(PAGE, /at daily, college or DU level/);
  const tour = read(new URL('TourScreens.jsx', here));
  assert.match(tour, /mark === 'soon' \? <small>Opens soon<\/small>/);
  // createAIRivalBattle refuses charged benchmarks while paid AI is closed: the two levels are charged.
  const { RIVAL_PROFILES } = await import('../../services/ai-rival/rivalProfiles.js');
  assert.ok(RIVAL_PROFILES.HANSRAJ_LEVEL.creditCost > 0 && RIVAL_PROFILES.SRCC_DREAM.creditCost > 0);
  assert.equal(RIVAL_PROFILES.NORTH_CAMPUS_RIVAL.creditCost, 0);
});

test('repairs are written from the answer key, never called "official", and their cost is the product’s', async () => {
  for (const [name, source] of [['page.js', PAGE], ...LANDING]) assert.doesNotMatch(source, /official key/i, `${name} says "official key"`);
  const { REPAIR_COST } = await import('./labStory.mjs');
  const { REPAIR_CREDIT_COST } = await import('../../../data/mistake_repair.js');
  assert.equal(REPAIR_COST.credits, REPAIR_CREDIT_COST);
  const wallet = read(new URL('../../services/credits/aiCreditWallet.js', import.meta.url));
  assert.match(wallet, new RegExp(`AI_FREE_MONTHLY_CREDITS = ${REPAIR_COST.freeMonthly};`));
  assert.match(wallet, new RegExp(`AI_PRO_INCLUDED_MONTHLY_CREDITS = ${REPAIR_COST.proMonthly};`));
  const cinema = read(new URL('LabCinema.jsx', here));
  assert.match(cinema, /A repair uses \$\{REPAIR_COST\.credits\} AI credit; Free has \$\{REPAIR_COST\.freeMonthly\} a month\./);
  assert.match(PAGE, /A repair uses \$\{REPAIR_COST\.credits\} AI credit/);
});

test('the Score Recovery Lab is named only once Recovery is released; until then it is the Mistake Lab across mocks', async () => {
  const { recoveryCopy } = await import('./recoveryCopy.mjs');
  const soon = recoveryCopy('blocked_content');
  const text = Object.values(soon).filter((v) => typeof v === 'string').join(' ');
  assert.doesNotMatch(text, /Score Recovery Lab/);
  assert.equal(soon.mini, 'Across your mocks');
  assert.match(soon.sub, /^After every mock, the Mistake Lab also follows a leak across your mocks/);
  assert.equal(recoveryCopy('available').mini, 'Score Recovery Lab');
  assert.match(PAGE, /mini=\{RECOVERY\.mini\}/);
  assert.doesNotMatch(PAGE, /mini="Score Recovery Lab"/);
  // No promise of five fresh questions: the app offers them only where the bank holds five unseen ones.
  assert.doesNotMatch(text, /five fresh questions/i);
  assert.match(soon.statement, /Then practise the chapter that cost you/);
});

test('the PYQ page is linked as a guide, not as a question set the site does not hold', () => {
  const nav = read(new URL('../NavBar.jsx', import.meta.url));
  const footer = read(new URL('../MarketingFooter.jsx', import.meta.url));
  assert.match(nav, /label: 'PYQ guide', href: '\/cuet-previous-year-questions'/);
  assert.match(footer, /\['How to use CUET PYQs', '\/cuet-previous-year-questions'\]/);
  assert.doesNotMatch(nav, /label: 'CUET PYQs'/);
  assert.doesNotMatch(footer, /'Previous year questions'/);
});

test('the exam preview counts against one paper: question n of 50, a 60:00 clock, a 50-cell palette', () => {
  const exam = read(new URL('ExamComparator.jsx', here));
  assert.match(exam, /const PAPER = 50;/);
  assert.match(exam, /useState\(3600\)/);
  assert.match(exam, /<span>of \{PAPER\}<\/span>/);
  assert.match(exam, /Array\.from\(\{ length: PAPER \}/);
  assert.doesNotMatch(exam, /of 5<|\/5 answered/);
});

test('no first-visit theme hint covers the landing headline', () => {
  const nav = read(new URL('../NavBar.jsx', import.meta.url));
  assert.match(nav, /<ThemeToggle hint=\{!onLanding\} \/>/);
});

test('the owner’s hero and heading asks hold: CUET 2027 in the brand colour, MockMob green in the docked band, commerce first', () => {
  // L-017: "CUET 2027" is coloured, as a name in the lead (not a kicker above the headline, not a button).
  assert.match(PAGE, /all the way to <b className="lp-lead__exam">CUET 2027<\/b>, commerce papers first\.<\/p>/);
  const hero = read(new URL('../../app/hero-v3.css', import.meta.url));
  assert.match(hero, /\.lp-lead__exam \{ font-weight: 600; color: var\(--accent-text\); \}/);
  assert.doesNotMatch(PAGE, /<(a|button|Link)[^>]*>\s*CUET 2027/, 'CUET 2027 is not a control');
  // L-030: the tour heading's docked short form carries MockMob in green; the full h2 stays one ink.
  assert.match(PAGE, /mini=\{<>What’s inside <em>MockMob<\/em><\/>\}/);
  assert.match(PAGE, /title="What’s inside MockMob\."/);
  // L-023: commerce first, said in the lineup's own note rather than as stray subtext.
  assert.match(PAGE, /<p className="lp-shelf__note"><b>Commerce papers first\.<\/b>/);
  assert.doesNotMatch(PAGE, /Built first for commerce/i);
});

test('no defensive fine print in the landing or its footer (owner, L-024)', () => {
  const footer = read(new URL('../MarketingFooter.jsx', import.meta.url));
  for (const [name, source] of [['page.js', PAGE], ['MarketingFooter.jsx', footer], ...LANDING]) {
    assert.doesNotMatch(source.replace(/\/\/.*$|\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/gm, ''), /not affiliated|illustrative|not a prediction|example only|just a diagnostic/i, `${name} carries defensive fine print`);
  }
});

// ---------- Round 14 truth checks: the sample saves no answers, the dock is one key, the Free list names what its credits do ----------

// Source without its comments: the words a visitor can read, not the notes about them.
const words = (source) => source.replace(/\/\/.*$|\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/gm, '');

function sourcesBelow(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) sourcesBelow(path, found);
    else if (/\.(jsx?|mjs)$/.test(entry.name) && !/\.test\.mjs$/.test(entry.name)) found.push([path.pathname, read(path)]);
  }
  return found;
}

test('no landing copy says the sample’s answers are saved: nothing outside the route calls /api/me/sample-import', async () => {
  // The route exists, but no page, component or service posts the sample to it, and the sample record keeps no answers.
  const src = new URL('../../', import.meta.url);
  const callers = sourcesBelow(src).filter(([path, source]) => !path.includes('/app/api/me/sample-import/') && /sample-import/.test(source)).map(([path]) => path);
  assert.deepEqual(callers, [], 'a caller of sample-import now exists: the landing may then say what it keeps, and this test should say so');
  const { nextRecord } = await import('./sampleRecord.mjs');
  const record = nextRecord(null, { answered: 5, done: true, subject: 'english', at: '2026-10-17T00:00:00Z', focus: 'Partnership', picks: ['A', 'B'], answers: [1, 2] });
  assert.deepEqual(Object.keys(record).sort(), ['answered', 'at', 'done', 'focus', 'subject'], 'the record holds a count, a subject and a chapter, never the answers');
  const footer = read(new URL('../MarketingFooter.jsx', here));
  for (const [name, source] of [['page.js', PAGE], ['MarketingFooter.jsx', footer], ...LANDING]) {
    assert.doesNotMatch(words(source), /save your answers|keep these answers|keeps? your answers|answers (are|stay) (saved|kept)/i, `${name} promises saved answers`);
    assert.doesNotMatch(words(source), /Start free and see your next move/, `${name} has a key promising saved answers`);
  }
});

test('the close and the hero keys say only what a finished sample really gives', () => {
  const close = read(new URL('CloseActions.jsx', here));
  assert.match(close, /name: `\$\{COUNT_WORDS\[n\] \|\| n\} \$\{n === 1 \? 'question' : 'questions'\} done\.`/, 'the heading counts what was answered');
  assert.doesNotMatch(close, /name: 'Five questions/);
  assert.match(close, /rest: 'Your next move is one sign-up away\.'/);
  assert.match(close, /sub: 'Start free and your first mock builds the record your next move comes from\.'/);
  assert.match(close, /kind === 'member' \? homeText : 'Start free'/);
  // After a reload the sample's card starts at the subject picker, so the hero's key must not name a card that is gone.
  const keys = read(new URL('HeroKeys.jsx', here));
  assert.match(keys, /sample\.done \? 'Try the sample again' : 'Try 5 questions'/);
  assert.doesNotMatch(keys, /Back to the sample|Your questions/);
});

test('the Free plan names what its AI credits are for: Mistake Repair and Ask Mobi, at the wallet’s own number', async () => {
  const { REPAIR_COST } = await import('./labStory.mjs');
  const wallet = read(new URL('../../services/credits/aiCreditWallet.js', import.meta.url));
  const freeMonthly = Number(wallet.match(/AI_FREE_MONTHLY_CREDITS = (\d+);/)[1]);
  assert.equal(REPAIR_COST.freeMonthly, freeMonthly);
  // The line is built from the same number the Repair scene and the wallet carry, so the three cannot drift apart.
  assert.match(PAGE, /`\$\{REPAIR_COST\.freeMonthly\} AI credits a month, for Mistake Repair and for Ask Mobi beyond your own record`/);
  assert.equal(`${REPAIR_COST.freeMonthly} AI credits a month, for Mistake Repair and for Ask Mobi beyond your own record`, `${freeMonthly} AI credits a month, for Mistake Repair and for Ask Mobi beyond your own record`);
  assert.doesNotMatch(PAGE, /'10 AI credits a month, for Ask Mobi/);
  // A repair is paid from that same AI wallet (reserve, execute, commit or release, as Ask Mobi replies are).
  const repair = read(new URL('../../services/recovery/mistakeRepair.js', import.meta.url));
  assert.match(repair, /same reserve -> execute -> commit \| release lifecycle as PrepOS replies/);
  const cinema = read(new URL('LabCinema.jsx', here));
  assert.match(cinema, /A repair uses \$\{REPAIR_COST\.credits\} AI credit; Free has \$\{REPAIR_COST\.freeMonthly\} a month\./);
});

test('L-024: no affiliation FAQ, no independent-platform footer line, no defensive "says little yet"', () => {
  const footer = read(new URL('../MarketingFooter.jsx', here));
  const faq = PAGE.slice(PAGE.indexOf('const faqs = ['), PAGE.indexOf('export default async function LandingPage'));
  assert.doesNotMatch(faq, /affiliated|MockMob is independent/i, 'the FAQ does not ask or answer the affiliation question');
  assert.match(faq, /question: 'What is MockMob built for\?', answer: '[^']*DU eligibility and published cutoffs sit alongside, from what NTA and DU publish\.'/);
  assert.doesNotMatch(footer, /independent CUET preparation platform|An independent/i);
  assert.equal((footer.match(/&copy;/g) || []).length, 1, 'one copyright line');
  assert.match(footer, /&copy; \{new Date\(\)\.getFullYear\(\)\} MockMob\.\s*<\/p>/);
  for (const [name, source] of [['page.js', PAGE], ['MarketingFooter.jsx', footer], ...LANDING]) {
    assert.doesNotMatch(words(source), /says little yet/i, `${name} hedges the result`);
  }
});

test('the phone dock is one real key whose label follows state, and the hero says "chapter" once and commerce once', () => {
  const dock = read(new URL('HeroDockGate.jsx', here));
  const body = dock.slice(dock.indexOf('export function LandingDock()'), dock.indexOf('export default HeroDockGate'));
  assert.equal((body.match(/<Link /g) || []).length, 2, 'one link key per state: member, or the sign-up key');
  assert.doesNotMatch(body, /<a |Try 5 questions/, 'no second key in the dock');
  assert.match(body, /kind === 'sampled' && sample\.done \? 'Sign up' : 'Start free'/);
  assert.match(body, /const label = kind === 'member' \? 'Welcome back' : '';/);
  // L-025 / L-023: the lead no longer repeats the turning line's "chapter" and names commerce once.
  const lead = PAGE.match(/<p className="lp-lead">(.*?)<\/p>/)[1];
  assert.doesNotMatch(lead, /chapter/i);
  assert.equal((lead.match(/commerce/gi) || []).length, 1);
  assert.match(PAGE, /<TypeLine lead="Down to" phrases=\{\['the chapter\.'/);
  assert.match(lead, /<b className="lp-lead__exam">CUET 2027<\/b>/);
});

test('the sample card keeps one volt key: its forward key is quiet, the explanation line is secondary ink, the DU hint is a plain line', () => {
  const drill = read(new URL('DemoDrill.jsx', here));
  assert.match(drill, /className="mm-btn mm-btn--card" onClick=\{next\}/);
  const css = (name) => read(new URL(`../../${name}`, import.meta.url));
  const globals = css('app/globals.css');
  assert.doesNotMatch(globals.match(/\.mm-btn--card \{[^}]*\}/)[0], /var\(--volt\)/, 'the quiet key is not volt');
  assert.match(css('app/lab-cinema.css'), /\.lcp-check \{[^}]*color: var\(--s-ink-2\);/);
  const du = css('components/du/du.css');
  const empty = du.slice(du.indexOf(".du-teaser__lead[data-empty='true'] {"), du.indexOf('.du-teaser__streams {'));
  assert.match(empty, /font: 500 var\(--t-body, 1rem\)/);
  assert.match(empty, /color: var\(--ink-2\)/);
  assert.doesNotMatch(empty, /@media|var\(--t-title|var\(--font-display\)/, 'no wide-screen heading step');
});
