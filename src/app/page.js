import Link from 'next/link';
import { CAPABILITIES, recoveryReleased, newOfferReleased } from '@/../data/capabilities';
import { priceLine, publicOffer } from '@/lib/payments/offer';
import { Check, History, Timer, Wrench, Radar, Sparkles, Compass, Combine, Trophy, Monitor, BookOpenText, Users } from 'lucide-react';
import STUDY_RELEASE from '@/../data/study/release.json';
import { SUBJECT_CLAIM } from '@/../data/subject_claim';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { LandingActions } from '@/components/LandingActions';
import { DemoDrill } from '@/components/landing/DemoDrill';
import { CloseActions, DockLine } from '@/components/landing/CloseActions';
import { DemoJump } from '@/components/landing/DemoJump';
import { HashSettle } from '@/components/landing/HashSettle';
import { HeroBackdrop } from '@/components/landing/HeroBackdrop';
import { HeroDockGate } from '@/components/landing/HeroDockGate';
import { HeroMorph } from '@/components/landing/HeroMorph';
import { HeroLine } from '@/components/landing/HeroLine';
import { HERO_LINES, heroMotionMode } from '@/components/landing/heroPhrases.mjs';
import { Reveal } from '@/components/landing/Reveal';
import { LiveStatsBand } from '@/components/landing/LiveStatsBand';
import { QuestionBankLine } from '@/components/landing/QuestionBankLine';
import { EligibilityTeaser } from '@/components/du/EligibilityTeaser';
import { CollegeDestinations } from '@/components/landing/CollegeDestinations';
import { ExamComparator } from '@/components/landing/ExamComparator';
import FeatureTour from '@/components/landing/FeatureTour';
import MistakeLab from '@/components/landing/MistakeLab';
import LabCinema from '@/components/landing/LabCinema';
import { SectionPosition } from '@/components/landing/SectionPosition';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { objectStage } from '@/components/brand/ObjectLifeModel.mjs';
import { subjectArt } from '@/../data/subject_art.mjs';
import { FIRST_FULL_MOCK_COPY, FIRST_FULL_MOCK_ON } from '@/../data/first_full_mock';
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
import './hero-motion.css';

