import '@/app/marketing.css';
import { notFound } from 'next/navigation';
import { NavBar } from '@/components/NavBar';
import { HomeFonts } from '@/components/landing/HomeFonts';
import { PageGrid } from '@/components/landing/BrandTexture';
import StoryPreview from '@/components/landing/stories/StoryPreview';
import MobiStory from '@/components/landing/stories/MobiStory.jsx';
import { mobiStory } from '@/components/landing/stories/mobiStory.mjs';
import { MISTAKE_PHOTO_ON } from '@/../data/mistake_photo.mjs';
import '@/components/brand/mobi-figure.css';
import '@/app/home-sheets.css';

export const metadata = { robots: { index: false, follow: false } };

// Development-only page for the Ask Mobi row story (owner LK365, 21 Nov 2026): the story on its stage, worked by the demo
// cursor, with the beat's line above it, in the home page's own context (the nav, the home sheets, the fonts). `?photo=off`
// draws it with the app's photo switch off (the question typed); by default it follows the switch (data/mistake_photo.mjs).
// Never available in production.
export default async function StoryMobiPreview({ searchParams }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const query = (await searchParams) || {};
  const photo = query.photo === 'off' ? false : query.photo === 'on' ? true : MISTAKE_PHOTO_ON;
  const story = mobiStory(photo);
  return (
    <div className="mm lp">
      <PageGrid />
      <HomeFonts />
      <NavBar />
      <main id="main-content">
        <StoryPreview key={photo ? 'photo' : 'typed'} title={story.title} steps={story.steps}>
          <MobiStory photo={photo} />
        </StoryPreview>
      </main>
    </div>
  );
}
