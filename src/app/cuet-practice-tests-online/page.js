import { SeoContentPage } from '@/components/SeoContentPage';
import { seoMetadata } from '@/lib/seo';
import { seoPages } from '@/lib/seoPages';

const page = seoPages.practiceTests;

// The paper facts card's bank line is the stored daily count (src/lib/server/inventory.js publicInventory, one small read),
// so the guide is prerendered, then refreshed at most hourly, like the subject pages (src/app/cuet/[subject]/page.js).
export const revalidate = 3600;

export const metadata = seoMetadata({
  title: 'CUET Practice Tests Online for UG Preparation | MockMob',
  description: page.description,
  path: page.path,
});

export default function CuetPracticeTestsOnlinePage() {
  return <SeoContentPage page={page} />;
}
