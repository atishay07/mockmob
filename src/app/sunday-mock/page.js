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

// The Sunday Mock's public page (15 Nov 2026): what it is, when the next one is, and the way in. No question is shown here:
// the paper is the same for everyone that Sunday and stays on the server. The date line is the one live part (SundayNext).
export const metadata = seoMetadata({
  title: 'CUET Sunday Mock: one full paper every Sunday, free | MockMob',
  description:
    'Every Sunday from 10:00 AM to 10:00 PM, one full CUET paper in each of your subjects, the same for everyone. 50 questions, 60 minutes, marked +5 and −1. Free with a MockMob account.',
  path: '/sunday-mock',
});

const HOW = [
  { title: 'A full paper, as CUET sets it', body: '50 questions in 60 minutes, marked +5 for right and −1 for wrong, in each subject you study.' },
  { title: 'The same paper for everyone', body: 'Every student sitting a subject that Sunday gets the same questions, so you can talk it over with friends after it closes.' },
  { title: 'Open all day Sunday', body: 'Start any time from 10:00 AM to 10:00 PM IST. A paper started by 10:00 PM keeps its full 60 minutes. One sitting a subject.' },
  { title: 'Marks at once, answers at 11:05 PM', body: 'Your marks show as soon as you send it. The answers and explanations open at 11:05 PM, once every paper started by 10:00 PM is in.' },
  { title: 'See how it went for everyone', body: 'From 11:05 PM, see how many sat the paper and, once 30 or more have, how many got each question right.' },
  { title: 'Sit it with your Mob', body: 'In a Mob, see which of your friends have sat it, and their marks if they share them.' },
];

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
                One full CUET paper in each of your subjects, every Sunday from 10:00 AM to 10:00 PM. Everyone sits the same paper. Free.
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

        <section className="mm-section">
          <div className="mm-wrap mm-wrap--tight">
            <h2 className="mm-h2">How it works.</h2>
            <dl className="mm-beliefs">
              {HOW.map((item) => (
                <div key={item.title} className="mm-belief">
                  <dt>{item.title}</dt>
                  <dd>{item.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <MarketingFooter />
      <PublicDock />
      <style>{`${PUBLIC_HERO_CSS}
        .sm-page .sm-next { min-height: 1.5em; margin: 1rem 0 0; font: 650 1rem/1.5 var(--font-display); color: var(--brand-word, var(--ink)); font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}
