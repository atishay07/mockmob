import { notFound } from 'next/navigation';
import { SubjectLandingPage } from '@/components/subject/SubjectLandingPage';
import { seoMetadata } from '@/lib/seo';
import { SUBJECT_HUBS, getSubjectHub } from '@/lib/subjectHubs';
import { subjectBank, syllabusUnits } from '@/lib/subjectPages.mjs';
import { publicInventory } from '@/lib/server/inventory';

// The 15 CUET subject pages. Prerendered, then refreshed at most hourly (Next 16.2.4, the previous caching model:
// node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md, "Route segment config revalidate";
// cacheComponents is off in next.config.mjs). The question counts are the stored daily inventory row
// (src/lib/server/inventory.js publicInventory: one small read, never a count of the bank), so an hour is plenty.
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return SUBJECT_HUBS.map((hub) => ({ subject: hub.slug }));
}

export async function generateMetadata({ params }) {
  const { subject } = await params;
  const hub = getSubjectHub(subject);
  if (!hub) return {};
  return seoMetadata({ title: hub.title, description: hub.description, path: `/cuet/${hub.slug}` });
}

export default async function SubjectPage({ params }) {
  const { subject } = await params;
  const hub = getSubjectHub(subject);
  if (!hub) notFound();

  const units = syllabusUnits(hub.id);
  const inventory = await publicInventory().catch(() => null);
  const bank = subjectBank(inventory, hub.id, units);
  const others = SUBJECT_HUBS.filter((other) => other.slug !== hub.slug);

  return <SubjectLandingPage hub={hub} units={units} bank={bank} others={others} />;
}
