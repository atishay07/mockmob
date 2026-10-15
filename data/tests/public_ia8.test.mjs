// IA8 (web IA plan sections 2.4, 4.3, 4.4 and 6): pricing in plain numbers, and the public pages
// (calculator, planner, guides, subject hubs, About). Static checks over the source plus the pure
// pricing module: every number comes from data/plan_facts.mjs and publicOffer(), no caveat or retired
// product name reaches a student, public pages link only to public pages, every title keeps its
// search keywords, and nothing renders after the footer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
import { APPROVED, CAVEAT_PATTERNS, retiredHits, studentStrings } from '../glossary.mjs';
import { PLAN_FACTS } from '../plan_facts.mjs';
import { ROUTE_MOVES } from '../route_moves.mjs';
import { isSignedInPath, TODAY_HREF } from '../../src/lib/navigation.js';
import { publicRoutes } from '../../src/lib/seo.js';
import { seoPages } from '../../src/lib/seoPages.js';
import * as pricing from '../../src/components/pricing/pricingContent.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const walk = (rel, out = []) => {
  const abs = join(ROOT, rel);
  const st = statSync(abs, { throwIfNoEntry: false });
  if (!st) return out;
  if (st.isDirectory()) {
    for (const name of readdirSync(abs)) walk(`${rel}/${name}`, out);
  } else out.push(relative(ROOT, abs).split(sep).join('/'));
  return out;
};

// Every file this packet owns that a student can read.
const OWNED = [
  ...['pricing', 'features', 'coming-soon', 'about', 'cuet', 'cuet-2027', 'cuet-cutoff-calculator', 'cuet-mock-test-free', 'cuet-practice-tests-online',
    'cuet-previous-year-questions', 'cuet-subject-combination'].flatMap((dir) => walk(`src/app/${dir}`)),
  ...walk('src/components/pricing'),
  ...walk('src/components/du'),
  'src/components/billing/RazorpayPaymentButton.jsx',
  'src/components/SeoContentPage.jsx',
  'src/lib/seo.js',
  'src/lib/seoPages.js',
  'src/lib/subjectHubs.js',
].filter((file) => /\.(js|jsx|mjs)$/.test(file));

const oneTime = Object.freeze({
  monthly: Object.freeze({ planId: 'pro_monthly_99', rupees: 99, ready: false }),
  oneTime: Object.freeze({ planId: 'pro_once_test', rupees: 99, expires: '30 Jun 2027', onSale: true }),
  purchasable: 'one_time',
});
const monthly = Object.freeze({ ...oneTime, monthly: Object.freeze({ ...oneTime.monthly, ready: true }), purchasable: 'monthly' });

// ----------------------------------------------------------------------------------------------
// Pricing: plain numbers, from one place.

test('pricing numbers come from plan_facts: the free plan states the starting credits, the costs and the AI allowance', () => {
  const [free] = pricing.buildPlans(oneTime);
  const text = free.features.join(' ');
  const p = PLAN_FACTS.practiceCredits;
  assert.match(text, new RegExp(`${p.startingBalance.value} practice credits`));
  assert.match(text, new RegExp(`uses ${p.quickCost.value}`));
  assert.match(text, new RegExp(`full mock uses ${p.fullMockCost.value}`));
  assert.match(text, new RegExp(`${PLAN_FACTS.aiCredits.freeMonthly.value} AI credits every month`));
  assert.match(text, new RegExp(`One Mistake Repair uses ${PLAN_FACTS.aiCredits.repairCost.value}`));
  assert.match(text, new RegExp(`All ${PLAN_FACTS.subjects.count.value} subjects`));
});

test('the Pro plan lists what plan_facts says Pro includes, and its price comes from the offer', () => {
  for (const offer of [oneTime, monthly]) {
    const pro = pricing.buildPlans(offer).find((plan) => plan.id === 'pro');
    for (const line of PLAN_FACTS.pro.includes.value) assert.ok(pro.features.includes(line), line);
    assert.equal(pro.price, '₹99');
    assert.equal(pro.amount, 9900);
  }
  const once = pricing.buildPlans(oneTime).find((plan) => plan.id === 'pro');
  const month = pricing.buildPlans(monthly).find((plan) => plan.id === 'pro');
  assert.equal(once.cycle, 'once');
  assert.equal(once.billing, 'once');
  assert.equal(once.planId, 'pro_once_test');
  assert.equal(month.cycle, 'a month');
  assert.equal(month.billing, 'monthly');
  assert.equal(month.planId, 'pro_monthly_99');
  assert.match(once.footnote, /30 Jun 2027/);
  assert.match(once.description, /30 Jun 2027/);
});

