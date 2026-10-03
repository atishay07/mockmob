import { POST as post } from '@/app/api/auth/email-login/route';
import { withMobileCors } from '@/lib/server/mobileCors';
export { OPTIONS } from '@/lib/server/mobileCors';
export const POST=withMobileCors(post);
