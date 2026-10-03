import { GET as get } from '@/app/api/attempts/[id]/route';
import { withMobileCors } from '@/lib/server/mobileCors';
export { OPTIONS } from '@/lib/server/mobileCors';
export const GET=withMobileCors(get);
