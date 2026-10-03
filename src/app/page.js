import Link from 'next/link';
import { CAPABILITIES, recoveryReleased, newOfferReleased } from '@/../data/capabilities';
import { publicOffer } from '@/lib/payments/offer';
import { ArrowRight, ArrowUpRight, Check, History, Bookmark, Trophy, Monitor, Target, GraduationCap, ShieldCheck } from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { LandingActions } from '@/components/LandingActions';
import { PrepOSOrb } from '@/components/ui/PrepOSOrb';
import { DemoDrill } from '@/components/landing/DemoDrill';
import { HeroBackdrop } from '@/components/landing/HeroBackdrop';
import { Reveal } from '@/components/landing/Reveal';
import { LiveStatsBand } from '@/components/landing/LiveStatsBand';
import { EligibilityTeaser } from '@/components/du/EligibilityTeaser';
import { CollegeDestinations } from '@/components/landing/CollegeDestinations';
import { ExamComparator } from '@/components/landing/ExamComparator';
import { ChapterReadout } from '@/components/landing/ChapterReadout';
import { SubjectGrid } from '@/components/landing/SubjectGrid';
import { ArenaScreen, CompassScreen, PlanScreen } from '@/components/landing/ProductScreens';
import MistakeLab from '@/components/landing/MistakeLab';
import { publishedVoices } from '@/lib/voices';
import { INSTAGRAM, STATS_AS_OF, rankedReels } from '@/lib/social';
import { buildCompassShowcase, duIndexFacts } from '@/lib/du/showcase';
import CompassLadder from '@/components/landing/CompassLadder';
import CreatorReels from '@/components/landing/CreatorReels';
import { MascotSeat } from '@/components/brand/Mascot';
import PipGuide from '@/components/brand/PipGuide';
import WallOfLove from '@/components/landing/WallOfLove';
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/seo';
import './landing.css';
import './home-refinements.css';
import './mistake-lab.css';
import './compass-ladder.css';
import './social-proof.css';
import './hero-depth.css';

const MARQUEE = [
  'English', 'Accountancy', 'Business Studies', 'Economics', 'History', 'Political Science', 'Psychology',
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'General Test',
];

const steps = [
  ['Pick a subject and a pace', 'A five-question drill tonight, or a full 50-question, 60-minute mock at the weekend.', 'pick'],
  ['Practise against the clock', 'Every answer is scored on the server. Reload mid-session and you resume where you left off.', 'time'],
  ['Fix the chapter, not the score', 'Review explanations and follow the same next action in Today, Radar and PrepOS.', 'fix'],
];

function StepVisual({ kind }) {
  if (kind === 'pick') {
    return (
      <div className="lp-stepvis" aria-hidden="true">
        <span>Accountancy</span>
        <span data-on="true">Partnership</span>
        <span>20 questions</span>
      </div>
    );
  }
  if (kind === 'time') {
    return (
      <div className="lp-stepvis lp-stepvis--timer" aria-hidden="true">
        <span className="mm-measure">38:12 left</span>
        <i className="lp-stepvis__track"><b /></i>
      </div>
    );
  }
  return (
    <div className="lp-stepvis lp-stepvis--bars" aria-hidden="true">
      <i style={{ '--w': '38%' }} data-low="true" />
      <i style={{ '--w': '61%' }} />
      <i style={{ '--w': '84%' }} />
    </div>
  );
}

