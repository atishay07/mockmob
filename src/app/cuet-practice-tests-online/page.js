import { SeoContentPage } from '@/components/SeoContentPage';
import { seoMetadata } from '@/lib/seo';
import { seoPages } from '@/lib/seoPages';

const page = seoPages.practiceTests;

export const metadata = seoMetadata({
  title: 'CUET Practice Tests Online for UG Preparation | MockMob',
  description: page.description,
  path: page.path,
});

export default function CuetPracticeTestsOnlinePage() {
  return <SeoContentPage page={page} />;
}
