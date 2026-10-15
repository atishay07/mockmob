import Link from 'next/link';
import { CAPABILITIES, newOfferReleased } from '@/../data/capabilities';
import { publicOffer } from '@/lib/payments/offer';
import STUDY_RELEASE from '@/../data/study/release.json';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { HeroKeys } from '@/components/landing/HeroKeys';
import { HeroLive } from '@/components/landing/HeroLive';
import { TypeLine } from '@/components/landing/TypeLine';
import { DemoDrill } from '@/components/landing/DemoDrill';
import { CloseActions } from '@/components/landing/CloseActions';
import { DemoJump } from '@/components/landing/DemoJump';
import { HeroBackdrop } from '@/components/landing/HeroBackdrop';
import { LandingDock } from '@/components/landing/HeroDockGate';
import { Reveal } from '@/components/landing/Reveal';
import { LiveStatsBand } from '@/components/landing/LiveStatsBand';
import { EligibilityTeaser } from '@/components/du/EligibilityTeaser';
import { CollegeDestinations } from '@/components/landing/CollegeDestinations';
import { ExamComparator } from '@/components/landing/ExamComparator';
import FeatureTour from '@/components/landing/FeatureTour';
import { SectionHeading } from '@/components/landing/SectionHeading';
import MistakeLab from '@/components/landing/MistakeLab';
import LabCinema from '@/components/landing/LabCinema';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { objectStage } from '@/components/brand/ObjectLifeModel.mjs';
import { subjectArt } from '@/../data/subject_art.mjs';
import { publishedVoices } from '@/lib/voices';
import { INSTAGRAM, STATS_AS_OF, rankedReels } from '@/lib/social';
import { buildCompassShowcase } from '@/lib/du/showcase';
import CompassLadder from '@/components/landing/CompassLadder';
import CreatorReels from '@/components/landing/CreatorReels';
import { MascotSeat } from '@/components/brand/Mascot';
import PipGuide from '@/components/brand/PipGuideLazy';
import WallOfLove from '@/components/landing/WallOfLove';
import { SubjectCount } from '@/components/landing/SubjectGrid';
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/seo';
import './landing.css';
import './home-refinements.css';
import './mistake-lab.css';
import './compass-ladder.css';
import './social-proof.css';
import './hero-depth.css';
import './feature-tour.css';
import './tour-screens.css';
import './lab-cinema.css';
import './home.css';
import './hero-v3.css';
import './landing-rest.css';

const freePlan = newOfferReleased() ? ['One baseline per launch subject', 'One included daily 10-question set', 'One new recovery episode per week', 'Fresh checks for started episodes', '25 saved questions'] : [
  'Quick Practice and Full Mock on Practice credits',
  'Weekly progress tracking',
  '25 saved questions',
  'Leaderboard',
];
const proPlan = newOfferReleased() ? ['All available recovery pathways', 'Fresh delayed checks and full history', 'Unlimited available practice and reattempts', 'Full, Smart and NTA access', 'Unlimited saved questions'] : [
  'Unlimited Quick Practice and Full Mock',
  'Compass Pro: your practice mapped to your DU shortlist',
  'Smart Practice and NTA Mode',
  'Full Radar: every ranked chapter, pace and changed answers',
  'Unlimited saved questions',
];

const OFFER = publicOffer();
const SHOWCASE = buildCompassShowcase();
const WALL_VOICES = publishedVoices();

