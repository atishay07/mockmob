import Link from 'next/link';
import { CAPABILITIES, recoveryReleased, newOfferReleased } from '@/../data/capabilities';
import { publicOffer } from '@/lib/payments/offer';
import { ArrowRight, Check, History, Timer, Wrench, Radar, Sparkles, Compass, Combine, Trophy, Monitor, Target, GraduationCap, ShieldCheck, BookOpenText } from 'lucide-react';
import STUDY_RELEASE from '@/../data/study/release.json';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { LandingActions } from '@/components/LandingActions';
import { DemoDrill } from '@/components/landing/DemoDrill';
import { CloseActions, DockLine } from '@/components/landing/CloseActions';
import { DemoJump } from '@/components/landing/DemoJump';
import { HeroBackdrop } from '@/components/landing/HeroBackdrop';
import { HeroDockGate, DockMobi } from '@/components/landing/HeroDockGate';
import { Reveal } from '@/components/landing/Reveal';
import { LiveStatsBand } from '@/components/landing/LiveStatsBand';
import { EligibilityTeaser } from '@/components/du/EligibilityTeaser';
import { CollegeDestinations } from '@/components/landing/CollegeDestinations';
import { ExamComparator } from '@/components/landing/ExamComparator';
import FeatureTour from '@/components/landing/FeatureTour';
import MistakeLab from '@/components/landing/MistakeLab';
import LabCinema from '@/components/landing/LabCinema';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { objectStage } from '@/components/brand/ObjectLifeModel.mjs';
import { subjectArt } from '@/../data/subject_art.mjs';
import { publishedVoices } from '@/lib/voices';
import { INSTAGRAM, STATS_AS_OF, rankedReels } from '@/lib/social';
import { buildCompassShowcase, duIndexFacts } from '@/lib/du/showcase';
import CompassLadder from '@/components/landing/CompassLadder';
import CreatorReels from '@/components/landing/CreatorReels';
import { MascotSeat } from '@/components/brand/Mascot';
import PipGuide from '@/components/brand/PipGuideLazy';
import WallOfLove from '@/components/landing/WallOfLove';
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

const freePlan = newOfferReleased() ? ['One baseline per launch subject', 'One included daily 10-question set', 'One new recovery episode per week', 'Fresh checks for started episodes', '25 saved questions'] : [
  'Quick practice and Full mock on credits',
  'Weekly progress tracking',
  '25 saved questions',
  'Leaderboard',
];
const proPlan = newOfferReleased() ? ['All available recovery pathways', 'Fresh delayed checks and full history', 'Unlimited available practice and reattempts', 'Full, Smart and NTA access', 'Unlimited saved questions'] : [
  'Unlimited Quick practice and Full mock',
  'Compass Pro: your practice mapped to your DU shortlist',
  'Smart practice and NTA mode',
  'Full chapter review: every ranked chapter, pace and changed answers',
  'Unlimited saved questions',
];

const OFFER = publicOffer();
const SHOWCASE = buildCompassShowcase();
const WALL_VOICES = publishedVoices();
const DU_FACTS = duIndexFacts();

