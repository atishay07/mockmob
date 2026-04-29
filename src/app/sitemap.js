import { absoluteUrl, publicRoutes } from '@/lib/seo';

export default function sitemap() {
  const now = new Date();

  return publicRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.path === '/' ? 'daily' : 'weekly',
    priority: route.priority,
  }));
}
