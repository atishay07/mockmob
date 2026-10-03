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
    eyebrow: hub.eyebrow,
    h1: hub.h1,
    intro: hub.intro,
    description: hub.description,
    sections: [
      ...hub.sections,
      {
        heading: `Practise CUET ${hub.name} on MockMob`,
        body: [
          `Where practice is available, use a timed drill and review your attempt history to choose what to revisit. Access follows current inventory and plan rules. MockMob NTA Mode uses original practice content; CUET UG 2027 rules remain provisional until NTA publishes its bulletin.`,
        ],
        links: [
          { href: '/signup', label: `Start a free ${hub.name} mock` },
          { href: '/cuet-2027', label: 'CUET 2027 exam guide' },
          { href: '/pricing', label: 'See Pro pricing' },
        ],
      },
      {
        heading: 'More CUET subject practice',
        body: ['Explore the published subject guides below. Confirm the final 2027 paper choices with NTA and check programme requirements with the university:'],
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
