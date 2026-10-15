import { permanentRedirect } from 'next/navigation';

// The preview-passcode page is retired (web IA plan 2.4). Nothing links to it any more. next.config.mjs
// answers first with the same 308 from data/route_moves.mjs; this page is the fallback.
export const dynamic = 'force-dynamic';

export default function RetiredComingSoonPage() {
  permanentRedirect('/');
}
