export const dynamic = "force-dynamic";

import { permanentRedirect } from 'next/navigation';

// /my-uploads is Your submissions, the second tab of Contribute questions (web IA plan 2.4).
// next.config.mjs answers first with the same 308 from data/route_moves.mjs (it keeps the query); this
// page is the fallback if that wiring is ever removed.
export default function MyUploadsPage() {
  permanentRedirect('/upload?tab=mine');
}
