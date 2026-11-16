import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { PublicDock } from '@/components/PublicDock';
import { JsonLd } from '@/components/JsonLd';
import { PublicHeroArt, PUBLIC_HERO_CSS } from '@/components/landing/PublicHeroArt';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { signupPathFor, loginPathFor } from '@/lib/auth-redirect';
import { sundayMockEnabled } from '@/lib/sundayFlag.mjs';
import SundayNext from './SundayNext';
import { LAST_START, OPENS, PAPER_FIGURES, SUNDAY_STEPS } from './sundayHow.mjs';

// The Sunday Mock's public page (15 Nov 2026): what it is, when the next one is, and the way in. No question is shown here:
// the paper is the same for everyone that Sunday and stays on the server. The date line is the one live part (SundayNext).
export const metadata = seoMetadata({
  title: 'CUET Sunday Mock: one full paper every Sunday, free | MockMob',
  description:
    'Every Sunday from 10:00 AM to 10:00 PM, one full CUET paper in each of your subjects, the same for everyone. 50 questions, 60 minutes, marked +5 and −1. Free with a MockMob account.',
  path: '/sunday-mock',
});

export default function SundayMockPublicPage() {
  if (!sundayMockEnabled()) notFound();
  const next = '/sunday';
  return (
    <div className="mm sm-page">
      <JsonLd id="sunday-breadcrumb-json-ld" data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Sunday Mock', path: '/sunday-mock' }])} />
      <NavBar />
      <main id="main-content">
        <section className="mm-section mm-section--flush" style={{ paddingTop: '2.5rem' }}>
          <div className="mm-wrap mm-wrap--tight pub-hero">
            <div>
              <h1 className="mm-h1">The Sunday Mock.</h1>
              <p className="mm-lead" style={{ marginTop: '1rem', maxWidth: '52ch' }}>
                One full CUET paper in each of your subjects, every Sunday from {OPENS} to {LAST_START}. Everyone sits the same paper. Free.
              </p>
              <SundayNext />
              <div className="mm-actions" style={{ marginTop: '1.5rem' }}>
                <Link href={signupPathFor(next)} className="mm-btn mm-btn--primary">Sign up free</Link>
                <Link href={loginPathFor(next)} className="mm-btn mm-btn--secondary">Log in</Link>
              </div>
            </div>
            <PublicHeroArt kind="subjects" />
          </div>
        </section>

        {/* How a Sunday goes (16 Nov 2026, evening): the paper as three figures, then the day as a timeline (sundayHow.mjs).
            It was six headings over six paragraphs, which the owner read as a wall of text. */}
        <section className="mm-section sm-how" aria-labelledby="sm-how-title">
          <div className="mm-wrap mm-wrap--tight">
            <h2 className="mm-h2" id="sm-how-title">How a Sunday goes.</h2>
            <ul className="sm-figs" aria-label="The paper">
              {PAPER_FIGURES.map((f) => <li key={f.unit}><b>{f.figure}</b><span>{f.unit}</span></li>)}
            </ul>
            <ol className="sm-day">
              {SUNDAY_STEPS.map((step) => (
                <li key={step.title} className="sm-day__step">
                  <span className="sm-day__when">{step.when}</span>
                  <span className="sm-day__dot" aria-hidden="true" />
                  <div className="sm-day__what">
                    <h3>{step.title}</h3>
                    <p>{step.line}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
      <MarketingFooter />
      <PublicDock />
      <style>{`${PUBLIC_HERO_CSS}
        .sm-page .sm-when { margin-top: 1.25rem; }
        .sm-page .sm-next { min-height: 1.5em; margin: 0.75rem 0 0; font: 650 1rem/1.5 var(--font-display); color: var(--brand-word, var(--ink)); font-variant-numeric: tabular-nums; }
        /* The paper in three figures: the number large, its unit under it, on one hairline. */
        .sm-page .sm-figs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 12px; margin: 1.5rem 0 0; padding: 0 0 1.25rem; list-style: none; border-bottom: 1px solid var(--line-strong); }
        .sm-page .sm-figs li { display: grid; gap: 4px; align-content: start; min-width: 0; }
        .sm-page .sm-figs b { color: var(--ink); font: 800 clamp(2.25rem, 9vw, 3.25rem)/0.95 var(--font-display); letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
        .sm-page .sm-figs span { color: var(--ink-2); font-size: 0.9375rem; line-height: 1.3; }
        /* The day: the time on the left, a rail with a dot at each moment, what happens on the right. */
        .sm-page .sm-day { display: grid; margin: 1.5rem 0 0; padding: 0; list-style: none; }
        .sm-page .sm-day__step { position: relative; display: grid; grid-template-columns: 5.25rem 14px minmax(0, 1fr); column-gap: 12px; padding-bottom: 1.5rem; }
        .sm-page .sm-day__step:last-child { padding-bottom: 0; }
        .sm-page .sm-day__when { padding-top: 1px; color: var(--ink); font: 750 0.9375rem/1.4 var(--font-display); font-variant-numeric: tabular-nums; text-align: right; }
        .sm-page .sm-day__dot { position: relative; justify-self: center; width: 12px; height: 12px; margin-top: 5px; border-radius: 50%; background: var(--ink); }
        .sm-page .sm-day__step:first-child .sm-day__dot { background: var(--volt); box-shadow: inset 0 0 0 1.5px var(--ink); }
        .sm-page .sm-day__step:not(:last-child)::before { content: ''; position: absolute; left: calc(5.25rem + 12px + 6px); top: 19px; bottom: -3px; width: 2px; background: var(--line-strong); }
        .sm-page .sm-day__what h3 { margin: 0; color: var(--ink); font: 750 1.125rem/1.3 var(--font-display); letter-spacing: -0.01em; }
        .sm-page .sm-day__what p { margin: 0.25rem 0 0; max-width: 46ch; color: var(--ink-2); font-size: 1rem; line-height: 1.5; text-wrap: pretty; }
        @media (min-width: 720px) {
          .sm-page .sm-figs { max-width: 34rem; gap: 0 24px; }
          .sm-page .sm-day__step { grid-template-columns: 7rem 14px minmax(0, 1fr); column-gap: 16px; padding-bottom: 1.75rem; }
          .sm-page .sm-day__step:not(:last-child)::before { left: calc(7rem + 16px + 6px); }
          .sm-page .sm-day__when { font-size: 1rem; }
        }
      `}</style>
    </div>
  );
}
