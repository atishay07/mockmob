import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import { Fragment } from 'react';
import Link from 'next/link';
import { CAPABILITIES, recoveryReleased, newOfferReleased } from '@/../data/capabilities';
import { publicOffer } from '@/lib/payments/offer';
import STUDY_RELEASE from '@/../data/study/release.json';
import { SUBJECT_CLAIM } from '@/../data/subject_claim';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { LandingActions } from '@/components/LandingActions';
import { DemoDrill } from '@/components/landing/DemoDrill';
import { CloseActions, CloseSheet } from '@/components/landing/CloseActions';
import { LandingDock } from '@/components/landing/LandingDock';
import { DemoJump } from '@/components/landing/DemoJump';
import { HashSettle } from '@/components/landing/HashSettle';
import { HeroRoom } from '@/components/landing/HeroRoom';
import HeroMobi from '@/components/landing/HeroMobi';
import { MobiPoster } from '@/components/landing/MobiPoster';
import { DESK_NOTE, HERO_FEATURES_LABEL, heroFeatures, heroPriceHook } from '@/components/landing/heroTaps.mjs';
import HeroBeatStrip from '@/components/landing/HeroBeatStrip';
import { BrandTexture } from '@/components/landing/BrandTexture';
import { HERO_LEAD, STATEMENT, LAB_HEAD, TOUR_HEAD, RECOVERY_HEAD, COMPASS_HEAD, DU_HEAD, INSTAGRAM_HEAD, WALL_HEAD, BRAND_STAMPS, FAQ_HEAD, CLOSE, COMPASS_PRO, COMBO, buildFaqs, buildTour } from '@/components/landing/homeCopy.mjs';
import { HeroDockGate } from '@/components/landing/HeroDockGate';
import { HERO_LINES } from '@/components/landing/heroLines.mjs';
import { Reveal } from '@/components/landing/Reveal';
import { HomePricing } from '@/components/landing/HomePricing';
import { referralsLive } from '@/lib/referrals/friendInvite.mjs';
import { EligibilityTeaser } from '@/components/du/EligibilityTeaser';
import { CollegeDestinations } from '@/components/landing/CollegeDestinations';
import { ExamScreen } from '@/components/landing/ExamScreen';
import OpeningMo from '@/components/landing/OpeningMo';
import HeroTyped from '@/components/landing/HeroTyped';
import { HomeFonts } from '@/components/landing/HomeFonts';
import { Statement } from '@/components/landing/Statement';
import { MobiPoseSprite } from '@/components/brand/MobiPoseSprite';
import FeatureTour from '@/components/landing/FeatureTour';
import MistakeLab from '@/components/landing/MistakeLab';
import LabCinema from '@/components/landing/LabCinema';
import { SectionPosition } from '@/components/landing/SectionPosition';
import { objectStage } from '@/components/brand/ObjectLifeModel.mjs';
import { subjectArt } from '@/../data/subject_art.mjs';
import { FIRST_FULL_MOCK_COPY, FIRST_FULL_MOCK_ON } from '@/../data/first_full_mock';
import { publishedVoices } from '@/lib/voices';
import { INSTAGRAM, STATS_AS_OF, rankedReels } from '@/lib/social';
import { buildCompassShowcase } from '@/lib/du/showcase';
import CompassLadder from '@/components/landing/CompassLadder';
import CreatorReels from '@/components/landing/CreatorReels';
import { MascotSeat } from '@/components/brand/Mascot';
import PipGuide from '@/components/brand/PipGuideLazy';
import WallOfLove from '@/components/landing/WallOfLove';
import { BrandStamp } from '@/components/landing/BrandStamp';
import KeyCardsDemo from '@/components/landing/KeyCardsDemo';
import { keyCardsDemo } from '@/components/landing/keyCardsPicks.mjs';
import { KEY_CARDS_HEAD } from '@/components/landing/keyCardsCopy.mjs';
import { BrandIcon } from '@/components/brand/BrandIcon';
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
import '@/components/brand/mobi-figure.css';
import './hero-scene.css';
import './desktop-scale.css';
// Round 4 (6 Nov 2026): every section under the hero laid out again for desktop and phones; loaded last (home-sections.css).
import './home-sections.css';

// The page's words live in homeCopy.mjs (1104 P5, LK71: budgets tested in landingCopy.test.mjs); page.js renders them.
// The free first full mock (C-dec 1) is said only while its switch is on (FIRST_FULL_MOCK_ENABLED, data/first_full_mock.js).

