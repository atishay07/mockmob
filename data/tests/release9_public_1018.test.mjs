// Release 9, public packet (the 18 Oct ledger audit of release 8, landing-pricing-copy surface): landing, pricing,
// credits, auth, web onboarding copy and the public footer. Source-level and pure-module checks, no server.
// The browser walk of the same fixes (390 and 1440, Night and Day, reduced motion, real pointer) is in tmp/r9-fixes/public.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RELEASE_GATES, runtimeAiReleased, aiCommerceReleased } from '../capabilities.js';
import { aiCreditsRules, aiCreditsStatusLine } from '../../src/app/pricing/ai-credits/aiCreditsCopy.mjs';
import { ONBOARDING_LEAD, ONBOARDING_STEPS } from '../../src/lib/paperCopy.mjs';
import { priceHeadline, priceLine, priceTag } from '../../src/lib/payments/offer.js';
import { DEMO_ANSWERED_EVENT, demoAnswered, heroKeyClass, markDemoAnswered, resetDemoSignal, subscribeDemoAnswered } from '../../src/components/landing/demoSignal.mjs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function walk(dir, ext, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, ext, out);
    else if (ext.some((e) => entry.name.endsWith(e))) out.push(path);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// MEDIUM (truth): /pricing/ai-credits told every visitor "Written replies and new top-ups are paused" while replies were live.
// ---------------------------------------------------------------------------------------------------------------------

test('Credits: while runtimeAi is on, the page never says written replies are paused', () => {
  const repliesPaused = /(written )?repl(y|ies)[^.]*paused/i;
  for (const checkoutOpen of [false, true]) {
    const line = aiCreditsStatusLine({ checkoutOpen, repliesOpen: true });
    assert.doesNotMatch(line, repliesPaused, line);
    for (const [title, body] of aiCreditsRules(checkoutOpen)) assert.doesNotMatch(`${title}. ${body}`, repliesPaused);
  }
  assert.equal(aiCreditsStatusLine({ checkoutOpen: false, repliesOpen: true }), 'New top-ups are paused for now. Your monthly credits work, and credits you bought are kept.');
  assert.equal(aiCreditsStatusLine({ checkoutOpen: true, repliesOpen: true }), 'You can buy more below.');
  // Only when replies really are off may the page say so.
  assert.match(aiCreditsStatusLine({ checkoutOpen: false, repliesOpen: false }), /Written replies and new top-ups are paused/);
});

test('Credits: the page reads the real gates (runtimeAi for replies, aiCommerce for top-ups) and today says top-ups only', () => {
  const page = read('src/app/pricing/ai-credits/page.js');
  assert.match(page, /aiCreditsStatusLine\(\{ checkoutOpen, repliesOpen: runtimeAiReleased\(\), packsHere \}\)/);
  assert.match(page, /aiCreditsRules\(checkoutOpen\)/);
  assert.doesNotMatch(stripComments(page), /Written replies and new top-ups are paused/, 'the old fixed sentence is gone');
  // The live gates, as release 9 ships them: replies on, top-ups closed.
  assert.equal(RELEASE_GATES.runtimeAi, true);
  const today = aiCreditsStatusLine({ checkoutOpen: aiCommerceReleased(), repliesOpen: runtimeAiReleased() });
  assert.doesNotMatch(today, /repl(y|ies)[^.]*paused/i);
});

// ---------------------------------------------------------------------------------------------------------------------
// MEDIUM (truth): onboarding step 1 promised "no cap on how many you take" to Free students too. M-006: bolder copy.
// ---------------------------------------------------------------------------------------------------------------------

test('onboarding: "no cap" is said for Pro, and Free is told each mock uses credits', () => {
  assert.doesNotMatch(ONBOARDING_LEAD, /no cap on how many you take/);
  // New contract (copy pass, 19 Oct): the free first full mock leads; the cap and the credits are still said in one breath.
  assert.match(ONBOARDING_LEAD, /on Pro there is no cap/);
  assert.match(ONBOARDING_LEAD, /each one uses credits on Free/);
  assert.equal(ONBOARDING_STEPS.subjects.lead, ONBOARDING_LEAD);
});

