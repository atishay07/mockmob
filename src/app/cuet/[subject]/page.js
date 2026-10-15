import { notFound } from 'next/navigation';
import { SeoContentPage } from '@/components/SeoContentPage';
import { seoMetadata } from '@/lib/seo';
import { SUBJECT_HUBS, getSubjectHub } from '@/lib/subjectHubs';

export function generateStaticParams() {
  return SUBJECT_HUBS.map((hub) => ({ subject: hub.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }) {
  const { subject } = await params;
  const hub = getSubjectHub(subject);
  if (!hub) return {};
  return seoMetadata({
    title: hub.title,
    description: hub.description,
    path: `/cuet/${hub.slug}`,
  });
}

export default async function SubjectHubPage({ params }) {
  const { subject } = await params;
  const hub = getSubjectHub(subject);
  if (!hub) notFound();

  const otherHubs = SUBJECT_HUBS.filter((other) => other.slug !== hub.slug);

  const page = {
    slug: `cuet-${hub.slug}`,
    path: `/cuet/${hub.slug}`,
    breadcrumb: `CUET ${hub.name}`,
    subjectArt: hub.slug.replace(/-/g, '_'),
    eyebrow: hub.eyebrow,
    h1: hub.h1,
    intro: hub.intro,
    description: hub.description,
    sections: [
      ...hub.sections,
      {
        heading: `Practise CUET ${hub.name} on MockMob`,
        body: [
          `Take a timed set or a full 50-question mock, then let Radar show which ${hub.name} chapters cost you marks. Switch to NTA mode when you want the exam-day screen.`,
        ],
        links: [
          { href: '/signup', label: `Start a free ${hub.name} mock` },
          { href: '/cuet-2027', label: 'CUET 2027 exam guide' },
          { href: '/pricing', label: 'See Pro pricing' },
        ],
      },
      {
        heading: 'More CUET subject practice',
        body: ['Guides for the other CUET subjects:'],
        links: otherHubs.map((other) => ({
          href: `/cuet/${other.slug}`,
          label: `CUET ${other.name}`,
        })),
      },
    ],
    faqs: hub.faqs,
  };

  return <SeoContentPage page={page} />;
}
