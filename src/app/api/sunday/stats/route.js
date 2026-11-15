import { handleSunday } from '@/lib/server/sunday/http';
import { sundayDeps } from '@/lib/server/sunday/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// GET ?week=&subject=: after the close, how many sat and the share who got each question right (from 30 sitters).
export const GET = (request) => handleSunday(sundayDeps(), 'stats', request);
