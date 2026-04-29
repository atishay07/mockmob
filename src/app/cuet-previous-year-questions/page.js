import { SeoContentPage } from '@/components/SeoContentPage';
import { seoMetadata } from '@/lib/seo';
import { seoPages } from '@/lib/seoPages';

const page = seoPages.previousYearQuestions;

export const metadata = seoMetadata({
  title: 'CUET Previous Year Questions with Answers | MockMob',
  description: page.description,
  path: page.path,
});

export default function CuetPreviousYearQuestionsPage() {
  return <SeoContentPage page={page} />;
}