const freePlan = newOfferReleased() ? ['One baseline per launch subject', 'One included daily 10-question set', 'One new recovery episode per week', 'Fresh checks for started episodes', '25 saved questions'] : [
  'Quick practice and Full mock on credits',
  // The free first full mock (C-dec 1), only while its switch is on (FIRST_FULL_MOCK_ENABLED, data/first_full_mock.js).
  ...(FIRST_FULL_MOCK_ON ? [FIRST_FULL_MOCK_COPY.planItem] : []),
  'Weekly progress tracking',
  '25 saved questions',
  'Your standing',
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
// The held stories, as the position band under the site bar names them while one runs (SectionPosition). Each name is
// the words of its section's own heading: the Mistake Lab's kicker, the tour's title, the Recovery Lab's kicker.
const POSITION = [
  { id: 'inside-the-lab', name: 'Inside the Mistake Lab' },
  { id: 'your-prep', name: <>What’s inside <em>MockMob</em></> },
  { id: 'score-recovery-lab', name: 'Score Recovery Lab' },
];
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

// The Mob is marketed only while it is live for students: MOB_ENABLED opens /mob and MOB_V3_ENABLED its sprints,
// quests, chains and Fix it together (the same switches the Mob's own route and API read).
const MOB_LIVE = process.env.MOB_ENABLED === 'true' && process.env.MOB_V3_ENABLED === 'true';
// Learn is marketed only while study content is switched on; counts come from the release proof.
const STUDY_LIVE = process.env.STUDY_CONTENT_ENABLED === 'true' && process.env.STUDY_RECALL_ENABLED === 'true';
const STUDY_LESSONS = Object.keys(STUDY_RELEASE.units || {}).length;
const STUDY_SUBJECTS = new Set(Object.keys(STUDY_RELEASE.units || {}).map(id => id.split('-')[0])).size;
// The feature tour: every product area, one idea per slide. Screens are labelled illustrations; the
// chips say what is true of the product. Each slide's demo screen lives in TourScreens.jsx, keyed by id.
// Add `video: '/demos/<id>.mp4'` to a slide to play a real screen recording in its place.
const TOUR = [
  { id: 'arena', label: 'Practice', icon: <Timer size={18} aria-hidden="true" />, line: 'Drills and full mocks on the exam clock', kicker: 'Practice', title: 'Train on the exam’s own clock.',
    body: 'A short drill for a free evening, or a full 50-question, 60-minute mock for the weekend. Same timer, same question palette, same pressure.',
    points: ['Quick drills and full mocks', 'NTA-style screen and Smart practice with Pro', 'Close the tab mid-test and pick up where you left off'], chip: 'Marked +5 / −1, the way CUET marks it.', href: '/dashboard', cta: 'Start practising' },
  { id: 'repair', label: 'Mistake Repair', icon: <Wrench size={18} aria-hidden="true" />, line: 'Fix why you got it wrong, not just the answer', kicker: 'Score Recovery', title: 'Fix why you missed it. Not just the answer.',
    body: 'After a wrong answer, see why your pick was tempting, where it breaks and what to remember, all written from the official key. If the AI’s working can’t match the key, there’s no repair and no charge.',
    points: ['If the AI and the key disagree, we hold the question back and you pay nothing', 'A 10-minute next step, then 5 fresh questions to test the fix'], chip: 'The AI explains only once its answer matches the official key.', href: '/signup', cta: 'Try Mistake Repair' },
  ...(STUDY_LIVE && STUDY_LESSONS ? [{ id: 'learn', label: 'Learn', icon: <BookOpenText size={18} aria-hidden="true" />, line: 'Learn the idea, then keep it', kicker: 'Learn', title: 'Learn the idea behind the mark, then keep it.',
    body: 'Short lessons with worked examples and the common mistake, then recall cards that return before you are likely to forget. When a chapter keeps costing you marks, its lesson is linked from your result.',
    points: [`${STUDY_LESSONS} lessons across ${STUDY_SUBJECTS} subjects, with more on the way`, 'Lessons and recall are free and use no credits', 'Then practise the same chapter with marks'], chip: 'Made to sit beside your NCERT.', href: '/learn', cta: 'Open Learn' }] : []),
  { id: 'replay', label: 'Replay', icon: <History size={18} aria-hidden="true" />, line: 'See where the marks actually went', kicker: 'Mistake Replay', title: 'Replay your mock, move by move.',
    body: 'Every answer you changed, every question that ate your time, every skip, in the order it happened. Then turn the costly ones into a short drill.',
    points: ['An answer-by-answer timeline', 'Save any question to revisit later'], chip: 'The whole mock in order, so you pick what to fix.', href: '/review', cta: 'Review your mistakes' },
  { id: 'radar', label: 'Chapter review', icon: <Radar size={18} aria-hidden="true" />, line: 'The chapter to fix first', kicker: 'Chapter review', title: 'Know the chapter to fix first.',
    body: 'A score is just a number. Chapter review traces every miss to its chapter, so tonight has a target. Pro adds pace and changed-answer detail for every chapter.',
    points: ['Your weakest chapters, free after every mock', 'Built only from questions you attempted'], chip: 'Built from your attempts alone.', href: '/analytics', cta: 'See chapter review' },
  { id: 'prepos', label: 'Ask Mobi', icon: <Sparkles size={18} aria-hidden="true" />, line: 'Ask what to do tonight', kicker: 'Ask Mobi', title: 'Ask what to do tonight. Get one clear step.',
    body: 'Mobi reads your practice record and answers with the leak, the pace problem and a single next step: the same one you see on Today and in chapter review.',
    points: ['Questions about your own record are free', 'One credit buys a whole Mobi job, a mistake fixed for good or a doubt answered and tested, and every plan gets 50 free credits a month', 'Answers come from your record, not a generic plan'], chip: 'One step for tonight, the same on Today and in chapter review.', href: '/mentor', cta: 'Ask Mobi' },
  { id: 'compass', label: 'DU Compass', icon: <Compass size={18} aria-hidden="true" />, line: 'Your shortlist against real DU cutoffs', kicker: 'Admission Compass', title: 'Test your DU shortlist against real cutoffs.',
    body: 'Compare a score with published 2026 DU cutoffs by college, category and round, free. With Pro, Compass turns your practice into a paper-by-paper range for your shortlist.',
    points: ['Programme eligibility rules, free', 'Pro: your practice projected onto your shortlist, and the paper to improve first'], chip: 'Your practice, set against DU’s published cutoffs.', href: '/admission-compass', cta: 'Open Compass' },
  { id: 'combo', label: 'Combo Planner', icon: <Combine size={18} aria-hidden="true" />, line: 'Choose your five CUET papers', kicker: 'Subject Combo Planner', title: 'Picking five papers? Test the combination first.',
    body: 'Pick your DU goals and the subjects you can take, then see which five-paper combinations the published 2026 rules keep open.',
    points: ['Free to use', 'Compare combinations side by side'], chip: 'Tested against DU’s published 2026 rules.', href: '/cuet-subject-combination', cta: 'Plan my subjects' },
  { id: 'rival', label: 'Benchmarks', icon: <Trophy size={18} aria-hidden="true" />, line: 'Beat a target score under the clock', kicker: 'Benchmarks and your standing', title: 'Beat the score you’re aiming for.',
    body: 'Take a short timed run against a fixed target for accuracy and pace, set at daily, college or DU level. It shows whether you can hold that standard when the clock is running.',
    points: ['The daily benchmark is free', 'Every mock earns points for accuracy and speed toward your standing'], chip: 'Race a set target score against the clock.', href: '/leaderboard', cta: 'See your standing' },
  ...(MOB_LIVE ? [{ id: 'mob', label: 'The Mob', icon: <Users size={18} aria-hidden="true" />, line: 'Prep with your friends, on the same questions', kicker: 'The Mob', title: 'Bring your friends. Race the same questions.',
    body: 'Start a Mob and share its code. Everyone gets the same five questions for 24 hours and races the runs before them. After the game, Fix it together takes you back to the question that caught you and gives you a fresh one like it.',
    points: ['Play as a Fold, and earn new ones when your Mob finishes its weekly quest', 'Keep a chain going together, week after week', 'Turn sharing off and your marks stay private'], chip: 'Playing every game your Mob starts is free on every plan.', href: '/mob', cta: 'Open the Mob' }] : []),
];

const faqs = [
  { question: 'Can I try it before signing up?', answer: 'Yes. Answer five CUET-style questions at the top of this page, each with the reasoning behind the answer. No account needed.' },
  { question: 'What is MockMob built for?', answer: 'Timed CUET UG practice, a clear read of every mistake, and one next step you can act on tonight. It covers the 15 subjects behind 19 of every 20 CUET papers, with DU eligibility and published cutoffs alongside. Every mock is built fresh from one live question bank, and Pro puts no cap on how many you take.' },
  ...(MOB_LIVE ? [{ question: 'What is the Mob?', answer: 'Your study group inside MockMob. Start a Mob for a subject and share its code with friends. Everyone gets the same five questions for 24 hours, the podium shows how the runs compare, and after each game Fix it together gives you a fresh question like the one that caught you. A weekly quest and a chain keep the group going, and you can keep your marks private.' }] : []),
  { question: 'What is the Mistake Lab?', answer: 'After every mock, the Lab shows where your marks went: the time on each question, every answer you changed, the reason behind each miss, and a SWOT with the set to do next. Mistake Repair then fixes the reasoning, one mistake at a time.' },
  { question: 'What does Pro cost?', answer: OFFER.purchasable === 'monthly' ? `₹${OFFER.monthly.rupees} a month. It renews until you cancel in Account, and you keep Pro to the end of the month you paid for.` : `₹${OFFER.oneTime.rupees} once covers Pro through ${OFFER.oneTime.expires}, with no auto-renewal. Monthly Pro at ₹${OFFER.monthly.rupees} a month opens soon, and whoever pays now keeps the full term.` },
];

export default function LandingPage() {
  // D115: option C ("select and type") ships OFF. Everyone gets the released line; ?hero=v2 previews option C on any
  // build, production included, and HERO_MOTION_V2=1 switches it on for everyone after his OK (heroPhrases.mjs).
  const heroMotion = heroMotionMode(process.env);
  return (
    <div className="mm lp">
      <JsonLd id="home-breadcrumb-json-ld" data={breadcrumbJsonLd([{ name: 'Home', path: '/' }])} />
      <JsonLd id="home-faq-json-ld" data={faqJsonLd(faqs)} />
      <noscript>
        <style>{'.rv,.rv-item,.lp-hero [data-hero]{opacity:1!important;transform:none!important}'}</style>
      </noscript>
      <NavBar />
      <SectionPosition sections={POSITION} />
      <main id="main-content">
        {/* ------------------------------ HERO ------------------------------ */}
        <section className="lp-hero">
          <HeroBackdrop />
          <div className="mm-wrap lp-hero__grid">
            <div className="lp-hero__copy">
              <div className="lp-hero__greeting"><p className="lp-hero__for" data-hero style={{ '--h': 0 }}>For CUET UG 2027</p><MascotSeat station="hero" pose="greeting" label="Mobi’s on your side." note="Even at 11pm." eager /></div>
              <h1 className="lp-title">
                {recoveryReleased() ? <><span className="lp-title__line">Find the mistake</span><span className="lp-title__line">behind the marks.</span></> : <>
                {/* The two still lines run inline in the h1 with a break between them, so the browser counts them as one
                    paint (largest contentful paint) at first render. Each was its own block before, and the typed third
                    line, a new element every change, then out-sized either one and moved LCP to its first change
                    (about 3.2 s on a desktop): the page looked done at 0.5 s but measured slow. */}
                <span className="lp-title__line lp-title__line--run lp-title__brand">{HERO_LINES[0]}</span>{' '}<br />
                <span className="lp-title__line lp-title__line--run">{HERO_LINES[1]}</span>
                {heroMotion === 'v1' ? <HeroMorph /> : <HeroLine mode={heroMotion} />}
                </>}
              </h1>
              <p className="lp-lead" data-hero style={{ '--h': 1 }}>
                {recoveryReleased() ? 'Find the missing step. Practise it. Check it on fresh questions. Built for CUET Commerce and English.' : 'Take a timed mock. See exactly where every mark went. Fix the right chapter tonight.'}
              </p>
              <QuestionBankLine className="lp-bank" data-hero style={{ '--h': 1 }} />
              <div className="lp-cta" data-hero style={{ '--h': 2 }}>
                <LandingActions />
              </div>
              <ul className="lp-trust" data-hero style={{ '--h': 3 }}>
                <li><Check size={16} aria-hidden="true" />Free to start</li>
                <li><Check size={16} aria-hidden="true" />{priceLine(OFFER)}</li>
                <li><Check size={16} aria-hidden="true" />{OFFER.purchasable === 'monthly' ? 'Cancel anytime' : 'No auto-renewal'}</li>
              </ul>
              <Link href="/cuet-cutoff-calculator" className="lp-link lp-hero__tool" data-hero style={{ '--h': 4 }}>
                Free DU eligibility and cutoff calculator
              </Link>
              <a href="#exam-experience" className="lp-hero__exam-link"><Monitor size={16} aria-hidden="true" />Try the exam-day screen</a>
            </div>

            <div className="lp-stage" id="try-practice" data-hero style={{ '--h': 2 }}>
              <div className="lp-stage__heading"><span>Your first question. Go.</span><span>No signup</span></div>
              <div className="lp-stage__card">
                <DemoDrill />
              </div>
              <div className="lp-stage__path"><span>Answer</span><i /><span>Read why it’s right</span></div>
              <p className="lp-stage__note">Five original CUET-style questions. Every answer comes with the why.</p>
              <p className="lp-stage__other">Taking other subjects? <Link href="/signup">Sign up free and pick yours</Link></p>
            </div>
          </div>

          {/* Second hero beat: real, linked facts on a glass dock. Numbers and words only, no icon per fact (W-076: no icon grids). */}
          <div className="mm-wrap">
            <nav className="lp-proof" aria-label="Why students pick MockMob" data-hero style={{ '--h': 5 }}>
              <a href="#try-practice"><b>5 questions</b><span>Free to try, no signup</span></a>
              {DU_FACTS ? <a href="#du-eligibility"><b>{DU_FACTS.programmes}</b><span>DU programmes, matched to your subjects</span></a> : null}
              <a href="#exam-experience"><b>2 screens</b><span>Practise calm. Rehearse NTA style.</span></a>
              <a href="#your-prep"><b>60 min</b><span>50 questions on the full CUET clock</span></a>
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
              <ul className="lp-shelf__row" aria-label="Subjects with full NTA-pattern mocks">
                {SHELF.map(({ id, name, href, depth, tilt, base, sizes }, i) => (
                  <li key={id} className="lp-shelf__item" style={{ '--k': i, '--depth': depth, '--tilt': `${tilt}deg`, '--base': base }}>
                    <Link href={href} className="lp-shelf__link">
                      <span className="lp-shelf__float"><SubjectObject id={id} size={184} sizes={sizes} lit={i === 1} className="lp-shelf__obj" style={{ '--obj-size': 'var(--shelf-obj)' }} /></span>
                      <span className="lp-shelf__name">{name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="lp-shelf__note">{SUBJECT_CLAIM.long}.</p>
            </div>
          </div>
        </section>

        {/* ------------------- MISTAKE LAB CINEMA (held scroll story) ------------------ */}
        <section className="lp-sec lp-sec--cinema lp-pos-host" id="inside-the-lab" aria-labelledby="inside-the-lab-title">
          {/* Without JavaScript the held stories (ScrollStory) simply scroll as plain sections. */}
          <noscript><style>{'.ss .ss__track{height:auto!important}.ss .ss__stage{position:static!important;height:auto!important}'}</style></noscript>
          <div className="mm-wrap">
            <Reveal className="lp-head lp-head--left lp-cinema-head">
              <p className="lp-kicker">Mistake Lab</p>
              <h2 className="lp-h2" id="inside-the-lab-title">Every mark, traced back to a moment.</h2>
              <p className="lp-sub">Your score says how it went. The Lab says why: every minute, every second thought, the reason behind each miss, and the plan for your next mock.</p>
            </Reveal>
          </div>
          <LabCinema />
        </section>

        {/* --------------------------- FEATURE TOUR -------------------------- */}
        <section className="lp-sec lp-sec--tour lp-pos-host" id="your-prep">
          <div className="mm-wrap">
            <Reveal className="lp-head lp-head--left">
              <h2 className="lp-h2">What’s inside MockMob.</h2>
              <p className="lp-sub">Practise. Replay. Repair. Then one plan that ties it all together.</p>
            </Reveal>
            <FeatureTour slides={TOUR} />
          </div>
        </section>

        {/* ------------------------- SCORE RECOVERY LAB --------------------- */}
        <section className="lp-sec lp-pos-host" id="score-recovery-lab">
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
                <h2 className="lp-h2">Hold your shortlist up to real cutoffs.</h2>
                <p className="lp-sub">
                  Slide a score. See which colleges it would have cleared in 2026, by category and round.
                </p>
              </Reveal><MascotSeat station="compass" pose="pointing" label="Got a dream college? Let’s look." /></div>
              <Reveal delay={100}><CompassLadder data={SHOWCASE} /></Reveal>
              <Reveal as="aside" className="lp-cpro" aria-label="Compass Pro">
                <div className="lp-cpro__copy">
                  <p className="lp-cpro__badge">Compass Pro</p>
                  <h3 className="lp-h3">Your practice, mapped to the colleges you want.</h3>
                  <p>Turn your practice into a paper-by-paper range. Set it against your DU shortlist and see which paper has the most marks open.</p>
                  <Link href="/pricing" className="lp-link" data-commerce="">See what Pro includes</Link>
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
              <h2 className="lp-h2">Which DU courses are open to you?</h2>
              <p className="lp-sub">
                Tick your subjects. See every DU programme they open under the 2026 rules, then compare college cutoffs in your category. Free, no signup.
              </p>
            </Reveal>
            <Reveal>
              <EligibilityTeaser />
            </Reveal>
            <Reveal as="aside" className="lp-combo" aria-label="CUET subject combination planner">
              <div>
                <p className="lp-cpro__badge">Combo Planner</p>
                <h3 className="lp-h3">Five CUET subjects. Pick them right.</h3>
                <p>Set your DU goals and the subjects you can take. Compare five-paper combinations against the published 2026 rules before you fill the CUET form.</p>
              </div>
              <Link href="/cuet-subject-combination" className="mm-btn mm-btn--secondary">Plan my subjects</Link>
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
              <p className="lp-sub">DU seniors and admissions creators have put MockMob in front of their followers. Tap a reel and watch it right here.</p>
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
                <h2 className="lp-h2">Students, in their own words.</h2>
              </Reveal>
              <Reveal delay={100}><WallOfLove voices={WALL_VOICES} /></Reveal>
            </div>
          </section>
        ) : null}

        {/* ------------------------------ PRICING --------------------------- */}
        <section className="lp-sec" id="pricing" data-commerce="">
          <div className="mm-wrap">
            <MascotSeat station="pricing" pose="attentive" label="No rush. Free stays free." className="pip-seat--utility" />
            <Reveal className="lp-head">
              <h2 className="lp-h2">Start free. Go Pro for unlimited mocks.</h2>
              <p className="lp-sub">{OFFER.purchasable === 'monthly' ? `Pro is ₹${OFFER.monthly.rupees} a month. Cancel any month and keep what you paid for.` : `₹${OFFER.oneTime.rupees} once covers Pro through ${OFFER.oneTime.expires}. Monthly Pro at ₹${OFFER.monthly.rupees} is on the way. Pay once now and keep every day you paid for.`}</p>
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
                <Link href="/pricing" className="mm-btn mm-btn--primary">Get Pro</Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* -------------------------------- FAQ ----------------------------- */}
        <section className="lp-sec lp-sec--band" id="faq">
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
            <div className="lp-bg__grid" />
            <div className="lp-bg__dots" />
          </div>
          <Reveal className="mm-wrap lp-close__inner">
            <MascotSeat station="close" pose="greeting" label="See you at your first mock." />
            <h2 className="lp-h2 lp-h2--xl">Five questions. Your move.</h2>
            <p className="lp-sub">Answer five now. Sign up when you’re ready to keep score.</p>
            <CloseActions />
          </Reveal>
          {/* Every same-page "Try a CUET question" link lands on the live sample question, every time. */}
          <DemoJump />
          {/* The footer's Help sends guests to /#faq from any page: land on the questions once the page has settled. */}
          <HashSettle />
        </section>
      </main>
      <MarketingFooter />
      <PipGuide />
      {/* The phone bar waits until the hero's buttons have gone and steps aside while the demo, the DU teaser or the close band's actions hold the screen. It carries no Mobi: he lives in the sections' own seats, so one Mobi is ever in view (W-074). */}
      <noscript><style>{'.lp-dockgate .mm-dock{opacity:1!important;transform:none!important;pointer-events:auto!important}'}</style></noscript>
      <HeroDockGate>
        <MobileDock note={<span className="lp-dockmobi__line"><DockLine /></span>} label="Try a CUET question" href="/#try-practice" />
      </HeroDockGate>
    </div>
  );
}
