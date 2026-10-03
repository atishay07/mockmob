import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, seoMetadata, siteConfig } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Contact MockMob — Support and Payment Questions',
  description:
    'Contact MockMob for account help, payment questions, and reports about a practice question.',
  path: '/contact',
});

const CHANNELS = [
  {
    title: 'Student support',
    body: 'Account access, mock issues, credits, or anything broken. Include the email you signed up with.',
    subject: 'Support%20request',
    note: 'Include the email on your account so we can find the right record.',
  },
  {
    title: 'Payments and refunds',
    body: 'Charged but access not active, duplicate payment, or a refund request. Include your Razorpay payment ID if you have it.',
    subject: 'Payment%20issue',
    note: 'Include your Razorpay payment ID if you have it. Do not send card or bank credentials.',
  },
  {
    title: 'Report a wrong question',
    body: 'Spotted a possible answer-key or question issue? Send the question text or a screenshot so we can investigate it.',
    subject: 'Question%20report',
    note: 'Uncertain content is held until its evidence checks are complete.',
  },
  {
    title: 'Partnership enquiries',
    body: 'For school, institute, or creator enquiries, describe the idea and the audience you have in mind.',
    subject: 'Partnership',
    note: 'We will review the request and reply if there is a fit.',
  },
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
              No ticket walls, no chatbots pretending to help. Pick the lane that matches your
              question so it lands with the right context.
            </p>
          </div>
        </section>

        <section className="mm-section">
          <div className="mm-wrap mm-wrap--tight">
            <ul className="mm-channels">
              {CHANNELS.map((channel) => (
                <li key={channel.title} className="mm-channel">
                  <h2 className="mm-h3">{channel.title}</h2>
                  <p className="mm-channel__body">{channel.body}</p>
                  <a
                    className="mm-btn mm-btn--secondary mm-channel__cta"
                    href={`mailto:${siteConfig.email}?subject=${channel.subject}`}
                  >
                    {siteConfig.email}
                  </a>
                  <p className="mm-channel__note">{channel.note}</p>
                </li>
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
      <MobileDock note="Support replies within 24h." />
    </div>
  );
}