test('the sign-in state swaps the Free button, and Today is the destination', () => {
  const guest = pricing.buildPlans(oneTime)[0];
  assert.equal(guest.ctaHref, '/signup');
  assert.equal(guest.ctaLabel, 'Start free');
  const member = pricing.buildPlans(oneTime, { signedIn: true })[0];
  assert.equal(member.ctaHref, TODAY_HREF);
  assert.equal(member.ctaLabel, 'Open MockMob');
});

test('"Monthly Pro opens soon" appears at most once while billing is one-time, and never when monthly is on', () => {
  const soon = (offer) => pricing.buildFaqs(offer).filter((faq) => /opens soon/i.test(`${faq.q} ${faq.a}`)).length;
  assert.equal(soon(oneTime), 1);
  assert.equal(soon(monthly), 0);
  const all = [pricing.pricingTitle(oneTime), pricing.pricingDescription(oneTime), JSON.stringify(pricing.pricingHeading(oneTime)), JSON.stringify(pricing.buildPlans(oneTime))].join(' ');
  assert.ok(!/opens soon/i.test(all), 'only the FAQ says it');
});

test('heading, title and description follow the offer and keep "Pricing"', () => {
  for (const offer of [oneTime, monthly]) {
    assert.match(pricing.pricingTitle(offer), /Pricing/);
    assert.match(pricing.pricingTitle(offer), /₹99/);
    assert.match(pricing.pricingDescription(offer), /CUET/);
    assert.match(pricing.pricingHeading(offer).h1, /^Free to start\. Pro is ₹99/);
  }
  assert.match(pricing.pricingHeading(monthly).h1, /a month/);
  assert.match(pricing.pricingHeading(oneTime).lead, /does not renew/);
});

test('the credit rows and the table state the costs from plan_facts', () => {
  const practice = Object.fromEntries(pricing.practiceCreditRows());
  assert.match(practice['Free accounts start with'], /100 practice credits/);
  assert.match(practice['Quick practice'], /10 credits/);
  assert.match(practice['Full mock'], /50 credits/);
  assert.equal(practice['Smart practice and NTA mode'], APPROVED.proLock.replace('Comes', 'Come'));
  const ai = Object.fromEntries(pricing.aiCreditRows());
  assert.match(ai['Mistake Repair'], /1 credit for each mistake/);
  assert.match(ai['Ask Mobi'], /1 credit for each reply/);
  const groups = pricing.buildCostGroups();
  const rows = Object.fromEntries(groups.flatMap((g) => g.rows).map(([feature, free, pro]) => [feature, [free, pro]]));
  assert.deepEqual(rows['AI credits each month'], [String(PLAN_FACTS.aiCredits.freeMonthly.value), String(PLAN_FACTS.aiCredits.proMonthly.value)]);
  assert.deepEqual(rows['Your gap to each college'], [false, true]);
  assert.deepEqual(rows['Smart practice, adaptive'], [false, true]);
});

test('an item appears only while its capability is on: repair and Ask Mobi rows drop out, nothing says "not available"', () => {
  const off = pricing.buildCostGroups({ repairOn: false, askOn: false });
  const features = off.flatMap((g) => g.rows).map((r) => r[0]);
  assert.ok(!features.some((f) => /Mistake Repair|Ask Mobi/.test(f)));
  assert.deepEqual(Object.keys(Object.fromEntries(pricing.aiCreditRows({ repairOn: false, askOn: false }))), ['Every month']);
  const everything = JSON.stringify([off, pricing.buildFaqs(oneTime, { repairOn: false }), pricing.aiCreditRows({ repairOn: false, askOn: false })]);
  assert.ok(!/not available|unavailable|paused|being prepared/i.test(everything));
});

test('the saved-question limit in the table is the limit the API enforces', () => {
  const limit = read('src/app/api/bookmarks/route.js').match(/FREE_BOOKMARK_LIMIT = (\d+)/)?.[1];
  assert.ok(limit, 'the API constant exists');
  const row = pricing.buildCostGroups().flatMap((g) => g.rows).find((r) => r[0] === 'Saved questions');
  assert.equal(row[1], `${limit} saves`);
});