test('onboarding (M-006): every step has a bolder headline and lead, true and plain: no "!", no hype words, no emoji', () => {
  assert.equal(ONBOARDING_STEPS.subjects.title, 'Your papers. Your mocks.');
  const plainBefore = ['Which subjects are you taking?', 'Your subjects', 'How many days a week can you study?', 'Which colleges are you aiming for?'];
  const hype = /\b(revolutionary|ultimate|game.?chang|supercharge|unleash|insane|amazing|best ever|guaranteed)\b/i;
  for (const [step, { title, lead }] of Object.entries(ONBOARDING_STEPS)) {
    assert.ok(!plainBefore.includes(title), `${step}: still the plain headline`);
    for (const line of [title, lead]) {
      assert.doesNotMatch(line, /!/, `${step}: ${line}`);
      assert.doesNotMatch(line, hype, `${step}: ${line}`);
      assert.doesNotMatch(line, /[\u{1F300}-\u{1FAFF}☀-➿]/u, `${step}: ${line}`);
    }
  }
  // The facts the leads state stay the code's facts: up to 5 subjects, up to 8 colleges, Skip keeps 4 study days.
  assert.match(ONBOARDING_STEPS.subjects.lead, /^Pick up to 5\./);
  assert.match(ONBOARDING_STEPS.edit.lead, /^Up to 5\./);
  assert.match(ONBOARDING_STEPS.colleges.lead, /up to 8 colleges/);
  assert.match(ONBOARDING_STEPS.days.lead, /start you on 4\./);
  assert.match(read('src/app/onboarding/firstRun.js'), /export const DEFAULT_DAYS = 4;/);
  const client = read('src/app/onboarding/OnboardingPageClient.jsx');
  assert.match(client, /const COPY = ONBOARDING_STEPS;/, 'the onboarding screens read the tested copy');
});

// ---------------------------------------------------------------------------------------------------------------------
// MEDIUM: the landing still said "leaderboard" three times; LOW: "The mob speaks." and "Mob solved in" used Mob for the crowd.
// ---------------------------------------------------------------------------------------------------------------------

test('landing: no "leaderboard" in any visible line (the route /leaderboard stays), and "Your standing" is said instead', () => {
  const page = read('src/app/page.js');
  const visible = stripComments(page).replace(/'\/leaderboard'/g, "'/standing-route'");
  assert.doesNotMatch(visible, /leaderboard/i);
  assert.match(page, /'Your standing',\n\];/, 'the Free plan item');
  assert.match(page, /kicker: 'Benchmarks and your standing'/);
  assert.match(page, /'Every mock earns points for accuracy and speed toward your standing'/);
  assert.match(page, /cta: 'See your standing'/);
});

test('landing: the crowd is "students", never "the mob", now that Mob means your friends', () => {
  assert.doesNotMatch(read('src/app/page.js'), /The mob speaks/i);
  assert.match(read('src/app/page.js'), /Students, in their own words\./);
  const arena = read('src/components/landing/ArenaPreview.jsx');
  assert.doesNotMatch(arena, /Mob solved/);
  assert.match(arena, /Students solved it in <strong>/);
});

// ---------------------------------------------------------------------------------------------------------------------
// MEDIUM (CEO decision): one price framing everywhere, led by what a buyer is charged today.
// ---------------------------------------------------------------------------------------------------------------------

const offerFor = (purchasable) => ({
  monthly: { planId: 'pro_monthly_99', rupees: 99, interval: 'month', autoRenews: true, ready: purchasable === 'monthly' },
  oneTime: { planId: 'pro_cuet_2027', rupees: 99, expires: '31 July 2027', onSale: purchasable !== 'monthly' },
  purchasable,
});

