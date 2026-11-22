import '@/app/marketing.css';
import { notFound } from 'next/navigation';
import { NavBar } from '@/components/NavBar';
import { HomeFonts } from '@/components/landing/HomeFonts';
import { PageGrid } from '@/components/landing/BrandTexture';
import { BrandStamp } from '@/components/landing/BrandStamp';
import { Marked } from '@/components/doodle/Doodle';
import { LAB_HEAD, BRAND_STAMPS } from '@/components/landing/homeCopy.mjs';
import LabCinema from '@/components/landing/LabCinema';
import '@/components/brand/mobi-figure.css';
import '@/app/home-sheets.css';

export const metadata = { robots: { index: false, follow: false } };

// Development-only review page for the Mistake Lab's "next" look (LabCinema look="next"): the Lab in the home page's own
// context (the nav, the home sheets, the section and its head as src/app/page.js draws them), with a plain block above and
// below so the held story can be scrolled into and out of. Never available in production.
// `?look=default` draws the earlier set of screens (LabCinema's default look), for side-by-side review (22 Nov 2026).
export default async function LabNextPreview({ searchParams }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const look = (await searchParams)?.look === 'default' ? undefined : 'next';
  return (
    <div className="mm lp">
      <PageGrid />
      <HomeFonts />
      <NavBar />
      <main id="main-content">
        <div className="mm-wrap" style={{ minHeight: '70svh', display: 'grid', alignContent: 'center' }}>
          <p className="lp-sub">Preview: the Mistake Lab, next look. Scroll down.</p>
        </div>
        <section className="lp-sec lp-sec--cinema lp-pos-host" id="inside-the-lab" aria-labelledby="inside-the-lab-title">
          <div className="mm-wrap">
            <div className="lp-head lp-head--left lp-cinema-head">
              <BrandStamp {...BRAND_STAMPS.lab} />
              <h2 className="lp-h2" id="inside-the-lab-title"><Marked text={LAB_HEAD.h2} marks={[['a moment.', { mark: 'squiggle', tone: 'brand' }]]} /></h2>
              <p className="lp-sub">{LAB_HEAD.sub}</p>
            </div>
          </div>
          <LabCinema look={look} />
        </section>
        <div className="mm-wrap" style={{ minHeight: '90svh' }} />
      </main>
    </div>
  );
}
