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

  const subjectRoutes = SUBJECT_HUBS.map((hub) => ({
    url: absoluteUrl(`/cuet/${hub.slug}`),
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  const appRoute = absoluteUrl('/app');
  const appRoutes = staticRoutes.some((route) => route.url === appRoute)
    ? []
    : [{ url: appRoute, lastModified: now, changeFrequency: 'monthly', priority: 0.6 }];

  return [...staticRoutes, ...appRoutes, ...subjectRoutes];
}