test('price framing: while monthly billing is not open, the H1, the Pro card tag and the trust row all say "₹99 once, through 31 July 2027"', () => {
  const offer = offerFor('one_time');
  assert.equal(priceHeadline(offer), 'Pro is ₹99 once, through 31 July 2027.');
  assert.deepEqual(priceTag(offer), { price: '₹99', cycle: 'once' });
  assert.equal(priceLine(offer), 'Pro ₹99 once, through 31 July 2027');
  for (const line of [priceHeadline(offer), priceLine(offer), `${priceTag(offer).price} ${priceTag(offer).cycle}`]) {
    assert.doesNotMatch(line, /a month|monthly|\/month/, line);
  }
});

test('price framing: once monthly billing opens, all three switch together to "₹99 a month"', () => {
  const offer = offerFor('monthly');
  assert.equal(priceHeadline(offer), 'Pro is ₹99 a month.');
  assert.deepEqual(priceTag(offer), { price: '₹99', cycle: 'a month' });
  assert.equal(priceLine(offer), 'Pro ₹99 a month');
});

test('price framing: /pricing and the landing read the same helpers, and checkout still charges the one-time plan', () => {
  const pricing = read('src/app/pricing/page.js');
  assert.match(pricing, /<h1 className="mm-h1">\{priceHeadline\(offer\)\}<\/h1>/);
  assert.match(pricing, /\.\.\.priceTag\(offer\),/);
  assert.doesNotMatch(pricing, /\{`Pro is ₹\$\{offer\.monthly\.rupees\} a month\.`\}/, 'the H1 no longer hard-codes "a month"');
  const home = read('src/app/page.js');
  assert.match(home, /<li><Check size=\{16\} aria-hidden="true" \/>\{priceLine\(OFFER\)\}<\/li>/);
  // What a buyer is charged today (checkout code, unchanged): the one-time plan is ₹99, live, through 31 July 2027;
  // the monthly plan opens only when its Razorpay plan id is configured.
  const plans = read('src/lib/payments/plans.js');
  assert.match(plans, /id: 'pro_cuet_2027',\n\s+name: 'MockMob CUET 2027 Access',\n\s+amount: 9900,\n\s+currency: 'INR',\n\s+billingType: 'one_time',\n\s+status: 'live',/);
  assert.match(plans, /accessUntil: '2027-07-31T18:29:59\.999Z',\n\s+checkoutKind: 'cuet_2027_access',/);
  assert.match(plans, /return Boolean\(getRazorpayPlanId\(PAYMENT_PLANS\.pro_monthly_99\)\);/);
});

// ---------------------------------------------------------------------------------------------------------------------
// LOW: after the first sample answer, two lime keys were in view (at 960 px and up; at 390 the hero key stayed lime under the sticky nav).
// ---------------------------------------------------------------------------------------------------------------------

test('demo signal: the hero key steps down to secondary after an answer, at every width', () => {
  for (const wide of [true, false]) {
    assert.equal(heroKeyClass({ answered: false, wide }), 'mm-btn mm-btn--primary');
    assert.equal(heroKeyClass({ answered: true, wide }), 'mm-btn mm-btn--secondary', `wide=${wide}: a phone steps down too`);
  }
  assert.equal(heroKeyClass({ answered: true }), 'mm-btn mm-btn--secondary', 'no width is asked for');
  const actions = read('src/components/LandingActions.jsx');
  assert.doesNotMatch(actions, /matchMedia|DEMO_QUIET_QUERY/, 'no width gate is left on the hero key');
  assert.doesNotMatch(read('src/components/landing/demoSignal.mjs'), /DEMO_QUIET_QUERY|min-width/);
});

