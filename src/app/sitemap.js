import { absoluteUrl, publicRoutes } from '@/lib/seo';
import { SUBJECT_HUBS } from '@/lib/subjectHubs';
import { duCutoffCatalog } from '@/lib/du/cutoffData.server';
import { CUTOFFS_PATH, collegePath, coursePath } from '@/lib/du/cutoffPages.mjs';
import { KEY_CARDS_PATH } from '@/lib/keycardsPublic.mjs';
import { publicKeyCards } from '@/lib/server/keycardsPublic';
import { loadCorrections } from '@/../data/corrections.mjs';

export default async function sitemap() {
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

  // The public Key card decks (src/app/key-cards): the index and each chapter with a free card, the same list the pages are
  // built from (src/lib/keycardsPublic.mjs). A failed read leaves them out rather than failing the sitemap.
  let keyCardRoutes = [];
  try {
    const decks = await publicKeyCards();
    if (decks.subjects.length) {
      keyCardRoutes = [
        { url: absoluteUrl(KEY_CARDS_PATH), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
        ...decks.subjects.flatMap((s) => s.chapters.map((c) => ({ url: absoluteUrl(c.path), lastModified: now, changeFrequency: 'monthly', priority: 0.7 }))),
      ];
    }
  } catch {
    keyCardRoutes = [];
  }

  // The corrections log (src/app/corrections): it changes when an entry is added, so its date is the newest entry's.
  const latestCorrection = loadCorrections().latest;
  const corrections = { url: absoluteUrl('/corrections'), lastModified: latestCorrection ? new Date(`${latestCorrection}T00:00:00+05:30`) : now, changeFrequency: 'monthly', priority: 0.5 };

  return [...staticRoutes, subjectIndex, ...subjectRoutes, daily, sundayMock, corrections, ...duRoutes, ...keyCardRoutes];
}
