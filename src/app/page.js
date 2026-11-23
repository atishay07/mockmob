import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { recoveryReleased, newOfferReleased } from '@/../data/capabilities';
import { publicOffer } from '@/lib/payments/offer';
import { SUBJECT_CLAIM } from '@/../data/subject_claim';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { LandingActions } from '@/components/LandingActions';
import DailyFiveRow from '@/components/daily/DailyFiveRow';
import DailyHow from '@/components/daily/DailyHow';
import { COLLEGE_DAILY, PERSONAL_HEAD, STRIP_HEAD } from '@/components/daily/dailyStripCopy.mjs';
import { LandingDock } from '@/components/landing/LandingDock';
import { DemoJump } from '@/components/landing/DemoJump';
import { HashSettle } from '@/components/landing/HashSettle';
import { FunnelBeacon } from '@/components/landing/FunnelBeacon';
import { HeroRoom } from '@/components/landing/HeroRoom';
import HeroMobi from '@/components/landing/HeroMobi';
import { MobiPoster } from '@/components/landing/MobiPoster';
import { DESK_NOTE, HERO_FEATURES_LABEL, heroFeatures, heroPriceHook } from '@/components/landing/heroTaps.mjs';
import HeroBeatStrip from '@/components/landing/HeroBeatStrip';
import { HeroProof } from '@/components/landing/HeroProof';
import { BrandTexture, PageGrid } from '@/components/landing/BrandTexture';
import { HERO_LEAD, STATEMENT, TRY_HEAD, LAB_HEAD, COMPASS_HEAD, INSTAGRAM_HEAD, WALL_HEAD, BRAND_STAMPS, FAQ_HEAD, CLOSE, COMPASS_PRO, buildFaqs, buildTour } from '@/components/landing/homeCopy.mjs';
import { DesktopNote } from '@/components/landing/DesktopNote';
import HeroFilm from '@/components/landing/HeroFilm';
import { CollegeStrip } from '@/components/landing/CollegeStrip';
import { HERO_LINES } from '@/components/landing/heroLines.mjs';
import { Reveal } from '@/components/landing/Reveal';
import { HomePricing } from '@/components/landing/HomePricing';
import { referralsLive } from '@/lib/referrals/friendInvite.mjs';
import OpeningMo from '@/components/landing/OpeningMo';
import HeroTyped from '@/components/landing/HeroTyped';
import { HomeFonts } from '@/components/landing/HomeFonts';
import { Statement } from '@/components/landing/Statement';
import { Marked } from '@/components/doodle/Doodle';
import HeroMark from '@/components/landing/HeroMark';
import { SectionPosition } from '@/components/landing/SectionPosition';
import { objectStage } from '@/components/brand/ObjectLifeModel.mjs';
import { subjectArt } from '@/../data/subject_art.mjs';
import { FIRST_FULL_MOCK_COPY, FIRST_FULL_MOCK_ON } from '@/../data/first_full_mock';
import { publishedVoices } from '@/lib/voices';
import { INSTAGRAM, STATS_AS_OF, rankedReels } from '@/lib/social';
import { buildCompassShowcase } from '@/lib/du/showcase';
import CompassLadder from '@/components/landing/CompassLadder';
import { MascotSeat } from '@/components/brand/Mascot';
import PipGuide from '@/components/brand/PipGuideLazy';
import AskMobiSheet from '@/components/landing/AskMobiSheet';
import MobiCompanion from '@/components/landing/MobiCompanion';
import DesktopCursor from '@/components/landing/DesktopCursor';
import AssetWarm from '@/components/landing/AssetWarm';
import WallOfLove from '@/components/landing/WallOfLove';
import { BrandStamp } from '@/components/landing/BrandStamp';
import { MISTAKE_PHOTO_ON } from '@/../data/mistake_photo.mjs';
import { keyCardsDemo } from '@/components/landing/keyCardsPicks.mjs';
import { headPhrases } from '@/components/landing/keyCardsCopy.mjs';
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/seo';
import { AI_FREE_MONTHLY_CREDITS } from '@/services/credits/freeGrant.mjs';
import { DAILY_FIVE_SIZE } from '@/lib/dailyFive.mjs';
import { DemoDrill } from '@/components/landing/DemoDrill';
import { CloseActions } from '@/components/landing/CloseActions';
import { HeroDockGate } from '@/components/landing/HeroDockGate';
import AndroidAppNudge from '@/components/landing/AndroidAppNudge';
import CoverageProof from '@/components/landing/CoverageProof';
import LaunchFilmKey from '@/components/landing/LaunchFilmKey';
import LabCinema from '@/components/landing/LabCinema';
import CreatorReels from '@/components/landing/CreatorReels';
import OnePlaceGate from '@/components/landing/OnePlaceGate';
import { CREATORS_SUB, ONE_PLACE, freeFaq, mobiPrice } from '@/components/landing/onePlaceCopy.mjs';
import { publicSample } from '@/components/landing/sampleFive.mjs';
import STUDY_RELEASE from '@/../data/study/release.json';
import { MISTAKE_CREDITS, MISTAKE_PHOTO_CREDITS } from '@/services/mobi/mistakePrices.mjs';
// Shared with app pages: MobiFigure.jsx already loads it before this point, so this line only keeps it ahead of the sheets below.
import '@/components/brand/mobi-figure.css';
// The home page's own 24 sheets (landing.css ... r16-tour-stack.css), joined in their cascade order into one file, so a phone
// makes one render-blocking request for them instead of seven (paint pass, 15 Nov 2026). The list, its order and why are in
// src/lib/homeCss.mjs. Edit those sheets, never home-sheets.css: node scripts/gen-home-css.mjs rewrites it (next dev does too).
import './home-sheets.css';

