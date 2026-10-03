import { GET as get } from '@/app/api/auth/me/route';
import { withMobileCors } from '@/lib/server/mobileCors';
export { OPTIONS } from '@/lib/server/mobileCors';
export const GET=withMobileCors(get);