// The statement scrubs word by word with the scroll (on phones it holds the screen while it does). It carries on
// from the hero, which has said what the marks cost: what you do once you can see where they went.
// Words marked with * carry the accent.
const STATEMENT = 'Fix the *reason, not just the answer. Prove it on fresh questions days later. Then test your DU *shortlist against real cutoffs.';
// The four launch papers as the app's lamp-lit objects. Each lands on its shadow from its own height as the
// statement scrolls: depth is how far it falls (px), tilt how far it turns on the way. base is where the
// object's contact shadow ends, as a share of its square box, so on phones the name sits right under it.
const shelfBase = (id) => {
  const stage = objectStage(subjectArt(id));
  return stage ? ((stage.contact.cy + stage.contact.ry) / 100).toFixed(3) : '0.9';
};
// The picture's drawn width for the srcset: the shelf box (--shelf-obj, home.css and hero-depth.css: at most 42vw
// on phones, 11.5rem on desktop) times the share of the box the object fills. Without it a phone fetched the
// 512 px file for a 130 px object.
const shelfSizes = (id) => {
  const share = (objectStage(subjectArt(id))?.box.width ?? 100) / 100;
  return `(max-width: 959px) ${Math.ceil(42 * share)}vw, ${Math.ceil(184 * share)}px`;
};
const SHELF = [
  { id: 'english', name: 'English', href: '/cuet/english', depth: 70, tilt: -4 },
  { id: 'accountancy', name: 'Accountancy', href: '/cuet/accountancy', depth: 120, tilt: 3 },
  { id: 'business_studies', name: 'Business Studies', href: '/cuet/business-studies', depth: 45, tilt: -2 },
  { id: 'economics', name: 'Economics', href: '/cuet/economics', depth: 95, tilt: 4 },
].map((item) => ({ ...item, base: shelfBase(item.id), sizes: shelfSizes(item.id) }));

