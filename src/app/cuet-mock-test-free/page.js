import { SeoContentPage } from '@/components/SeoContentPage';
import { seoMetadata } from '@/lib/seo';
import { seoPages } from '@/lib/seoPages';

const page = seoPages.freeMockTest;

export const metadata = seoMetadata({
  title: 'CUET Mock Test Free Online | MockMob',
  description: page.description,
  path: page.path,
});

export default function CuetMockTestFreePage() {
  return <SeoContentPage page={page} />;
}