test('no rupee amount or credit number is typed into the pricing sources', () => {
  for (const file of ['src/app/pricing/page.js', 'src/components/pricing/PlanCard.jsx', 'src/components/pricing/CostTable.jsx', 'src/components/pricing/CreditsSection.jsx']) {
    for (const s of studentStrings(read(file))) assert.ok(!/₹\s*[1-9]\d*/.test(s) && !/\b\d+\s+(practice|AI)\s+credits?\b/i.test(s), `${file}: "${s.slice(0, 80)}"`);
  }
  // pricingContent.js may type "₹0" (the free price) and the 25-save limit above, and nothing else.
  for (const s of studentStrings(read('src/components/pricing/pricingContent.js'))) {
    assert.ok(!/₹\s*[1-9]\d*/.test(s), `rupees typed: "${s.slice(0, 80)}"`);
    assert.ok(!/\b(10|40|50|100)\s+(practice|AI)\s+credits?\b/i.test(s), `credit count typed: "${s.slice(0, 80)}"`);
  }
});

test('signed-out Pro buttons return to this page after sign-in', () => {
  const button = read('src/components/billing/RazorpayPaymentButton.jsx');
  assert.match(button, /import \{ loginPathFor \} from '@\/lib\/auth-redirect'/);
  assert.match(button, /window\.location\.href = loginPathFor\(`\$\{window\.location\.pathname\}\$\{window\.location\.search\}`\)/);
  assert.doesNotMatch(button, /window\.location\.href = '\/login'/);
});

// ----------------------------------------------------------------------------------------------
// Public pages: truth and names.

test('no caveat line on a pricing or public page', () => {
  for (const file of OWNED) {
    for (const s of studentStrings(read(file))) {
      for (const re of CAVEAT_PATTERNS) assert.ok(!re.test(s), `${file}: ${s.slice(0, 100)}`);
      // A single word is a code (an Error message), not a sentence a student reads.
      if (/\s/.test(s.trim())) assert.ok(!/\bnot available\b|\bunavailable\b|\bcoming soon\b/i.test(s), `${file}: ${s.slice(0, 100)}`);
    }
  }
});

test('no retired product name on a pricing or public page (About may keep Score Recovery)', () => {
  for (const file of OWNED) assert.deepEqual(retiredHits(read(file), file), [], file);
});

test('copy rules: no em dash and no exclamation mark in student-facing strings', () => {
  for (const file of OWNED) {
    for (const s of studentStrings(read(file))) {
      assert.ok(!s.includes('—'), `${file}: em dash in "${s.slice(0, 80)}"`);
      if (/\s/.test(s.trim()) && /[A-Za-z]{2}/.test(s)) assert.ok(!/[A-Za-z]!(\s|$)/.test(s), `${file}: "!" in "${s.slice(0, 80)}"`);
    }
  }
});

