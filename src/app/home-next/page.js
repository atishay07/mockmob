import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { recoveryReleased, newOfferReleased } from '@/../data/capabilities';
import { publicOffer } from '@/lib/payments/offer';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { LandingActions } from '@/components/LandingActions';
import { HERO_LEAD, FAQ_HEAD, CLOSE, COMPASS_PRO, buildFaqs } from '@/components/landing/homeCopy.mjs';
import { DESK_NOTE, HERO_FEATURES_LABEL, heroFeatures, heroPriceHook } from '@/components/landing/heroTaps.mjs';
import { HERO_LINES } from '@/components/landing/heroLines.mjs';
import { Marked } from '@/components/doodle/Doodle';
import { INSTAGRAM, STATS_AS_OF, rankedReels } from '@/lib/social';
import { buildCompassShowcase } from '@/lib/du/showcase';
import { referralsLive } from '@/lib/referrals/friendInvite.mjs';
import { keyCardsDemo } from '@/components/landing/keyCardsPicks.mjs';
import { publicInventory } from '@/lib/server/inventory';
import { MascotSeat } from '@/components/brand/Mascot';
import { MISTAKE_PHOTO_ON } from '@/../data/mistake_photo.mjs';
import { MISTAKE_CREDITS, MISTAKE_PHOTO_CREDITS } from '@/services/mobi/mistakePrices.mjs';
import { AI_FREE_MONTHLY_CREDITS } from '@/services/credits/aiCreditWallet';
import { DAILY_FIVE_SIZE } from '@/lib/dailyFive.mjs';
// The live home's own parts, imported as they are; this page edits none of them. The sections the home sheet draws are
// re-exported from src/components/home2/landingParts.js by relative path (data/tests/css_split.test.mjs guards the '@/' form
// of some of these imports for pages that would draw them without home-sheets.css; this page imports that sheet below, after
// marketing.css, and data/tests/home_next_1120.test.mjs holds that).
import {
  BrandTexture, CloseActions, CollegeStrip, CompassLadder, CreatorReels, DemoDrill, DemoJump, DesktopCursor, DesktopNote,
  HashSettle, HeroBeatStrip, HeroDockGate, HeroFilm, HeroMark, HeroMobi, HeroProof, HeroRoom, HeroTyped, HomeFonts,
  HomePricing, LandingDock, MobiCompanion, MobiPoster, OpeningMo, PageGrid, PipGuide, AskMobiSheet, Reveal,
} from '@/components/home2/landingParts';
import PrepFrame from '@/components/home2/PrepFrame';
import LabBeats from '@/components/home2/LabBeats';
import Coverage from '@/components/home2/Coverage';
import RhythmRow from '@/components/home2/RhythmRow';
import SampleHere from '@/components/home2/SampleHere';
import ReadLineHere from '@/components/home2/ReadLineHere';
import { coverageModel } from '@/components/home2/coverageModel.mjs';
import { COMPASS_NEXT, COVER_HEAD, LAB_NEXT, PREP_HEAD, SOCIAL_NEXT, TRY_NEXT, coverFine, coverLead, fixPrice, freeFaq } from '@/components/home2/homeNextCopy.mjs';
// The same sheets as "/", in the same order (css_split.test.mjs), then this page's one sheet.
import '@/components/brand/mobi-figure.css';
import '../home-sheets.css';
import '@/components/home2/home-next.css';

// /home-next: the clarity-first home (spec: mockmob-brain/docs/HOME-NEXT-SPEC-2026-11-20.md and its Revision 2; owner LK360,
// LK361), built beside the live home for the owner to judge on his phone. Phone first. Never indexed, linked from nowhere and
// not in the sitemap; the live home (src/app/page.js) is not changed by it.
//
// Its one server read is the stored daily question counts (publicInventory: one small row, never a count of the bank), the
// same read and the same hour of caching as the /cuet subject pages, for the coverage section's figures.
export const revalidate = 3600;

