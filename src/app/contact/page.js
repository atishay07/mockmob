import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { PublicHero } from '@/components/PublicPage';
import { buttonClass } from '@/components/ui/Button';
import { breadcrumbJsonLd, seoMetadata, siteConfig } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Contact MockMob: support and payment questions',
  description:
    'Contact MockMob for account help, payment questions, and reports about a practice question.',
  path: '/contact',
});

// Each lane is a different mail subject, so the message lands with the right context.
const CHANNELS = [
  {
    title: 'Student support',
    body: 'Account access, mock issues, credits, or anything broken. Include the email you signed up with.',
    action: 'Email support',
    subject: 'Support%20request',
    note: 'Include the email on your account so we can find the right record.',
  },
  {
    title: 'Payments and refunds',
    body: 'Charged but access not active, duplicate payment, or a refund request. Include your Razorpay payment ID if you have it.',
    action: 'Email about a payment',
    subject: 'Payment%20issue',
    note: 'Include your Razorpay payment ID if you have it. Do not send card or bank credentials.',
  },
  {
    title: 'Report a wrong question',
    body: 'Spotted a possible answer-key or question issue? Send the question text or a screenshot so we can investigate it.',
    action: 'Report a question',
    subject: 'Question%20report',
    note: 'Uncertain content is held until its evidence checks are complete.',
  },
  {
    title: 'Partnership enquiries',
    body: 'For school, institute, or creator enquiries, describe the idea and the audience you have in mind.',
    action: 'Email about a partnership',
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

      <main id="main-content">
        <PublicHero
          enter
          title="Tell us what happened."
          lead="No ticket walls, no chatbots pretending to help. Pick the lane that matches your question so it lands with the right context."
        />

        <section className="pp-section" style={{ paddingTop: 0 }} aria-label="Ways to reach us">
          <div className="mm-wrap">
            <ul className="pp-lanes">
              {CHANNELS.map((channel) => (
                <li key={channel.title} className="pp-lane">
                  <div className="pp-lane__copy">
                    <h2 className="pp-h3">{channel.title}</h2>
                    <p className="pp-lane__body">{channel.body}</p>
                    <p className="pp-lane__note">{channel.note}</p>
                  </div>
                  <a
                    className={buttonClass({ variant: 'secondary', size: 'lg' })}
                    href={`mailto:${siteConfig.email}?subject=${channel.subject}`}
                  >
                    {channel.action}
                  </a>
                </li>
              ))}
            </ul>

            <p className="pp-small" style={{ marginTop: '2rem', maxWidth: '64ch' }}>
              Every lane goes to {siteConfig.email}. You can also reach us on{' '}
              <a
                className="pp-link"
                href="https://www.instagram.com/mockmob.in/"
                target="_blank"
                rel="noreferrer"
              >
                Instagram
              </a>
              . For policy details, see{' '}
              <Link href="/terms" className="pp-link">Terms</Link>,{' '}
              <Link href="/privacy" className="pp-link">Privacy</Link>, and{' '}
              <Link href="/refunds" className="pp-link">Refunds</Link>.
            </p>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <MobileDock note="Questions? Email us." />
    </div>
  );
}
