import '@/app/marketing.css';
import { notFound } from 'next/navigation';
import { NavBar } from '@/components/NavBar';
import { HomeFonts } from '@/components/landing/HomeFonts';
import { PageGrid } from '@/components/landing/BrandTexture';
import StoryPreview from '@/components/landing/stories/StoryPreview';
import RivalStory from '@/components/landing/stories/RivalStory.jsx'; // the extension matters: on Windows 'RivalStory' also matches rivalStory.mjs
import { RIVAL_STORY } from '@/components/landing/stories/rivalStory.mjs';
import '@/components/brand/mobi-figure.css';
import '@/app/home-sheets.css';

export const metadata = { robots: { index: false, follow: false } };

// Development-only review page for the Benchmarks row story (owner LK365, 21 Nov 2026): the story played by the demo cursor,
// with its lines, in the home page's own sheets, fonts and nav. Never available in production.
export default function StoryRivalPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div className="mm lp">
      <PageGrid />
      <HomeFonts />
      <NavBar />
      <main id="main-content">
        <StoryPreview title={RIVAL_STORY.title} steps={RIVAL_STORY.steps}>
          <RivalStory />
        </StoryPreview>
      </main>
    </div>
  );
}