// Learn is marketed only while study content is switched on; counts come from the release proof.
const STUDY_LIVE = process.env.STUDY_CONTENT_ENABLED === 'true' && process.env.STUDY_RECALL_ENABLED === 'true';
const STUDY_LESSONS = Object.keys(STUDY_RELEASE.units || {}).length;
const STUDY_SUBJECTS = new Set(Object.keys(STUDY_RELEASE.units || {}).map(id => id.split('-')[0])).size;
// The feature tour: every product area, one idea per slide. Screens are labelled illustrations; the
// captions say what is true of the product. Each slide's demo screen lives in TourScreens.jsx, keyed by id.
// Add `video: '/demos/<id>.mp4'` to a slide to play a real screen recording in its place.
const TOUR = [
  { id: 'arena', label: 'Practice', line: 'Drills and full mocks on the exam clock', title: 'Practise the way the exam runs.',
    body: 'A short drill for a free evening, or a full 50-question, 60-minute mock for the weekend. Same timer, same question palette, same pressure.',
    points: ['Quick drills and full mocks', 'NTA-style screen and Smart Practice with Pro', 'Close the tab mid-test and pick up where you left off'], chip: 'Close the tab mid-test and pick up where you left off.', href: '/dashboard', cta: 'Start practising' },
  { id: 'repair', label: 'Mistake Repair', line: 'Fix why you got it wrong, not just the answer', title: 'Fix why you missed it, not just the answer.',
    body: 'After a wrong answer, see why your pick tempted you, where it breaks and what to remember. Every repair is written from the official key.',
    points: ['If the AI and the key disagree, the question is held back and you pay nothing', 'A 10-minute next step, then 5 fresh questions to test the fix'], chip: 'Then a 10-minute next step and 5 fresh questions to test the fix.', href: '/signup', cta: 'Try Mistake Repair' },
  ...(STUDY_LIVE && STUDY_LESSONS ? [{ id: 'learn', label: 'Learn', line: 'Learn the idea, then keep it', title: 'Learn the idea behind the mark, then keep it.',
    body: 'Short lessons with worked examples and the common mistake, then recall cards that return before you are likely to forget. When a chapter keeps costing you marks, its lesson is linked from your result.',
    points: [`${STUDY_LESSONS} lessons across ${STUDY_SUBJECTS} subjects, with more on the way`, 'Lessons and recall are free and use no credits', 'Then practise the same chapter with marks'], chip: 'Made to sit beside your NCERT.', href: '/learn', cta: 'Open Learn' }] : []),
  { id: 'replay', label: 'Replay', line: 'See where the marks actually went', title: 'Replay a mock, answer by answer.',
    body: 'Every answer you changed, every question that ate your time, every skip, in the order it happened. Then turn the costly ones into a short drill.',
    points: ['An answer-by-answer timeline', 'Save any question to revisit later'], chip: 'Then turn the costly questions into a short drill.', href: '/review', cta: 'Review your mistakes' },
  { id: 'radar', label: 'Radar', line: 'The chapter to fix first', title: 'Know which chapter to fix first.',
    body: 'A score is just a number. Radar traces every miss back to its chapter, so tonight’s session has a target. Pro adds pace and changed-answer detail for every chapter.',
    points: ['Your weakest chapters, free after every mock', 'Built only from questions you attempted'], chip: 'Your weakest chapters, free after every mock.', href: '/analytics', cta: 'Explore Radar' },
  { id: 'prepos', label: 'PrepOS', line: 'Ask what to do tonight', title: 'Ask what to do tonight. Get one clear step.',
    body: 'PrepOS reads your practice record and answers with the leak, the pace problem and a single next step: the same one you see on Today and in Radar.',
    points: ['Questions about your own record are free', 'AI credits each month: 10 on Free, 50 on Pro', 'Answers come from your record, not a generic plan'], chip: 'Questions about your own record are free.', href: '/mentor', cta: 'Meet PrepOS' },
  { id: 'compass', label: 'DU Compass', line: 'Your shortlist against real DU cutoffs', title: 'Test your DU shortlist against real cutoffs.',
    body: 'Compare a score with published 2026 DU cutoffs by college, category and round, free. With Pro, Compass turns your practice into a paper-by-paper range for your shortlist.',
    points: ['Programme eligibility rules, free', 'Pro: your practice projected onto your shortlist, and the paper to improve first'], chip: 'Cutoffs from DU’s published Round I to III lists.', href: '/admission-compass', cta: 'Open Compass' },
  { id: 'combo', label: 'Combo Planner', line: 'Choose your five CUET papers', title: 'Choosing five papers? Check the combination first.',
    body: 'Pick your DU goals and the subjects you can take, then see which five-paper combinations the published 2026 rules keep open.',
    points: ['Free to use', 'Compare combinations side by side'], chip: 'Compare combinations side by side, free.', href: '/cuet-subject-combination', cta: 'Plan my subjects' },
  { id: 'rival', label: 'Benchmarks', line: 'Beat a target score under the clock', title: 'Beat the score you’re aiming for.',
    body: 'Run a short timed set against a fixed target for accuracy and pace, at daily, college or DU level. See whether you hold the standard with the clock running.',
    points: ['The daily benchmark is free', 'Every mock earns XP for accuracy and speed on the leaderboard'], chip: 'The daily benchmark is free.', href: '/leaderboard', cta: 'See the leaderboard' },
];

const faqs = [
  { question: 'Can I try it before signing up?', answer: 'Yes. Pick your subject at the top of this page and answer five CUET-style questions, each with the reason behind the answer. No account needed.' },
  { question: 'What is MockMob built for?', answer: 'Timed CUET UG practice, a clear read of every mistake, and one next step you can act on tonight. DU eligibility and published cutoffs sit alongside.' },
  { question: 'What is the Mistake Lab?', answer: 'After every mock, the Lab shows where your marks went: the time on each question, every answer you changed, the reason behind each miss, and a SWOT with the set to do next. Mistake Repair then fixes the reasoning, one mistake at a time.' },
  { question: 'What does Pro cost?', answer: OFFER.purchasable === 'monthly' ? `₹${OFFER.monthly.rupees} a month. It renews until you cancel in Account, and you keep Pro to the end of the month you paid for.` : `Monthly Pro at ₹${OFFER.monthly.rupees} a month is opening soon. Until then, ₹${OFFER.oneTime.rupees} once covers access through ${OFFER.oneTime.expires}, with no auto-renewal. Whoever pays now keeps the full term.` },
  { question: 'Is MockMob affiliated with NTA or DU?', answer: 'No. MockMob is independent. The exam pattern and the DU rules you see here come from what NTA and DU publish.' },
];

