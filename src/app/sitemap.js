import { absoluteUrl, publicRoutes } from '@/lib/seo';
import { SUBJECT_HUBS } from '@/lib/subjectHubs';

export default function sitemap() {
  const now = new Date();

  const staticRoutes = publicRoutes
    .filter((route) => route.sitemap !== false)
    .map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: now,
      changeFrequency: route.path === '/' ? 'daily' : 'weekly',
      priority: route.priority,
    }));

  // The CUET subjects index and the 15 subject pages (src/lib/subjectPages.mjs).
  const subjectIndex = { url: absoluteUrl('/cuet'), lastModified: now, changeFrequency: 'weekly', priority: 0.85 };
  const subjectRoutes = SUBJECT_HUBS.map((hub) => ({
    url: absoluteUrl(`/cuet/${hub.slug}`),
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  // The Daily Five (src/app/daily/page.js): a new five every day at 12:00 am IST.
  const daily = { url: absoluteUrl('/daily'), lastModified: now, changeFrequency: 'daily', priority: 0.8 };

  return [...staticRoutes, subjectIndex, ...subjectRoutes, daily];
}