test('demo signal: the first answer announces itself once and stays answered', () => {
  resetDemoSignal();
  const target = new EventTarget();
  let heard = 0;
  const off = subscribeDemoAnswered(() => { heard += 1; }, target);
  assert.equal(demoAnswered(), false);
  assert.equal(markDemoAnswered(target), true);
  assert.equal(markDemoAnswered(target), false, 'a second answer changes nothing');
  assert.equal(heard, 1);
  assert.equal(demoAnswered(), true);
  off();
  resetDemoSignal();
  assert.equal(DEMO_ANSWERED_EVENT, 'mm:demo-answered');
});

test('demo signal: the sample marks its first pick, and the hero key reads the signal', () => {
  const drill = read('src/components/landing/DemoDrill.jsx');
  assert.match(drill, /setPicked\(optionIndex\);\n\s+markDemoAnswered\(\);/);
  const actions = read('src/components/LandingActions.jsx');
  assert.match(actions, /className=\{heroKey\}/);
  assert.match(actions, /useSyncExternalStore\(subscribeDemoAnswered, demoAnswered, \(\) => false\)/, 'server render keeps the lime key');
});

// ---------------------------------------------------------------------------------------------------------------------
// LOW: the "What's inside MockMob" chips were clipped hard at "Benchm..." at 1440.
// ---------------------------------------------------------------------------------------------------------------------

test('feature tour: from 900 px the chips wrap with no mask (none clipped); below, the row snaps and fades wide', () => {
  const css = stripComments(read('src/app/feature-tour.css'));
  const wide = css.slice(css.lastIndexOf('@media (min-width: 900px)'));
  assert.match(wide, /\.ft__list \{ flex-wrap: wrap;[^}]*overflow-x: visible;[^}]*mask-image: none; \}/);
  assert.match(wide, /\.ft__row \{ padding-inline: \.7rem; \}/);
  assert.match(css, /\.ft__list \{[^}]*scroll-snap-type: x proximity;[^}]*#000 48px/);
  assert.match(css, /\.ft__list li \{ scroll-snap-align: start; \}/);
});

// ---------------------------------------------------------------------------------------------------------------------
// LOW: the lime "aurora" wash behind the hero and the close (the glow L-019 forbids).
// ---------------------------------------------------------------------------------------------------------------------

test('landing backdrop: no aurora layer or rule anywhere; the grid and dots stay', () => {
  const src = fileURLToPath(new URL('src/', root));
  for (const file of walk(src, ['.css', '.jsx', '.js'])) {
    assert.doesNotMatch(stripComments(readFileSync(file, 'utf8')), /lp-bg__aurora|lp-depth-far/, file);
  }
  const backdrop = read('src/components/landing/HeroBackdrop.jsx');
  assert.match(backdrop, /lp-bg__grid/);
  assert.match(backdrop, /lp-bg__dots/);
  assert.match(read('src/app/page.js'), /<div className="lp-bg lp-bg--static" aria-hidden="true">\n\s+<div className="lp-bg__grid" \/>\n\s+<div className="lp-bg__dots" \/>/);
});

// ---------------------------------------------------------------------------------------------------------------------
// LOW (L-013): the public footer's Help sent guests to a sign-in wall.
// ---------------------------------------------------------------------------------------------------------------------

