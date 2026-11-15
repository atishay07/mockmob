import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import DailyFive from '@/components/daily/DailyFive';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
// The sample card's own sheets, in the home page's order (src/app/page.js), so the Daily Five's card is drawn by the same rules.
import '@/app/landing.css';
import '@/app/hero-scene.css';
import '@/app/r10-sample.css';
import '@/app/r13-motion.css';

// The Daily Five (15 Nov 2026, lane F-A): the same five CUET questions for everyone each day, free and without an account.
// The page is static; the five come from GET /api/daily (src/app/api/daily/route.js), which serves only questions the home
// page sample already shows (src/lib/server/dailyFive.js).
export const metadata = seoMetadata({
  title: 'CUET Daily Five: 5 free questions a day | MockMob',
  description:
    'Five CUET questions from English and the General Test, the same for everyone today. Free, no sign-up, each answer explained. Share your score and come back tomorrow.',
  path: '/daily',
});

export default function DailyFivePage() {
  return (
    <div className="mm lp dly-page">
      <JsonLd id="daily-breadcrumb-json-ld" data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Daily Five', path: '/daily' }])} />
      <NavBar />
      <main id="main-content">
        <section className="lp-try dly" aria-label="Daily Five">
          <div className="mm-wrap">
            <div className="dly__col">
              <DailyFive />
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
