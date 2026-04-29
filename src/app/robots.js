import { absoluteUrl, siteConfig } from '@/lib/seo';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/creator',
          '/dashboard',
          '/analytics',
          '/moderation',
          '/my-uploads',
          '/profile',
          '/saved',
          '/test',
          '/upload',
          '/result/',
          '/auth/',
          '/onboarding',
          '/create-subscription',
          '/verify-payment',
          '/webhook',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteConfig.url,
  };
}