export const metadata = {
  title: 'MockMob: the next home page (preview)',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

const Later = ({ children }) => <Suspense fallback={null}>{children}</Suspense>;

const OFFER = publicOffer();
const BUILT = new Date();
const INVITES_LIVE = referralsLive();
const SHOWCASE = buildCompassShowcase();
const MOB_LIVE = process.env.MOB_ENABLED === 'true' && process.env.MOB_V3_ENABLED === 'true';
const KEY_CARDS = process.env.KEY_CARDS_ENABLED === 'true' ? keyCardsDemo() : null;
// The FAQ as on "/", with "What do I get free?" after its first question, answered from the code's constants (Revision 2).
const FAQS = (() => {
  const all = buildFaqs({ offer: OFFER, mobLive: MOB_LIVE });
  return [all[0], freeFaq({ freeCredits: AI_FREE_MONTHLY_CREDITS, dailySize: DAILY_FIVE_SIZE }), ...all.slice(1)];
})();
// The hero keeps only Ask Mobi from its features strip (Revision 2: the one frame shows the features once, LK198; Ask Mobi
// stays reachable without signing up, LK239), and the price hook from the live offer with its circle and three flicks (LK342).
const ASK_MOBI = heroFeatures({ compass: SHOWCASE.programmes.length > 0, keyCards: Boolean(KEY_CARDS) }).filter((item) => item.ask);
const PRICE_HOOK = heroPriceHook(OFFER, { from: BUILT });
// What a brought mistake costs, from the app's own numbers (the price line the live home's Bring a mistake block shows).
const FIX_PRICE = fixPrice({ photo: MISTAKE_PHOTO_ON, credits: MISTAKE_CREDITS, photoCredits: MISTAKE_PHOTO_CREDITS, free: AI_FREE_MONTHLY_CREDITS });

// The Aim screen of the one frame: DU's own 2026 Round 1 cutoffs for B.Com. (Hons.), general category, five colleges spread
// from the highest cutoff to the lowest of the showcase, against one example score (said as an example on the screen).
const AIM_SCORE = 860;
function aimData(showcase) {
  const programme = showcase.programmes[0];
  if (!programme) return null;
  const rows = programme.rows
    .map((r) => ({ college: r.college, cutoff: r.cutoffs['round-1']?.UR }))
    .filter((r) => typeof r.cutoff === 'number')
    .sort((a, b) => b.cutoff - a.cutoff);
  if (rows.length < 5) return null;
  const pick = [0, 2, 5, 7, rows.length - 1].map((i) => rows[Math.min(i, rows.length - 1)]);
  return { programme: programme.label, category: 'General', round: 'Round 1', cycle: '2026', score: AIM_SCORE, max: 1000, rows: pick };
}
const AIM = aimData(SHOWCASE);

export default async function HomeNextPage() {
  const inventory = await publicInventory().catch(() => null);
  const cover = coverageModel(inventory);
  const lead = coverLead(cover?.totals.questions);
  return (
    <div className="mm lp hn">
      <OpeningMo />
      <PageGrid />
      <HomeFonts />
      <noscript>
        <style>{'.rv,.rv-item,.lp-hero [data-hero]{opacity:1!important;transform:none!important}.lp-room__file{opacity:1!important}.lp-film__keys{display:none}'}</style>
      </noscript>
      <NavBar />
      <ReadLineHere />
      <main id="main-content">
        <DesktopNote />
        {/* ------------------------------ 1. HERO (as on "/", without the six-item strip) ------------------------------ */}
        <section className="lp-hero">
          <BrandTexture variant="hero" />
          <div className="mm-wrap lp-hero__grid">
            <div className="lp-hero__copy">
              <h1 className="lp-title">
                {recoveryReleased() ? <><span className="lp-title__line">Find the mistake</span>{' '}<span className="lp-title__line">behind the marks.</span></> : <>
                <span className="lp-title__line lp-title__brand">{HERO_LINES[0]}</span>{' '}
                <span className="lp-title__line"><HeroMark>{HERO_LINES[1]}</HeroMark></span>{' '}
                <HeroTyped />
                </>}
              </h1>
              <p className="lp-lead">
                {recoveryReleased() ? 'Find the missing step. Practise it. Check it on fresh questions. Built for CUET Commerce and English.' : <><b>{HERO_LEAD.strong}</b>{HERO_LEAD.rest}</>}
              </p>
              <div className="lp-cta">
                <LandingActions />
              </div>
              <HeroProof />
            </div>
            <HeroFilm />
            <HeroBeatStrip items={ASK_MOBI} label={HERO_FEATURES_LABEL} hook={PRICE_HOOK} />
            {/* The DU calculator's link left the hero (Revision 2 lists what the hero keeps); it stays one tap away in DU
                Compass ("Check my subjects") and in the footer's free tools. */}
          </div>
        </section>

        {/* ------------------------------ 2. COLLEGES ------------------------------ */}
        <Later><CollegeStrip /></Later>

        {/* ------------------------------ 3. THE ONE FRAME: four parts ------------------------------ */}
        {/* id "your-prep": the guide's waypoint for this part of the page (PipGuide.jsx WAYPOINTS), and Ask Mobi's no-script link. */}
        <Later><section className="lp-sec hn-sec hn-sec--prep" id="your-prep" aria-labelledby="prep-title">
          <div className="mm-wrap">
            <Reveal className="lp-head lp-head--left hn-head">
              <h2 className="lp-h2" id="prep-title"><Marked text={PREP_HEAD.h2} marks={[[PREP_HEAD.mark, { mark: 'underline', tone: 'brand' }]]} /></h2>
            </Reveal>
            <PrepFrame aim={AIM} price={FIX_PRICE} />
          </div>
        </section></Later>

        {/* ------------------------------ 4. TRY FIVE QUESTIONS (the working sample, as on "/") ------------------------------ */}
        <Later><section className="lp-sec lp-try" id="try" aria-labelledby="try-title">
          <div className="mm-wrap lp-try__wrap">
            <div className="lp-head lp-try__head">
              <h2 className="lp-h2" id="try-title"><Marked text={TRY_NEXT.h2} marks={[['five', { mark: 'double' }]]} /></h2>
              <p className="lp-sub">{TRY_NEXT.sub}</p>
            </div>
            <div className="lp-desk" id="try-practice">
              <div className="lp-desk__stage">
                <HeroRoom />
                <HeroMobi poster={<MobiPoster id="desk" />} />
              </div>
              <div className="lp-desk__card">
                <DemoDrill note={DESK_NOTE} />
              </div>
            </div>
          </div>
        </section></Later>

        {/* ------------------------------ 5. THE MISTAKE LAB, four beats ------------------------------ */}
        {/* id "inside-the-lab": the guide's Lab waypoint, and the live home's own address for the Lab. */}
        <Later><section className="lp-sec hn-sec hn-sec--lab" id="inside-the-lab" aria-labelledby="lab-title">
          <div className="mm-wrap">
            <Reveal className="lp-head lp-head--left hn-head">
              <h2 className="lp-h2" id="lab-title"><Marked text={LAB_NEXT.h2} marks={[[LAB_NEXT.mark, { mark: 'squiggle', tone: 'brand' }]]} /></h2>
            </Reveal>
            <LabBeats />
          </div>
        </section></Later>

        {/* ------------------------------ 6. COVERAGE (only while the stored counts can back it) ------------------------------ */}
        {cover ? (
          <Later><section className="lp-sec hn-sec hn-sec--cover" id="coverage" aria-labelledby="cover-title">
            <div className="mm-wrap">
              <div className="lp-guide-head hn-cover__headrow">
                <Reveal className="lp-head lp-head--left hn-head">
                  <h2 className="lp-h2" id="cover-title">{COVER_HEAD.h2}</h2>
                  <p className="lp-sub hn-cover__sum">{lead.claim}{lead.count ? <>, with <b className="hn-cover__figure">{lead.count}</b> questions in the live bank.</> : '.'}</p>
                </Reveal>
                <MascotSeat station="coverage" pose="magnifier" label="Tap a chapter to see its count." />
              </div>
              <Coverage model={cover} />
              <p className="hn-cover__fine">{coverFine({ covered: cover.totals.covered, chapters: cover.totals.chapters, countedOn: cover.countedOn })}</p>
            </div>
          </section></Later>
        ) : null}

        {/* ------------------------------ Daily Five and Sunday Mock, one slim row ------------------------------ */}
        <Later><RhythmRow /></Later>

        {/* ------------------------------ 7. DU COMPASS (as on "/") ------------------------------ */}
        {SHOWCASE.programmes.length > 0 ? (
          <Later><section className="lp-sec" id="compass">
            <div className="mm-wrap">
              <div className="lp-guide-head lp-guide-head--lead"><Reveal className="lp-head lp-head--left">
                <h2 className="lp-h2"><Marked text={COMPASS_NEXT.h2} marks={[['real cutoffs.', { mark: 'double' }]]} /></h2>
                <p className="lp-sub">{COMPASS_NEXT.sub}</p>
              </Reveal><MascotSeat station="compass" pose="pointing" label="Got a dream college? Let’s look." /></div>
              <Reveal delay={100}><CompassLadder data={SHOWCASE} /></Reveal>
              <Reveal as="aside" className="lp-cpro" aria-label="Compass Pro">
                <p className="lp-cpro__line">{COMPASS_PRO.title} <Link href="/pricing" className="lp-link" data-commerce="">{COMPASS_PRO.cta}</Link></p>
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

        {/* ------------------------------ 8. PRICING (as on "/"; no free-first-mock line, Revision 2) ------------------------------ */}
        <Later><section className="lp-sec lp-sec--price" id="pricing" data-commerce="">
          <HomePricing offer={OFFER} newOffer={newOfferReleased()} firstFullMock={null} from={BUILT} keyCards={KEY_CARDS ? KEY_CARDS.bank : null}
            seat={<MascotSeat station="pricing" pose="attentive" label="No rush. Free stays free." className="pip-seat--eyebrow pip-seat--center" />} />
        </section></Later>

        {/* ------------------------------ 9. PROOF, then FAQ, then the close ------------------------------ */}
        {/* The creators (no consented student quote exists: Revision 2). Its id is theirs, so the hero's proof link lands here. */}
        <Later><section className="lp-sec" id="on-instagram" aria-labelledby="proof-title">
          <div className="mm-wrap">
            <Reveal className="lp-head lp-head--left">
              <h2 className="lp-h2" id="proof-title">{SOCIAL_NEXT.h2}</h2>
              <p className="lp-sub">{SOCIAL_NEXT.sub}</p>
            </Reveal>
            <Reveal delay={100}><CreatorReels items={rankedReels()} profileUrl={INSTAGRAM.url} handle={INSTAGRAM.handle} asOf={STATS_AS_OF} /></Reveal>
          </div>
        </section></Later>

        <Later><section className="lp-sec lp-sec--band" id="faq">
          <div className="mm-wrap lp-faq-desk">
            <Reveal className="lp-faq-desk__head">
              <h2 className="lp-h2">{FAQ_HEAD.h2}</h2>
              <Link href="#try-practice" className="lp-link">Try five questions</Link>
            </Reveal>
            <Reveal className="mm-faqs">
              {FAQS.map(({ question, answer }) => (
                <details key={question} className="mm-faq" name="home-faq">
                  <summary>{question}</summary>
                  <div className="mm-faq__body">{answer}</div>
                </details>
              ))}
            </Reveal>
          </div>
        </section></Later>

        <Later><section className="lp-close">
          <BrandTexture variant="close" />
          <Reveal className="mm-wrap lp-close__inner">
            <MascotSeat station="close" pose="wave" label={CLOSE.mobi} />
            <h2 className="lp-h2 lp-h2--xl"><Marked text={CLOSE.h2} marks={[['first mock?', { mark: 'squiggle', tone: 'brand' }]]} /></h2>
            <p className="lp-sub">{CLOSE.sub}</p>
            <CloseActions invites={INVITES_LIVE} />
          </Reveal>
          <DemoJump />
          <HashSettle />
        </section></Later>
      </main>
      <Later><MarketingFooter home /></Later>
      <Later><PipGuide /></Later>
      <Later><MobiCompanion /></Later>
      <Later><DesktopCursor /></Later>
      <Later><AskMobiSheet /></Later>
      <SampleHere />
      <noscript><style>{'.lp-dockgate .mm-dock{opacity:1!important;transform:none!important;pointer-events:auto!important}'}</style></noscript>
      <HeroDockGate>
        <LandingDock />
      </HeroDockGate>
    </div>
  );
}