const freePlan = newOfferReleased() ? ['One baseline per launch subject', 'One included daily 10-question set', 'One new recovery episode per week', 'Fresh checks for started episodes', '25 saved questions'] : [
  'Quick Practice and Full Mock on credits',
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
const DU_FACTS = duIndexFacts();

// The statement scrubs word by word with the scroll. Words marked with * carry the accent.
const STATEMENT = 'One mock. A clearer *next step. See what cost you marks, choose a chapter for *tonight, and check the DU subject rules behind your *shortlist.';

const faqs = [
  { question: 'Can I try it before signing up?', answer: 'Yes. Try five original sample questions here. They show how practice feels, not a subject diagnosis or an official previous-year paper.' },
  { question: 'What is MockMob built for?', answer: `CUET UG practice, review and one shared next action. ${recoveryReleased() ? 'Recovery pathways support' : 'Recovery content is being prepared for'} English, Accountancy, Business Studies and Economics. DU guidance uses sourced eligibility and historical cutoffs.` },
  { question: 'What is Score Recovery Lab?', answer: recoveryReleased() ? 'Investigate a specific reasoning gap, complete the missing step and return for fresh unassisted checks. Five questions are an initial signal, not a complete subject diagnosis.' : 'A reasoning-repair workflow being built around source-backed probes, interactive repair and fresh delayed checks. It remains unavailable while sources, calibration and the authenticated journey are checked. The decision replay shown here is an illustrative example.' },
  { question: 'What does Pro cost?', answer: OFFER.purchasable === 'monthly' ? `₹${OFFER.monthly.rupees} a month. It renews until you cancel in Account, and you keep Pro to the end of the month you paid for.` : `Monthly Pro at ₹${OFFER.monthly.rupees} a month is opening soon. Until then, ₹${OFFER.oneTime.rupees} once covers access through ${OFFER.oneTime.expires}, with no auto-renewal. Whoever pays now keeps the full term.` },
  { question: 'Is MockMob affiliated with NTA or DU?', answer: 'No. MockMob is independent. Practice scores and DU guidance cannot guarantee a result or admission. The 2027 exam details remain provisional until officially confirmed.' },
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
              </a><MascotSeat station="hero" pose="greeting" label="Pip’s on your side." note="Even at 11pm." eager /></div>
              <h1 className="lp-title">
                {recoveryReleased() ? <><span className="lp-title__line">Find the mistake</span><span className="lp-title__line">behind the marks.</span></> : <>
                <span className="lp-title__line">CUET 2027.</span>
                <span className="lp-title__line">One mock.</span>
                <span className="lp-title__line lp-title__morph">A clearer next step.</span>
                </>}
              </h1>
              <p className="lp-lead" data-hero style={{ '--h': 1 }}>
                {recoveryReleased() ? 'Find the missing step. Practise it. Check it on fresh questions. Built for CUET Commerce and English.' : 'Take a timed session. Review the answers you missed. Choose what to practise next in English, Accountancy, Business Studies and Economics.'}
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
              <div className="lp-stage__path"><span>01 · Answer</span><i /><span>02 · Read the explanation</span></div>
              <p className="lp-stage__note">
                Five original sample questions. No signup. Not an official PYQ or a scored diagnostic.
              </p>
            </div>
          </div>

          {/* Second hero beat: real, linked facts on a glass dock over the hero's light. */}
          <div className="mm-wrap">
            <nav className="lp-proof" aria-label="Why students pick MockMob" data-hero style={{ '--h': 5 }}>
              <a href="#try-practice"><Target size={18} aria-hidden="true" /><b>5 questions</b><span>Try the sample before you sign up</span></a>
              {DU_FACTS ? <a href="#du-eligibility"><GraduationCap size={18} aria-hidden="true" /><b>{DU_FACTS.programmes}</b><span>DU programmes · check subject rules free</span></a> : null}
              <a href="#exam-experience"><Monitor size={18} aria-hidden="true" /><b>2 screens</b><span>MockMob or NTA style · your choice</span></a>
              <a href="#how-it-works"><ShieldCheck size={18} aria-hidden="true" /><b>60 min</b><span>50 questions · one full CUET mock</span></a>
            </nav>
          </div>
        </section>

        {/* ----------------------- STATEMENT (scroll-scrubbed) -------------------- */}
        <section className="lp-statement" aria-label="What MockMob does">
          <div className="mm-wrap">
            <p className="lp-statement__text">
              {STATEMENT.split(' ').map((word, i, all) => (
                <span key={i} className="lp-statement__w" data-accent={word.startsWith('*') || undefined} style={{ '--p': (i / (all.length - 1)).toFixed(3) }}>
                  {word.replace('*', '')}{i < all.length - 1 ? ' ' : ''}
                </span>
              ))}
            </p>
          </div>
        </section>

        {/* ------------------------- SCORE RECOVERY LAB --------------------- */}
        <section className="lp-sec" id="score-recovery-lab">
          <div className="mm-wrap">
            <div className="lp-guide-head"><Reveal className="lp-head lp-head--left">
              <p className="lp-kicker">Mistake lab</p>
              <h2 className="lp-h2">See exactly where your marks went.</h2>
              <p className="lp-sub">
                Replay the answer changes, slow questions and skips. Then pick one useful move. The example below shows how.
              </p>
            </Reveal><MascotSeat station="lab" pose="attentive" label="Read the pattern." note="Replay, then choose a step." /></div>
            <Reveal delay={100}>
              <MistakeLab recoveryState={CAPABILITIES.recovery.state} recoveryReason={CAPABILITIES.recovery.reason} />
            </Reveal>
          </div>
        </section>

        {/* ----------------------------- MARQUEE ---------------------------- */}
        <div className="lp-marquee" aria-label="CUET subjects you can practise">
          <div className="lp-marquee__track" aria-hidden="true">
            {[...MARQUEE, ...MARQUEE].map((name, i) => (
              <span key={`${name}-${i}`}>{name}</span>
            ))}
          </div>
          <ul className="lp-sr">{MARQUEE.map((name) => <li key={name}>{name}</li>)}</ul>
        </div>

        {/* ---------------------------- COMPASS LADDER ---------------------------- */}
        {SHOWCASE.programmes.length > 0 ? (
          <section className="lp-sec" id="compass">
            <div className="mm-wrap">
              <div className="lp-guide-head lp-guide-head--lead"><Reveal className="lp-head lp-head--left">
                <p className="lp-kicker">DU Compass</p>
                <h2 className="lp-h2">Put your shortlist beside the numbers.</h2>
                <p className="lp-sub">
                  Compare a score with published 2026 DU cutoffs, by college, category and round. Historical context for your plan, not an admission promise.
                </p>
              </Reveal><MascotSeat station="compass" pose="pointing" label="Check the source." note="Keep the goal in view." /></div>
              <Reveal delay={100}><CompassLadder data={SHOWCASE} /></Reveal>
              <Reveal as="aside" className="lp-cpro" aria-label="Compass Pro">
                <div className="lp-cpro__copy">
                  <p className="lp-cpro__badge">Compass Pro</p>
                  <h3 className="lp-h3">Your practice, mapped to the colleges you want.</h3>
                  <p>Turn your recorded practice into a paper-by-paper range. Compare it with your DU shortlist and see which paper has the most room to improve.</p>
                  <Link href="/pricing" className="lp-link">See what Pro includes<ArrowRight size={16} aria-hidden="true" /></Link>
                </div>
                <ul className="lp-cpro__list">
                  <li><b>Practice projection</b><span>Each paper out of 250, from your attempt rate and accuracy, with an honest range.</span></li>
                  <li><b>Your DU shortlist</b><span>Up to 8 college and programme targets, compared with Rounds I to III.</span></li>
                  <li><b>Next move</b><span>The paper with the most marks open, and its weakest chapter.</span></li>
                </ul>
                <p className="lp-cpro__fine">A projection from your own record, not a prediction or an admission chance. The cutoff comparison above stays free.</p>
              </Reveal>
            </div>
          </section>
        ) : null}

        {/* ------------------------- FREE DU CALCULATOR --------------------- */}
        <section className="lp-sec" id="du-eligibility">
          <div className="mm-wrap">
            <MascotSeat station="eligibility" pose="pointing" label="Start with your subjects." note="Eligibility is not admission." className="pip-seat--utility" />
            <Reveal className="lp-head">
              <h2 className="lp-h2">Which DU courses fit your subjects?</h2>
              <p className="lp-sub">
                Tick your subjects. Check the published 2026 subject rules, then compare college cutoffs in your category. Free to use. Eligibility is not admission.
              </p>
            </Reveal>
            <Reveal>
              <EligibilityTeaser />
            </Reveal>
            <Reveal as="aside" className="lp-combo" aria-label="CUET subject combination planner">
              <div>
                <p className="lp-cpro__badge">New · Combo Planner</p>
                <h3 className="lp-h3">Not sure which CUET subjects to pick?</h3>
                <p>Choose your DU goals and available subjects. Compare five-paper combinations against the published 2026 rules before you fill the CUET form. Recheck when 2027 rules arrive.</p>
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

        {/* ------------------------------ BENTO ----------------------------- */}
        <section className="lp-sec" id="your-prep">
          <div className="mm-wrap">
            <Reveal className="lp-head">
              <h2 className="lp-h2">A clearer plan, from practice to your shortlist.</h2>
              <p className="lp-sub">
                Practise, find the weak chapter, plan the next session, and check which Delhi University courses your subjects unlock.
                The screens below are illustrative; yours fill in from your own attempts.
              </p>
            </Reveal>

            <div className="lp-bento">
              <Reveal as="article" className="lp-tile lp-tile--arena">
                <div className="lp-tile__copy">
                  <h3 className="lp-h3">Arena. Practice that fits your day.</h3>
                  <p>Choose subject, chapter and pace. Start with a short drill, or sit a full 50-question, 60-minute mock in an interface built to feel like the real thing.</p>
                  <Link href="/dashboard" className="lp-link">Open the Arena<ArrowRight size={16} aria-hidden="true" /></Link>
                </div>
                <div className="lp-tile__media"><ArenaScreen /></div>
              </Reveal>

              <Reveal as="article" className="lp-tile lp-tile--radar" delay={90}>
                <div className="lp-tile__copy">
                  <h3 className="lp-h3">Radar. Know which chapter to fix first.</h3>
                  <p>A score is only a number. Radar maps every miss back to a chapter so tonight’s session has a target.</p>
                  <Link href="/analytics" className="lp-link">Explore Radar<ArrowRight size={16} aria-hidden="true" /></Link>
                </div>
                <div className="lp-tile__media"><ChapterReadout /></div>
              </Reveal>

              <Reveal as="article" className="lp-tile lp-tile--prepos">
                <div className="lp-tile__copy">
                  <div className="lp-tile__orb"><PrepOSOrb size={52} /></div>
                  <h3 className="lp-h3">PrepOS. Your record, explained.</h3>
                  <p>Ask what to do next. PrepOS reads your sessions and shows the leak, the pace problem and the one step to take, the same step you see in Today and Radar. The basics of your record are free and use no credits; Pro adds the full chapter list, pace and changed-answer detail.</p>
                  <Link href="/mentor" className="lp-link">Meet PrepOS<ArrowRight size={16} aria-hidden="true" /></Link>
                </div>
                <div className="lp-tile__media"><PlanScreen /></div>
              </Reveal>

              <Reveal as="article" className="lp-tile lp-tile--compass" delay={90}>
                <div className="lp-tile__copy">
                  <h3 className="lp-h3">Admission Compass. Keep the college goal in view.</h3>
                  <p>Check programme eligibility and published DU cutoffs free. With Pro, Compass projects your practice paper by paper and maps it to your shortlist of colleges.</p>
                  <ul className="lp-ticks">
                    <li><Check size={16} aria-hidden="true" />Sourced historical cutoff comparisons</li>
                    <li><Check size={16} aria-hidden="true" />Subject and course eligibility</li>
                    <li><Check size={16} aria-hidden="true" />Pro: practice projection, DU shortlist, next move</li>
                  </ul>
                  <Link href="/admission-compass" className="lp-link">Open Compass<ArrowRight size={16} aria-hidden="true" /></Link>
                  <Link href="/cuet-cutoff-calculator" className="lp-link">See real DU cutoffs, free<ArrowRight size={16} aria-hidden="true" /></Link>
                </div>
                <div className="lp-tile__media"><CompassScreen /></div>
              </Reveal>

              <Reveal as="article" className="lp-tile lp-tile--mini">
                <History size={20} aria-hidden="true" />
                <h3 className="lp-h4">Mistake Replay</h3>
                <p>Reopen the questions that actually cost you marks and turn them into short drills.</p>
                <Link href="/review" className="lp-link">Review mistakes<ArrowRight size={16} aria-hidden="true" /></Link>
              </Reveal>
              <Reveal as="article" className="lp-tile lp-tile--mini" delay={80}>
                <Bookmark size={20} aria-hidden="true" />
                <h3 className="lp-h4">Saved questions</h3>
                <p>Keep the questions worth another look and revise them on your own schedule.</p>
                <Link href="/saved" className="lp-link">Open saved<ArrowRight size={16} aria-hidden="true" /></Link>
              </Reveal>
              <Reveal as="article" className="lp-tile lp-tile--mini" delay={160}>
                <Trophy size={20} aria-hidden="true" />
                <h3 className="lp-h4">Leaderboard and AI Rival</h3>
                <p>See how your scores stack up, then race a timed practice rival to train speed and nerve.</p>
                <Link href="/leaderboard" className="lp-link">See the board<ArrowRight size={16} aria-hidden="true" /></Link>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------------------------- HOW IT WORKS ------------------------ */}
        <section className="lp-sec lp-sec--band" id="how-it-works">
          <div className="mm-wrap">
            <Reveal className="lp-head">
              <h2 className="lp-h2">Practise. Review. Fix. Repeat until exam day.</h2>
            </Reveal>
            <Reveal as="ol" className="lp-steps">
              {steps.map(([title, body, kind], i) => (
                <li className="lp-step rv-item" style={{ '--i': i }} key={title}>
                  <span className="lp-step__num mm-measure">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="lp-h4">{title}</h3>
                  <p>{body}</p>
                  <StepVisual kind={kind} />
                </li>
              ))}
            </Reveal>
          </div>
        </section>

        {/* ------------------------------ SUBJECTS -------------------------- */}
        <section className="lp-sec lp-sec--band" id="subjects">
          <div className="mm-wrap">
            <Reveal className="lp-head">
              <h2 className="lp-h2">Start with the subjects that carry your score.</h2>
              <p className="lp-sub">
                Recovery is being prepared for four subjects. These counts describe ordinary practice, not complete recovery pathways.
              </p>
            </Reveal>
            <Reveal><SubjectGrid /></Reveal>
            <p className="lp-more">
              <Link href="/cuet-2027" className="lp-link">CUET 2027 guide<ArrowUpRight size={16} aria-hidden="true" /></Link>
              <Link href="/cuet-previous-year-questions" className="lp-link">Previous year questions<ArrowUpRight size={16} aria-hidden="true" /></Link>
              <Link href="/cuet-mock-test-free" className="lp-link">Free CUET mock test<ArrowUpRight size={16} aria-hidden="true" /></Link>
            </p>
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
            <MascotSeat station="pricing" pose="attentive" label="Take your time." note="The sample stays free." className="pip-seat--utility" />
            <Reveal className="lp-head">
              <h2 className="lp-h2">Start free. Go Pro when you want more room.</h2>
              <p className="lp-sub">{OFFER.purchasable === 'monthly' ? `Pro is ₹${OFFER.monthly.rupees} a month. Cancel any month and keep what you paid for.` : `One payment of ₹${OFFER.oneTime.rupees} covers you through ${OFFER.oneTime.expires}. Monthly Pro at ₹${OFFER.monthly.rupees} opens soon, and nobody who pays now loses a day.`}</p>
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
            <MascotSeat station="close" pose="greeting" label="See you in the Arena." note="Start with one session." />
            <h2 className="lp-h2 lp-h2--xl">Five questions. Then your next move.</h2>
            <p className="lp-sub">Try the sample now. Build your practice record when you’re ready.</p>
            <LandingActions mode="primary" />
          </Reveal>
        </section>
      </main>
      <MarketingFooter />
      <PipGuide />
      <MobileDock note={OFFER.purchasable === 'monthly' ? `Free to start. Pro ₹${OFFER.monthly.rupees}/month.` : 'Five sample questions. No signup.'} label="Try a CUET question" href="/#try-practice" />
    </div>
  );
}