// The statement scrubs word by word with the scroll (on phones it holds the screen while it does).
// Words marked with * carry the accent.
const STATEMENT = 'Your lost marks went somewhere. MockMob shows you *where, picks the chapter for *tonight, and keeps your DU *shortlist in sight.';
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
// chips say what is true of the product. Each slide's demo screen lives in TourScreens.jsx, keyed by id.
// Add `video: '/demos/<id>.mp4'` to a slide to play a real screen recording in its place.
const TOUR = [
  { id: 'arena', label: 'Practice', icon: <Timer size={18} aria-hidden="true" />, line: 'Drills and full mocks on the exam clock', kicker: 'Arena', title: 'Practise the way the exam runs.',
    body: 'A short drill for a free evening, or a full 50-question, 60-minute mock for the weekend. Same timer, same question palette, same pressure.',
    points: ['Quick drills and full mocks', 'NTA-style screen and Smart practice with Pro', 'Close the tab mid-test and pick up where you left off'], chip: 'Marked +5 / −1, the way CUET marks it.', href: '/dashboard', cta: 'Start practising' },
  { id: 'repair', label: 'Mistake Repair', icon: <Wrench size={18} aria-hidden="true" />, line: 'Fix why you got it wrong, not just the answer', kicker: 'Score Recovery', title: 'Fix why you missed it, not just what the answer was.',
    body: 'After a wrong answer, see why your pick was tempting, where it breaks and what to remember, written from the official key. If the AI’s own working disagrees with the key, you get no repair and no charge.',
    points: ['If the AI and the key disagree, we hold the question back and you pay nothing', 'A 10-minute next step, then 5 fresh questions to test the fix'], chip: 'The AI explains only once its answer matches the official key.', href: '/signup', cta: 'Try Mistake Repair' },
  ...(STUDY_LIVE && STUDY_LESSONS ? [{ id: 'learn', label: 'Learn', icon: <BookOpenText size={18} aria-hidden="true" />, line: 'Learn the idea, then keep it', kicker: 'Learn', title: 'Learn the idea behind the mark, then keep it.',
    body: 'Short lessons with worked examples and the common mistake, then recall cards that return before you are likely to forget. When a chapter keeps costing you marks, its lesson is linked from your result.',
    points: [`${STUDY_LESSONS} lessons across ${STUDY_SUBJECTS} subjects, with more on the way`, 'Lessons and recall are free and use no credits', 'Then practise the same chapter with marks'], chip: 'Made to sit beside your NCERT.', href: '/learn', cta: 'Open Learn' }] : []),
  { id: 'replay', label: 'Replay', icon: <History size={18} aria-hidden="true" />, line: 'See where the marks actually went', kicker: 'Mistake Replay', title: 'Replay a mock, answer by answer.',
    body: 'Every answer you changed, every question that ate your time, every skip, in the order it happened. Then turn the costly ones into a short drill.',
    points: ['An answer-by-answer timeline', 'Save any question to revisit later'], chip: 'The whole mock in order, so you pick what to fix.', href: '/review', cta: 'Review your mistakes' },
  { id: 'radar', label: 'Chapter review', icon: <Radar size={18} aria-hidden="true" />, line: 'The chapter to fix first', kicker: 'Chapter review', title: 'Know which chapter to fix first.',
    body: 'A score is just a number. Chapter review traces every miss back to its chapter, so tonight’s session has a target. Pro adds pace and changed-answer detail for every chapter.',
    points: ['Your weakest chapters, free after every mock', 'Built only from questions you attempted'], chip: 'Built from your attempts alone.', href: '/analytics', cta: 'See chapter review' },
  { id: 'prepos', label: 'Ask Mobi', icon: <Sparkles size={18} aria-hidden="true" />, line: 'Ask what to do tonight', kicker: 'Ask Mobi', title: 'Ask what to do tonight. Get one clear step.',
    body: 'Mobi reads your practice record and answers with the leak, the pace problem and a single next step: the same one you see on Today and in chapter review.',
    points: ['Questions about your own record are free', 'AI replies use monthly credits: 10 on Free, 50 on Pro', 'Answers come from your record, not a generic plan'], chip: 'One step for tonight, the same on Today and in chapter review.', href: '/mentor', cta: 'Ask Mobi' },
  { id: 'compass', label: 'DU Compass', icon: <Compass size={18} aria-hidden="true" />, line: 'Your shortlist against real DU cutoffs', kicker: 'Admission Compass', title: 'Test your DU shortlist against real cutoffs.',
    body: 'Compare a score with published 2026 DU cutoffs by college, category and round, free. With Pro, Compass turns your practice into a paper-by-paper range for your shortlist.',
    points: ['Programme eligibility rules, free', 'Pro: your practice projected onto your shortlist, and the paper to improve first'], chip: 'Your practice, set against DU’s published cutoffs.', href: '/admission-compass', cta: 'Open Compass' },
  { id: 'combo', label: 'Combo Planner', icon: <Combine size={18} aria-hidden="true" />, line: 'Choose your five CUET papers', kicker: 'Subject Combo Planner', title: 'Choosing five papers? Check the combination first.',
    body: 'Pick your DU goals and the subjects you can take, then see which five-paper combinations the published 2026 rules keep open.',
    points: ['Free to use', 'Compare combinations side by side'], chip: 'Tested against DU’s published 2026 rules.', href: '/cuet-subject-combination', cta: 'Plan my subjects' },
  { id: 'rival', label: 'Benchmarks', icon: <Trophy size={18} aria-hidden="true" />, line: 'Beat a target score under the clock', kicker: 'Benchmarks and leaderboard', title: 'Beat the score you’re aiming for.',
    body: 'Take a short timed run against a fixed target for accuracy and pace, set at daily, college or DU level. It shows whether you can hold that standard when the clock is running.',
    points: ['The daily benchmark is free', 'Every mock earns points for accuracy and speed on the leaderboard'], chip: 'Race a set target score against the clock.', href: '/leaderboard', cta: 'See the leaderboard' },
];

