import { absoluteUrl, publicRoutes } from '@/lib/seo';
import { SUBJECT_HUBS } from '@/lib/subjectHubs';
import { duCutoffCatalog } from '@/lib/du/cutoffData.server';
import { CUTOFFS_PATH, collegePath, coursePath } from '@/lib/du/cutoffPages.mjs';

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
  // The Sunday Mock's public page (src/app/sunday-mock/page.js): the next Sunday's date changes each week.
  const sundayMock = { url: absoluteUrl('/sunday-mock'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 };

  // The DU cutoff pages (src/app/du-cutoffs): the index, a page per course and per college, from the 2026 files
  // (read when the sitemap is built, as the pages are). A failed read leaves them out rather than failing the sitemap.
  const duPage = (path, priority) => ({ url: absoluteUrl(path), lastModified: now, changeFrequency: 'monthly', priority });
  let duRoutes = [];
  try {
    const du = duCutoffCatalog();
    duRoutes = [
      duPage(CUTOFFS_PATH, 0.85),
      ...du.courses.map((course) => duPage(coursePath(course.id), 0.8)),
      ...du.colleges.map((college) => duPage(collegePath(college.slug), 0.75)),
    ];
  } catch {
    duRoutes = [];
  }

  return [...staticRoutes, subjectIndex, ...subjectRoutes, daily, sundayMock, ...duRoutes];
}
