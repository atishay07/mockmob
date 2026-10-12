import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { AppCta } from '@/components/app/AppCta';
import { getAppCta } from '@/components/app/appLinks';
import { APP_FEATURES } from '@/components/app/appFeatures';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import '@/components/app/app.css';

export const metadata = seoMetadata({
  title: 'MockMob Android app',
  description: 'The MockMob Android app adds a next step for tonight, a recap after each mock, reminders only for real tasks, a home-screen widget and offline review.',
  path: '/app',
});

export default function AppPage() {
  // 'none' is explained by AppCta's own note, so it is not repeated here.
  const state = getAppCta().state;
  const lede = state === 'beta' ? 'The app is in a closed test.' : '';
  return (
    <div className="mm">
      <JsonLd id="app-breadcrumb-json-ld" data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Android app', path: '/app' }])} />
      <NavBar />
      <main>
        <section className="mm-section mm-section--flush" style={{ paddingTop: '2.5rem' }}>
          <div className="mm-wrap mm-wrap--tight">
            <h1 className="mm-h1">MockMob on Android.</h1>
            <p className="mm-lead" style={{ marginTop: '1rem', maxWidth: '52ch' }}>
              The same practice, with the parts that help you come back tonight.{lede ? ` ${lede}` : ''}
            </p>
            <div style={{ marginTop: '1.5rem' }}>
              <AppCta />
            </div>
          </div>
        </section>

        <section className="mm-section">
          <div className="mm-wrap mm-wrap--tight">
            <h2 className="mm-h2">What the app adds.</h2>
            <ul className="app-list" style={{ marginTop: '1.5rem' }}>
              {APP_FEATURES.map((f) => (
                <li key={f.title}>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mm-section mm-section--sunken">
          <div className="mm-wrap mm-wrap--tight">
            <h2 className="mm-h2">Your data, your choice.</h2>
            <p className="mm-body" style={{ marginTop: '1rem' }}>
              Usage data is optional and off unless an adult chooses to turn it on. You can ask us to delete your account at any time.
            </p>
            <div className="app-page-links">
              <Link href="/account-deletion" className="mm-link">Delete your account</Link>
              <Link href="/privacy" className="mm-link">Privacy policy</Link>
            </div>
            <p className="mm-body" style={{ marginTop: '1.5rem', fontSize: '.875rem' }}>
              MockMob is an independent practice platform. It is not affiliated with NTA or Delhi University.
            </p>
          </div>
        </section>
      </main>
      <MarketingFooter />
      <MobileDock note="Practice that follows you home." />
    </div>
  );
}