const faqs = [
  { question: 'Can I try it before signing up?', answer: 'Yes. Answer five CUET-style questions at the top of this page, each with the reasoning behind the answer. No account needed.' },
  { question: 'What is MockMob built for?', answer: 'Timed CUET UG practice, a clear read of every mistake, and one next step you can act on tonight. It is built first for English, Accountancy, Business Studies and Economics, with DU eligibility and published cutoffs alongside.' },
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
        <section className="lp-hero">
          <HeroBackdrop />
          <div className="mm-wrap lp-hero__grid">
            <div className="lp-hero__copy">
              <div className="lp-hero__greeting"><a href="#try-practice" className="lp-pill" data-hero style={{ '--h': 0 }}>
                <span className="lp-pill__dot" aria-hidden="true" />
                CUET UG 2027
                <ArrowRight size={14} aria-hidden="true" />
              </a><MascotSeat station="hero" pose="greeting" label="Mobi’s on your side." note="Even at 11pm." eager /></div>
              <h1 className="lp-title">
                {recoveryReleased() ? <><span className="lp-title__line">Find the mistake</span><span className="lp-title__line">behind the marks.</span></> : <>
                <span className="lp-title__line">CUET 2027.</span>
                <span className="lp-title__line">One mock.</span>
                <span className="lp-title__line lp-title__morph">A clearer next step.</span>
                </>}
              </h1>
              <p className="lp-lead" data-hero style={{ '--h': 1 }}>
                {recoveryReleased() ? 'Find the missing step. Practise it. Check it on fresh questions. Built for CUET Commerce and English.' : 'Take a timed mock. See where every mark went. Know what to practise tonight.'}
              </p>
              <div className="lp-cta" data-hero style={{ '--h': 2 }}>
                <LandingActions />
              </div>
              <ul className="lp-trust" data-hero style={{ '--h': 3 }}>
                <li><Check size={16} aria-hidden="true" />Free to start</li>
                <li><Check size={16} aria-hidden="true" />{OFFER.purchasable === 'monthly' ? `Pro ₹${OFFER.monthly.rupees} a month` : `Pro ₹${OFFER.oneTime.rupees} once, through ${OFFER.oneTime.expires}`}</li>
                <li><Check size={16} aria-hidden="true" />{OFFER.purchasable === 'monthly' ? 'Cancel anytime' : 'No auto-renewal'}</li>
              </ul>
              <Link href="/cuet-cutoff-calculator" className="lp-link lp-hero__tool" data-hero style={{ '--h': 4 }}>
                Free DU eligibility and cutoff calculator
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href="#exam-experience" className="lp-hero__exam-link"><Monitor size={16} aria-hidden="true" />Meet the exam before exam day<ArrowRight size={15} aria-hidden="true" /></a>
            </div>

            <div className="lp-stage" id="try-practice" data-hero style={{ '--h': 2 }}>
              <div className="lp-stage__heading"><span><span className="lp-stage__live" />Your first question starts here</span><span>No signup</span></div>
              <div className="lp-stage__card">
                <DemoDrill />
              </div>
              <div className="lp-stage__path"><span>Answer</span><i /><span>Read why it’s right</span></div>
              <p className="lp-stage__note">Five original CUET-style questions, each with the reasoning behind the answer.</p>
            </div>
          </div>

          {/* Second hero beat: real, linked facts on a glass dock over the hero's light. */}
          <div className="mm-wrap">
            <nav className="lp-proof" aria-label="Why students pick MockMob" data-hero style={{ '--h': 5 }}>
              <a href="#try-practice"><Target size={18} aria-hidden="true" /><b>5 questions</b><span>Try them before you sign up</span></a>
              {DU_FACTS ? <a href="#du-eligibility"><GraduationCap size={18} aria-hidden="true" /><b>{DU_FACTS.programmes}</b><span>DU programmes to check against your subjects</span></a> : null}
              <a href="#exam-experience"><Monitor size={18} aria-hidden="true" /><b>2 screens</b><span>MockMob or NTA style, your pick</span></a>
              <a href="#your-prep"><ShieldCheck size={18} aria-hidden="true" /><b>60 min</b><span>50 questions, one full CUET mock</span></a>
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
            <div className="lp-shelf">
              <ul className="lp-shelf__row" aria-label="Built first for CUET Commerce and English">
                {SHELF.map(({ id, name, href, depth, tilt, base, sizes }, i) => (
                  <li key={id} className="lp-shelf__item" style={{ '--k': i, '--depth': depth, '--tilt': `${tilt}deg`, '--base': base }}>
                    <Link href={href} className="lp-shelf__link">
                      <span className="lp-shelf__float"><SubjectObject id={id} size={184} sizes={sizes} lit={i === 1} className="lp-shelf__obj" style={{ '--obj-size': 'var(--shelf-obj)' }} /></span>
                      <span className="lp-shelf__name">{name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="lp-shelf__note">Built first for CUET Commerce and English.</p>
            </div>
          </div>
        </section>

        {/* ------------------- MISTAKE LAB CINEMA (held scroll story) ------------------ */}
        <section className="lp-sec lp-sec--cinema" id="inside-the-lab" aria-labelledby="inside-the-lab-title">
          {/* Without JavaScript the held stories (ScrollStory) simply scroll as plain sections. */}
          <noscript><style>{'.ss .ss__track{height:auto!important}.ss .ss__stage{position:static!important;height:auto!important}'}</style></noscript>
          <div className="mm-wrap">
            <Reveal className="lp-head lp-head--left lp-cinema-head">
              <p className="lp-kicker">Mistake Lab</p>
              <h2 className="lp-h2" id="inside-the-lab-title">Every mark, traced back to a moment.</h2>
              <p className="lp-sub">A score tells you how it went. The Lab shows why: the minutes, the second thoughts, the reason behind each miss, and the plan for the next mock.</p>
            </Reveal>
          </div>
          <LabCinema />
        </section>

        {/* --------------------------- FEATURE TOUR -------------------------- */}
        <section className="lp-sec lp-sec--tour" id="your-prep">
          <div className="mm-wrap">
            <Reveal className="lp-head lp-head--left">
              <h2 className="lp-h2">What’s inside MockMob.</h2>
              <p className="lp-sub">Practice, repair, replay and the plan that ties them together.</p>
            </Reveal>
            <FeatureTour slides={TOUR} />
          </div>
        </section>

        {/* ------------------------- SCORE RECOVERY LAB --------------------- */}
        <section className="lp-sec" id="score-recovery-lab">
          <div className="mm-wrap">
            <div className="lp-guide-head"><Reveal className="lp-head lp-head--left">
              <p className="lp-kicker">Score Recovery Lab</p>
              <h2 className="lp-h2">Fix it once. Check it holds.</h2>
              <p className="lp-sub">
                Replay the session, repair the leak, then prove it on fresh questions days later.
              </p>
            </Reveal><MascotSeat station="lab" pose="attentive" label="Let’s find the lost marks." /></div>
            <MistakeLab recoveryState={CAPABILITIES.recovery.state} recoveryReason={CAPABILITIES.recovery.reason} />
          </div>
        </section>

        {/* ---------------------------- COMPASS LADDER ---------------------------- */}
        {SHOWCASE.programmes.length > 0 ? (
          <section className="lp-sec" id="compass">
            <div className="mm-wrap">
              <div className="lp-guide-head lp-guide-head--lead"><Reveal className="lp-head lp-head--left">
                <p className="lp-kicker">DU Compass</p>
                <h2 className="lp-h2">Put your shortlist beside the numbers.</h2>
                <p className="lp-sub">
                  Slide a score and see which colleges it would have cleared in 2026, by category and round.
                </p>
              </Reveal><MascotSeat station="compass" pose="pointing" label="Got a dream college? Let’s look." /></div>
              <Reveal delay={100}><CompassLadder data={SHOWCASE} /></Reveal>
              <Reveal as="aside" className="lp-cpro" aria-label="Compass Pro">
                <div className="lp-cpro__copy">
                  <p className="lp-cpro__badge">Compass Pro</p>
                  <h3 className="lp-h3">Your practice, mapped to the colleges you want.</h3>
                  <p>Turn your recorded practice into a paper-by-paper range. Compare it with your DU shortlist and see which paper has the most room to improve.</p>
                  <Link href="/pricing" className="lp-link">See what Pro includes<ArrowRight size={16} aria-hidden="true" /></Link>
                </div>
                <ul className="lp-cpro__list">
                  <li><b>Practice projection</b><span>Each paper out of 250, from your attempt rate and accuracy, shown as a range.</span></li>
                  <li><b>Your DU shortlist</b><span>Up to 8 college and programme targets, compared with Rounds I to III.</span></li>
                  <li><b>Next move</b><span>The paper with the most marks open, and its weakest chapter.</span></li>
                </ul>
                <p className="lp-cpro__fine">Comparing cutoffs is free, always.</p>
              </Reveal>
            </div>
          </section>
        ) : null}

        {/* ------------------------- FREE DU CALCULATOR --------------------- */}
        <section className="lp-sec" id="du-eligibility">
          <div className="mm-wrap">
            <MascotSeat station="eligibility" pose="pointing" label="Leave the counting to me." className="pip-seat--utility" />
            <Reveal className="lp-head">
              <h2 className="lp-h2">Which DU courses fit your subjects?</h2>
              <p className="lp-sub">
                Tick your subjects to see every DU programme they open under the 2026 rules, then compare college cutoffs in your category. Free, no signup.
              </p>
            </Reveal>
            <Reveal>
              <EligibilityTeaser />
            </Reveal>
            <Reveal as="aside" className="lp-combo" aria-label="CUET subject combination planner">
              <div>
                <p className="lp-cpro__badge">Combo Planner</p>
                <h3 className="lp-h3">Not sure which CUET subjects to pick?</h3>
                <p>Choose your DU goals and available subjects. Compare five-paper combinations against the published 2026 rules before you fill the CUET form.</p>
              </div>
              <Link href="/cuet-subject-combination" className="mm-btn mm-btn--primary">Plan my subjects<ArrowRight size={17} aria-hidden="true" /></Link>
            </Reveal>
            <CollegeDestinations />
          </div>
        </section>

        <ExamComparator />

        {/* ------------------------------ PROOF ----------------------------- */}
        <section className="lp-sec lp-sec--tight">
          <div className="mm-wrap">
            <Reveal>
              <LiveStatsBand offer={OFFER} />
            </Reveal>
          </div>
        </section>

        {/* ------------------------------ INSTAGRAM ------------------------------ */}
        <section className="lp-sec" id="on-instagram">
          <div className="mm-wrap">
            <Reveal className="lp-head lp-head--left">
              <p className="lp-kicker">MockMob on Instagram</p>
              <h2 className="lp-h2">Featured by CUET creators.</h2>
              <p className="lp-sub">DU seniors and admissions creators have put MockMob in front of their audiences. Tap a reel to watch it here.</p>
            </Reveal>
            <Reveal delay={100}><CreatorReels items={rankedReels()} profileUrl={INSTAGRAM.url} handle={INSTAGRAM.handle} asOf={STATS_AS_OF} /></Reveal>
          </div>
        </section>

        {/* ----------------------------- WALL OF LOVE ----------------------------- */}
        {WALL_VOICES.length > 0 ? (
          <section className="lp-sec" id="wall-of-love">
            <div className="mm-wrap">
              <Reveal className="lp-head lp-head--left">
                <p className="lp-kicker">Wall of love</p>
                <h2 className="lp-h2">The mob speaks.</h2>
              </Reveal>
              <Reveal delay={100}><WallOfLove voices={WALL_VOICES} /></Reveal>
            </div>
          </section>
        ) : null}

        {/* ------------------------------ PRICING --------------------------- */}
        <section className="lp-sec" id="pricing">
          <div className="mm-wrap">
            <MascotSeat station="pricing" pose="attentive" label="No rush. Free stays free." className="pip-seat--utility" />
            <Reveal className="lp-head">
              <h2 className="lp-h2">Start free. Go Pro when you want more room.</h2>
              <p className="lp-sub">{OFFER.purchasable === 'monthly' ? `Pro is ₹${OFFER.monthly.rupees} a month. Cancel any month and keep what you paid for.` : `One payment of ₹${OFFER.oneTime.rupees} covers you through ${OFFER.oneTime.expires}. Monthly Pro at ₹${OFFER.monthly.rupees} is coming. Pay once now and keep every day you paid for.`}</p>
            </Reveal>
            <Reveal className="lp-plans">
              <div className="lp-plan">
                <h3 className="lp-h4">Free</h3>
                <p className="lp-plan__price mm-measure">₹0</p>
                <ul className="lp-ticks">
                  {freePlan.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}
                </ul>
                <Link href="/signup" className="mm-btn mm-btn--secondary">Start free</Link>
              </div>
              <div className="lp-plan lp-plan--pro">
                <h3 className="lp-h4">Pro</h3>
                <p className="lp-plan__price mm-measure">₹{OFFER.purchasable === 'monthly' ? OFFER.monthly.rupees : OFFER.oneTime.rupees}<span>{OFFER.purchasable === 'monthly' ? ' a month' : ' once'}</span></p>
                <p className="lp-plan__note">{OFFER.purchasable === 'monthly' ? 'Renews monthly. Cancel anytime in Account.' : `Access through ${OFFER.oneTime.expires}. This payment does not renew.`}</p>
                <ul className="lp-ticks">
                  <li><Check size={16} aria-hidden="true" />Everything in Free</li>
                  {proPlan.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}
                </ul>
                <Link href="/pricing" className="mm-btn mm-btn--primary">{OFFER.purchasable === 'monthly' ? `Go Pro for ₹${OFFER.monthly.rupees}/month` : 'See Pro'}<ArrowRight size={18} aria-hidden="true" /></Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* -------------------------------- FAQ ----------------------------- */}
        <section className="lp-sec lp-sec--band">
          <div className="mm-wrap mm-wrap--tight">
            <Reveal><h2 className="lp-h2">Before your first mock.</h2></Reveal>
            <Reveal className="mm-faqs">
              {faqs.map(({ question, answer }) => (
                <details key={question} className="mm-faq">
                  <summary>{question}</summary>
                  <div className="mm-faq__body">{answer}</div>
                </details>
              ))}
            </Reveal>
          </div>
        </section>

        {/* ------------------------------- CLOSE ---------------------------- */}
        <section className="lp-close">
          <div className="lp-bg lp-bg--static" aria-hidden="true">
            <div className="lp-bg__aurora" />
            <div className="lp-bg__grid" />
            <div className="lp-bg__dots" />
          </div>
          <Reveal className="mm-wrap lp-close__inner">
            <MascotSeat station="close" pose="greeting" label="See you at your first mock." />
            <h2 className="lp-h2 lp-h2--xl">Five questions. Then your next move.</h2>
            <p className="lp-sub">Answer five now. Sign up when you want MockMob to keep your record.</p>
            <CloseActions />
          </Reveal>
          {/* Every same-page "Try a CUET question" link lands on the live sample question, every time. */}
          <DemoJump />
        </section>
      </main>
      <MarketingFooter />
      <PipGuide />
      {/* The phone bar waits until the hero's buttons have gone, steps aside while the demo, the DU teaser or the close band's actions hold the screen, and carries Mobi. */}
      <noscript><style>{'.lp-dockgate .mm-dock{opacity:1!important;transform:none!important;pointer-events:auto!important}'}</style></noscript>
      <HeroDockGate>
        <MobileDock note={<DockMobi line={<DockLine />} />} label="Try a CUET question" href="/#try-practice" />
      </HeroDockGate>
    </div>
  );
}