// The home page (21 Nov 2026, owner: "Switch it live", after judging /home-next on his phone, LK363 and LK364). The tour deck,
// the Key cards section, Bring a mistake and the exam screen section are one frame, "Your whole CUET prep, in one place."
// (OnePlace.jsx), right after the five sample questions: six rows, each stage a real landing component (or the tour deck's
// own screen) worked by a demo cursor. The Mistake Lab plays its next look (LabCinema look="next"). The creators' line says
// the sign-up floor and the FAQ answers "What do I get free?". /home-next, where it was built, now redirects here
// (next.config.mjs). The page's title, description and canonical are the root layout's ("/").

// The page's words live in homeCopy.mjs (1104 P5, LK71: budgets tested in landingCopy.test.mjs); page.js renders them.
// The free first full mock (C-dec 1) is said only while its switch is on (FIRST_FULL_MOCK_ENABLED, data/first_full_mock.js).

// The page comes alive in pieces (19 Nov 2026, owner LK326: "the screen stutters in the first five [seconds]"). Measured that
// day on a throttled phone profile: React woke the whole page in ONE task of about 1.2 seconds, 2.7 seconds after the load,
// right as the opening handed over, and every animation on screen froze for it. Each block below the hero is its own
// Suspense boundary: its HTML is already in the page (nothing here ever shows a fallback), and React wakes each boundary
// in its own short piece of idle time, the hero first, a block the reader touches before the others.
const Later = ({ children }) => <Suspense fallback={null}>{children}</Suspense>;

