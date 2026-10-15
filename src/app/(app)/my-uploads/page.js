export const dynamic = "force-dynamic";

import { permanentRedirect } from 'next/navigation';

// /my-uploads is Your submissions, the second tab of Contribute questions (web IA plan 2.4). The redirect is
// also declared in data/route_moves.mjs, which IA9 turns into a 308 in next.config.mjs; this keeps the old
// address working until then.
export default function MyUploadsPage() {
  permanentRedirect('/upload?tab=mine');
}
