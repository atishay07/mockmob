'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

// The public footer's Help link. /help sits behind sign-in, so a guest goes to the landing's public questions instead
// of a login wall (release 9, L-013); a signed-in student keeps /help with its tour and FAQ.
export const GUEST_HELP_HREF = '/#faq';
export const STUDENT_HELP_HREF = '/help';

export function FooterHelpLink({ children = 'Help' }) {
  const { isAuthenticated } = useAuth();
  return <Link href={isAuthenticated ? STUDENT_HELP_HREF : GUEST_HELP_HREF}>{children}</Link>;
}

export default FooterHelpLink;