const OFFER = publicOffer();
const dailyHead = COLLEGE_DAILY ? STRIP_HEAD : PERSONAL_HEAD;
// When this page was built: the months to CUET in the price comparison and the one-time offer's days start here (value.mjs).
const BUILT = new Date();
// The close band's invite line, only while friend invites are on (the same switch /signup reads); never a code on this page.
const INVITES_LIVE = referralsLive();
const SHOWCASE = buildCompassShowcase();
const WALL_VOICES = publishedVoices();
// The held stories, as the position band under the site bar names them while one runs (SectionPosition). Each name is
// the words of its section's own heading: the Mistake Lab's kicker, the tour's title. Round 11 (owner, 10 Nov 2026): the
// Score Recovery Lab told the Mistake Lab's feature a second time, so it is one Lab now (#inside-the-lab).
// On this page the Lab is the one held story (the tour deck that shared the band with it is gone).
const POSITION = [
  { id: 'inside-the-lab', name: 'Inside the Mistake Lab' },
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
// The one frame's rows 4 to 6 (owner LK364): Learn, Benchmarks and the Mob as the live home's tour builds them, from the same
// switches ("/" page.js TOUR), so a tool is shown only while it is live; the Mob's screen opens one of the sample's questions.
const STUDY_LESSONS = Object.keys(STUDY_RELEASE.units || {}).length;
const STUDY_SUBJECTS = new Set(Object.keys(STUDY_RELEASE.units || {}).map(id => id.split('-')[0])).size;
const TOUR = buildTour({ studyLive: STUDY_LIVE, studyLessons: STUDY_LESSONS, studySubjects: STUDY_SUBJECTS, mobLive: MOB_LIVE });
const TOUR_SAMPLES = MOB_LIVE ? { mob: publicSample('Economics') } : null;
// The Learn row story's foot line: the study release's lesson and subject counts (the tour slide's own first point).
const STUDY_COUNTS = { lessons: STUDY_LESSONS, subjects: STUDY_SUBJECTS };
// Ask Mobi's proof line: Bring a mistake's own credit line, from the app's prices and the free monthly credits (a photo is
// promised only while Mobi reads photos).
const MOBI_PRICE = mobiPrice({ photo: MISTAKE_PHOTO_ON, credits: MISTAKE_CREDITS, photoCredits: MISTAKE_PHOTO_CREDITS, free: AI_FREE_MONTHLY_CREDITS });
// Key cards (R3-D10, LK112): five real cards from the app's decks, read once at build (keyCardsPicks.mjs), shown only while
// Key cards are live for students (KEY_CARDS_ENABLED, the switch every Key cards route reads). No card readable, no section.
const KEY_CARDS_LIVE = process.env.KEY_CARDS_ENABLED === 'true';
const KEY_CARDS = KEY_CARDS_LIVE ? keyCardsDemo() : null;
// The FAQ as on "/", with "What do I get free?" after its first question, answered from the code's constants.
const faqs = (() => {
  const all = buildFaqs({ offer: OFFER, mobLive: MOB_LIVE });
  return [all[0], freeFaq({ freeCredits: AI_FREE_MONTHLY_CREDITS, dailySize: DAILY_FIVE_SIZE }), ...all.slice(1)];
})();
// The hero's features strip and its price hook (round 4, owner LK124; docs/design-decisions/web-r4-hero.md): the main
// features, each a link to its own section on this page (Compass falls back to the DU calculator, Key cards only while
// their section is drawn), and "As low as ₹X a mock" worked out from the live offer at the pricing slider's top pace.
const FEATURES = heroFeatures({ compass: SHOWCASE.programmes.length > 0, keyCards: Boolean(KEY_CARDS) });
const PRICE_HOOK = heroPriceHook(OFFER, { from: BUILT });
// The addresses a visitor arrives at from elsewhere (HashSettle): the FAQ, the one frame, and the frame's rows by their old
// sections' names (page.js keeps an anchor for each; the frame opens that row).
// 23 Nov 2026 (LK427): measured on a phone, /#compass stayed at the top of the page and /#pricing stopped a screen short (the
// sections above are drawn as they near the window, so the browser's own jump lands on a guess). They settle here too.
const HASH_IDS = ['faq', 'your-prep', 'exam-experience', 'key-cards', 'bring-a-mistake', 'cuet-2026', 'compass', 'pricing', 'daily-and-sunday'];

export default function LandingPage() {
  return (
    <div className="mm lp">
      {/* The opening (OpeningMo, P3): the app's "mo" opening, first child of the page; its gate decides first / short / skip. */}
      {/* fast (21 Nov 2026): it hands over as soon as the hero has painted; a weak device is clear within 800 ms. */}
      <OpeningMo fast />
      {/* The page's hairline grid, behind everything (10 Nov 2026; brand-texture.css). */}
      <PageGrid />
      <HomeFonts />
      {/* The landing's steps of the aggregate funnel (FunnelBeacon): step names only, counted while FUNNEL_ENABLED is on. */}
      <FunnelBeacon />
      <JsonLd id="home-breadcrumb-json-ld" data={breadcrumbJsonLd([{ name: 'Home', path: '/' }])} />
      <JsonLd id="home-faq-json-ld" data={faqJsonLd(faqs)} />
      <noscript>
        <style>{'.rv,.rv-item,.lp-hero [data-hero]{opacity:1!important;transform:none!important}.lp-room__file{opacity:1!important}.lp-film__keys{display:none}'}</style>
      </noscript>
      <NavBar />
      <SectionPosition sections={POSITION} />
      <main id="main-content">
        <DesktopNote />
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
            the answer-sheet bubbles the owner found "very weird").
            Round 7 (owner, 7 Nov 2026, after klayprep.com): the launch film (HeroFilm, hero-film.css) is the hero's picture in
            the desk's place: the right column from 960 px, under the keys on phones. The desk moved to section#try under the
            college strip (CollegeStrip), keeping id="try-practice". */}
        <section className="lp-hero">
          <BrandTexture variant="hero" />
          <div className="mm-wrap lp-hero__grid">
            <div className="lp-hero__copy">
              <h1 className="lp-title">
                {recoveryReleased() ? <><span className="lp-title__line">Find the mistake</span>{' '}<span className="lp-title__line">behind the marks.</span></> : <>
                {/* Three block lines with a space between them, so a screen reader and a search engine read the sentence
                    "CUET 2027. One mock. Know what to fix." (HERO_SENTENCE); the h1 is the page's largest paint. */}
                <span className="lp-title__line lp-title__brand">{HERO_LINES[0]}</span>{' '}
                <span className="lp-title__line"><HeroMark>{HERO_LINES[1]}</HeroMark></span>{' '}
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
              {/* Round 11 (10 Nov 2026): one quiet proof link under the ways in, to the creators section (HeroProof). */}
              <HeroProof />
            </div>

            {/* The film (round 7, owner 7 Nov 2026): the launch teaser plays muted as the hero's picture (HeroFilm). */}
            <HeroFilm />

            {/* The features strip (LK124): the main features, each a link, then "As low as ₹X a mock" from the live offer. */}
            <HeroBeatStrip items={FEATURES} label={HERO_FEATURES_LABEL} hook={PRICE_HOOK} />

            {/* Round 11: the exam-day screen moved into the strip, so the tray holds the DU calculator alone. */}
            <div className="lp-hero__links">
              <Link href="/cuet-cutoff-calculator" prefetch={false} className="lp-hero__tool">Free DU eligibility and cutoff calculator</Link>
              {/* The launch film (owner LK427, 23 Nov 2026): hidden until he switches it on; /?film=1 shows it to him. */}
              <LaunchFilmKey />
            </div>
          </div>
        </section>

        {/* ---------------------- COLLEGES (round 7: the CUET colleges' own emblems, owner 7 Nov) ---------------------- */}
        <Later><CollegeStrip /></Later>

        {/* ------------------------------ TRY FIVE QUESTIONS ------------------------------ */}
        {/* The desk moved out of the hero when the film took its place (round 7, 7 Nov 2026): Mobi in his lamp-lit room
            (HeroRoom, HeroMobi) offering the five CUET questions (DemoDrill, the card attached to the room's foot), under a
            short head, in one centred column. It keeps id="try-practice", so "Try 5 questions first" and every deep link
            (/#try-practice) still land on the card (DemoJump). */}
        <Later><section className="lp-sec lp-try" id="try" aria-labelledby="try-title">
          <div className="mm-wrap lp-try__wrap">
            <div className="lp-head lp-try__head">
              <h2 className="lp-h2" id="try-title"><Marked text={TRY_HEAD.h2} marks={[['five', { mark: 'double' }]]} /></h2>
              <p className="lp-sub">{TRY_HEAD.sub}</p>
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
          </div>
        </section></Later>

        {/* ----------------------- YOUR WHOLE CUET PREP, IN ONE PLACE (the one frame) ----------------------- */}
        {/* id "your-prep": the guide's waypoint (PipGuide.jsx WAYPOINTS) and Ask Mobi's no-script link. Six rows, one stage:
            the exam screen, Key cards, Bring a mistake's card, then Learn, Benchmarks and the Mob on the old tour deck's card,
            each worked by a demo cursor (OnePlace.jsx). Under it the one volt key. */}
        <Later><section className="lp-sec op" id="your-prep" aria-labelledby="op-title">
          {/* The addresses of the sections this frame replaced (the hero strip's links, the app's "/#exam-experience"): each lands
              here, and the frame opens that row (OnePlace.jsx ROW_OF_HASH). */}
          <span id="exam-experience" className="op-anchor" aria-hidden="true" />
          {KEY_CARDS ? <span id="key-cards" className="op-anchor" aria-hidden="true" /> : null}
          <span id="bring-a-mistake" className="op-anchor" aria-hidden="true" />
          <div className="mm-wrap">
            <Reveal className="lp-head lp-head--left">
              <h2 className="lp-h2" id="op-title"><Marked text={ONE_PLACE.h2} marks={[[ONE_PLACE.mark, { mark: 'underline', tone: 'brand' }]]} /></h2>
              <p className="lp-sub">{ONE_PLACE.sub}</p>
            </Reveal>
            <OnePlaceGate keyCards={KEY_CARDS} photo={MISTAKE_PHOTO_ON} price={MOBI_PRICE} tour={TOUR} samples={TOUR_SAMPLES} study={STUDY_COUNTS}>
              <LandingActions mode="primary" />
            </OnePlaceGate>
          </div>
        </section></Later>

        {/* ----------------------- STATEMENT (a 4-step held story on phones, a scrub on desktop) -------------------- */}
        <Later><Statement text={STATEMENT} shelf={SHELF} note={`${SUBJECT_CLAIM.long}.`} /></Later>

        {/* ------------------- MISTAKE LAB CINEMA (held scroll story) ------------------ */}
        <Later><section className="lp-sec lp-sec--cinema lp-pos-host" id="inside-the-lab" aria-labelledby="inside-the-lab-title">
          {/* Without JavaScript the held stories (ScrollStory) simply scroll as plain sections. */}
          <noscript><style>{'.ss .ss__track{height:auto!important}.ss .ss__stage{position:static!important;height:auto!important}'}</style></noscript>
          <div className="mm-wrap">
            <Reveal className="lp-head lp-head--left lp-cinema-head">
              <BrandStamp {...BRAND_STAMPS.lab} />
              <h2 className="lp-h2" id="inside-the-lab-title"><Marked text={LAB_HEAD.h2} marks={[['a moment.', { mark: 'squiggle', tone: 'brand' }]]} /></h2>
              <p className="lp-sub">{LAB_HEAD.sub}</p>
            </Reveal>
          </div>
          <LabCinema look="next" />
        </section></Later>

        {/* ------------------- THE WEEK'S TWO FIXED DATES: Daily Five and Sunday Mock ------------------- */}
        {/* 16 Nov 2026, evening (owner, after seeing them live on his phone under the sample): "consuming too much vertical
            space", "it should not be at the top. It can be somewhere else." So they stay here, after the practice features and
            before admissions. 10:25 pm, of the two short rows that followed: "a very small subsection, not something
            important". So the section heads like every other product on the page (a stamp over a full-size h2). 17 Nov 2026
            (LK293, "something unique"): the Daily Five is an admit card with "Playing for" a DU college and today's college
            board past its perforation, then the Sunday Mock's card (DailyFiveRow HomeBlock). */}
        <Later><section className="lp-sec lp-rhythm" id="daily-and-sunday" aria-labelledby="rhythm-title">
          <div className="mm-wrap">
            {/* 17 Nov 2026: Mobi holds up today's page of the calendar at the head's right (the new 3D art, LK294). */}
            <div className="lp-guide-head"><Reveal className="lp-head lp-head--left">
              <BrandStamp {...BRAND_STAMPS.rhythm} />
              <h2 className="lp-h2" id="rhythm-title">{headPhrases(dailyHead.h2).map((phrase, i, all) => <span key={phrase} className="lp-kc__phrase"><Marked text={i < all.length - 1 ? `${phrase} ` : phrase} marks={[[dailyHead.mark, { mark: 'highlight', tone: 'volt' }]]} /></span>)}</h2>
              <p className="lp-sub">{dailyHead.sub}</p>
            </Reveal><MascotSeat station="daily" pose="calendar" label="A new five every day." /></div>
            {/* How it works, as three small pictures (owner LK427, 23 Nov 2026): in the paragraph's place. */}
            {COLLEGE_DAILY ? null : <DailyHow />}
            <DailyFiveRow where="home" />
          </div>
        </section></Later>

        {/* ---------------------------- COMPASS LADDER ---------------------------- */}
        {SHOWCASE.programmes.length > 0 ? (
          <Later><section className="lp-sec" id="compass">
            <div className="mm-wrap">
              <div className="lp-guide-head lp-guide-head--lead"><Reveal className="lp-head lp-head--left">
                <BrandStamp {...BRAND_STAMPS.compass} />
                <h2 className="lp-h2"><Marked text={COMPASS_HEAD.h2} marks={[['real cutoffs.', { mark: 'double' }]]} /></h2>
                <p className="lp-sub">{COMPASS_HEAD.sub}</p>
              </Reveal><MascotSeat station="compass" pose="pointing" label="Got a dream college? Let’s look." /></div>
              <Reveal delay={100}><CompassLadder data={SHOWCASE} /></Reveal>
              {/* R19 (18 Nov 2026): Compass Pro is one line under the card with its link; what it adds opens below it. */}
              <Reveal as="aside" className="lp-cpro" aria-label="Compass Pro">
                <p className="lp-cpro__line">{COMPASS_PRO.title} <Link href="/pricing" prefetch={false} className="lp-link" data-commerce="">{COMPASS_PRO.cta}</Link></p>
                <details className="lp-cpro__more">
                  <summary><span>What Compass Pro adds</span><ChevronDown aria-hidden="true" /></summary>
                  <p className="lp-cpro__badge">{COMPASS_PRO.badge}</p>
                  <p className="lp-cpro__body">{COMPASS_PRO.body}</p>
                  <ul className="lp-cpro__list">
                    {COMPASS_PRO.items.map(([title, line]) => <li key={title}><b>{title}</b><span>{line}</span></li>)}
                  </ul>
                  <p className="lp-cpro__fine">{COMPASS_PRO.fine}</p>
                </details>
              </Reveal>
            </div>
          </section></Later>
        ) : null}

        {/* The real CUET 2026 papers, checked against MockMob, question by question (owner LK427, 23 Nov 2026; it replaced the
            teaser of LK368): stream tabs, subject chips, a strip of every question, NTA's question beside MockMob's. */}
        <Later><CoverageProof /></Later>

        {/* ------------------------------ PRICING --------------------------- */}
        {/* R3-D8 (owner LK109-LK111), R4-H7 (LK130-LK132): the /pricing page's one plan as a glass card under "Pro" and, round 5
            (owner, 6 Nov 2026), the receipt of everything it covers at your pace (HomePricing.jsx), counting the Key cards bank
            only while Key cards are live. Every rupee figure is the offer's, worked out, never typed. */}
        <Later><section className="lp-sec lp-sec--price" id="pricing" data-commerce="">
          <HomePricing offer={OFFER} newOffer={newOfferReleased()} firstFullMock={FIRST_FULL_MOCK_ON ? FIRST_FULL_MOCK_COPY.plan : null} from={BUILT} keyCards={KEY_CARDS ? KEY_CARDS.bank : null}
            seat={<MascotSeat station="pricing" pose="attentive" label="No rush. Free stays free." className="pip-seat--eyebrow pip-seat--center" />} />
        </section></Later>

        {/* ------------------------------ INSTAGRAM ------------------------------ */}
        <Later><section className="lp-sec" id="on-instagram">
          <div className="mm-wrap">
            <Reveal className="lp-head lp-head--left">
              <BrandStamp {...BRAND_STAMPS.instagram} />
              <h2 className="lp-h2">{INSTAGRAM_HEAD.h2}</h2>
              <p className="lp-sub">{CREATORS_SUB}</p>
            </Reveal>
            <Reveal delay={100}><CreatorReels items={rankedReels()} profileUrl={INSTAGRAM.url} handle={INSTAGRAM.handle} asOf={STATS_AS_OF} /></Reveal>
          </div>
        </section></Later>

        {/* ----------------------------- WALL OF LOVE ----------------------------- */}
        {WALL_VOICES.length > 0 ? (
          <Later><section className="lp-sec" id="wall-of-love">
            <div className="mm-wrap">
              <Reveal className="lp-head lp-head--left">
                <BrandStamp {...BRAND_STAMPS.wall} />
                <h2 className="lp-h2">{WALL_HEAD.h2}</h2>
              </Reveal>
              <Reveal delay={100}><WallOfLove voices={WALL_VOICES} /></Reveal>
            </div>
          </section></Later>
        ) : null}



        {/* -------------------------------- FAQ ----------------------------- */}
        {/* The Android app, above "Before your first mock." (owner LK367, 22 Nov 2026). Android phones only. */}
        <Later><AndroidAppNudge listed={process.env.PLAY_LISTING_PUBLIC === 'true'} /></Later>
        <Later><section className="lp-sec lp-sec--band" id="faq">
          <div className="mm-wrap lp-faq-desk">
            <Reveal className="lp-faq-desk__head">
              <h2 className="lp-h2">{FAQ_HEAD.h2}</h2>
              <Link href="#try-practice" prefetch={false} className="lp-link">Try five questions</Link>
            </Reveal>
            <Reveal className="mm-faqs">
              {/* Every answer starts closed (round 2 of 18 Nov 2026, lane home-b: an earlier change had left the first one open). */}
              {faqs.map(({ question, answer }) => (
                <details key={question} className="mm-faq" name="home-faq">
                  <summary>{question}</summary>
                  <div className="mm-faq__body">{answer}</div>
                </details>
              ))}
            </Reveal>
          </div>
        </section></Later>

        {/* ------------------------------- CLOSE ---------------------------- */}
        {/* The final card (R3-D9, owner LK110): Mobi on the paper's own grain (BrandTexture, the hero's texture; the answer-sheet
            bubbles were rejected, LK208, and removed 15 Nov 2026); Sign up free and Log in as before; while invites are on, one
            line on where a friend's invite code goes (never a code on this page). */}
        <Later><section className="lp-close">
          <BrandTexture variant="close" />
          <Reveal className="mm-wrap lp-close__inner">
            <MascotSeat station="close" pose="wave" label={CLOSE.mobi} />
            <h2 className="lp-h2 lp-h2--xl"><Marked text={CLOSE.h2} marks={[['first mock?', { mark: 'squiggle', tone: 'brand' }]]} /></h2>
            <p className="lp-sub">{CLOSE.sub}</p>
            <CloseActions invites={INVITES_LIVE} />
          </Reveal>
          {/* Every same-page link to the sample ("Try 5 questions first") lands on the live sample question, every time. */}
          <DemoJump />
          {/* The footer's Help sends guests to /#faq from any page, the site bar's "Your prep tools" to /#your-prep, the app to
              /#exam-experience: land there once the page has settled (on a phone the browser's own jump was lost). */}
          <HashSettle ids={HASH_IDS} />
        </section></Later>
      </main>
      <Later><MarketingFooter home /></Later>
      {/* Every Mobi seat on the page is a <use> of these generated poses (one finish, one copy). */}
      <Later><PipGuide /></Later>
      {/* The pictures further down, fetched ahead in idle time so nothing arrives blank (AssetWarm.jsx, 20 Nov 2026). */}
      <Later><AssetWarm /></Later>
      {/* Round 14: Mobi travels the page with a phone reader (MobiCompanion) and answers guests (AskMobiSheet, opened by the
          window event mm:ask-mobi). */}
      <Later><MobiCompanion /></Later>
      {/* Desktop only (a mouse or a trackpad): a ring that trails the arrow and answers a click (owner LK333). */}
      <Later><DesktopCursor /></Later>
      <Later><AskMobiSheet /></Later>
      {/* The phone bar (a guest: "Log in" and "Sign up free" with "No card needed" inside it, demoSignal.mjs DOCK_GO) waits until the hero's buttons have gone and steps aside while the demo, the DU teaser or the close band's actions hold the screen. It carries no Mobi: he lives in the sections' own seats, so one Mobi is ever in view (W-074). */}
      <noscript><style>{'.lp-dockgate .mm-dock{opacity:1!important;transform:none!important;pointer-events:auto!important}'}</style></noscript>
      <HeroDockGate aside=".op-gate, .lp-app, .dwk-story__stage">
        <LandingDock />
      </HeroDockGate>
    </div>
  );
}
