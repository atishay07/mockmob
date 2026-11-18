import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import '@/app/tour-screens.css'; // the home tour's product screens, drawn here as they are (FeatureScreen)
import '@/app/pub-pages.css';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { PublicHeroArt, PUBLIC_HERO_CSS } from '@/components/landing/PublicHeroArt';
import { Marked } from '@/components/doodle/Doodle';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { Unfold } from '@/components/landing/Unfold';
import { PUBLIC_MARKS } from '@/lib/publicMarks.mjs';
import { FeatureScreen } from './FeatureScreen';

// What MockMob does, as a catalogue of screens, not of paragraphs (19 Nov 2026, lane pub-c). The nine parts keep their names,
// words and links; they sit in three groups. A part the home tour has a true product screen for leads with that screen
// (TourScreens.jsx, its finished state, nothing playing by itself): on a phone the screen is the part's first thing, as wide as
// the column, then its title, its words and its link on one left edge; from 900 px the screen and the words sit side by side,
// alternating sides down the page. The parts with no screen are compact rows: their desk object in a paper tile, then the
// words. A body longer than three lines on a 390 px phone shows its first sentence and keeps the rest behind "More" (Unfold:
// closed on a phone, open from 720 px), so no part is a wall; every word stays in the page. One volt key: the closing one.
// Your standing keeps words and a desk object: the tour's Benchmark screen shows a target score, not a rank (lane report).
export const metadata = seoMetadata({
  title: 'CUET Practice Features, Chapter Review & Admission Compass | MockMob',
  description: 'What MockMob does for CUET UG: timed practice marked +5 / −1, the NTA-style screen, mistake review, chapter review, saved questions, Ask Mobi and the free DU cutoff calculator.',
  path: '/features',
});

const PARTS = [
  {
    title: 'Practice',
    screen: 'arena',
    body: 'Quick practice of 5 to 20 questions, or a 50-question Full mock in 60 minutes, timed and marked +5 / −1 the way CUET marks it. Close the tab mid-test and pick up where you left off.',
    href: '/signup', link: 'Sign up free',
  },
  {
    title: 'NTA mode',
    icon: 'papers',
    body: 'The exam-style screen, so the real paper does not feel new on the day. With Pro.',
    href: '/pricing', link: 'See Pro',
  },
  {
    title: 'Your papers and mistake repair',
    screen: 'repair',
    body: 'Every miss from a session lands in Your papers with its explanation. Repair one, then a fresh question on the same idea comes back later to check the fix held.',
    href: '/signup', link: 'Sign up free',
  },
  {
    title: 'Chapter review',
    screen: 'radar',
    body: 'Your misses traced back to their chapters, built only from questions you attempted. Every mock’s review is free; across your mocks, Free ranks your top three chapters and Pro ranks every chapter, with your pace and changed answers.',
    href: '/signup', link: 'Sign up free',
  },
  {
    title: 'Saved questions',
    icon: 'saved',
    body: 'Keep the questions that deserve another go and practise their chapter from the same row. 25 on Free.',
    href: '/signup', link: 'Sign up free',
  },
  {
    title: 'Ask Mobi',
    screen: 'prepos',
    body: 'One next step from your own practice record, sized to the time you have. Questions about your record are free; a Mobi job (a mistake fixed for good, or a doubt answered and tested) uses 1 credit from your one balance, and everyone gets 50 free a month.',
    href: '/pricing/ai-credits', link: 'How credits work',
  },
  {
    title: 'DU cutoff calculator',
    screen: 'compass',
    body: 'Which DU courses your CUET subjects open under the 2026 Bulletin rules, and the published 2026 cutoffs by category and round. Free for everyone, no account needed.',
    href: '/cuet-cutoff-calculator', link: 'Open the calculator',
  },
  {
    title: 'Subject combination planner',
    screen: 'combo',
    body: 'Pick the courses you want and the subjects you could take; it ranks the combinations that keep those courses open.',
    href: '/cuet-subject-combination', link: 'Plan your subjects',
  },
  {
    title: 'Your standing',
    icon: 'you',
    body: 'Your own rank among MockMob students, from your recorded mocks. You see your rank and your average; no other student’s name is shown. It is separate from your CUET exam rank.',
    href: '/signup', link: 'Sign up free',
  },
];

