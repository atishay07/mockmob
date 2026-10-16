import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, seoMetadata, siteConfig } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Contact MockMob — Support and Payment Questions',
  description:
    'Contact MockMob for account help, payment questions, and reports about a practice question.',
  path: '/contact',
});

// One address and one action; then what to put in the email for each kind of question, as a plain list.
const TOPICS = [
  ['Account or a mock', 'Account access, mock issues, credits or anything broken. Include the email you signed up with.'],
  ['Payment or refund', 'Charged but access not active, a duplicate payment or a refund request. Include your Razorpay payment ID if you have it. Never send card or bank details.'],
  ['A wrong question', 'A possible answer-key or question issue. Send the question text or a screenshot. Uncertain content is held until its checks are complete.'],
  ['Partnerships', 'School, institute or creator enquiries. Describe the idea and the audience you have in mind.'],
];

export default function ContactPage() {
  return (
    <div className="mm">
      <JsonLd
        id="contact-breadcrumb-json-ld"
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Contact', path: '/contact' },
        ])}
      />
      <NavBar />

      <main>
        <section className="mm-section mm-section--flush" style={{ paddingTop: '2.5rem' }}>
          <div className="mm-wrap mm-wrap--tight">
            <h1 className="mm-h1">Tell us what happened.</h1>
            <p className="mm-lead" style={{ marginTop: '1rem', maxWidth: '48ch' }}>
              Email {siteConfig.email}. We reply within a day.
            </p>
            <p style={{ marginTop: '1.5rem' }}>
              <a className="mm-btn mm-btn--primary" href={`mailto:${siteConfig.email}?subject=MockMob%20support`}>Email support</a>
            </p>

            <h2 className="mm-h3" style={{ marginTop: '2.5rem' }}>What to include</h2>
            <ul className="ct-list">
              {TOPICS.map(([title, body]) => (
                <li key={title}><b>{title}</b><span>{body}</span></li>
              ))}
            </ul>

            <p className="mm-small" style={{ marginTop: '2.5rem' }}>
              You can also reach us on{' '}
              <a
                className="mm-link"
                href="https://www.instagram.com/mockmob.in/"
                target="_blank"
                rel="noreferrer"
              >
                Instagram
              </a>
              . For policy details, see{' '}
              <Link href="/terms" className="mm-link">
                Terms
              </Link>
              ,{' '}
              <Link href="/privacy" className="mm-link">
                Privacy
              </Link>
              , and{' '}
              <Link href="/refunds" className="mm-link">
                Refunds
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <style>{`
        .ct-list { list-style: none; margin: 1rem 0 0; padding: 0; border-bottom: 1px solid var(--line); }
        .ct-list li { display: grid; gap: 0.25rem; padding: 1rem 0; border-top: 1px solid var(--line); }
        .ct-list b { font: 700 1rem/1.35 var(--font-display); color: var(--ink); }
        .ct-list span { max-width: 64ch; font-size: 0.9375rem; line-height: 1.6; color: var(--ink-2); }
      `}</style>
    </div>
  );
}
