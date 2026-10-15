import { permanentRedirect } from 'next/navigation';

// /features is retired (web IA plan 2.4, N9). Its tour of product areas is now "How it works" on the
// home page. It is out of publicRoutes and the sitemap; this 308 keeps old links and search results
// working. next.config.mjs carries the same redirect from data/route_moves.mjs.
export const dynamic = 'force-dynamic';

export default function RetiredFeaturesPage() {
  permanentRedirect('/#how-it-works');
}