const GROUPS = [
  { title: 'Practise', parts: ['Practice', 'NTA mode', 'Saved questions', 'Your standing'] },
  { title: 'Fix what you missed', parts: ['Your papers and mistake repair', 'Chapter review', 'Ask Mobi'] },
  { title: 'Free DU tools', parts: ['DU cutoff calculator', 'Subject combination planner'] },
];

// More than three lines at 390 px (measured 19 Nov 2026: a screen part's words run 350 px wide, a row's 270 px).
const FOLD_AT = { screen: 140, row: 105 };

/** The first sentence, and the rest (null when the body is short enough to stand whole). */
function splitBody(body, limit) {
  if (body.length <= limit) return [body, null];
  const m = /^(.+?[.;])\s+(.+)$/s.exec(body);
  return m ? [m[1], m[2]] : [body, null];
}

function Words({ part, limit }) {
  const [lead, rest] = splitBody(part.body, limit);
  return (
    <div className="fx-words">
      <h3>{part.title}</h3>
      <p>{lead}</p>
      {rest ? <Unfold from={720} className="fx-more" summary="More"><p>{rest}</p></Unfold> : null}
      <Link href={part.href} className="mm-link">{part.link}</Link>
    </div>
  );
}

// The screens alternate sides down the whole page (from 900 px), counted across the groups.
const byTitle = new Map(PARTS.map((part) => [part.title, part]));
const SCREEN_ORDER = GROUPS.flatMap((g) => g.parts).filter((t) => byTitle.get(t).screen);
const slug = (text) => `fx-${text.replace(/\W+/g, '-').toLowerCase()}`;
const LAYOUT = GROUPS.map((group) => ({
  ...group,
  id: slug(group.title),
  shown: group.parts.filter((t) => byTitle.get(t).screen).map((t) => ({ part: byTitle.get(t), flip: SCREEN_ORDER.indexOf(t) % 2 === 1 })),
  rows: group.parts.filter((t) => !byTitle.get(t).screen).map((t) => byTitle.get(t)),
}));

export default function FeaturesPage() {
  return (
    <div className="mm">
      <JsonLd
        id="features-breadcrumb-json-ld"
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Features', path: '/features' },
        ])}
      />
      <NavBar />

      <main>
        <section className="mm-section mm-section--flush ft-hero" style={{ paddingTop: '2.5rem' }}>
          <div className="mm-wrap mm-wrap--tight fx-wrap fx-hero pub-hero">
            <div>
              <h1 className="mm-h1">What MockMob does</h1>
              <p className="mm-lead" style={{ marginTop: '1rem' }}>
                <Marked text="CUET UG practice that shows where your marks went and what to do next, plus free tools for DU admissions." marks={[PUBLIC_MARKS.features.head]} />
              </p>
            </div>
            <PublicHeroArt kind="subjects" />
          </div>
        </section>

        <section className="mm-section fx">
          <div className="mm-wrap fx-wrap">
            {LAYOUT.map((group) => (
              <section key={group.title} className="fx-group" aria-labelledby={group.id}>
                <h2 className="mm-h2 fx-group__h" id={group.id}>{group.title}</h2>
                {group.shown.map(({ part, flip }) => (
                  <article key={part.title} className="fx-part" data-flip={flip || undefined}>
                    <div className="fx-shot"><FeatureScreen id={part.screen} /></div>
                    <Words part={part} limit={FOLD_AT.screen} />
                  </article>
                ))}
                {group.rows.length ? (
                  <ul className="fx-rows">
                    {group.rows.map((part) => (
                      <li key={part.title} className="fx-row">
                        <span className="fx-tile"><BrandIcon name={part.icon} size={48} /></span>
                        <Words part={part} limit={FOLD_AT.row} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
            <p className="fx-go">
              <Link href="/signup" className="mm-btn mm-btn--primary">Sign up free</Link>
            </p>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <style>{PUBLIC_HERO_CSS}</style>
    </div>
  );
}