export default function LandingPage() {
  return (
    <div className="mm lp">
      <JsonLd id="home-breadcrumb-json-ld" data={breadcrumbJsonLd([{ name: 'Home', path: '/' }])} />
      <JsonLd id="home-faq-json-ld" data={faqJsonLd(faqs)} />
      <noscript>
        <style>{'.rv,.rv-item,.lp-hero [data-hero]{opacity:1!important;transform:none!important}'}</style>
      </noscript>
      <NavBar />
      <main id="main-content">
        {/* ------------------------------ HERO ------------------------------ */}
        <section className="lp-hero lp-hero--v3">
          <HeroBackdrop />
          <div className="mm-wrap lp-hero__grid">
            {/* Everything the reader needs is in the server HTML and visible at first paint: no entrance hides the
                words or the keys. The headline carries the page: "CUET 2027" in volt as its first line. Mobi has three
                places on this page, each with a reason: on the sample card at desktop (he greets you beside the
                question), in the phone dock once the hero's keys have gone, and reacting to your own sample answers.
                The one thing that moves here is the turning line, which turns a set number of times and rests. */}
            <div className="lp-hero__copy">
              <div className="lp-hero__head">
                <h1 className="lp-title">
                  <span className="lp-title__exam">CUET 2027</span>
                  <span className="lp-title__line">Your lost marks went somewhere.</span>
                  <span className="lp-title__line">MockMob shows you where.</span>
                </h1>
              </div>
              <TypeLine lead="Down to" phrases={['the chapter.', 'the minute.', 'the changed answer.', 'the reason.']} label="the chapter, the minute, the changed answer and the reason." />
              <p className="lp-lead">Then it picks the chapter for tonight and keeps your DU shortlist in sight.</p>
              <div className="lp-cta">
                <HeroKeys />
              </div>
              <p className="lp-terms">
                <b>Free to start.</b>{' '}
                {OFFER.purchasable === 'monthly' ? `Pro is ₹${OFFER.monthly.rupees} a month, and you can cancel anytime.` : `Pro is ₹${OFFER.oneTime.rupees} once, through ${OFFER.oneTime.expires}, with no auto-renewal.`}
              </p>
              <HeroLive />
              <Link href="/cuet-cutoff-calculator" className="lp-link lp-hero__tool">Free DU eligibility and cutoff calculator</Link>
            </div>

            {/* The sample is one surface: its own bar says what it costs ("No sign-up needed", "5 questions") and its
                first line asks the question, so nothing labels it from above and no path diagram explains it below. */}
            <div className="lp-stage" id="try-practice" data-hero>
              <div className="lp-stage__card">
                {/* Desktop only (hero-v3.css): Mobi perched on the card's top edge at its right end. No caption. The
                    phone seat in the headline is the one phones and tablets show. */}
                <MascotSeat station="hero-card" pose="greeting" className="pip-seat--card" />
                <DemoDrill />
              </div>
            </div>
          </div>

          {/* Second hero beat: two facts the page does not say anywhere else, as plain sentences under a hairline,
              each a link to the part of the page that shows it. The sample already offers five questions, and the
              73 DU programmes belong to the DU section, so neither is repeated here. */}
          <div className="mm-wrap">
            <nav className="lp-proof" aria-label="What MockMob gives you">
              <a href="#exam-experience"><b>Two exam screens</b>, MockMob or NTA style. Your pick.</a>
              <a href="#your-prep"><b>One full CUET mock</b>: 50 questions in 60 minutes.</a>
            </nav>
          </div>
        </section>

        {/* ----------------------- STATEMENT (scroll-scrubbed) -------------------- */}
        <section className="lp-statement" aria-label="What MockMob does">
          <div className="mm-wrap lp-statement__grid">
            <p className="lp-statement__text">
              {STATEMENT.split(' ').map((word, i, all) => (
                <span key={i} className="lp-statement__w" data-accent={word.startsWith('*') || undefined} style={{ '--p': (i / (all.length - 1)).toFixed(3) }}>
                  {word.replace('*', '')}{i < all.length - 1 ? ' ' : ''}
                </span>
              ))}
            </p>
            {/* The four launch papers as a lineup: each object stands on one shared floor (a hairline), its name
                and its real question count under the line. No label above: the statement is the heading. */}
            <div className="lp-shelf">
              <ul className="lp-shelf__row" aria-label="The four launch papers">
                {SHELF.map(({ id, name, href, depth, tilt, base, sizes }, i) => (
                  <li key={id} className="lp-shelf__item" style={{ '--k': i, '--depth': depth, '--tilt': `${tilt}deg`, '--base': base }}>
                    <Link href={href} className="lp-shelf__link">
                      <span className="lp-shelf__float"><SubjectObject id={id} size={184} sizes={sizes} className="lp-shelf__obj" style={{ '--obj-size': 'var(--shelf-obj)' }} /></span>
                      <span className="lp-shelf__name">{name}</span>
                      <SubjectCount id={id} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ------------------- MISTAKE LAB CINEMA (held scroll story) ------------------ */}
        {/* Each held story's heading docks under the site bar while its story runs (SectionHeading). */}
        <section className="lp-sec lp-sec--cinema lp-sh-host" id="inside-the-lab" aria-labelledby="inside-the-lab-title">
          {/* Without JavaScript the held stories (ScrollStory) simply scroll as plain sections. */}
          <noscript><style>{'.ss .ss__track{height:auto!important}.ss .ss__stage{position:static!important;height:auto!important}'}</style></noscript>
          <SectionHeading titleId="inside-the-lab-title" className="lp-cinema-head" name="Mistake Lab."
            title="Every mark, traced back to a moment."
            sub="A score tells you how it went. The Lab shows why: the minutes, the second thoughts, the reason behind each miss, and the plan for the next mock."
            mini="Inside the Mistake Lab" />
          <LabCinema />
        </section>

        {/* --------------------------- FEATURE TOUR -------------------------- */}
        <section className="lp-sec lp-sec--tour lp-sh-host" id="your-prep" aria-labelledby="your-prep-title">
          <SectionHeading titleId="your-prep-title" title={<>What’s inside <em>MockMob</em>.</>}
            sub="Practice, repair, replay and the plan that ties them together."
            mini={<>What’s inside <em>MockMob</em></>} />
          <div className="mm-wrap">
            <FeatureTour slides={TOUR} />
          </div>
        </section>

        {/* ------------------------- SCORE RECOVERY LAB --------------------- */}
        <section className="lp-sec lp-sh-host" id="score-recovery-lab" aria-labelledby="score-recovery-lab-title">
          <SectionHeading titleId="score-recovery-lab-title" name="Score Recovery Lab." title="Fix it once. Check it holds."
            sub="Replay the session, repair the leak, then prove it on fresh questions days later."
            mini="Score Recovery Lab" />
          <div className="mm-wrap">
            <MistakeLab recoveryState={CAPABILITIES.recovery.state} recoveryReason={CAPABILITIES.recovery.reason} />
          </div>
        </section>

        {/* ---------------------------- COMPASS LADDER ---------------------------- */}
        {SHOWCASE.programmes.length > 0 ? (
          <section className="lp-sec" id="compass">
            <div className="mm-wrap">
              <div className="lp-head lp-head--left">
                <h2 className="lp-h2"><span className="lp-h2__name">DU Compass.</span> <span className="lp-h2__rest">Put your shortlist beside the numbers.</span></h2>
                <p className="lp-sub">
                  Slide a score and see which colleges it would have cleared in 2026, by category and round.
                </p>
              </div>
              <Reveal delay={100}><CompassLadder data={SHOWCASE} /></Reveal>
              {/* Compass Pro, the paid layer over the free ladder: a block on the page ground (title, words, three
                  defined features on hairlines, one text link), not a card. */}
              <aside className="lp-cpro" aria-labelledby="compass-pro-title">
                <div className="lp-cpro__copy">
                  <h3 className="lp-h3" id="compass-pro-title"><span className="lp-h2__name">Compass Pro.</span> <span className="lp-h2__rest">Your practice, mapped to the colleges you want.</span></h3>
                  <p>Turn your recorded practice into a paper-by-paper range. Compare it with your DU shortlist and see which paper has the most room to improve.</p>
                  <Link href="/pricing" className="lp-textlink">See what Pro includes</Link>
                </div>
                <dl className="lp-cpro__list">
                  <div><dt>Practice projection</dt><dd>Each paper out of 250, from your attempt rate and accuracy, shown as a range.</dd></div>
                  <div><dt>Your DU shortlist</dt><dd>Up to 8 college and programme targets, compared with Rounds I to III.</dd></div>
                  <div><dt>Next move</dt><dd>The paper with the most marks open, and its weakest chapter.</dd></div>
                </dl>
                <p className="lp-cpro__fine">Comparing cutoffs stays free.</p>
              </aside>
            </div>
          </section>
        ) : null}

        {/* ------------------------- FREE DU CALCULATOR --------------------- */}
        <section className="lp-sec" id="du-eligibility">
          <div className="mm-wrap">
            <div className="lp-head lp-head--left">
              <h2 className="lp-h2"><span className="lp-h2__name">Which DU courses fit your subjects?</span> <span className="lp-h2__rest">Tick them and see.</span></h2>
              <p className="lp-sub">
                Every DU programme your subjects open under the 2026 rules, then the college cutoffs in your category. Free, no sign-up.
              </p>
            </div>
            <Reveal>
              <EligibilityTeaser />
            </Reveal>
            {/* Combo Planner: a row between two hairlines, not a card. The teaser above holds the section's
                primary key, so this one is secondary. */}
            <aside className="lp-combo" aria-labelledby="combo-title">
              <div>
                <h3 className="lp-h3" id="combo-title"><span className="lp-h2__name">Combo Planner.</span> <span className="lp-h2__rest">Not sure which CUET subjects to pick?</span></h3>
                <p>Choose your DU goals and available subjects. Compare five-paper combinations against the published 2026 rules before you fill the CUET form.</p>
              </div>
              <Link href="/cuet-subject-combination" className="mm-btn mm-btn--secondary">Plan my subjects</Link>
            </aside>
            <CollegeDestinations />
          </div>
        </section>

        <ExamComparator />

        {/* ------------------------------ PROOF ----------------------------- */}
        <section className="lp-sec lp-sec--tight">
          <div className="mm-wrap">
            <LiveStatsBand />
          </div>
        </section>

        {/* ------------------------------ INSTAGRAM ------------------------------ */}
        <section className="lp-sec" id="on-instagram">
          <div className="mm-wrap">
            <div className="lp-head lp-head--left">
              <h2 className="lp-h2"><span className="lp-h2__name">MockMob on Instagram.</span> <span className="lp-h2__rest">Featured by CUET creators.</span></h2>
              <p className="lp-sub">DU seniors and admissions creators have put MockMob in front of their audiences. Press Watch to see a reel right here.</p>
            </div>
            <Reveal delay={100}><CreatorReels items={rankedReels()} profileUrl={INSTAGRAM.url} handle={INSTAGRAM.handle} asOf={STATS_AS_OF} /></Reveal>
          </div>
        </section>

        {/* ----------------------------- WALL OF LOVE ----------------------------- */}
        {WALL_VOICES.length > 0 ? (
          <section className="lp-sec" id="wall-of-love">
            <div className="mm-wrap">
              <div className="lp-head lp-head--left">
                <h2 className="lp-h2"><span className="lp-h2__name">Wall of love.</span> <span className="lp-h2__rest">What students say.</span></h2>
              </div>
              <Reveal delay={100}><WallOfLove voices={WALL_VOICES} /></Reveal>
            </div>
          </section>
        ) : null}

        {/* ------------------------------ PRICING --------------------------- */}
        <section className="lp-sec" id="pricing">
          <div className="mm-wrap">
            <div className="lp-head lp-head--left">
              <h2 className="lp-h2"><span className="lp-h2__name">Start free.</span> <span className="lp-h2__rest">Go Pro when you want more room.</span></h2>
              <p className="lp-sub">{OFFER.purchasable === 'monthly' ? `Pro is ₹${OFFER.monthly.rupees} a month. Cancel any month and keep what you paid for.` : `Monthly Pro, ₹${OFFER.monthly.rupees} a month, opens soon. Pay ₹${OFFER.oneTime.rupees} once now and keep access through ${OFFER.oneTime.expires}.`}</p>
            </div>
            {/* Two plain columns split by one hairline. Pro is set apart by the size of its price, not a frame. */}
            <div className="lp-plans">
              <div className="lp-plan">
                <h3 className="lp-h3">Free</h3>
                <p className="lp-plan__price">₹0</p>
                <ul className="lp-plan__list">
                  {freePlan.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <Link href="/signup" className="mm-btn mm-btn--secondary">Start free</Link>
              </div>
              <div className="lp-plan lp-plan--pro">
                <h3 className="lp-h3">Pro</h3>
                <p className="lp-plan__price">₹{OFFER.purchasable === 'monthly' ? OFFER.monthly.rupees : OFFER.oneTime.rupees}<span>{OFFER.purchasable === 'monthly' ? ' a month' : ' once'}</span></p>
                <p className="lp-plan__note">{OFFER.purchasable === 'monthly' ? 'Renews monthly. Cancel anytime in Account.' : `Access through ${OFFER.oneTime.expires}. This payment does not renew.`}</p>
                <ul className="lp-plan__list">
                  <li className="lp-plan__lead">Everything in Free</li>
                  {proPlan.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <Link href="/pricing" className="mm-btn mm-btn--primary">{OFFER.purchasable === 'monthly' ? `Go Pro for ₹${OFFER.monthly.rupees}/month` : 'See Pro'}</Link>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------- FAQ ----------------------------- */}
        <section className="lp-sec lp-sec--band lp-faq" aria-labelledby="faq-title">
          <div className="mm-wrap">
            <div className="lp-faq__grid">
              <h2 className="lp-h2" id="faq-title"><span className="lp-h2__name">Questions.</span> <span className="lp-h2__rest">Before your first mock.</span></h2>
              <div className="mm-faqs">
                {faqs.map(({ question, answer }) => (
                  <details key={question} className="mm-faq">
                    <summary>{question}</summary>
                    <div className="mm-faq__body">{answer}</div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------- CLOSE ---------------------------- */}
        {/* The page's last word: the line on the left, the one key on the right where Mobi lands (no caption). */}
        <section className="lp-close" aria-labelledby="close-title">
          <div className="mm-wrap">
            <div className="lp-close__inner">
              <div className="lp-close__copy">
                <h2 className="lp-h2 lp-h2--xl" id="close-title"><span className="lp-h2__name">Five questions.</span> <span className="lp-h2__rest">Then your next move.</span></h2>
                <p className="lp-sub">Answer five now. Start free when you want MockMob to keep your record.</p>
              </div>
              <div className="lp-close__act">
                <MascotSeat station="close" pose="greeting" />
                <CloseActions />
              </div>
            </div>
          </div>
          {/* Every same-page "Try a CUET question" link lands on the live sample question, every time. */}
          <DemoJump />
        </section>
      </main>
      <MarketingFooter />
      <PipGuide />
      {/* The phone bar waits until the hero's buttons have gone, steps aside while the demo, the DU teaser or the close band's actions hold the screen, and carries Mobi. Its keys follow the visitor: new, answered some, signed in. */}
      <noscript><style>{'.lp-dockgate .mm-dock{opacity:1!important;transform:none!important;pointer-events:auto!important}'}</style></noscript>
      <LandingDock />
    </div>
  );
}