test('footer Help: a guest goes to the landing’s public questions, a signed-in student to /help', () => {
  const link = read('src/components/FooterHelpLink.jsx');
  assert.match(link, /export const GUEST_HELP_HREF = '\/#faq';/);
  assert.match(link, /export const STUDENT_HELP_HREF = '\/help';/);
  assert.match(link, /href=\{isAuthenticated \? STUDENT_HELP_HREF : GUEST_HELP_HREF\}/);
  assert.match(read('src/components/MarketingFooter.jsx'), /href === '\/help' \? <FooterHelpLink>\{label\}<\/FooterHelpLink>/);
  assert.match(read('src/app/page.js'), /<section className="lp-sec lp-sec--band" id="faq">/, 'the public questions have the anchor');
  // Arriving from another page (/pricing -> /#faq), the landing settles on the questions after its sections grow,
  // and the heading lands clear of the sticky nav. The student's own scroll stops the settle.
  assert.match(read('src/app/page.js'), /<HashSettle \/>/);
  const settle = read('src/components/landing/HashSettle.jsx');
  assert.match(settle, /const DEFAULT_IDS = \['faq'\];/);
  assert.match(settle, /USER_INPUT\.forEach\(\(type\) => window\.addEventListener\(type, stop/);
  assert.match(read('src/app/landing.css'), /#faq \{ scroll-margin-top: 64px; \}/);
  // /help itself is still behind sign-in: it lives in the (app) group.
  assert.ok(readdirSync(new URL('src/app/(app)/help/', root)).includes('page.js'));
});

// ---------------------------------------------------------------------------------------------------------------------
// LOW: /login and /signup said things twice (card subline echoed the lead; "stay signed in" twice on /login).
// ---------------------------------------------------------------------------------------------------------------------

test('auth: each thing is said once on /login and /signup', () => {
  const card = read('src/components/ui/SignupCard.jsx');
  const login = read('src/app/login/LoginPageClient.jsx');
  const signup = read('src/app/signup/SignupPageClient.jsx');
  assert.doesNotMatch(card, /Open your recorded mocks/, 'the login card no longer echoes the headline lead');
  assert.doesNotMatch(card, /chapter review and saved questions stay with your account/, 'the signup card no longer echoes its lead');
  assert.match(card, /\? 'Use Google, or get a one-time code by email\. No password to remember\.'\n\s+: 'Free to start\. No card needed\.'/);
  // "Stay signed in": /login says it once, as the ruled fact; the card's fine print drops it there and keeps it on /signup,
  // whose facts do not say it.
  assert.match(login, /'You stay signed in on this device until you sign out'/);
  assert.doesNotMatch(signup, /stay signed in/i);
  assert.match(card, /\{isLogin \? 'Your email is how you sign in\.' : 'Your email is how you sign in, and you stay signed in on this device until you sign out\.'\}/);
});

// ---------------------------------------------------------------------------------------------------------------------
// MEDIUM (truth, one price framing): the /pricing FAQ said "Pro is ₹99 a month" while the page, checkout and the JSON-LD
// answer were one payment of ₹99. The FAQ answer feeds faqJsonLd, so search results could show the monthly price.
// ---------------------------------------------------------------------------------------------------------------------

test('pricing FAQ: while monthly billing is not open, no string says "Pro is ₹N a month" (the FAQ and its JSON-LD answer say one payment)', () => {
  const pricing = read('src/app/pricing/page.js');
  const lines = pricing.split('\n');
  const monthlyOnly = (index) => {
    // A monthly-branch string sits on a line that starts "? `" under a "=== 'monthly'" line, or on a ternary that names the monthly state.
    const here = lines[index];
    const before = lines.slice(Math.max(0, index - 2), index).join('\n');
    return /^\s*\? `/.test(here) && /\bmonthly\b/.test(before) || /monthly \? `/.test(here);
  };
  lines.forEach((line, index) => {
    if (/Pro is ₹\$\{[^}]+\} a month|MockMob Pro is ₹\$\{[^}]+\} a month/.test(line)) assert.ok(monthlyOnly(index), `line ${index + 1} states a monthly price outside the monthly branch: ${line.trim().slice(0, 100)}`);
  });
  assert.match(pricing, /`Not yet\. Today Pro is one payment of ₹\$\{offer\.oneTime\.rupees\} for access through \$\{offer\.oneTime\.expires\}, with no auto-renewal\. A ₹\$\{offer\.monthly\.rupees\} monthly plan opens soon, and whoever pays now keeps the full term\.`/);
  assert.doesNotMatch(pricing, /Not yet\. Pro is/);
  // The JSON-LD answer is the same FAQ text, never a second copy.
  assert.match(pricing, /faqJsonLd\(FAQS\.map\(\(faq\) => \(\{ question: faq\.q, answer: faq\.a \}\)\)\)/);
});
