import { permanentRedirect } from 'next/navigation';

// The old wallet page now lives on /pricing as "Two kinds of credits" (web IA plan 2.4). The same
// 308 is also wired in next.config.mjs from data/route_moves.mjs; this keeps the old address working
// if that wiring is ever removed. Dynamic so the redirect is a real 308 response, not a prerender.
export const dynamic = 'force-dynamic';

export default function OldCreditsPage() {
  permanentRedirect('/pricing#ai-credits');
}
