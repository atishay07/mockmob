import { permanentRedirect } from 'next/navigation';

// The preview-passcode page is retired (web IA plan 2.4). Nothing links to it any more.
export const dynamic = 'force-dynamic';

export default function RetiredComingSoonPage() {
  permanentRedirect('/');
}