const OFFER = publicOffer();
// When this page was built: the months to CUET in the price comparison and the one-time offer's days start here (value.mjs).
const BUILT = new Date();
// The close band's invite line, only while friend invites are on (the same switch /signup reads); never a code on this page.
const INVITES_LIVE = referralsLive();
const SHOWCASE = buildCompassShowcase();
const WALL_VOICES = publishedVoices();
// The held stories, as the position band under the site bar names them while one runs (SectionPosition). Each name is
// the words of its section's own heading: the Mistake Lab's kicker, the tour's title, the Recovery Lab's kicker.
const POSITION = [
  { id: 'inside-the-lab', name: 'Inside the Mistake Lab' },
  { id: 'your-prep', name: <>What’s inside <em>MockMob</em></> },
  { id: 'score-recovery-lab', name: 'Score Recovery Lab' },
];

// The statement (homeCopy.mjs STATEMENT) scrubs word by word with the scroll (on phones it holds the screen while it
// does). Words marked with * carry the accent.
// The four launch papers as the app's lamp-lit objects. Each lands on its shadow from its own height as the
// statement scrolls: depth is how far it falls (px), tilt how far it turns on the way. base is where the
// object's contact shadow ends, as a share of its square box, so on phones the name sits right under it.
const shelfBase = (id) => {
  const stage = objectStage(subjectArt(id));
  return stage ? ((stage.contact.cy + stage.contact.ry) / 100).toFixed(3) : '0.9';
};
// The picture's drawn width for the srcset: the shelf box (--shelf-obj, home.css and hero-depth.css: at most 42vw
// on phones, 11.5rem on desktop, up to 15rem (270 px) from 1440 px, home-sections.css) times the share of the box the object
// fills. Without it a phone fetched the 512 px file for a 130 px object.
const shelfSizes = (id) => {
  const share = (objectStage(subjectArt(id))?.box.width ?? 100) / 100;
  return `(max-width: 959px) ${Math.ceil(42 * share)}vw, (min-width: 1440px) ${Math.ceil(270 * share)}px, ${Math.ceil(184 * share)}px`;
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
// The feature tour: every product area, one idea per slide (homeCopy.mjs buildTour; the rail draws each slide's desk
// object, BrandIcon). Screens are labelled illustrations (TourScreens.jsx, keyed by id). Learn and the Mob appear only
// while they are live, from the same switches their pages read.
const TOUR = buildTour({ studyLive: STUDY_LIVE, studyLessons: STUDY_LESSONS, studySubjects: STUDY_SUBJECTS, mobLive: MOB_LIVE });

// Key cards (R3-D10, LK112): five real cards from the app's decks, read once at build (keyCardsPicks.mjs), shown only while
// Key cards are live for students (KEY_CARDS_ENABLED, the switch every Key cards route reads). No card readable, no section.
const KEY_CARDS_LIVE = process.env.KEY_CARDS_ENABLED === 'true';
const KEY_CARDS = KEY_CARDS_LIVE ? keyCardsDemo() : null;
const faqs = buildFaqs({ offer: OFFER, mobLive: MOB_LIVE });
// The hero's features strip and its price hook (round 4, owner LK124; docs/design-decisions/web-r4-hero.md): the main
// features, each a link to its own section on this page (Compass falls back to the DU calculator, Key cards only while
// their section is drawn), and "As low as ₹X a mock" worked out from the live offer at the pricing slider's top pace.
const FEATURES = heroFeatures({ compass: SHOWCASE.programmes.length > 0, keyCards: Boolean(KEY_CARDS) });
const PRICE_HOOK = heroPriceHook(OFFER, { from: BUILT });

export default function LandingPage() {
  return (
    <div className="mm lp">
      {/* The opening (OpeningMo, P3): the app's "mo" opening, first child of the page; its gate decides first / short / skip. */}
      <OpeningMo />
      <HomeFonts />
      <JsonLd id="home-breadcrumb-json-ld" data={breadcrumbJsonLd([{ name: 'Home', path: '/' }])} />
      <JsonLd id="home-faq-json-ld" data={faqJsonLd(faqs)} />
      <noscript>
        <style>{'.rv,.rv-item,.lp-hero [data-hero]{opacity:1!important;transform:none!important}.lp-room__file{opacity:1!important}'}</style>
      </noscript>
      <NavBar />
      <SectionPosition sections={POSITION} />
      <main id="main-content">
        {/* ------------------------------ HERO ------------------------------ */}
        {/* Desk Light (4 Nov 2026, SPEC-HOME-1104 P2; LK67, LK70), calmer in round 3 (R3-D3, LK99/LK100), and in round 4
            (owner LK117-LK124, LK133, 5 Nov; docs/design-decisions/web-r4-hero.md) made to fill a desktop screen: one
            hero idea at every width. The words first: the headline with "CUET 2027." a step larger in the brand colour, the
            sentence that says what MockMob is, the volt "Sign up free" key with "Try 5 questions first" under it and one
            "Have an account? Log in" line (LK83/LK88; the fact line went, LK121). Then the desk: Mobi in his lamp-lit room
            (HeroRoom, HeroMobi) offering a CUET question (DemoDrill, the card attached to the room's foot). Then the
            features strip (HeroBeatStrip: the main features, each a link, and the honest price hook, LK124) and the two
            hero links. Phones stack it; from 960 px the desk is the right column and the strip and links sit under the
            keys (hero-scene.css, desktop-scale.css). Behind it, the paper's own grain (BrandTexture, LK117; round 5 replaced
            the answer-sheet bubbles the owner found "very weird"). */}
        <section className="lp-hero">
          <BrandTexture variant="hero" />
          <div className="mm-wrap lp-hero__grid">
            <div className="lp-hero__copy">
              <h1 className="lp-title">
                {recoveryReleased() ? <><span className="lp-title__line">Find the mistake</span>{' '}<span className="lp-title__line">behind the marks.</span></> : <>
                {/* Three block lines with a space between them, so a screen reader and a search engine read the sentence
                    "CUET 2027. One mock. Know what to fix." (HERO_SENTENCE); the h1 is the page's largest paint. */}
                <span className="lp-title__line lp-title__brand">{HERO_LINES[0]}</span>{' '}
                <span className="lp-title__line">{HERO_LINES[1]}</span>{' '}
                {/* The third line types once and rests on HERO_LINES[2] (HeroTyped, P3); its server text is that line. */}
                <HeroTyped />
                </>}
              </h1>
              <p className="lp-lead">
                {recoveryReleased() ? 'Find the missing step. Practise it. Check it on fresh questions. Built for CUET Commerce and English.' : <><b>{HERO_LEAD.strong}</b>{HERO_LEAD.rest}</>}
              </p>
              <div className="lp-cta">
                <LandingActions />
              </div>
            </div>

            <div className="lp-desk" id="try-practice">
              <div className="lp-desk__stage">
                <HeroRoom />
                <HeroMobi poster={<MobiPoster id="desk" />} />
              </div>
              <div className="lp-desk__card">
                <DemoDrill note={DESK_NOTE} />
                {/* The note is one even line with no link (LK83/LK84): sign-up is the hero's volt key, and the card's own
                    end state offers it after the fifth answer. */}
              </div>
            </div>

            {/* The features strip (LK124): the main features, each a link, then "As low as ₹X a mock" from the live offer. */}
            <HeroBeatStrip items={FEATURES} label={HERO_FEATURES_LABEL} hook={PRICE_HOOK} />

            <div className="lp-hero__links">
              <Link href="/cuet-cutoff-calculator" className="lp-hero__tool">Free DU eligibility and cutoff calculator</Link>
              <a href="#exam-experience" className="lp-hero__exam-link">Try the exam-day screen</a>
            </div>
          </div>
        </section>

        {/* ----------------------- STATEMENT (a 4-step held story on phones, a scrub on desktop) -------------------- */}
        <Statement text={STATEMENT} shelf={SHELF} note={`${SUBJECT_CLAIM.long}.`} />

        {/* ------------------- MISTAKE LAB CINEMA (held scroll story) ------------------ */}
        <section className="lp-sec lp-sec--cinema lp-pos-host" id="inside-the-lab" aria-labelledby="inside-the-lab-title">
          {/* Without JavaScript the held stories (ScrollStory) simply scroll as plain sections. */}
          <noscript><style>{'.ss .ss__track{height:auto!important}.ss .ss__stage{position:static!important;height:auto!important}'}</style></noscript>
          <div className="mm-wrap">
            <Reveal className="lp-head lp-head--left lp-cinema-head">
              <BrandStamp {...BRAND_STAMPS.lab} />
              <h2 className="lp-h2" id="inside-the-lab-title">{LAB_HEAD.h2}</h2>
              <p className="lp-sub">{LAB_HEAD.sub}</p>
            </Reveal>
          </div>
          <LabCinema />
        </section>

        {/* --------------------------- FEATURE TOUR -------------------------- */}
        <section className="lp-sec lp-sec--tour lp-pos-host" id="your-prep">
          <div className="mm-wrap">
            <Reveal className="lp-head lp-head--left">
              <h2 className="lp-h2">{TOUR_HEAD.h2}</h2>
              <p className="lp-sub">{TOUR_HEAD.sub}</p>
            </Reveal>
            <FeatureTour slides={TOUR} />
          </div>
        </section>

        {/* ------------------------- SCORE RECOVERY LAB --------------------- */}
        <section className="lp-sec lp-pos-host" id="score-recovery-lab">
          <div className="mm-wrap">
            <div className="lp-guide-head"><Reveal className="lp-head lp-head--left">
              <BrandStamp {...BRAND_STAMPS.recovery} />
              <h2 className="lp-h2">{RECOVERY_HEAD.h2}</h2>
              <p className="lp-sub">{RECOVERY_HEAD.sub}</p>
            </Reveal><MascotSeat station="lab" pose="encouraging" label="Let’s find the lost marks." /></div>
            <MistakeLab recoveryState={CAPABILITIES.recovery.state} recoveryReason={CAPABILITIES.recovery.reason} />
          </div>
        </section>

        {/* ------------------------------ KEY CARDS ------------------------------ */}
        {/* R3-D10 (owner LK112, 5 Nov 2026): a real card that turns over in 3D, glass over its subject object, rated with the
            app's keys; the bank's true numbers count up once (LoadingKit). The stamp is the product's name (R3-D2). */}
        {KEY_CARDS ? (
          <section className="lp-sec lp-kc" id="key-cards" aria-labelledby="key-cards-title">
            <div className="mm-wrap lp-kc__grid">
              <Reveal className="lp-head lp-head--left lp-kc__head">
                <p className="lp-kc__stamp"><BrandIcon name="keycards" size={32} style={{ '--bi-size': '28px' }} />{KEY_CARDS_HEAD.stamp}</p>
                <h2 className="lp-h2" id="key-cards-title">{KEY_CARDS_HEAD.h2}</h2>
                <p className="lp-sub">{KEY_CARDS_HEAD.sub}</p>
              </Reveal>
              <KeyCardsDemo cards={KEY_CARDS.cards} keys={KEY_CARDS.keys} bank={KEY_CARDS.bank} />
            </div>
          </section>
        ) : null}

        {/* ---------------------------- COMPASS LADDER ---------------------------- */}
        {SHOWCASE.programmes.length > 0 ? (
          <section className="lp-sec" id="compass">
            <div className="mm-wrap">
              <div className="lp-guide-head lp-guide-head--lead"><Reveal className="lp-head lp-head--left">
                <BrandStamp {...BRAND_STAMPS.compass} />
                <h2 className="lp-h2">{COMPASS_HEAD.h2}</h2>
                <p className="lp-sub">{COMPASS_HEAD.sub}</p>
              </Reveal><MascotSeat station="compass" pose="pointing" label="Got a dream college? Let’s look." /></div>
              <Reveal delay={100}><CompassLadder data={SHOWCASE} /></Reveal>
              <Reveal as="aside" className="lp-cpro" aria-label="Compass Pro">
                <div className="lp-cpro__copy">
                  <p className="lp-cpro__badge">{COMPASS_PRO.badge}</p>
                  <h3 className="lp-h3">{COMPASS_PRO.title}</h3>
                  <p>{COMPASS_PRO.body}</p>
                  <Link href="/pricing" className="lp-link" data-commerce="">{COMPASS_PRO.cta}</Link>
                </div>
                <ul className="lp-cpro__list">
                  {COMPASS_PRO.items.map(([title, line]) => <li key={title}><b>{title}</b><span>{line}</span></li>)}
                </ul>
                <p className="lp-cpro__fine">{COMPASS_PRO.fine}</p>
              </Reveal>
            </div>
          </section>
        ) : null}

        {/* ------------------------- FREE DU CALCULATOR --------------------- */}
        <section className="lp-sec" id="du-eligibility">
          <div className="mm-wrap">
            <MascotSeat station="eligibility" pose="pointing" label="Leave the counting to me." className="pip-seat--utility" />
            <Reveal className="lp-head">
              <h2 className="lp-h2">{DU_HEAD.h2}</h2>
              <p className="lp-sub">{DU_HEAD.sub}</p>
            </Reveal>
            {/* The calculator is a tool, so it is simply there when the reader arrives: no reveal fade in front of it (LK93:
                the section read as loading slowly). Its section is also drawn ahead while the page is idle (EligibilityTeaser). */}
            <EligibilityTeaser />
            <Reveal as="aside" className="lp-combo" aria-label="CUET subject combination planner">
              <div>
                <p className="lp-cpro__badge">{COMBO.badge}</p>
                <h3 className="lp-h3">{COMBO.title}</h3>
                <p>{COMBO.body}</p>
              </div>
              <Link href="/cuet-subject-combination" className="mm-btn mm-btn--secondary">{COMBO.cta}</Link>
            </Reveal>
            <CollegeDestinations />
          </div>
        </section>

        <ExamScreen />

        {/* The numbers band (bank size, subjects, the price) went in R3-D7 (owner LK107): its true counts are lines of the one
            plan in #pricing now, with their count-up (PlanCounts), and the price is the plan's own. */}

        {/* ------------------------------ INSTAGRAM ------------------------------ */}
        <section className="lp-sec" id="on-instagram">
          <div className="mm-wrap">
            <Reveal className="lp-head lp-head--left">
              <BrandStamp {...BRAND_STAMPS.instagram} />
              <h2 className="lp-h2">{INSTAGRAM_HEAD.h2}</h2>
              <p className="lp-sub">{INSTAGRAM_HEAD.sub}</p>
            </Reveal>
            <Reveal delay={100}><CreatorReels items={rankedReels()} profileUrl={INSTAGRAM.url} handle={INSTAGRAM.handle} asOf={STATS_AS_OF} /></Reveal>
          </div>
        </section>

        {/* ----------------------------- WALL OF LOVE ----------------------------- */}
        {WALL_VOICES.length > 0 ? (
          <section className="lp-sec" id="wall-of-love">
            <div className="mm-wrap">
              <Reveal className="lp-head lp-head--left">
                <BrandStamp {...BRAND_STAMPS.wall} />
                <h2 className="lp-h2">{WALL_HEAD.h2}</h2>
              </Reveal>
              <Reveal delay={100}><WallOfLove voices={WALL_VOICES} /></Reveal>
            </div>
          </section>
        ) : null}

        {/* ------------------------------ PRICING --------------------------- */}
        {/* R3-D8 (owner LK109-LK111), R4-H7 (LK130-LK132): the /pricing page's one plan as a glass card under "Pro" and, round 5
            (owner, 6 Nov 2026), the receipt of everything it covers at your pace (HomePricing.jsx), counting the Key cards bank
            only while Key cards are live. Every rupee figure is the offer's, worked out, never typed. */}
        <section className="lp-sec lp-sec--price" id="pricing" data-commerce="">
          <HomePricing offer={OFFER} newOffer={newOfferReleased()} firstFullMock={FIRST_FULL_MOCK_ON ? FIRST_FULL_MOCK_COPY.plan : null} from={BUILT} keyCards={KEY_CARDS ? KEY_CARDS.bank : null}
            seat={<MascotSeat station="pricing" pose="attentive" label="No rush. Free stays free." className="pip-seat--utility" />} />
        </section>

        {/* -------------------------------- FAQ ----------------------------- */}
        <section className="lp-sec lp-sec--band" id="faq">
          <div className="mm-wrap mm-wrap--tight">
            <Reveal><h2 className="lp-h2">{FAQ_HEAD.h2}</h2></Reveal>
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
        {/* The final card (R3-D9, owner LK110): Mobi and the brand's own answer sheet (the OMR texture, neutral rings with a few
            pencil marks, CloseActions.jsx) in place of the generic grid and dots; Sign up free and Log in as before; while invites
            are on, one line on where a friend's invite code goes (never a code on this page). */}
        <section className="lp-close">
          <CloseSheet />
          <Reveal className="mm-wrap lp-close__inner">
            <MascotSeat station="close" pose="celebrating" label={CLOSE.mobi} />
            <h2 className="lp-h2 lp-h2--xl">{CLOSE.h2}</h2>
            <p className="lp-sub">{CLOSE.sub}</p>
            <CloseActions invites={INVITES_LIVE} />
          </Reveal>
          {/* Every same-page link to the sample ("Try 5 questions first") lands on the live sample question, every time. */}
          <DemoJump />
          {/* The footer's Help sends guests to /#faq from any page: land on the questions once the page has settled. */}
          <HashSettle />
        </section>
      </main>
      <MarketingFooter />
      {/* Every Mobi seat on the page is a <use> of these generated poses (one finish, one copy). */}
      <MobiPoseSprite />
      <PipGuide />
      {/* The phone bar (a guest: "Log in" and "Sign up free", never relabelled) waits until the hero's buttons have gone and steps aside while the demo, the DU teaser or the close band's actions hold the screen. It carries no Mobi: he lives in the sections' own seats, so one Mobi is ever in view (W-074). */}
      <noscript><style>{'.lp-dockgate .mm-dock{opacity:1!important;transform:none!important;pointer-events:auto!important}'}</style></noscript>
      <HeroDockGate>
        <LandingDock />
      </HeroDockGate>
    </div>
  );
}
