import { handleSunday } from '@/lib/server/sunday/http';
import { sundayDeps } from '@/lib/server/sunday/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// GET ?mob=: this week's Sunday Mock in the Mob's subject for the den: who sat, marks as each member shares them.
export const GET = (request) => handleSunday(sundayDeps(), 'mob', request);
