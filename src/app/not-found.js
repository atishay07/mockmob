// The root not-found page: a URL that matches no route. The signed-in app has its own (src/app/(app)/not-found.js, the shell
// stays); this one is for everything else, themed so a Night student never gets the default white page.
import SiteNotFound from '@/components/SiteNotFound';

export const metadata = { title: 'Page not found | MockMob' };

export default function NotFound() {
  return <SiteNotFound />;
}
