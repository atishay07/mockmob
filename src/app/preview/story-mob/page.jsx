import '@/app/marketing.css';
import { notFound } from 'next/navigation';
import { NavBar } from '@/components/NavBar';
import { HomeFonts } from '@/components/landing/HomeFonts';
import { PageGrid } from '@/components/landing/BrandTexture';
import StoryPreview from '@/components/landing/stories/StoryPreview';
// MobStory.jsx and mobStory.mjs differ only in case and extension: on Windows an extensionless import resolves to the .mjs
// (no default export), so the component is imported with its extension.
import MobStory from '@/components/landing/stories/MobStory.jsx';
import { MOB_STORY } from '@/components/landing/stories/mobStory.mjs';
import { publicSample } from '@/components/landing/sampleFive.mjs';
import '@/components/brand/mobi-figure.css';
import '@/app/home-sheets.css';

export const metadata = { robots: { index: false, follow: false } };

// Development-only page for the Mob row's story (owner LK365, 21 Nov 2026): MobStory played by the demo cursor in the home
// page's own context (nav, home sheets, fonts). The fresh question is read here on the server, as page.js reads it for the
// frame (publicSample('Economics')). Never available in production.
export default function StoryMobPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  const sample = publicSample('Economics');
  return (
    <div className="mm lp">
      <PageGrid />
      <HomeFonts />
      <NavBar />
      <main id="main-content">
        <StoryPreview title={MOB_STORY.title} steps={MOB_STORY.steps}>
          <MobStory sample={sample} />
        </StoryPreview>
        <p className="lp-sub" style={{ textAlign: 'center', margin: '0 auto 80px', maxWidth: '36rem' }}>{MOB_STORY.chip}</p>
      </main>
    </div>
  );
}