test('public pages never link into a signed-in page', () => {
  const PUBLIC_FILES = OWNED.filter((file) => !/RazorpayPaymentButton|CutoffCalculator\.jsx|CompassPro\.jsx|ComboPlanner\.jsx|SubjectPicker\.jsx|EligibleMeter\.jsx|^src\/lib\/seo\.js$/.test(file));
  for (const file of PUBLIC_FILES) {
    const src = read(file);
    const hrefs = [...src.matchAll(/href=["'`]([^"'`$]+)["'`]/g), ...src.matchAll(/\bhref\s*[:=]\s*['"`](\/[^'"`$]*)['"`]/g)].map((m) => m[1]);
    for (const href of hrefs) {
      if (!href.startsWith('/')) continue;
      assert.equal(isSignedInPath(href), false, `${file} links to ${href}`);
    }
  }
  // The shared calculator offers signed-in buttons only to a signed-in visitor.
  const calc = read('src/components/du/CutoffCalculator.jsx');
  assert.match(calc, /isAuthenticated \? '\/dashboard' : '\/signup'/);
  assert.match(calc, /isAuthenticated \? '\/analytics' : '\/#how-it-works'/);
  assert.ok(!calc.includes("'/features'"), 'the retired page is not linked');
});

test('the retired routes are not linked anywhere in this packet', () => {
  for (const file of OWNED) {
    const src = read(file);
    assert.ok(!/['"`]\/features['"`]|\/coming-soon|\/pricing\/prepos/.test(src.replace(/^\s*\/\/.*$/gm, '')) || /^src\/app\/(features|coming-soon|pricing\/prepos)\//.test(file), file);
  }
});

test('the calculator page carries the ladder, the college starts and the Pro aside, and says nothing about Radar', () => {
  const page = read('src/app/cuet-cutoff-calculator/page.js');
  for (const piece of ['CutoffLadder', 'CollegeStarts', 'GapAside']) assert.match(page, new RegExp(`<${piece}`));
  assert.ok(!/Radar|Arena|Compass/.test(studentStrings(page).join(' ')));
  const gap = read('src/components/du/GapAside.jsx');
  assert.match(gap, /APPROVED\.cutoffToolPro/);
  assert.match(gap, /APPROVED\.proLock/);
  assert.equal(APPROVED.cutoffToolPro, 'Your gap to each college');
  const pro = read('src/components/du/CompassPro.jsx');
  assert.match(pro, /APPROVED\.cutoffToolPro/);
  assert.ok(!/Compass Pro/.test(studentStrings(pro).join(' ')));
});

test('every du-* class the public calculator and planner pages use has a style rule', () => {
  const css = read('src/components/du/du.css');
  const files = [
    'src/app/cuet-cutoff-calculator/page.js', 'src/app/cuet-subject-combination/page.js',
    'src/components/du/CutoffLadder.jsx', 'src/components/du/CollegeStarts.jsx', 'src/components/du/GapAside.jsx',
  ];
  const missing = new Set();
  for (const file of files) {
    for (const m of read(file).matchAll(/className=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
      for (const token of (m[1] || m[2]).split(/\s+/)) {
        if (!/^du-[a-z0-9_-]+$/.test(token)) continue;
        if (!new RegExp(`\\.${token.replace(/[-_]/g, (c) => `\\${c}`)}(?![a-z0-9_-])`).test(css)) missing.add(`${file}: ${token}`);
      }
    }
  }
  assert.deepEqual([...missing], []);
});

test('the pages that used the landing scope no longer need it', () => {
  for (const file of ['src/app/cuet-cutoff-calculator/page.js', 'src/app/cuet-subject-combination/page.js']) {
    const src = read(file);
    assert.ok(!/landing\.css/.test(src), `${file} imports the landing styles`);
    assert.ok(!/\blp-[a-z]/.test(src) && !/className="mm lp/.test(src), `${file} uses the landing scope`);
  }
});

test('the calculator ladder does not play by itself', () => {
  const ladder = read('src/components/du/CutoffLadder.jsx');
  assert.ok(!/setInterval|setTimeout|requestAnimationFrame/.test(ladder));
});

// ----------------------------------------------------------------------------------------------
// SEO: every title keeps its keywords, the retired pages leave the sitemap.

test('titles keep their search keywords', () => {
  const route = (path) => publicRoutes.find((r) => r.path === path);
  assert.match(route('/').title, /CUET Mock Tests/);
  assert.match(route('/cuet-cutoff-calculator').title, /CUET Cutoff Calculator/);
  assert.match(route('/cuet-subject-combination').title, /CUET Subject Combination Planner/);
  assert.match(route('/cuet-mock-test-free').title, /CUET Mock Test Free/);
  assert.match(route('/cuet-practice-tests-online').title, /CUET Practice Tests Online/);
  assert.match(route('/cuet-previous-year-questions').title, /CUET Previous Year Questions/);
  assert.match(route('/cuet-2027').title, /CUET 2027/);
  assert.match(route('/pricing').title, /Pricing/);
  // The page's own metadata agrees with the route table where it states a literal title.
  const literal = (file) => read(file).match(/title:\s*'([^']+)'/)?.[1];
  for (const path of ['/cuet-cutoff-calculator', '/cuet-subject-combination', '/cuet-mock-test-free', '/cuet-previous-year-questions', '/cuet-practice-tests-online', '/cuet-2027']) {
    assert.equal(literal(`src/app${path}/page.js`), route(path).title, path);
  }
});

test('the previous-year-questions page is honest in its title, description and H1', () => {
  const page = seoPages.previousYearQuestions;
  const route = publicRoutes.find((r) => r.path === '/cuet-previous-year-questions');
  for (const text of [route.title, route.description, page.h1, page.description, page.intro]) assert.ok(!/with answers/i.test(text), text);
  assert.match(page.h1, /previous year questions/i);
  assert.match(page.description, /not official past-paper material/i);
  assert.match(page.intro, /not official past-paper material/i);
});

test('/features, /coming-soon and /pricing/prepos are out of the sitemap and each redirects to the move table target', () => {
  for (const gone of ['/features', '/coming-soon', '/pricing/prepos']) assert.ok(!publicRoutes.some((r) => r.path === gone), gone);
  const target = (path) => ROUTE_MOVES.find((m) => m.from === path)?.to;
  assert.match(read('src/app/features/page.js'), new RegExp(`permanentRedirect\\('${target('/features').replace(/[#/]/g, (c) => `\\${c}`)}'\\)`));
  assert.match(read('src/app/coming-soon/page.js'), new RegExp(`permanentRedirect\\('${target('/coming-soon')}'\\)`));
  assert.match(read('src/app/pricing/prepos/page.js'), new RegExp(`permanentRedirect\\('${target('/pricing/prepos').replace(/[#/]/g, (c) => `\\${c}`)}'\\)`));
  // Nothing else in the coming-soon folder: its client form and release-hold styles are gone.
  assert.deepEqual(walk('src/app/coming-soon'), ['src/app/coming-soon/page.js']);
});

test('the free-mock and practice-test pages carry the live sample; the other reading pages do not', () => {
  assert.equal(seoPages.freeMockTest.sample, true);
  assert.equal(seoPages.practiceTests.sample, true);
  assert.ok(!seoPages.previousYearQuestions.sample);
  const shell = read('src/components/SeoContentPage.jsx');
  assert.match(shell, /import \{ DemoDrill \} from '@\/components\/landing\/DemoDrill'/);
  assert.match(shell, /id="try"/);
  assert.match(shell, /href=\{page\.sample \? '#try' : undefined\}/);
  assert.match(shell, /5 sample questions, no sign-up/);
  assert.equal(PLAN_FACTS.sessions.sampleQuestions.value, 5);
});

test('nothing renders after the footer except the phone dock', () => {
  const pages = [
    'src/app/pricing/page.js', 'src/app/about/page.js', 'src/app/cuet-cutoff-calculator/page.js',
    'src/app/cuet-subject-combination/page.js', 'src/components/SeoContentPage.jsx',
  ];
  for (const file of pages) {
    const src = read(file);
    const at = src.indexOf('<MarketingFooter />');
    assert.ok(at > -1, `${file} has the footer`);
    const rest = src.slice(at + '<MarketingFooter />'.length).replace(/<MobileDock[\s\S]*?\/>/, '').replace(/<\/div>|<\/>|[)};\s]/g, '');
    assert.equal(rest, '', `${file} renders after the footer: ${rest.slice(0, 80)}`);
  }
});

test('the old pricing extras are gone: the countdown, the below-footer text and the unlimited promise', () => {
  assert.deepEqual(walk('src/components/pricing').filter((f) => /Countdown/.test(f)), []);
  const files = OWNED.filter((f) => f.startsWith('src/app/pricing/') || f.startsWith('src/components/pricing/'));
  const shown = files.flatMap((f) => studentStrings(read(f))).join('\n');
  assert.ok(!/credit-gated|spending checks|Everything unlocked/i.test(shown));
  assert.ok(!files.map(read).join('\n').includes('PriceIncreaseCountdown'));
});

test('subject hubs speak in numbers, not plan rules', () => {
  const hubs = read('src/lib/subjectHubs.js');
  assert.match(hubs, /PLAN_FACTS\.practiceCredits\.startingBalance\.value/);
  assert.ok(!/credit-gated|Mistake Replay|Radar/.test(hubs));
  const page = read('src/app/cuet/[subject]/page.js');
  assert.ok(!/plan rules|current inventory/.test(page));
  assert.match(page, /NTA mode, the exam screen, comes with Pro/);
});

test('About keeps one Mobi and the non-affiliation line', () => {
  const about = read('src/app/about/page.js');
  assert.equal((about.match(/<MobiReact/g) || []).length, 1);
  assert.match(about, /not affiliated with NTA, Delhi University/i);
  assert.match(about, /Score Recovery/, 'positioning stays here, and only here');
});
