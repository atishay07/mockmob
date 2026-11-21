import '@/app/marketing.css';
import { notFound } from 'next/navigation';
import { NavBar } from '@/components/NavBar';
import { HomeFonts } from '@/components/landing/HomeFonts';
import { PageGrid } from '@/components/landing/BrandTexture';
import StoryPreview from '@/components/landing/stories/StoryPreview';
import LearnStory from '@/components/landing/stories/LearnStory.jsx';
import { LEARN_STORY } from '@/components/landing/stories/learnStory.mjs';
import STUDY_RELEASE from '@/../data/study/release.json';
import '@/components/brand/mobi-figure.css';
import '@/app/home-sheets.css';

export const metadata = { robots: { index: false, follow: false } };

// The props the home page passes (src/app/page.js STUDY_LESSONS and STUDY_SUBJECTS), counted the same way.
const LESSONS = Object.keys(STUDY_RELEASE.units || {}).length;
const SUBJECTS = new Set(Object.keys(STUDY_RELEASE.units || {}).map((id) => id.split('-')[0])).size;

// Development-only page for the Learn row's story (owner LK365, 21 Nov 2026): the story played by the demo cursor, with its
// beat lines, in the home page's own sheets and fonts. Never available in production.
export default function StoryLearnPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div className="mm lp">
      <PageGrid />
      <HomeFonts />
      <NavBar />
      <main id="main-content">
        <StoryPreview title={LEARN_STORY.title} steps={LEARN_STORY.steps}>
          <LearnStory lessons={LESSONS} subjects={SUBJECTS} />
        </StoryPreview>
      </main>
    </div>
  );
}
